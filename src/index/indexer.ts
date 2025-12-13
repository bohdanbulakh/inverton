import { Writable } from 'stream';
import { NormalizedToken } from './normalizer';
import { RedisClient } from '../redis/client/client';

export class InvertedIndexWriter extends Writable {
  private batch: NormalizedToken[] = [];
  private readonly batchSize = 200;

  constructor (
    private readonly redis: RedisClient,
    private readonly docId: string,
    private readonly lang: string
  ) {
    super({ objectMode: true });
  }

  _write (chunk: NormalizedToken, _encoding: string, callback: (error?: Error | null) => void): void {
    this.batch.push(chunk);

    if (this.batch.length >= this.batchSize) {
      this.flushBatch().then(() => callback()).catch(callback);
    } else {
      callback();
    }
  }

  _final (callback: (error?: Error | null) => void): void {
    this.flushBatch().then(() => callback()).catch(callback);
  }

  private async flushBatch (): Promise<void> {
    if (this.batch.length === 0) return;

    const pipeline = this.redis.pipeline();

    for (const token of this.batch) {
      const baseKey = `idx:${this.lang}:${token.lemma}`;

      pipeline.sadd(baseKey, this.docId);

      const infoPayload = `${token.line}:${token.pos}:${token.len}`;
      pipeline.rpush(`${baseKey}:${this.docId}`, infoPayload);
    }

    await pipeline.exec();
    this.batch = [];
  }
}
