import { RedisClient } from '../redis/client/client';

export interface DocumentInfoService {
  getTotalDocuments (): Promise<number>;
  getDocIdsForTerm (term: string): Promise<string[]>;
  getTermPositions (term: string, docId: string): Promise<string[]>;
  getTermFrequency (term: string, docId: string): Promise<number>;
}

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
}
