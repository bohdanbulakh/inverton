import { DocumentInfoService } from '../../src/search/document-info/document-info.interface';
import { Normalizer } from '../../src/index/normalizer';

function makeDocInfoMock (opts?: {
  lemmaMap?: Record<string, string | null>;
  stopwords?: Set<string>;
}) {
  const lemmaMap = opts?.lemmaMap ?? {};
  const stopwords = opts?.stopwords ?? new Set<string>();

  const docInfo: jest.Mocked<DocumentInfoService> = {
    getTotalDocuments: jest.fn(async () => 1),
    getDocIdsForTerm: jest.fn(async (term: string) => []),
    getTermPositions: jest.fn(async (term: string, docId: string) => []),
    getTermFrequency: jest.fn(async (term: string, docId: string) => 0),

    getLemma: jest.fn(async (term: string) => lemmaMap[term.toLowerCase()] ?? null),
    isStopWord: jest.fn(async (lemma: string) => stopwords.has(lemma)),
    getLemmas: jest.fn(async (terms: string[]) => terms.map((t) => lemmaMap[t.toLowerCase()] ?? null)),
    areStopWords: jest.fn(async (lemmas: string[]) => lemmas.map((l) => stopwords.has(l))),
  };

  return { docInfo };
}

describe('Normalizer.normalizeTerms', () => {
  describe('non-boolean mode (default)', () => {
    it.concurrent('lemmatizes + lowercases fallback + removes stopwords', async () => {
      const { docInfo } = makeDocInfoMock({
        lemmaMap: { hello: 'hello_lemma', world: null, the: 'the' },
        stopwords: new Set(['the', 'hello_lemma']),
      });

      const n = new Normalizer(docInfo);

      await expect(n.normalizeTerms(['Hello', 'THE', 'World'])).resolves.toEqual(['world']);

      expect(docInfo.getLemmas).toHaveBeenCalledTimes(1);
      expect(docInfo.getLemmas).toHaveBeenCalledWith(['Hello', 'THE', 'World']);
      expect(docInfo.areStopWords).toHaveBeenCalledTimes(1);
      expect(docInfo.areStopWords).toHaveBeenCalledWith(['hello_lemma', 'the', 'world']);
    });

    const nonBooleanCases: Array<{
      name: string;
      lemmaMap?: Record<string, string | null>;
      stopwords?: string[];
      input: string[];
      expected: string[];
    }> = [
      {
        name: 'preserves relative order after removing stopwords',
        lemmaMap: { a: 'a', b: 'b', c: 'c', d: 'd' },
        stopwords: ['b', 'd'],
        input: ['A', 'B', 'C', 'D'],
        expected: ['a', 'c'],
      },
      {
        name: 'keeps duplicates (unless removed as stopwords)',
        lemmaMap: { a: 'a' },
        stopwords: [],
        input: ['A', 'A', 'A'],
        expected: ['a', 'a', 'a'],
      },
      {
        name: 'removes all when all are stopwords',
        lemmaMap: { a: 'a', b: 'b' },
        stopwords: ['a', 'b'],
        input: ['A', 'B', 'A'],
        expected: [],
      },
      {
        name: 'lemma fallback lowercases when lemma missing',
        lemmaMap: { hello: null },
        stopwords: [],
        input: ['Hello', 'WORLD'],
        expected: ['hello', 'world'],
      },
      {
        name: 'does not treat AND/OR/NOT specially in non-boolean mode (they are just terms)',
        lemmaMap: { and: 'and', or: 'or', not: 'not' },
        stopwords: [],
        input: ['AND', 'or', 'Not'],
        expected: ['and', 'or', 'not'],
      },
      {
        name: 'unicode terms: lemma map miss => lowercased fallback (no change for non-latin casing rules)',
        lemmaMap: {},
        stopwords: [],
        input: ['Привіт', '中文123'],
        expected: ['привіт', '中文123'],
      },
    ];

    it.concurrent.each(nonBooleanCases)('$name', async ({ lemmaMap, stopwords, input, expected }) => {
      const { docInfo } = makeDocInfoMock({
        lemmaMap,
        stopwords: new Set(stopwords ?? []),
      });

      const n = new Normalizer(docInfo);
      await expect(n.normalizeTerms(input)).resolves.toEqual(expected);
    });

    it.concurrent('empty input returns empty output (no service calls)', async () => {
      const { docInfo } = makeDocInfoMock();
      const n = new Normalizer(docInfo);

      await expect(n.normalizeTerms([])).resolves.toEqual([]);

      expect(docInfo.getLemmas).not.toHaveBeenCalled();
      expect(docInfo.areStopWords).not.toHaveBeenCalled();
    });
  });

  describe('boolean mode', () => {
    it.concurrent('keeps parentheses + operators, uppercases operators, lemmatizes terms', async () => {
      const { docInfo } = makeDocInfoMock({
        lemmaMap: { some: 'some', text: 'text', test: 'test' },
        stopwords: new Set(['some', 'text', 'test']),
      });

      const n = new Normalizer(docInfo);
      const tokens = ['nOt', '(', 'Some', 'aNd', 'Text', ')', 'oR', 'Test'];

      await expect(n.normalizeTerms(tokens, true)).resolves.toEqual([
        'NOT',
        '(',
        'some',
        'AND',
        'text',
        ')',
        'OR',
        'test',
      ]);

      expect(docInfo.areStopWords).not.toHaveBeenCalled();
      expect(docInfo.getLemmas).toHaveBeenCalledTimes(1);
      expect(docInfo.getLemmas).toHaveBeenCalledWith(['Some', 'Text', 'Test']);
    });

    const booleanCases: Array<{
      name: string;
      lemmaMap?: Record<string, string | null>;
      stopwords?: string[];
      input: string[];
      expected: string[];
      expectedLemmaInputs?: string[];
    }> = [
      {
        name: 'does NOT remove stopwords in boolean mode',
        lemmaMap: { a: 'a', b: 'b' },
        stopwords: ['a', 'b'],
        input: ['a', 'AND', 'b'],
        expected: ['a', 'AND', 'b'],
        expectedLemmaInputs: ['a', 'b'],
      },
      {
        name: 'operators are case-insensitive and emitted uppercased',
        lemmaMap: { a: 'a', b: 'b', c: 'c' },
        input: ['a', 'aNd', 'b', 'oR', 'c', 'nOt', 'a'],
        expected: ['a', 'AND', 'b', 'OR', 'c', 'NOT', 'a'],
        expectedLemmaInputs: ['a', 'b', 'c', 'a'],
      },
      {
        name: 'keeps parentheses and does not send them to getLemmas',
        lemmaMap: { a: 'a', b: 'b' },
        input: ['(', 'a', 'AND', 'b', ')'],
        expected: ['(', 'a', 'AND', 'b', ')'],
        expectedLemmaInputs: ['a', 'b'],
      },
      {
        name: 'operator words inside other words stay terms (ANDy/ORacle/NOTary)',
        lemmaMap: { andy: 'andy', oracle: 'oracle', notary: 'notary' },
        input: ['ANDy', 'OR', 'ORacle', 'AND', 'NOTary'],
        expected: ['andy', 'OR', 'oracle', 'AND', 'notary'],
        expectedLemmaInputs: ['ANDy', 'ORacle', 'NOTary'],
      },
      {
        name: 'underscored terms that contain operators are still terms',
        lemmaMap: { x_and_y: 'x_and_y', not_me: 'not_me' },
        input: ['x_and_y', 'OR', 'not_me'],
        expected: ['x_and_y', 'OR', 'not_me'],
        expectedLemmaInputs: ['x_and_y', 'not_me'],
      },
      {
        name: 'handles only operators/parens: no getLemmas call',
        lemmaMap: {},
        input: ['(', 'NOT', ')', 'AND', 'OR'],
        expected: ['(', 'NOT', ')', 'AND', 'OR'],
        expectedLemmaInputs: [],
      },
      {
        name: 'lemma fallback lowercases when lemma missing (boolean mode)',
        lemmaMap: { foo: null },
        input: ['Foo', 'AND', 'Bar'],
        expected: ['foo', 'AND', 'bar'],
        expectedLemmaInputs: ['Foo', 'Bar'],
      },
      {
        name: 'keeps stopword terms even when stopwords set contains them',
        lemmaMap: { the: 'the', cat: 'cat' },
        stopwords: ['the'],
        input: ['the', 'AND', 'cat'],
        expected: ['the', 'AND', 'cat'],
        expectedLemmaInputs: ['the', 'cat'],
      },
    ];

    it.concurrent.each(booleanCases)('$name', async ({ lemmaMap, stopwords, input, expected, expectedLemmaInputs }) => {
      const { docInfo } = makeDocInfoMock({
        lemmaMap,
        stopwords: new Set(stopwords ?? []),
      });

      const n = new Normalizer(docInfo);
      await expect(n.normalizeTerms(input, true)).resolves.toEqual(expected);

      expect(docInfo.areStopWords).not.toHaveBeenCalled();

      const expectedInputs = expectedLemmaInputs ?? [];
      if (expectedInputs.length === 0) {
        expect(docInfo.getLemmas).not.toHaveBeenCalled();
      } else {
        expect(docInfo.getLemmas).toHaveBeenCalledTimes(1);
        expect(docInfo.getLemmas).toHaveBeenCalledWith(expectedInputs);
      }
    });
  });

  describe('service interaction sanity', () => {
    type NonBooleanServiceCase = {
      name: string;
      input: string[];
      lemmaMap: Record<string, string | null>;
      stopwords: string[];
    };

    it.concurrent.each<NonBooleanServiceCase>([
      {
        name: 'non-boolean calls getLemmas + areStopWords once each',
        input: ['A'],
        lemmaMap: { a: 'a' },
        stopwords: [],
      },
      {
        name: 'non-boolean with multiple terms still only one batch call',
        input: ['A', 'B', 'C'],
        lemmaMap: { a: 'a', b: 'b', c: 'c' },
        stopwords: [],
      },
    ])('$name', async ({ input, lemmaMap, stopwords }) => {
      const { docInfo } = makeDocInfoMock({
        lemmaMap,
        stopwords: new Set(stopwords),
      });

      const n = new Normalizer(docInfo);
      await n.normalizeTerms(input);

      expect(docInfo.getLemmas).toHaveBeenCalledTimes(1);
      expect(docInfo.areStopWords).toHaveBeenCalledTimes(1);
    });

    type BooleanServiceCase = {
      name: string;
      input: string[];
      lemmaMap: Record<string, string | null>;
    };

    it.concurrent.each<BooleanServiceCase>([
      {
        name: 'boolean calls getLemmas once (if has terms) and never areStopWords',
        input: ['A', 'AND', 'B'],
        lemmaMap: { a: 'a', b: 'b' },
      },
      {
        name: 'boolean with parentheses still only one getLemmas call',
        input: ['(', 'A', 'AND', 'B', ')', 'OR', 'C'],
        lemmaMap: { a: 'a', b: 'b', c: 'c' },
      },
    ])('$name', async ({ input, lemmaMap }) => {
      const { docInfo } = makeDocInfoMock({ lemmaMap });

      const n = new Normalizer(docInfo);
      await n.normalizeTerms(input, true);

      expect(docInfo.areStopWords).not.toHaveBeenCalled();
      expect(docInfo.getLemmas).toHaveBeenCalledTimes(1);
    });
  });
});
