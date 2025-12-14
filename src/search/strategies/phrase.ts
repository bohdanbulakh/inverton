import { DocumentInfoService } from '../document-info-service';

export const searchPhrase = async (
  terms: string[],
  searchService: DocumentInfoService,
): Promise<Map<string, number>> => {
  const docScores = new Map<string, number>();

  const docSets = await Promise.all(terms.map((t) => searchService.getDocIdsForTerm(t)));

  if (docSets.some((ids) => ids.length === 0)) {
    return docScores;
  }

  let candidateDocs = docSets[0];
  for (let i = 1; i < docSets.length; i++) {
    const currentSet = new Set(docSets[i]);
    candidateDocs = candidateDocs.filter((id) => currentSet.has(id));
  }

  if (candidateDocs.length === 0) {
    return docScores;
  }

  for (const docId of candidateDocs) {
    const positionsMap = new Map<string, number[]>();

    for (const term of terms) {
      const entries = await searchService.getTermPositions(term, docId);
      const positions = entries.map((e) => parseInt(e.split(':')[1], 10)).sort((a, b) => a - b);
      positionsMap.set(term, positions);
    }

    if (hasPhraseMatch(terms, positionsMap)) {
      docScores.set(docId, 1.0);
    }
  }

  return docScores;
};

const hasPhraseMatch = (terms: string[], positionsMap: Map<string, number[]>): boolean => {
  const firstTermPositions = positionsMap.get(terms[0]) || [];

  for (const startPos of firstTermPositions) {
    let isMatch = true;
    for (let i = 1; i < terms.length; i++) {
      const nextTermPositions = positionsMap.get(terms[i]);
      if (!nextTermPositions?.includes(startPos + i)) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) return true;
  }
  return false;
};
