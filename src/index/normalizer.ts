import { RedisClient } from '../redis/client/client';

export class Normalizer {
  constructor (private readonly redis: RedisClient) {}

  async normalizeTerms (terms: string[]): Promise<string[]> {
    const lemmas = await this.fetchLemmas(terms);
    const isStopWordFlags = await this.checkStopWords(lemmas);

    const normalized: string[] = [];
    for (let i = 0; i < terms.length; i++) {
      if (!isStopWordFlags[i]) {
        normalized.push(lemmas[i]);
      }
    }
    return normalized;
  }

  async fetchLemmas (terms: string[]): Promise<string[]> {
    const pipeline = this.redis.pipeline();

    for (const term of terms) {
      pipeline.get(term.toLowerCase());
    }

    const results = await pipeline.exec();

    if (!results) {
      return terms.map((t) => t.toLowerCase());
    }

    return results.map((result, i) => {
      const [err, val] = result;
      if (err) {
        console.error(`Error fetching lemma for "${terms[i]}":`, err);
        return terms[i].toLowerCase();
      }
      return val ? (val as string) : terms[i].toLowerCase();
    });
  }

  async checkStopWords (lemmas: string[]): Promise<boolean[]> {
    const pipeline = this.redis.pipeline();

    for (const lemma of lemmas) {
      pipeline.get(`sw:${lemma}`);
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
