import { Expression, resolveBooleanQuery } from '../../../src/search/boolean-query-resolver';
import { tokenize } from '../../../src/index/tokenizer';

function parse (query: string): Expression {
  return resolveBooleanQuery(tokenize(query, true));
}

describe('parseBooleanQuery - edge cases - try to break the parser', () => {
  describe('operator substrings inside words (must remain TERMS)', () => {
    it.concurrent('does not treat \'or\' prefix as OR: oryx', () => {
      expect(parse('candy AND oryx OR notation')).toEqual({
        operator: 'OR',
        operands: [{ operator: 'AND', operands: ['candy', 'oryx'] }, 'notation'],
      });
    });

    it.concurrent('does not split words around operators: \'or2\' and \'2or\' are terms', () => {
      expect(parse('or2 AND 2or')).toEqual({
        operator: 'AND',
        operands: ['or2', '2or'],
      });
    });

    it.concurrent('does not treat AND/OR/NOT when glued to underscores or letters', () => {
      expect(parse('x_and_y OR not_me')).toEqual({
        operator: 'OR',
        operands: ['x_and_y', 'not_me'],
      });
    });

    it.concurrent('does not treat \'and\' inside word: bandage', () => {
      expect(parse('bandage OR x')).toEqual({
        operator: 'OR',
        operands: ['bandage', 'x'],
      });
    });

    it.concurrent('does not treat \'not\' prefix inside word: notice / knot', () => {
      expect(parse('notice AND knot')).toEqual({
        operator: 'AND',
        operands: ['notice', 'knot'],
      });
    });

    it.concurrent('treats AND/OR/NOT as operators only when they are standalone words', () => {
      expect(parse('ANDy OR ORacle AND NOTary')).toEqual({
        operator: 'OR',
        operands: ['ANDy', { operator: 'AND', operands: ['ORacle', 'NOTary'] }],
      });
    });
  });

  describe('operator casing + adjacency quirks', () => {
    it.concurrent('operators can be any case', () => {
      expect(parse('a aNd b')).toEqual({ operator: 'AND', operands: ['a', 'b'] });
      expect(parse('a Or b')).toEqual({ operator: 'OR', operands: ['a', 'b'] });
      expect(parse('nOt a')).toEqual({ operator: 'NOT', operands: ['a'] });
    });

    it.concurrent('reserved operator word alone throws', () => {
      expect(() => parse('and')).toThrow(/missing left operand/i);
      expect(() => parse('or')).toThrow(/missing left operand/i);
      expect(() => parse('not')).toThrow(/missing operand/i);
    });
  });

  describe('NOT binding / tricky NOT chains', () => {
    it.concurrent('NOT NOT term', () => {
      expect(parse('NOT NOT a')).toEqual({
        operator: 'NOT',
        operands: [{ operator: 'NOT', operands: ['a'] }],
      });
    });

    it.concurrent('NOT applies to parenthesized group', () => {
      expect(parse('NOT (a OR b)')).toEqual({
        operator: 'NOT',
        operands: [{ operator: 'OR', operands: ['a', 'b'] }],
      });
    });

    it.concurrent('NOT binds tighter than AND: NOT a AND b', () => {
      expect(parse('NOT a AND b')).toEqual({
        operator: 'AND',
        operands: [{ operator: 'NOT', operands: ['a'] }, 'b'],
      });
    });

    it.concurrent('NOT binds tighter than OR: NOT a OR b', () => {
      expect(parse('NOT a OR b')).toEqual({
        operator: 'OR',
        operands: [{ operator: 'NOT', operands: ['a'] }, 'b'],
      });
    });

    it.concurrent('nested NOT inside group: a AND (NOT b OR c)', () => {
      expect(parse('a AND (NOT b OR c)')).toEqual({
        operator: 'AND',
        operands: [
          'a',
          { operator: 'OR', operands: [{ operator: 'NOT', operands: ['b'] }, 'c'] },
        ],
      });
    });
  });

  describe('precedence traps', () => {
    it.concurrent('a OR b AND c OR d => OR(a, AND(b,c), d)', () => {
      expect(parse('a OR b AND c OR d')).toEqual({
        operator: 'OR',
        operands: ['a', { operator: 'AND', operands: ['b', 'c'] }, 'd'],
      });
    });

    it.concurrent('a AND b OR c AND d => OR(AND(a,b), AND(c,d))', () => {
      expect(parse('a AND b OR c AND d')).toEqual({
        operator: 'OR',
        operands: [
          { operator: 'AND', operands: ['a', 'b'] },
          { operator: 'AND', operands: ['c', 'd'] },
        ],
      });
    });

    it.concurrent('(a OR b) AND (c OR d)', () => {
      expect(parse('(a OR b) AND (c OR d)')).toEqual({
        operator: 'AND',
        operands: [
          { operator: 'OR', operands: ['a', 'b'] },
          { operator: 'OR', operands: ['c', 'd'] },
        ],
      });
    });
  });

  describe('parentheses depth / weird spacing', () => {
    it.concurrent('handles very deep parentheses around a single term', () => {
      const deep = '('.repeat(50) + 'a' + ')'.repeat(50);
      expect(parse(deep)).toEqual({ operator: 'AND', operands: ['a'] });
    });

    it.concurrent('handles tabs/newlines around tokens', () => {
      expect(parse('\n\t(a\tAND\nb)\tOR\r\nc')).toEqual({
        operator: 'OR',
        operands: [{ operator: 'AND', operands: ['a', 'b'] }, 'c'],
      });
    });

    it.concurrent('handles irregular whitespace between every character group', () => {
      expect(parse('  NOT   (  some   AND  text )   OR   test ')).toEqual({
        operator: 'OR',
        operands: [
          { operator: 'NOT', operands: [{ operator: 'AND', operands: ['some', 'text'] }] },
          'test',
        ],
      });
    });
  });

  describe('unicode term edge cases', () => {
    it.concurrent('mixes scripts and numbers', () => {
      expect(parse('中文123 AND Привіт_42 OR test')).toEqual({
        operator: 'OR',
        operands: [{ operator: 'AND', operands: ['中文123', 'Привіт_42'] }, 'test'],
      });
    });

    it.concurrent('treats emoji as invalid character', () => {
      expect(() => parse('a AND 🙂')).toThrow(/Unexpected input/i);
    });
  });

  describe('invalid syntax that should throw', () => {
    it.concurrent('empty input', () => {
      expect(() => parse('   ')).toThrow(/missing operand/i);
    });

    it.concurrent('just parentheses', () => {
      expect(() => parse('()')).toThrow();
    });

    it.concurrent('binary operator at start', () => {
      expect(() => parse('AND a')).toThrow(/missing left operand/i);
    });

    it.concurrent('binary operator at end', () => {
      expect(() => parse('a OR')).toThrow(/missing operand/i);
    });

    it.concurrent('unexpected symbol', () => {
      expect(() => parse('a & b')).toThrow(/Unexpected input/i);
    });
  });

  describe('stress tests (long chains)', () => {
    it.concurrent('long AND chain stays flat', () => {
      const q = Array.from({ length: 200 }, (_, i) => `t${i}`).join(' AND ');
      const expr = parse(q);
      expect(expr.operator).toBe('AND');
      expect(expr.operands).toHaveLength(200);
    });

    it.concurrent('alternating operators produces nested structure', () => {
      const q = 'a AND b OR c AND d OR e AND f';
      expect(parse(q)).toEqual({
        operator: 'OR',
        operands: [
          { operator: 'AND', operands: ['a', 'b'] },
          { operator: 'AND', operands: ['c', 'd'] },
          { operator: 'AND', operands: ['e', 'f'] },
        ],
      });
    });
  });
});
