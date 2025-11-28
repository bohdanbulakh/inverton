import { Writable } from 'stream';
import { RedisClient } from './client';

export type KeyValuePair = [ key: string, value: string ];
export type ProcessedEntry = [ ...KeyValuePair, isValueValid: boolean ];

export abstract class RedisLoader extends Writable {
  private batch: KeyValuePair[] = [];

  protected constructor (
    private readonly redisClient: RedisClient,
    private readonly batchSize = 1000
  ) {
    super({ objectMode: true });
  }

  abstract processEntry(
    chunk: string | Buffer,
    _encoding: string,
  ): ProcessedEntry

  override _write (
    chunk: string | Buffer,
    _encoding: string,
    callback: (error?: Error | null) => void
  ): void {
    const [key, value, ok] = this.processEntry(chunk, _encoding);

    if (!ok) {
      return callback();
    }

    this.batch.push([key, value]);

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

    const pipeline = this.redisClient.pipeline();
    for (const [key, value] of this.batch) {
      pipeline.set(key, value);
    }
    await pipeline.exec();

    this.batch = [];
  }
}
