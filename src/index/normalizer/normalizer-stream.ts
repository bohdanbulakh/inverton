import { Transform, TransformCallback } from 'stream';
import { Token } from '../types';
import { RedisClient } from '../../redis/client/client';
import { NormalizedToken } from '../types';
import { Normalizer } from './normalizer';

export class TermNormalizerStream extends Transform {
  private batch: Token[] = [];
  private readonly batchSize = 200;
  private readonly normalizer: Normalizer;

  constructor (redis: RedisClient) {
    super({ objectMode: true });
    this.normalizer = new Normalizer(redis);
  }

  _transform (chunk: Token, _encoding: string, callback: TransformCallback): void {
    this.batch.push(chunk);
    if (this.batch.length >= this.batchSize) {
      this.processBatch().then(() => callback()).catch(callback);
    } else {
      callback();
    }
  }

  _flush (callback: TransformCallback): void {
    if (this.batch.length > 0) {
      this.processBatch().then(() => callback()).catch(callback);
    } else {
      callback();
    }
  }

  private async processBatch (): Promise<void> {
    if (this.batch.length === 0) return;

    const terms = this.batch.map((t) => t.term);

    const lemmas = await this.normalizer.fetchLemmas(terms);
    const isStopWordFlags = await this.normalizer.checkStopWords(lemmas);

    for (let i = 0; i < this.batch.length; i++) {
      if (!isStopWordFlags[i]) {
        const out: NormalizedToken = {
          ...this.batch[i],
          lemma: lemmas[i],
        };
        this.push(out);
      }
    }

    this.batch = [];
  }
}
