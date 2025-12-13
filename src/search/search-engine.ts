import { RedisClient } from '../redis/client/client';
import { SearchResult, SearchOptions } from './types';
import { Normalizer } from '../index/normalizer';

import { WORD_REGEX } from '../index/tokenizer';

export class SearchEngine {
  private readonly normalizer: Normalizer;

  constructor (private readonly redisClient: RedisClient) {
    this.normalizer = new Normalizer(redisClient);
  }

  async search (query: string, options: SearchOptions): Promise<SearchResult[]> {
    const rawTerms = query.match(WORD_REGEX) || [];
    if (rawTerms.length === 0) {
      return [];
    }

    const terms = await this.normalizer.normalizeTerms(rawTerms);
    if (terms.length === 0) {
      return [];
    }

    const docScores = new Map<string, number>();
    const totalDocs = await this.getTotalDocuments();

    for (const lemma of terms) {
      const docIds = await this.getDocIdsForTerm(lemma);
      if (docIds.length === 0) continue;

      const idf = Math.log10(totalDocs / docIds.length);

      for (const docId of docIds) {
        const tf = await this.getTermFrequency(lemma, docId);
        const score = tf * idf;
        const currentScore = docScores.get(docId) || 0;
        docScores.set(docId, currentScore + score);
      }
    }

    const results: SearchResult[] = Array.from(docScores.entries())
      .map(([docId, score]) => ({ docId, score }))
      .sort((a, b) => b.score - a.score);

    if (options.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  private async getDocIdsForTerm (lemma: string): Promise<string[]> {
    return this.redisClient.smembers(`idx:${lemma}`);
  }

  private async getTermFrequency (lemma: string, docId: string): Promise<number> {
    return this.redisClient.llen(`idx:${lemma}:${docId}`);
  }

  private async getTotalDocuments (): Promise<number> {
    const count = await this.redisClient.get('total_docs');
    return count ? parseInt(count, 10) : 1;
  }
}
