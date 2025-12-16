export interface DocumentInfoService {
  getTotalDocuments (): Promise<number>;
  getDocIdsForTerm (term: string): Promise<string[]>;
  getTermPositions (term: string, docId: string): Promise<string[]>;
  getTermFrequency (term: string, docId: string): Promise<number>;
  getLemma(term: string): Promise<string | null>;
  getLemmas(terms: string[]): Promise<(string | null)[]>;
  isStopWord(lemma: string): Promise<boolean>;
  areStopWords(lemmas: string[]): Promise<boolean[]>;
}
