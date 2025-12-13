import { Writable } from 'stream';
import { RedisClient } from '../redis/client/client';
import { NormalizedToken } from './types';

export class InvertedIndexWriter extends Writable {
  private batch: NormalizedToken[] = [];
  private readonly batchSize = 200;
  private isDocCounted = false;

  constructor (
    private readonly redis: RedisClient,
    private readonly docId: string
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
    const pipeline = this.redis.pipeline();

    if (!this.isDocCounted) {
      pipeline.incr('total_docs');
      this.isDocCounted = true;
    }

    if (this.batch.length > 0) {
      for (const token of this.batch) {
        const baseKey = `idx:${token.lemma}`;

        pipeline.sadd(baseKey, this.docId);

        const infoPayload = `${token.line}:${token.position}:${token.length}`;
        pipeline.rpush(`${baseKey}:${this.docId}`, infoPayload);
      }
    }

    await pipeline.exec();
    this.batch = [];
  }
}
