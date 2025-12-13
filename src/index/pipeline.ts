import * as fs from 'fs';
import * as readline from 'readline';
import { pipeline } from 'stream/promises';
import { TokenizerStream } from './tokenizer';
import { TermNormalizerStream } from './normalizer';
import { RedisClient } from '../redis/client/client';
import { InvertedIndexWriter } from './indexer';

export class IndexingService {
  constructor (private readonly redisClient: RedisClient) {}

  async indexFile (filePath: string, docId: string, langCode: string): Promise<void> {
    console.time(`Indexing ${docId}`);

    try {
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });

      const lineSource = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      const tokenizer = new TokenizerStream();
      const normalizer = new TermNormalizerStream(this.redisClient, langCode);
      const indexer = new InvertedIndexWriter(this.redisClient, docId, langCode);

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
