import type { DocumentInfoService } from '../../../src/search/document-info/document-info.interface';
import { searchBoolean } from '../../../src/search/strategies';

function makeDocInfoService (index: Record<string, string[]>): {
  svc: DocumentInfoService;
  getDocIdsForTerm: jest.Mock<Promise<string[]>, [string]>;
} {
  const getDocIdsForTerm = jest.fn(async (term: string) => index[term] ?? []);

  const svc: DocumentInfoService = {
    getTotalDocuments: jest.fn(async () => 1),
    getDocIdsForTerm,
    getTermPositions: jest.fn(async () => []),
    getTermFrequency: jest.fn(async () => 0),

    getLemma: jest.fn(async (term: string) => null),
    isStopWord: jest.fn(async (lemma: string) => false),
    getLemmas: jest.fn(async (terms: string[]) => []),
    areStopWords: jest.fn(async (lemmas: string[]) => []),
  };

  return { svc, getDocIdsForTerm };
}

function scoresToIds (map: Map<string, number>): string[] {
  return [...map.keys()].sort();
}

describe('searchBoolean', () => {
  it.concurrent('returns empty map for empty terms', async () => {
    const { svc, getDocIdsForTerm } = makeDocInfoService({});
    const res = await searchBoolean([], svc);
    expect(res.size).toBe(0);
    expect(getDocIdsForTerm).not.toHaveBeenCalled();
  });

  describe('basic operators', () => {
    it.concurrent('AND: intersection of doc sets', async () => {
      const { svc } = makeDocInfoService({
        a: ['1', '2', '3'],
        b: ['2', '3', '4'],
      });

      const res = await searchBoolean(['a', 'AND', 'b'], svc);
      expect(scoresToIds(res)).toEqual(['2', '3']);
    });

    it.concurrent('OR: union of doc sets', async () => {
      const { svc } = makeDocInfoService({
        a: ['1', '2'],
        b: ['2', '3'],
      });

      const res = await searchBoolean(['a', 'OR', 'b'], svc);
      expect(scoresToIds(res)).toEqual(['1', '2', '3']);
    });

    it.concurrent('NOT with positive universe: "a AND NOT b" => a \\ b', async () => {
      const { svc } = makeDocInfoService({
        a: ['1', '2', '3'],
        b: ['2'],
      });

      const res = await searchBoolean(['a', 'AND', 'NOT', 'b'], svc);
      expect(scoresToIds(res)).toEqual(['1', '3']);
    });

    it.concurrent('NOT only query: "NOT a" => empty when universe seeded by allTerms (=a)', async () => {
      const { svc } = makeDocInfoService({
        a: ['1', '2'],
      });

      const res = await searchBoolean(['NOT', 'a'], svc);
      expect(scoresToIds(res)).toEqual([]);
    });
  });

  describe('precedence and parentheses via tokens', () => {
    it.concurrent('AND binds tighter than OR: a OR b AND c', async () => {
      const { svc } = makeDocInfoService({
        a: ['1'],
        b: ['1', '2'],
        c: ['2'],
      });

      const res = await searchBoolean(['a', 'OR', 'b', 'AND', 'c'], svc);
      expect(scoresToIds(res)).toEqual(['1', '2']);
    });

    it.concurrent('parentheses override precedence: (a OR b) AND c', async () => {
      const { svc } = makeDocInfoService({
        a: ['1'],
        b: ['2', '3'],
        c: ['1', '2'],
      });

      const res = await searchBoolean(['(', 'a', 'OR', 'b', ')', 'AND', 'c'], svc);
      expect(scoresToIds(res)).toEqual(['1', '2']);
    });

    it.concurrent('nested: a AND (b OR (c AND d))', async () => {
      const { svc } = makeDocInfoService({
        a: ['1', '2', '3', '4'],
        b: ['9'],
        c: ['2', '3'],
        d: ['3', '7'],
      });

      const res = await searchBoolean(
        ['a', 'AND', '(', 'b', 'OR', '(', 'c', 'AND', 'd', ')', ')'],
        svc,
      );
      expect(scoresToIds(res)).toEqual(['3']);
    });
  });

  describe('flattened n-ary behavior', () => {
    it.concurrent('long AND chain stays flat semantically', async () => {
      const { svc } = makeDocInfoService({
        a: ['1', '2', '3'],
        b: ['2', '3'],
        c: ['3', '4'],
      });

      const res = await searchBoolean(['a', 'AND', 'b', 'AND', 'c'], svc);
      expect(scoresToIds(res)).toEqual(['3']);
    });

    it.concurrent('long OR chain stays flat semantically', async () => {
      const { svc } = makeDocInfoService({
        a: ['1'],
        b: ['2'],
        c: ['2', '3'],
      });

      const res = await searchBoolean(['a', 'OR', 'b', 'OR', 'c'], svc);
      expect(scoresToIds(res)).toEqual(['1', '2', '3']);
    });
  });

  describe('universe selection logic (critical for NOT)', () => {
    it.concurrent('universe uses positiveTerms if any exist (NOT terms excluded from seed)', async () => {
      const { svc } = makeDocInfoService({
        a: ['1', '2', '3'],
        b: ['2'],
        c: ['999'],
      });

      const res = await searchBoolean(['a', 'AND', 'NOT', '(', 'b', 'OR', 'c', ')'], svc);

      expect(scoresToIds(res)).toEqual(['1', '3']);
    });

    it.concurrent('if there are NO positiveTerms, universe uses allTerms (NOT-only tree)', async () => {
      const { svc } = makeDocInfoService({
        a: ['1', '2'],
        b: ['2', '3'],
      });

      const res = await searchBoolean(['NOT', '(', 'a', 'OR', 'b', ')'], svc);

      expect(scoresToIds(res)).toEqual([]);
    });
  });

  describe('caching / call counts', () => {
    it.concurrent('repeated same term hits docInfoService only once (termCache)', async () => {
      const { svc, getDocIdsForTerm } = makeDocInfoService({
        a: ['1', '2', '3'],
      });

      await searchBoolean(['a', 'AND', 'a', 'AND', 'NOT', 'a'], svc);

      expect(getDocIdsForTerm).toHaveBeenCalledTimes(1);
      expect(getDocIdsForTerm).toHaveBeenCalledWith('a');
    });

    it.concurrent('different terms are fetched once each, even if used multiple places', async () => {
      const { svc, getDocIdsForTerm } = makeDocInfoService({
        a: ['1', '2'],
        b: ['2'],
      });

      await searchBoolean(['a', 'AND', 'b', 'OR', 'a', 'AND', 'NOT', 'b'], svc);

      expect(getDocIdsForTerm).toHaveBeenCalledTimes(2);
      expect(getDocIdsForTerm.mock.calls.map(([t]) => t).sort()).toEqual(['a', 'b']);
    });
  });

  describe('edge semantics', () => {
    it.concurrent('AND can become empty quickly when any operand has empty set', async () => {
      const { svc } = makeDocInfoService({
        a: ['1'],
        b: [],
        c: ['1'],
      });

      const res = await searchBoolean(['a', 'AND', 'b', 'AND', 'c'], svc);
      expect(scoresToIds(res)).toEqual([]);
    });

    it.concurrent('OR with empty children behaves like union', async () => {
      const { svc } = makeDocInfoService({
        a: [],
        b: ['2'],
      });

      const res = await searchBoolean(['a', 'OR', 'b'], svc);
      expect(scoresToIds(res)).toEqual(['2']);
    });

    it.concurrent('NOT of unknown term (no docs) returns universe (best-effort)', async () => {
      const { svc } = makeDocInfoService({
        a: ['1', '2'],
        missing: [],
      });

      const res = await searchBoolean(['a', 'AND', 'NOT', 'missing'], svc);
      expect(scoresToIds(res)).toEqual(['1', '2']);
    });
  });
});
