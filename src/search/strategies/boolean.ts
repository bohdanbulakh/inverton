import { DocumentInfoService } from '../document-info/document-info.interface';
import { SearchStrategy } from '.';

export const searchBoolean: SearchStrategy = async (
  terms: string[],
  searchService: DocumentInfoService,
): Promise<Map<string, number>> => {
  const docSets = await Promise.all(terms.map((t) => searchService.getDocIdsForTerm(t)));

  const docScores = new Map<string, number>();

  if (docSets.some((ids) => ids.length === 0)) {
    return docScores;
  }

  let resultDocs = docSets[0];
  for (let i = 1; i < docSets.length; i++) {
    const currentSet = new Set(docSets[i]);
    resultDocs = resultDocs.filter((id) => currentSet.has(id));
  }

  resultDocs.forEach((docId) => docScores.set(docId, 1.0));

  return docScores;
};
