import * as fs from 'fs';
import * as readline from 'readline';
import { pipeline } from 'stream/promises';
import { RedisClient } from '../redis/client/client';
import { InvertedIndexWriter } from './indexer';
import { TermNormalizerStream } from './normalizer-stream';
import { Tokenizer } from './tokenizer';

export class IndexingService {
  constructor (private readonly redisClient: RedisClient) {}

  async indexFile (filePath: string, docId: string): Promise<void> {
    console.time(`Indexing ${docId}`);

    try {
      await this.redisClient.set(`doc:${docId}:path`, filePath);

      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });

      const lineSource = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      const tokenizer = new Tokenizer();
      const normalizer = new TermNormalizerStream(this.redisClient);
      const indexer = new InvertedIndexWriter(this.redisClient, docId);

      await pipeline(
        lineSource,
        tokenizer,
        normalizer,
        indexer
      );

      console.log(`Successfully indexed file: ${filePath}`);
    } catch (error) {
      console.error(`Failed to index file ${filePath}:`, error);
      throw error;
    } finally {
      console.timeEnd(`Indexing ${docId}`);
    }
  }
}
