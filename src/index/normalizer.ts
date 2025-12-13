import { Transform, TransformCallback } from 'stream';
import { RedisClient } from '../redis/client/client';
import { NormalizedToken, Token } from './types';

export class TermNormalizerStream extends Transform {
  private batch: Token[] = [];
  private readonly batchSize = 200;

  constructor (
    private readonly redis: RedisClient,
    private readonly lang: string
  ) {
    super({ objectMode: true });
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

    const lemmas = await this.fetchLemmas(this.batch);
    const isStopWordFlags = await this.checkStopWords(lemmas);

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

  private async fetchLemmas (tokens: Token[]): Promise<string[]> {
    const pipeline = this.redis.pipeline();

    for (const token of tokens) {
      pipeline.get(`${token.term.toLowerCase()}:${this.lang}`);
    }

    const results = await pipeline.exec();

    if (!results) {
      return tokens.map((t) => t.term.toLowerCase());
    }

    return results.map((result, i) => {
      const [err, val] = result;
      if (err) {
        console.error(`Error fetching lemma for "${tokens[i].term}":`, err);
        return tokens[i].term.toLowerCase();
      }
      return val ? (val as string) : tokens[i].term.toLowerCase();
    });
  }

  private async checkStopWords (lemmas: string[]): Promise<boolean[]> {
    const pipeline = this.redis.pipeline();

    for (const lemma of lemmas) {
      pipeline.get(`sw:${this.lang}:${lemma}`);
    }

    const results = await pipeline.exec();

    if (!results) {
      return new Array(lemmas.length).fill(false);
    }

    return results.map((result, i) => {
      const [err, val] = result;
      if (err) {
        console.error(`Error fetching stop word status for "${lemmas[i]}":`, err);
        return false;
      }
      return val !== null;
    });
  }
}
