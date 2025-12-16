import { Transform, TransformCallback } from 'stream';
import { Token, NormalizedToken } from '../types';
import { RedisClient } from '../../redis/client/client';
import { Normalizer } from './normalizer';
import { RedisDocumentInfoService } from '../../search/document-info/document-info-service';

export class TermNormalizerStream extends Transform {
  private batch: Token[] = [];
  private readonly batchSize = 200;
  private readonly normalizer: Normalizer;

  constructor (redis: RedisClient) {
    super({ objectMode: true });

    const docInfoService = new RedisDocumentInfoService(redis);
    this.normalizer = new Normalizer(docInfoService);
  }

  _transform (chunk: Token, _encoding: string, callback: TransformCallback): void {
    this.batch.push(chunk);
    if (this.batch.length >= this.batchSize) {
      this.processBatch().then(() => callback()).catch(callback);
      return;
    }

    callback();
  }

  _flush (callback: TransformCallback): void {
    if (this.batch.length === 0) {
      callback();
      return;
    }

    this.processBatch().then(() => callback()).catch(callback);
  }

  private async processBatch (): Promise<void> {
    const tokens = this.batch;
    this.batch = [];

    if (tokens.length === 0) return;

    const terms = tokens.map((t) => t.term);

    const normalized = await this.normalizer.normalizeTerms(terms, false);

    let outIdx = 0;

    for (let i = 0; i < tokens.length; i++) {
      const lemma = normalized[outIdx];

      if (lemma === undefined) break;

      if (tokens[i].term.toLowerCase() !== lemma) continue;

      const out: NormalizedToken = {
        ...tokens[i],
        lemma,
      };

      this.push(out);
      outIdx++;
    }
  }
}
