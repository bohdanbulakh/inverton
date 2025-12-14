import { RedisClient } from '../redis/client/client';
import { SearchResult, SearchOptions, SearchMode } from './types';
import { Normalizer } from '../index/normalizer';
import { RedisDocumentInfoService } from './document-info/document-info-service';
import { searchBoolean, searchKeyword, searchPhrase, SearchStrategy } from './strategies';
import { tokenize } from '../index/tokenizer';

export class SearchEngine {
  private readonly normalizer: Normalizer;
  private readonly redisDocumentInfoService;

  constructor (private readonly redisClient: RedisClient) {
    this.normalizer = new Normalizer(redisClient);
    this.redisDocumentInfoService = new RedisDocumentInfoService(redisClient);
  }

  private searchStrategies: Record<
    SearchMode,
    SearchStrategy
  > = {
      [SearchMode.Keyword]: searchKeyword,
      [SearchMode.Phrase]: searchPhrase,
      [SearchMode.Boolean]: searchBoolean,
    };

  async search (query: string, options: SearchOptions): Promise<SearchResult[]> {
    const rawTerms = tokenize(query);
    const terms = await this.normalizer.normalizeTerms(rawTerms);

    if (terms.length === 0) {
      return [];
    }

    const mode = options.mode ?? SearchMode.Keyword;

    const docScores = await this.searchStrategies[mode](terms, this.redisDocumentInfoService);
    return this.formatResults(docScores, options.limit);
  }

  private async formatResults (docScores: Map<string, number>, limit: number | null): Promise<SearchResult[]> {
    const sortedDocs = Array.from(docScores.entries()).sort((a, b) => b[1] - a[1]);
    const results: SearchResult[] = [];
    const finalLimit = limit || sortedDocs.length;

    for (let i = 0; i < Math.min(sortedDocs.length, finalLimit); i++) {
      const [docId, score] = sortedDocs[i];
      const path = await this.redisClient.get(`doc:${docId}:path`);
      results.push({ docId, path: path || 'Unknown', score });
    }
    return results;
  }
}
