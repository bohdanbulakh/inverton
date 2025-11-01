import { Writable } from 'stream';
import { RedisLemmaService } from '../redis-lemma-service';

const CSV_SEPARATOR = ';';

export class LemmaRedisLoader extends Writable {
  private batch: [string, string][] = [];

  constructor (
    private readonly redisService: RedisLemmaService,
    private readonly langCode: string,
    private readonly batchSize = 1000
  ) {
    super({ objectMode: true });
  }

  override _write (
    chunk: string | Buffer,
    _encoding: string,
    callback: (error?: Error | null) => void
  ): void {
    const line = chunk.toString();

    const fields = line.split(CSV_SEPARATOR);
    if (fields.length < 2) {
      return callback();
    }

    const [term, lemma] = fields;

    if (!term || !lemma || term === '_' || lemma === '_' || term === lemma) {
      return callback();
    }

    this.batch.push([term, lemma]);

    if (this.batch.length >= this.batchSize) {
      this.flushBatch().then(() => callback()).catch(callback);
    } else {
      callback();
    }
  }

  override async _final (callback: (err?: Error | null) => void) {
    try {
      await this.flushBatch();
      callback();
    } catch (err) {
      callback(err as Error);
    }
  }

  private async flushBatch (): Promise<void> {
    if (this.batch.length === 0) {
      return;
    }

    await this.redisService.setMany(this.langCode, this.batch);
    this.batch = [];
  }
}
