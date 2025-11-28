import { ProcessedEntry, RedisLoader } from './redis-loader';
import { RedisClient } from './client';

const CSV_SEPARATOR = ';';

export class LemmaRedisLoader extends RedisLoader {
  processEntry (chunk: string | Buffer, _encoding: string): ProcessedEntry {
    const line = chunk.toString();

    const fields = line.split(CSV_SEPARATOR);
    const [term, lemma] = fields;

    const isValueValid =
      fields.length >= 2 &&
      !!term &&
      !!lemma &&
      term !== '_' &&
      lemma !== '_' &&
      term !== lemma;

    return [`${term}:${this.langCode}`, lemma, isValueValid];
  }

  constructor (
    redisClient: RedisClient,
    private readonly langCode: string,
    batchSize = 1000
  ) {
    super(redisClient, batchSize);
  }
}
