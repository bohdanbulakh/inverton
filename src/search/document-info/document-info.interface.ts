export interface DocumentInfoService {
  getTotalDocuments (): Promise<number>;
  getDocIdsForTerm (term: string): Promise<string[]>;
  getTermPositions (term: string, docId: string): Promise<string[]>;
  getTermFrequency (term: string, docId: string): Promise<number>;
}
