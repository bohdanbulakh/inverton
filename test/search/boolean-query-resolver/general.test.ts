import { Expression, resolveBooleanQuery } from '../../../src/search/boolean-query-resolver';
import { tokenize } from '../../../src/index/tokenizer';

type Node = string | Expression;

function parse (query: string): Expression {
  return resolveBooleanQuery(tokenize(query, true));
}

function expectTerm (expr: Node, term: string) {
  expect(typeof expr).toBe('string');
  expect(expr).toBe(term);
}

function expectOp (expr: Node, op: Expression['operator']) {
  expect(typeof expr).toBe('object');
  if (typeof expr === 'string') throw new Error('Expected Expression, got string');
  expect(expr.operator).toBe(op);
  return expr;
}

describe('parseBooleanQuery', () => {
  describe('single term', () => {
    it.concurrent('wraps a single term into AND with one operand', () => {
      expect(parse('hello')).toEqual({
        operator: 'AND',
        operands: ['hello'],
      });
    });

    it.concurrent('unicode terms are supported', () => {
      expect(parse('Привіт')).toEqual({
        operator: 'AND',
        operands: ['Привіт'],
      });
      expect(parse('中文123')).toEqual({
        operator: 'AND',
        operands: ['中文123'],
      });
    });

    it.concurrent('underscore is allowed in terms', () => {
      expect(parse('snake_case_123')).toEqual({
        operator: 'AND',
        operands: ['snake_case_123'],
      });
    });

    it.concurrent('trims whitespace around a single term', () => {
      expect(parse('   hello   ')).toEqual({
        operator: 'AND',
        operands: ['hello'],
      });
    });
  });

  describe('basic AND / OR', () => {
    it.concurrent('parses simple AND', () => {
      expect(parse('a AND b')).toEqual({
        operator: 'AND',
        operands: ['a', 'b'],
      });
    });

    it.concurrent('parses simple OR', () => {
      expect(parse('a OR b')).toEqual({
        operator: 'OR',
        operands: ['a', 'b'],
      });
    });

    it.concurrent('is case-insensitive for operators', () => {
      expect(parse('a and b')).toEqual({
        operator: 'AND',
        operands: ['a', 'b'],
      });
      expect(parse('a oR b')).toEqual({
        operator: 'OR',
        operands: ['a', 'b'],
      });
      expect(parse('not a')).toEqual({
        operator: 'NOT',
        operands: ['a'],
      });
    });

    it.concurrent('keeps term casing (operators aside)', () => {
      expect(parse('Foo AND Bar')).toEqual({
        operator: 'AND',
        operands: ['Foo', 'Bar'],
      });
    });
  });

  describe('precedence', () => {
    it.concurrent('NOT binds tighter than AND', () => {
      expect(parse('NOT a AND b')).toEqual({
        operator: 'AND',
        operands: [{ operator: 'NOT', operands: ['a'] }, 'b'],
      });
    });

    it.concurrent('NOT binds tighter than OR', () => {
      expect(parse('NOT a OR b')).toEqual({
        operator: 'OR',
        operands: [{ operator: 'NOT', operands: ['a'] }, 'b'],
      });
    });

    it.concurrent('AND binds tighter than OR: a OR b AND c => a OR (b AND c)', () => {
      expect(parse('a OR b AND c')).toEqual({
        operator: 'OR',
        operands: ['a', { operator: 'AND', operands: ['b', 'c'] }],
      });
    });

    it.concurrent('AND binds tighter than OR: a AND b OR c => (a AND b) OR c', () => {
      expect(parse('a AND b OR c')).toEqual({
        operator: 'OR',
        operands: [{ operator: 'AND', operands: ['a', 'b'] }, 'c'],
      });
    });

    it.concurrent('NOT is right-associative: NOT NOT a => NOT (NOT a)', () => {
      expect(parse('NOT NOT a')).toEqual({
        operator: 'NOT',
        operands: [{ operator: 'NOT', operands: ['a'] }],
      });
    });
  });

  describe('parentheses', () => {
    it.concurrent('parentheses override precedence: (a OR b) AND c', () => {
      expect(parse('(a OR b) AND c')).toEqual({
        operator: 'AND',
        operands: [{ operator: 'OR', operands: ['a', 'b'] }, 'c'],
      });
    });

    it.concurrent('nested parentheses', () => {
      expect(parse('a AND (b OR (c AND d))')).toEqual({
        operator: 'AND',
        operands: [
          'a',
          { operator: 'OR', operands: ['b', { operator: 'AND', operands: ['c', 'd'] }] },
        ],
      });
    });

    it.concurrent('NOT applied to parenthesized expression', () => {
      expect(parse('NOT (a AND b)')).toEqual({
        operator: 'NOT',
        operands: [{ operator: 'AND', operands: ['a', 'b'] }],
      });
    });

    it.concurrent('deep parentheses should work', () => {
      const q = '((((a))))';
      expect(parse(q)).toEqual({
        operator: 'AND',
        operands: ['a'],
      });
    });
  });

  describe('flattening AND / OR chains', () => {
    it.concurrent('flattens a AND b AND c into one AND with 3 operands', () => {
      expect(parse('a AND b AND c')).toEqual({
        operator: 'AND',
        operands: ['a', 'b', 'c'],
      });
    });

    it.concurrent('flattens a OR b OR c into one OR with 3 operands', () => {
      expect(parse('a OR b OR c')).toEqual({
        operator: 'OR',
        operands: ['a', 'b', 'c'],
      });
    });

    it.concurrent('does NOT flatten through parentheses that change operator grouping', () => {
      expect(parse('a AND (b OR c) AND d')).toEqual({
        operator: 'AND',
        operands: ['a', { operator: 'OR', operands: ['b', 'c'] }, 'd'],
      });
    });

    it.concurrent('does not flatten NOT into anything', () => {
      expect(parse('NOT a AND NOT b')).toEqual({
        operator: 'AND',
        operands: [{ operator: 'NOT', operands: ['a'] }, { operator: 'NOT', operands: ['b'] }],
      });
    });
  });

  describe('complex examples', () => {
    it.concurrent('example from conversation', () => {
      const q = 'NOT (some AND text) OR test OR (value AND key AND button AND NOT input)';
      expect(parse(q)).toEqual({
        operator: 'OR',
        operands: [
          { operator: 'NOT', operands: [{ operator: 'AND', operands: ['some', 'text'] }] },
          'test',
          {
            operator: 'AND',
            operands: ['value', 'key', 'button', { operator: 'NOT', operands: ['input'] }],
          },
        ],
      });
    });

    it.concurrent('mix of unicode terms and operators', () => {
      const q = 'Привіт AND (世界 OR NOT тест)';
      expect(parse(q)).toEqual({
        operator: 'AND',
        operands: ['Привіт', { operator: 'OR', operands: ['世界', { operator: 'NOT', operands: ['тест'] }] }],
      });
    });

    it.concurrent('operator words inside other words are treated as terms', () => {
      expect(parse('candy AND oryx OR notation')).toEqual({
        operator: 'OR',
        operands: [{ operator: 'AND', operands: ['candy', 'oryx'] }, 'notation'],
      });
    });
  });

  describe('whitespace robustness', () => {
    it.concurrent('handles excessive whitespace', () => {
      expect(parse('  a   AND   (  b OR   c ) ')).toEqual({
        operator: 'AND',
        operands: ['a', { operator: 'OR', operands: ['b', 'c'] }],
      });
    });

    it.concurrent('handles newlines and tabs', () => {
      expect(parse('a\tAND\nb')).toEqual({
        operator: 'AND',
        operands: ['a', 'b'],
      });
    });
  });

  describe('errors: invalid characters', () => {
    it.concurrent('throws on unexpected non-whitespace characters (e.g., &)', () => {
      expect(() => parse('a & b')).toThrow(/Unexpected input/);
    });

    it.concurrent('throws on unexpected punctuation (e.g., $)', () => {
      expect(() => parse('a AND b$')).toThrow(/Unexpected input/);
    });
  });

  describe('errors: parentheses mismatch', () => {
    it.concurrent('throws on missing \')\'', () => {
      expect(() => parse('(a AND b')).toThrow(/Mismatched parentheses/);
    });

    it.concurrent('throws on missing \'(\'', () => {
      expect(() => parse('a AND b)')).toThrow(/Mismatched parentheses/);
    });
  });

  describe('errors: operator placement / missing operands', () => {
    it.concurrent('throws if query ends with operator', () => {
      expect(() => parse('a AND')).toThrow(/missing operand/i);
    });

    it.concurrent('throws if query starts with binary operator AND', () => {
      expect(() => parse('AND a')).toThrow(/missing left operand/i);
    });

    it.concurrent('throws if query starts with binary operator OR', () => {
      expect(() => parse('OR a')).toThrow(/missing left operand/i);
    });

    it.concurrent('throws on \'a OR OR b\'', () => {
      expect(() => parse('a OR OR b')).toThrow(/missing left operand|missing operand/i);
    });

    it.concurrent('throws on \'a AND ( )\' (empty parens)', () => {
      expect(() => parse('a AND ()')).toThrow();
    });

    it.concurrent('throws on \'a NOT b\' (NOT in wrong place for this grammar)', () => {
      expect(() => parse('a NOT b')).toThrow(/NOT must appear/i);
    });

    it.concurrent('throws on \'NOT\' alone', () => {
      expect(() => parse('NOT')).toThrow(/missing operand/i);
    });

    it.concurrent('throws on \'()\' alone', () => {
      expect(() => parse('()')).toThrow();
    });
  });

  describe('structure sanity checks (shape)', () => {
    it.concurrent('root is always Expression with operator and operands[]', () => {
      const expr = parse('a AND b');
      expect(expr).toHaveProperty('operator');
      expect(expr).toHaveProperty('operands');
      expect(Array.isArray(expr.operands)).toBe(true);
    });

    it.concurrent('NOT always has exactly one operand', () => {
      const expr = parse('NOT a');
      expect(expr.operator).toBe('NOT');
      expect(expr.operands).toHaveLength(1);
    });

    it.concurrent('AND/OR have at least two operands when built from binary ops', () => {
      const andExpr = parse('a AND b');
      expect(andExpr.operator).toBe('AND');
      expect(andExpr.operands.length).toBeGreaterThanOrEqual(2);

      const orExpr = parse('a OR b');
      expect(orExpr.operator).toBe('OR');
      expect(orExpr.operands.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('optional: very long chains', () => {
    it.concurrent('parses long AND chain and flattens operands', () => {
      const q = Array.from({ length: 50 }, (_, i) => `t${i}`).join(' AND ');
      const expr = parse(q);
      expect(expr.operator).toBe('AND');
      expect(expr.operands).toHaveLength(50);
      expect(expr.operands[0]).toBe('t0');
      expect(expr.operands[49]).toBe('t49');
    });

    it.concurrent('parses long OR chain and flattens operands', () => {
      const q = Array.from({ length: 50 }, (_, i) => `t${i}`).join(' OR ');
      const expr = parse(q);
      expect(expr.operator).toBe('OR');
      expect(expr.operands).toHaveLength(50);
    });
  });

  describe('structural assertions helpers', () => {
    it.concurrent('a OR (b AND c) has OR at root and nested AND', () => {
      const expr = parse('a OR (b AND c)');
      const root = expectOp(expr, 'OR');
      expect(root.operands).toHaveLength(2);

      expectTerm(root.operands[0], 'a');

      const nested = expectOp(root.operands[1], 'AND');
      expect(nested.operands).toEqual(['b', 'c']);
    });

    it.concurrent('NOT (a OR b) gives NOT root with OR child', () => {
      const expr = parse('NOT (a OR b)');
      const root = expectOp(expr, 'NOT');
      expect(root.operands).toHaveLength(1);

      const child = expectOp(root.operands[0], 'OR');
      expect(child.operands).toEqual(['a', 'b']);
    });
  });

  describe('errors: exact toPostfix error messages', () => {
    it.concurrent('throws: Mismatched parentheses: missing \'(\' when extra \')\' appears', () => {
      expect(() => parse('a AND b)')).toThrow('Mismatched parentheses: missing \'(\'');
    });

    it.concurrent('throws: Mismatched parentheses: missing \')\' when \'(\' is never closed', () => {
      expect(() => parse('(a AND b')).toThrow('Mismatched parentheses: missing \')\'');
    });

    it.concurrent('throws: NOT must appear where an operand is expected (NOT after term)', () => {
      expect(() => parse('a NOT b')).toThrow('NOT must appear where an operand is expected');
    });

    it.concurrent('throws: AND cannot appear here (missing left operand) when expression starts with AND', () => {
      expect(() => parse('AND a')).toThrow('AND cannot appear here (missing left operand)');
    });

    it.concurrent('throws: OR cannot appear here (missing left operand) when expression starts with OR', () => {
      expect(() => parse('OR a')).toThrow('OR cannot appear here (missing left operand)');
    });

    it.concurrent('throws: AND cannot appear here (missing left operand) right after \'(\'', () => {
      expect(() => parse('(AND a)')).toThrow('AND cannot appear here (missing left operand)');
    });

    it.concurrent('throws: OR cannot appear here (missing left operand) when operator follows another operator', () => {
      expect(() => parse('a AND OR b')).toThrow('OR cannot appear here (missing left operand)');
    });

    it.concurrent('throws: Expression ends unexpectedly (missing operand) when query ends with binary operator', () => {
      expect(() => parse('a AND')).toThrow('Expression ends unexpectedly (missing operand)');
    });

    it.concurrent('throws: Expression ends unexpectedly (missing operand) when query is only NOT', () => {
      expect(() => parse('NOT')).toThrow('Expression ends unexpectedly (missing operand)');
    });

    it.concurrent('throws: Expression ends unexpectedly (missing operand) for empty group \'()\'', () => {
      expect(() => parse('()')).toThrow('Expression ends unexpectedly (missing operand)');
    });

    it.concurrent('throws: Expression ends unexpectedly (missing operand) for \'a AND ()\'', () => {
      expect(() => parse('a AND ()')).toThrow('Expression ends unexpectedly (missing operand)');
    });

    it.concurrent('throws: Mismatched parentheses: missing \'(\' for query starting with \')\'', () => {
      expect(() => parse(') a')).toThrow('Mismatched parentheses: missing \'(\'');
    });

    it.concurrent('throws: Mismatched parentheses: missing \'(\' for \'(a))\' extra closing paren', () => {
      expect(() => parse('(a))')).toThrow('Mismatched parentheses: missing \'(\'');
    });
  });

  it.concurrent('parses when given tokens directly (no tokenization inside parser)', () => {
    expect(resolveBooleanQuery(['a', 'AND', 'b'])).toEqual({ operator: 'AND', operands: ['a', 'b'] });
  });
});
