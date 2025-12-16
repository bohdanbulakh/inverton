import * as fs from 'fs';
import * as readline from 'readline';
import * as crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { RedisClient } from '../redis/client/client';
import { InvertedIndexWriter } from './indexer';
import { TermNormalizerStream } from './normalizer';
import { TokenizerStream } from './tokenizer';

export class IndexingService {
  constructor (private readonly redisClient: RedisClient) {}

  async ingestFile (filePath: string): Promise<string> {
    const docId = crypto.randomUUID();
    await this.indexFile(filePath, docId);
    return docId;
  }

  async indexFile (filePath: string, docId: string): Promise<void> {
    await this.redisClient.set(`doc:${docId}:path`, filePath);

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });

    const lineSource = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    const tokenizer = new TokenizerStream();
    const normalizer = new TermNormalizerStream(this.redisClient);
    const indexer = new InvertedIndexWriter(this.redisClient, docId);

    await pipeline(
      lineSource,
      tokenizer,
      normalizer,
      indexer
    );
  }
}
