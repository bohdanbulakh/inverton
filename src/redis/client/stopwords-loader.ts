import { ProcessedEntry, RedisLoader } from './redis-loader';
import { RedisClient } from './client';

export class StopWordsLoader extends RedisLoader {
  processEntry (chunk: string | Buffer, _encoding: string): ProcessedEntry {
    const word = chunk.toString().trim();

    const isValid = !!word && word.length > 0;

    return [`sw:${word}`, '1', isValid];
  }

  constructor (
    redisClient: RedisClient,
    batchSize = 1000
  ) {
    super(redisClient, batchSize);
  }
}
