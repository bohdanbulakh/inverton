import { DocumentInfoService } from '../../../src/search/document-info/document-info.interface';
import { searchPhrase } from '../../../src/search/strategies';

type PostingTable = Record<string, string[]>;
type PositionTable = Record<string, Record<string, string[]>>;

function makeDocInfoMock (opts: {
  postings: PostingTable;
  positions: PositionTable;
}) {
  const { postings, positions } = opts;

  const svc: jest.Mocked<DocumentInfoService> = {
    getTotalDocuments: jest.fn(async () => 1),
    getDocIdsForTerm: jest.fn(async (term: string) => postings[term] ?? []),
    getTermPositions: jest.fn(async (term: string, docId: string) =>
      positions[term]?.[docId] ?? [],
    ),
    getTermFrequency: jest.fn(async (term: string, docId: string) => 0),


    getLemma: jest.fn(async (term: string) => null),
    isStopWord: jest.fn(async (lemma: string) => false),
    getLemmas: jest.fn(async (terms: string[]) => []),
    areStopWords: jest.fn(async (lemmas: string[]) => []),
  };

  return { svc };
}

describe('searchPhrase', () => {
  describe('phrase matching logic', () => {
    it.concurrent('returns empty map for empty terms array', async () => {
      const { svc } = makeDocInfoMock({ postings: {}, positions: {} });

      const res = await searchPhrase([], svc);
      expect(res.size).toBe(0);
    });

    it.concurrent('returns empty if any term has no postings', async () => {
      const { svc } = makeDocInfoMock({
        postings: { a: ['d1'], b: [] },
        positions: {},
      });

      const res = await searchPhrase(['a', 'b'], svc);
      expect(res.size).toBe(0);
    });

    it.concurrent('intersects candidate docs before position checks', async () => {
      const { svc } = makeDocInfoMock({
        postings: {
          a: ['d1', 'd2'],
          b: ['d2'],
        },
        positions: {
          a: { d2: ['x:1'] },
          b: { d2: ['x:2'] },
        },
      });

      const res = await searchPhrase(['a', 'b'], svc);
      expect([...res.keys()]).toEqual(['d2']);
    });

    it.concurrent.each([
      {
        name: 'simple two-word phrase matches',
        terms: ['a', 'b'],
        postings: { a: ['d1'], b: ['d1'] } as PostingTable,
        positions: {
          a: { d1: ['x:5'] },
          b: { d1: ['x:6'] },
        } as PositionTable,
        expected: ['d1'],
      },
      {
        name: 'phrase does not match if gap exists',
        terms: ['a', 'b'],
        postings: { a: ['d1'], b: ['d1'] } as PostingTable,
        positions: {
          a: { d1: ['x:5'] },
          b: { d1: ['x:7'] },
        } as PositionTable,
        expected: [] as string[],
      },
      {
        name: 'three-word phrase matches',
        terms: ['a', 'b', 'c'],
        postings: { a: ['d1'], b: ['d1'], c: ['d1'] } as PostingTable,
        positions: {
          a: { d1: ['x:10'] },
          b: { d1: ['x:11'] },
          c: { d1: ['x:12'] },
        } as PositionTable,
        expected: ['d1'],
      },
      {
        name: 'three-word phrase fails if middle term missing position',
        terms: ['a', 'b', 'c'],
        postings: { a: ['d1'], b: ['d1'], c: ['d1'] } as PostingTable,
        positions: {
          a: { d1: ['x:10'] },
          b: { d1: ['x:20'] },
          c: { d1: ['x:12'] },
        } as PositionTable,
        expected: [] as string[],
      },
    ])('$name', async ({ terms, postings, positions, expected }) => {
      const { svc } = makeDocInfoMock({ postings, positions });

      const res = await searchPhrase(terms, svc);

      expect([...res.keys()]).toEqual(expected);
    });
  });

  describe('multiple positions and docs', () => {
    it.concurrent('matches phrase when any valid start position exists', async () => {
      const { svc } = makeDocInfoMock({
        postings: { a: ['d1'], b: ['d1'] },
        positions: {
          a: { d1: ['x:1', 'x:10'] },
          b: { d1: ['x:2', 'x:20'] },
        },
      });

      const res = await searchPhrase(['a', 'b'], svc);
      expect(res.has('d1')).toBe(true);
    });

    it.concurrent('handles multiple candidate docs independently', async () => {
      const { svc } = makeDocInfoMock({
        postings: { a: ['d1', 'd2'], b: ['d1', 'd2'] },
        positions: {
          a: {
            d1: ['x:1'],
            d2: ['x:5'],
          },
          b: {
            d1: ['x:2'],
            d2: ['x:100'],
          },
        },
      });

      const res = await searchPhrase(['a', 'b'], svc);
      expect([...res.keys()]).toEqual(['d1']);
    });
  });

  describe('edge cases', () => {
    it.concurrent('handles unsorted positions', async () => {
      const { svc } = makeDocInfoMock({
        postings: { a: ['d1'], b: ['d1'] },
        positions: {
          a: { d1: ['x:10', 'x:1'] },
          b: { d1: ['x:2', 'x:11'] },
        },
      });

      const res = await searchPhrase(['a', 'b'], svc);
      expect(res.has('d1')).toBe(true);
    });

    it.concurrent('returns empty if positions array is empty', async () => {
      const { svc } = makeDocInfoMock({
        postings: { a: ['d1'], b: ['d1'] },
        positions: {
          a: { d1: [] },
          b: { d1: ['x:2'] },
        },
      });

      const res = await searchPhrase(['a', 'b'], svc);
      expect(res.size).toBe(0);
    });

    it.concurrent('assigns score 1.0 to matching docs', async () => {
      const { svc } = makeDocInfoMock({
        postings: { a: ['d1'], b: ['d1'] },
        positions: {
          a: { d1: ['x:3'] },
          b: { d1: ['x:4'] },
        },
      });

      const res = await searchPhrase(['a', 'b'], svc);
      expect(res.get('d1')).toBe(1.0);
    });
  });


  describe('service interaction sanity', () => {
    it.concurrent('calls getDocIdsForTerm once per term', async () => {
      const { svc } = makeDocInfoMock({
        postings: { a: ['d1'], b: ['d1'] },
        positions: {
          a: { d1: ['x:1'] },
          b: { d1: ['x:2'] },
        },
      });

      await searchPhrase(['a', 'b'], svc);

      expect(svc.getDocIdsForTerm).toHaveBeenCalledTimes(2);
    });

    it.concurrent('calls getTermPositions only for candidate docs', async () => {
      const { svc } = makeDocInfoMock({
        postings: {
          a: ['d1', 'd2'],
          b: ['d1'],
        },
        positions: {
          a: { d1: ['x:1'], d2: ['x:1'] },
          b: { d1: ['x:2'] },
        },
      });

      await searchPhrase(['a', 'b'], svc);

      expect(svc.getTermPositions).toHaveBeenCalledTimes(2);
    });
  });

});
