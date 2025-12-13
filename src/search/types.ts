export interface SearchResult {
  docId: string;
  score: number;
}

export interface SearchOptions {
  limit: number | null;
}
