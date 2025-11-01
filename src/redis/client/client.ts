import { Redis, type RedisOptions } from 'ioredis';
import * as path from 'path';
import * as readline from 'readline';
import { RedisLemmaService } from '../redis-lemma-service';
import { LemmaRedisLoader } from './lemma-loader';
import { finished } from 'node:stream/promises';
import * as fs from 'fs';
import * as unzipper from 'unzipper';
import { Readable } from 'stream';
import { AsyncQueue } from '../../async';
import * as constants from 'node:constants';

export class RedisClient extends Redis {
  private readonly redisNormalizeService: RedisLemmaService;
  private readonly lemmaLoadingPromise: Promise<void>;

  constructor (
    args: RedisOptions,
    private readonly maxLemmaLoadConcurrency: number,
    private readonly dictionariesPath: string,
  ) {
    super(args);
    this.redisNormalizeService = new RedisLemmaService(this);
    this.lemmaLoadingPromise = this.loadLemmas().catch(console.error);
  }

  async ready () {
    await this.checkArgs();
    await this.lemmaLoadingPromise;
  }

  private async checkArgs () {
    if (this.maxLemmaLoadConcurrency <= 0) {
      throw Error('maxLemmaLoadConcurrency must be greater or equal to 1');
    }

    try {
      await fs.promises.access(this.dictionariesPath, constants.F_OK);
    } catch {
      console.error(`File "${this.dictionariesPath}" does not exist.`);
    }

    try {
      await fs.promises.access(this.dictionariesPath, constants.R_OK);
    } catch {
      console.error(`File "${this.dictionariesPath}" is not readable.`);
    }
  }

  private async loadLemmas () {
    const taskQueue = new AsyncQueue(this.maxLemmaLoadConcurrency);

    const archiveStream = fs.createReadStream(this.dictionariesPath)
      .pipe(unzipper.Parse());

    await new Promise<void>((resolve, reject) => {
      archiveStream.on('error', reject);

      archiveStream.on('finish', async () => {
        try {
          await taskQueue.onDone();
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      archiveStream.on('entry', (entry: unzipper.Entry) => {

        const task = async () => {
          const fileName = entry.path;
          const type = entry.type;

          if (type !== 'File' || path.extname(fileName) !== '.csv') {
            entry.autodrain();
            return;
          }

          const langCode = path.basename(fileName, '.csv');
          try {
            const comparedHashes = await this.compareLangHashes(langCode, entry);
            if (comparedHashes.equal) {
              entry.autodrain();
              return;
            }

            await this.redisNormalizeService.deleteAllLemmas(langCode);
            await this.processFileStream(entry, langCode);
            await this.redisNormalizeService.setLemmaHash(langCode, comparedHashes.newHash);
          } catch (err) {
            console.error(`FAILED to process ${fileName}:`, err);
            entry.autodrain();
          }
        };

        taskQueue.addTasks(task);
      });
    });
  }

  private async compareLangHashes (langCode: string, entry: unzipper.Entry) {
    const oldHash = await this.redisNormalizeService.getLemmaHash(langCode);
    const newHash = entry.vars.crc32.toString(16);

    return {
      equal: oldHash === newHash,
      newHash,
      oldHash,
    };
  }

  private async processFileStream (
    fileStream: Readable,
    langCode: string,
  ): Promise<void> {
    const lemmaLoader = new LemmaRedisLoader(this.redisNormalizeService, langCode);

    const lineReader = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let isPaused = false;
    lemmaLoader.on('drain', () => {
      if (isPaused) {
        isPaused = false;
        lineReader.resume();
      }
    });

    lineReader.on('line', (line) => {
      if (!lemmaLoader.write(line)) {
        if (!isPaused) {
          isPaused = true;
          lineReader.pause();
        }
      }
    });

    fileStream.on('error', (err) => lemmaLoader.destroy(err));
    lemmaLoader.on('error', () => lineReader.close());
    lineReader.on('close', () => lemmaLoader.end());

    await finished(lemmaLoader);
  }
}

const archivePath = path.join(process.cwd(), 'data', 'dictionaries.zip');

const client = new RedisClient({
  port: 6379,
  host: 'localhost',
}, 5, archivePath);

export default client;
