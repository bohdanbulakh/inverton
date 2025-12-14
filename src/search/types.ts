export interface SearchResult {
  docId: string;
  path: string;
  score: number;
}

export interface SearchOptions {
  limit: number | null;
}
