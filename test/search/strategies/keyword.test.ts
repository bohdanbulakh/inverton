import { DocumentInfoService } from '../../../src/search/document-info/document-info.interface';
import { searchKeyword } from '../../../src/search/strategies';

type TfTable = Record<string, Record<string, number>>; // term -> docId -> tf
type PostingTable = Record<string, string[]>; // term -> [docIds]

function makeDocInfoMock (opts: {
  totalDocs: number;
  postings: PostingTable;
  tf: TfTable;
}) {
  const { totalDocs, postings, tf } = opts;

  const svc: jest.Mocked<DocumentInfoService> = {
    getTotalDocuments: jest.fn(async () => totalDocs),
    getDocIdsForTerm: jest.fn(async (term: string) => postings[term] ?? []),
    getTermFrequency: jest.fn(async (term: string, docId: string) => tf[term]?.[docId] ?? 0),
    getTermPositions: jest.fn(async (term: string, docId: string) => []),

    getLemma: jest.fn(async (term: string) => null),
    isStopWord: jest.fn(async (lemma: string) => false),
    getLemmas: jest.fn(async (terms: string[]) => []),
    areStopWords: jest.fn(async (lemmas: string[]) => []),
  };

  return { svc };
}

function approxEqual (a: number, b: number, eps = 1e-12) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(eps);
}

function getOr0 (map: Map<string, number>, key: string) {
  return map.get(key) ?? 0;
}

