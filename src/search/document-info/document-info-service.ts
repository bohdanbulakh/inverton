import { RedisClient } from '../../redis/client/client';
import { DocumentInfoService } from './document-info.interface';

export class RedisDocumentInfoService implements DocumentInfoService {
  constructor (private readonly redisClient: RedisClient) {}

  async getDocIdsForTerm (term: string): Promise<string[]> {
    return this.redisClient.smembers(`idx:${term}`);
  }

  async getTermFrequency (term: string, docId: string): Promise<number> {
    return this.redisClient.llen(`idx:${term}:${docId}`);
  }

  async getTermPositions (term: string, docId: string): Promise<string[]> {
    const posKey = `idx:${term}:${docId}`;
    return this.redisClient.lrange(posKey, 0, -1);
  }

  async getTotalDocuments (): Promise<number> {
    const count = await this.redisClient.get('total_docs');
    return count ? parseInt(count, 10) : 1;
  }

  async getLemma (term: string): Promise<string | null> {
    return this.redisClient.get(term.toLowerCase());
  }

  async isStopWord (lemma: string): Promise<boolean> {
    const val = await this.redisClient.get(`sw:${lemma}`);
    return val !== null;
  }

  async getLemmas (terms: string[]): Promise<(string | null)[]> {
    const pipeline = this.redisClient.pipeline();
    for (const term of terms) pipeline.get(term.toLowerCase());

    const results = await pipeline.exec();
    if (!results) return new Array(terms.length).fill(null);

    return results.map((result) => {
      const [err, val] = result;
      if (err) return null;
      return (val as string) ?? null;
    });
  }

  async areStopWords (lemmas: string[]): Promise<boolean[]> {
    const pipeline = this.redisClient.pipeline();
    for (const lemma of lemmas) pipeline.get(`sw:${lemma}`);

    const results = await pipeline.exec();
    if (!results) return new Array(lemmas.length).fill(false);

    return results.map((result) => {
      const [err, val] = result;
      if (err) return false;
      return val !== null;
    });
  }
}
