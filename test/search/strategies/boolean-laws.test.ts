import { searchBoolean } from '../../../src/search/strategies';
import { DocumentInfoService } from '../../../src/search/document-info/document-info.interface';

function createRandomDocInfo (universeSize: number): DocumentInfoService {
  const terms = ['A', 'B', 'C', 'D'];
  const index: Record<string, string[]> = {};

  terms.forEach((term) => {
    const docs = [];
    for (let i = 1; i <= universeSize; i++) {
      if (Math.random() > 0.5) docs.push(`doc-${i}`);
    }
    index[term] = docs;
  });

  return {
    getDocIdsForTerm: jest.fn(async (term) => index[term] || []),
    getTotalDocuments: jest.fn(async () => universeSize),
    getTermFrequency: jest.fn(async () => 0),
    getTermPositions: jest.fn(async () => []),
    getLemma: jest.fn(async (t) => t),
    isStopWord: jest.fn(async () => false),
    getLemmas: jest.fn(async (ts) => ts),
    areStopWords: jest.fn(async (ls) => ls.map(() => false)),
  };
}

const getIds = (map: Map<string, number>) => [...map.keys()].sort();

describe('Boolean Search - Property Laws', () => {
  const ITERATIONS = 50;
  const UNIVERSE_SIZE = 100;

  const booleanLaws = [
    ['Commutativity: AND', ['A', 'AND', 'B'], ['B', 'AND', 'A']],
    ['Commutativity: OR', ['A', 'OR', 'B'], ['B', 'OR', 'A']],

    ['Associativity: AND', ['(', 'A', 'AND', 'B', ')', 'AND', 'C'], ['A', 'AND', '(', 'B', 'AND', 'C', ')']],
    ['Associativity: OR', ['(', 'A', 'OR', 'B', ')', 'OR', 'C'], ['A', 'OR', '(', 'B', 'OR', 'C', ')']],

    ['Distributivity: AND over OR', ['A', 'AND', '(', 'B', 'OR', 'C', ')'], ['(', 'A', 'AND', 'B', ')', 'OR', '(', 'A', 'AND', 'C', ')']],
    ['Distributivity: OR over AND', ['A', 'OR', '(', 'B', 'AND', 'C', ')'], ['(', 'A', 'OR', 'B', ')', 'AND', '(', 'A', 'OR', 'C', ')']],

    ['De Morgan: NOT (A OR B)', ['NOT', '(', 'A', 'OR', 'B', ')'], ['NOT', 'A', 'AND', 'NOT', 'B']],
    ['De Morgan: NOT (A AND B)', ['NOT', '(', 'A', 'AND', 'B', ')'], ['NOT', 'A', 'OR', 'NOT', 'B']],
    ['De Morgan: Triple (A OR B OR C)', ['NOT', '(', 'A', 'OR', 'B', 'OR', 'C', ')'], ['NOT', 'A', 'AND', 'NOT', 'B', 'AND', 'NOT', 'C']],

    ['Idempotence: AND', ['A', 'AND', 'A'], ['A']],
    ['Idempotence: OR', ['A', 'OR', 'A'], ['A']],

    ['Absorption: A OR (A AND B)', ['A', 'OR', '(', 'A', 'AND', 'B', ')'], ['A']],
    ['Absorption: A AND (A OR B)', ['A', 'AND', '(', 'A', 'OR', 'B', ')'], ['A']],

    ['Double Negation', ['NOT', 'NOT', 'A'], ['A']],
    ['Triple Negation', ['NOT', 'NOT', 'NOT', 'A'], ['NOT', 'A']],
    ['Nested Double Negation', ['NOT', 'NOT', '(', 'A', 'AND', 'B', ')'], ['A', 'AND', 'B']],

    ['Precedence: OR then AND', ['A', 'OR', 'B', 'AND', 'C'], ['A', 'OR', '(', 'B', 'AND', 'C', ')']],
    ['Precedence: AND then OR', ['A', 'AND', 'B', 'OR', 'C'], ['(', 'A', 'AND', 'B', ')', 'OR', 'C']],
  ] satisfies [string, string[], string[]][];

  it.each(booleanLaws)('%s', async (_name, query1, query2) => {
    for (let i = 0; i < ITERATIONS; i++) {
      const svc = createRandomDocInfo(UNIVERSE_SIZE);

      const res1 = await searchBoolean(query1, svc);
      const res2 = await searchBoolean(query2, svc);

      try {
        expect(getIds(res1)).toEqual(getIds(res2));
      } catch (e) {
        console.error(`Failed on iteration ${i} for ${_name}`);
        throw e;
      }
    }
  });
});
