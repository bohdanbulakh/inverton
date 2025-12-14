import { DocumentInfoService } from '../document-info/document-info.interface';
import { SearchStrategy } from '.';

export const searchKeyword: SearchStrategy = async (
  terms: string[],
  searchService: DocumentInfoService,
): Promise<Map<string, number>> => {
  const docScores = new Map<string, number>();
  const totalDocs = await searchService.getTotalDocuments();

  for (const lemma of terms) {
    const docIds = await searchService.getDocIdsForTerm(lemma);
    if (docIds.length === 0) continue;

    const idf = Math.log10(totalDocs / docIds.length);

    for (const docId of docIds) {
      const tf = await searchService.getTermFrequency(lemma, docId);
      const score = tf * idf;
      const currentScore = docScores.get(docId) || 0;
      docScores.set(docId, currentScore + score);
    }
  }

  return docScores;
};
