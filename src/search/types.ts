export enum SearchMode {
  Keyword = 'keyword',
  Phrase = 'phrase',
  Boolean = 'boolean'
}

export interface SearchResult {
  docId: string;
  path: string;
  score: number;
}

export interface SearchOptions {
  limit: number | null;
  mode: SearchMode | null;
}