describe('searchKeyword', () => {
  it.concurrent('returns empty map when terms array is empty', async () => {
    const { svc } = makeDocInfoMock({ totalDocs: 10, postings: {}, tf: {} });

    const res = await searchKeyword([], svc);
    expect(res.size).toBe(0);

    expect(svc.getTotalDocuments).toHaveBeenCalledTimes(1);
    expect(svc.getDocIdsForTerm).not.toHaveBeenCalled();
    expect(svc.getTermFrequency).not.toHaveBeenCalled();
  });

  it.concurrent('skips term when it has no postings', async () => {
    const { svc } = makeDocInfoMock({
      totalDocs: 10,
      postings: { a: [] },
      tf: { a: {} },
    });

    const res = await searchKeyword(['a'], svc);
    expect(res.size).toBe(0);

    expect(svc.getDocIdsForTerm).toHaveBeenCalledWith('a');
    expect(svc.getTermFrequency).not.toHaveBeenCalled();
  });

  it.concurrent('computes TF-IDF correctly for one term across docs', async () => {
    const totalDocs = 100;
    const df = 4;
    const idf = Math.log10(totalDocs / df);

    const { svc } = makeDocInfoMock({
      totalDocs,
      postings: { a: ['d1', 'd2', 'd3', 'd4'] },
      tf: { a: { d1: 1, d2: 2, d3: 10, d4: 0 } },
    });

    const res = await searchKeyword(['a'], svc);

    expect(res.size).toBe(4);
    approxEqual(res.get('d1')!, 1 * idf);
    approxEqual(res.get('d2')!, 2 * idf);
    approxEqual(res.get('d3')!, 10 * idf);
    approxEqual(res.get('d4')!, 0 * idf);

    expect(svc.getTotalDocuments).toHaveBeenCalledTimes(1);
    expect(svc.getDocIdsForTerm).toHaveBeenCalledTimes(1);
    expect(svc.getTermFrequency).toHaveBeenCalledTimes(4);
  });

  it.concurrent('sums TF-IDF scores across multiple terms for the same doc', async () => {
    const totalDocs = 10;
    const idfA = Math.log10(totalDocs / 2);
    const idfB = Math.log10(totalDocs / 5);

    const { svc } = makeDocInfoMock({
      totalDocs,
      postings: {
        a: ['d1', 'd2'],
        b: ['d1', 'd3', 'd4', 'd5', 'd6'],
      },
      tf: {
        a: { d1: 3, d2: 1 },
        b: { d1: 4, d3: 2, d4: 1, d5: 1, d6: 10 },
      },
    });

    const res = await searchKeyword(['a', 'b'], svc);

    const expectedD1 = 3 * idfA + 4 * idfB;
    const expectedD2 = 1 * idfA;
    const expectedD3 = 2 * idfB;

    approxEqual(res.get('d1')!, expectedD1);
    approxEqual(res.get('d2')!, expectedD2);
    approxEqual(res.get('d3')!, expectedD3);

    expect(res.has('d4')).toBe(true);
    expect(res.has('d5')).toBe(true);
    expect(res.has('d6')).toBe(true);
  });

  it.concurrent('handles duplicate terms by applying scoring twice (current behavior)', async () => {
    const totalDocs = 10;
    const idf = Math.log10(totalDocs / 2);

    const { svc } = makeDocInfoMock({
      totalDocs,
      postings: { a: ['d1', 'd2'] },
      tf: { a: { d1: 2, d2: 1 } },
    });

    const res = await searchKeyword(['a', 'a'], svc);

    approxEqual(res.get('d1')!, 2 * (2 * idf));
    approxEqual(res.get('d2')!, 2 * (1 * idf));

    expect(svc.getDocIdsForTerm).toHaveBeenCalledTimes(2);
    expect(svc.getTermFrequency).toHaveBeenCalledTimes(4);
  });

  it.concurrent('idf is 0 when df == totalDocs (term appears in all docs)', async () => {
    const totalDocs = 3;
    const idf = Math.log10(totalDocs / totalDocs);

    const { svc } = makeDocInfoMock({
      totalDocs,
      postings: { a: ['d1', 'd2', 'd3'] },
      tf: { a: { d1: 5, d2: 1, d3: 100 } },
    });

    const res = await searchKeyword(['a'], svc);

    approxEqual(res.get('d1')!, 5 * idf);
    approxEqual(res.get('d2')!, 1 * idf);
    approxEqual(res.get('d3')!, 100 * idf);

    expect(res.get('d1')).toBe(0);
    expect(res.get('d2')).toBe(0);
    expect(res.get('d3')).toBe(0);
  });

  it.concurrent('does not produce NaN for totalDocs=1 and df=1', async () => {
    const { svc } = makeDocInfoMock({
      totalDocs: 1,
      postings: { a: ['d1'] },
      tf: { a: { d1: 7 } },
    });

    const res = await searchKeyword(['a'], svc);
    expect(Number.isNaN(res.get('d1')!)).toBe(false);
    expect(res.get('d1')).toBe(0);
  });

  it.concurrent('calls getTotalDocuments once even with many terms', async () => {
    const { svc } = makeDocInfoMock({
      totalDocs: 100,
      postings: { a: ['d1'], b: ['d2'], c: ['d3'] },
      tf: { a: { d1: 1 }, b: { d2: 1 }, c: { d3: 1 } },
    });

    await searchKeyword(['a', 'b', 'c'], svc);

    expect(svc.getTotalDocuments).toHaveBeenCalledTimes(1);
    expect(svc.getDocIdsForTerm).toHaveBeenCalledTimes(3);
    expect(svc.getTermFrequency).toHaveBeenCalledTimes(3);
  });

  it.concurrent('uses per-term df for idf (different terms produce different idf)', async () => {
    const totalDocs = 100;
    const idfA = Math.log10(totalDocs / 1);
    const idfB = Math.log10(totalDocs / 10);

    const { svc } = makeDocInfoMock({
      totalDocs,
      postings: {
        a: ['d1'],
        b: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10'],
      },
      tf: {
        a: { d1: 1 },
        b: { d1: 1, d2: 1, d3: 1, d4: 1, d5: 1, d6: 1, d7: 1, d8: 1, d9: 1, d10: 1 },
      },
    });

    const res = await searchKeyword(['a', 'b'], svc);

    approxEqual(res.get('d1')!, 1 * idfA + 1 * idfB);
    approxEqual(res.get('d2')!, 1 * idfB);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // + ~20 more cases via .each (TF-IDF validity + corner cases + call behavior)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('additional TF-IDF + behavior cases', () => {
    const cases: Array<{
      name: string;
      totalDocs: number;
      terms: string[];
      postings: PostingTable;
      tf: TfTable;
      assert: (res: Map<string, number>, svc: jest.Mocked<DocumentInfoService>) => void | Promise<void>;
    }> = [
      {
        name: 'term with postings but all tf=0 still creates 0 scores for those docs',
        totalDocs: 10,
        terms: ['a'],
        postings: { a: ['d1', 'd2'] },
        tf: { a: { d1: 0, d2: 0 } },
        assert: (res) => {
          expect(res.size).toBe(2);
          expect(res.get('d1')).toBe(0);
          expect(res.get('d2')).toBe(0);
        },
      },
      {
        name: 'term frequency missing for a doc defaults to 0',
        totalDocs: 10,
        terms: ['a'],
        postings: { a: ['d1', 'd2'] },
        tf: { a: { d1: 3 } }, // no d2
        assert: (res) => {
          const idf = Math.log10(10 / 2);
          approxEqual(res.get('d1')!, 3 * idf);
          expect(res.get('d2')).toBe(0);
        },
      },
      {
        name: 'df=1 produces maximal idf for given totalDocs',
        totalDocs: 1000,
        terms: ['rare'],
        postings: { rare: ['d1'] },
        tf: { rare: { d1: 2 } },
        assert: (res) => {
          const idf = Math.log10(1000 / 1);
          approxEqual(res.get('d1')!, 2 * idf);
        },
      },
      {
        name: 'two terms, disjoint doc sets => map contains union of docs',
        totalDocs: 10,
        terms: ['a', 'b'],
        postings: { a: ['d1'], b: ['d2'] },
        tf: { a: { d1: 1 }, b: { d2: 1 } },
        assert: (res) => {
          expect(res.size).toBe(2);
          expect(res.has('d1')).toBe(true);
          expect(res.has('d2')).toBe(true);
        },
      },
      {
        name: 'two terms, same docs => scores add per doc',
        totalDocs: 10,
        terms: ['a', 'b'],
        postings: { a: ['d1'], b: ['d1'] },
        tf: { a: { d1: 2 }, b: { d1: 4 } },
        assert: (res) => {
          const idfA = Math.log10(10 / 1);
          const idfB = Math.log10(10 / 1);
          approxEqual(res.get('d1')!, 2 * idfA + 4 * idfB);
        },
      },
      {
        name: 'idf can be negative if df > totalDocs (bad index, but math should follow)',
        totalDocs: 2,
        terms: ['a'],
        postings: { a: ['d1', 'd2', 'd3'] }, // df=3 > totalDocs
        tf: { a: { d1: 1, d2: 1, d3: 1 } },
        assert: (res) => {
          const idf = Math.log10(2 / 3); // negative
          approxEqual(res.get('d1')!, 1 * idf);
          approxEqual(res.get('d2')!, 1 * idf);
          approxEqual(res.get('d3')!, 1 * idf);
          expect(res.get('d1')!).toBeLessThan(0);
        },
      },
      {
        name: 'orders of terms do not change final scores',
        totalDocs: 10,
        terms: ['b', 'a'],
        postings: { a: ['d1', 'd2'], b: ['d2'] },
        tf: { a: { d1: 1, d2: 2 }, b: { d2: 10 } },
        assert: async (res, svc) => {
          const res2 = await searchKeyword(['a', 'b'], svc);
          expect([...res.entries()].sort()).toEqual([...res2.entries()].sort());
        },
      },
      {
        name: 'repeated docId in postings counts multiple times (current behavior)',
        totalDocs: 10,
        terms: ['a'],
        postings: { a: ['d1', 'd1'] }, // duplicate doc id!
        tf: { a: { d1: 2 } },
        assert: (res, svc) => {
          // df uses docIds.length (2), so idf differs; and loop runs twice so it adds twice.
          const idf = Math.log10(10 / 2);
          approxEqual(res.get('d1')!, 2 * idf + 2 * idf);
          expect(svc.getTermFrequency).toHaveBeenCalledTimes(2);
        },
      },
      {
        name: 'missing term key in postings behaves as empty postings',
        totalDocs: 10,
        terms: ['missing'],
        postings: {},
        tf: {},
        assert: (res) => {
          expect(res.size).toBe(0);
        },
      },
      {
        name: 'multiple docs + mixed tf: exact expected numbers for small case',
        totalDocs: 4,
        terms: ['a'],
        postings: { a: ['d1', 'd2'] }, // df=2 => idf=log10(2)
        tf: { a: { d1: 1, d2: 3 } },
        assert: (res) => {
          const idf = Math.log10(4 / 2);
          approxEqual(res.get('d1')!, 1 * idf);
          approxEqual(res.get('d2')!, 3 * idf);
        },
      },
      {
        name: 'three terms: some missing postings, still scores from others',
        totalDocs: 10,
        terms: ['a', 'missing', 'b'],
        postings: { a: ['d1'], b: ['d2'] },
        tf: { a: { d1: 1 }, b: { d2: 2 } },
        assert: (res, svc) => {
          expect(res.size).toBe(2);
          expect(svc.getDocIdsForTerm).toHaveBeenCalledWith('missing');
        },
      },
      {
        name: 'termFrequency called once per (term, doc) pair',
        totalDocs: 10,
        terms: ['a', 'b'],
        postings: { a: ['d1', 'd2', 'd3'], b: ['d1'] },
        tf: { a: { d1: 1, d2: 1, d3: 1 }, b: { d1: 1 } },
        assert: (_res, svc) => {
          expect(svc.getTermFrequency).toHaveBeenCalledTimes(4);
        },
      },
      {
        name: 'scores are additive: existing docScore is incremented (not replaced)',
        totalDocs: 10,
        terms: ['a', 'b'],
        postings: { a: ['d1'], b: ['d1'] },
        tf: { a: { d1: 1 }, b: { d1: 1 } },
        assert: (res) => {
          const s = res.get('d1')!;
          expect(s).not.toBe(0);
          // ensure equals sum of both contributions
          const idfA = Math.log10(10 / 1);
          const idfB = Math.log10(10 / 1);
          approxEqual(s, 1 * idfA + 1 * idfB);
        },
      },
      {
        name: 'term list with many repeats calls docIdsForTerm each time (no caching)',
        totalDocs: 10,
        terms: ['a', 'a', 'a'],
        postings: { a: ['d1'] },
        tf: { a: { d1: 1 } },
        assert: (_res, svc) => {
          expect(svc.getDocIdsForTerm).toHaveBeenCalledTimes(3);
        },
      },
      {
        name: 'idf uses base-10 log (sanity check vs ln)',
        totalDocs: 100,
        terms: ['a'],
        postings: { a: ['d1', 'd2'] },
        tf: { a: { d1: 1, d2: 1 } },
        assert: (res) => {
          const idf10 = Math.log10(100 / 2);
          const idfln = Math.log(100 / 2);
          expect(idf10).not.toBeCloseTo(idfln);
          approxEqual(res.get('d1')!, idf10);
        },
      },
      {
        name: 'idf for df=totalDocs is exactly 0 (not -0)',
        totalDocs: 2,
        terms: ['a'],
        postings: { a: ['d1', 'd2'] },
        tf: { a: { d1: 1, d2: 1 } },
        assert: (res) => {
          expect(Object.is(res.get('d1')!, -0)).toBe(false);
          expect(res.get('d1')).toBe(0);
          expect(res.get('d2')).toBe(0);
        },
      },
      {
        name: 'totalDocs fetched even if all terms have empty postings (still 1 call)',
        totalDocs: 10,
        terms: ['a', 'b'],
        postings: { a: [], b: [] },
        tf: { a: {}, b: {} },
        assert: (_res, svc) => {
          expect(svc.getTotalDocuments).toHaveBeenCalledTimes(1);
          expect(svc.getTermFrequency).not.toHaveBeenCalled();
        },
      },
      {
        name: 'score map contains docs even if score is 0 (tf=0) (current behavior)',
        totalDocs: 10,
        terms: ['a'],
        postings: { a: ['d1'] },
        tf: { a: { d1: 0 } },
        assert: (res) => {
          expect(res.has('d1')).toBe(true);
          expect(res.get('d1')).toBe(0);
        },
      },
      {
        name: 'when two terms both hit doc, score is > each individual contribution (for positive idf)',
        totalDocs: 10,
        terms: ['a', 'b'],
        postings: { a: ['d1'], b: ['d1'] },
        tf: { a: { d1: 1 }, b: { d1: 1 } },
        assert: (res) => {
          const idfA = Math.log10(10 / 1);
          const idfB = Math.log10(10 / 1);
          const s = res.get('d1')!;
          expect(s).toBeGreaterThan(idfA);
          expect(s).toBeGreaterThan(idfB);
        },
      },
      {
        name: 'term appears in zero docs does not create any entries',
        totalDocs: 10,
        terms: ['a'],
        postings: { a: [] },
        tf: { a: { d1: 100 } }, // should be ignored
        assert: (res) => {
          expect(res.size).toBe(0);
        },
      },
    ];

    it.concurrent.each(cases)('$name', async ({ totalDocs, terms, postings, tf, assert }) => {
      const { svc } = makeDocInfoMock({ totalDocs, postings, tf });
      const res = await searchKeyword(terms, svc);
      await assert(res, svc);
    });
  });

  describe('property-ish: exact TF-IDF for a generated long OR-like term list', () => {
    it.concurrent('many terms with one doc each produce expected per-doc scores', async () => {
      const totalDocs = 1000;
      const terms = Array.from({ length: 20 }, (_, i) => `t${i}`);
      const postings: PostingTable = {};
      const tf: TfTable = {};

      for (let i = 0; i < 20; i++) {
        const term = `t${i}`;
        const doc = `d${i}`;
        postings[term] = [doc];
        tf[term] = { [doc]: i + 1 };
      }

      const { svc } = makeDocInfoMock({ totalDocs, postings, tf });
      const res = await searchKeyword(terms, svc);

      // each term hits exactly one doc => df=1 => idf=log10(totalDocs)
      const idf = Math.log10(totalDocs / 1);

      expect(res.size).toBe(20);
      for (let i = 0; i < 20; i++) {
        const doc = `d${i}`;
        const expected = (i + 1) * idf;
        approxEqual(getOr0(res, doc), expected);
      }
    });
  });
});
