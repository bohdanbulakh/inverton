import { tokenize } from '../../src/index/tokenizer';

describe('tokenize', () => {
  describe('non-boolean mode (default)', () => {
    it.concurrent.each<
      [name: string, input: string, expected: string[]]
    >([
      ['empty string => []', '', []],
      ['whitespace only => []', '   \n\t  ', []],
      ['simple words', 'hello world', ['hello', 'world']],
      ['multiple whitespace', '  hello   world  ', ['hello', 'world']],
      ['punctuation splits', 'hello, world!', ['hello', 'world']],
      ['underscore kept', 'snake_case_123', ['snake_case_123']],
      ['unicode letters', 'Привіт світе', ['Привіт', 'світе']],
      ['mixed scripts and numbers', '中文123 test42', ['中文123', 'test42']],
      ['operators treated as regular words (non-boolean)', 'a and b OR not', ['a', 'and', 'b', 'OR', 'not']],
      ['parentheses ignored (non-boolean)', '(a AND b)', ['a', 'AND', 'b']],
      ['emoji skipped (non-boolean regex matches words only)', 'a 🙂 b', ['a', 'b']],
    ])('%s', async (_name, input, expected) => {
      expect(tokenize(input)).toEqual(expected);
    });
  });

  describe('boolean mode', () => {
    it.concurrent.each<
      [name: string, input: string, expected: string[]]
    >([
      ['single term', 'hello', ['hello']],
      ['trims whitespace', '   hello   ', ['hello']],
      ['keeps parentheses as tokens', '(a)', ['(', 'a', ')']],
      ['parentheses with spaces', ' ( a ) ', ['(', 'a', ')']],
      ['simple AND', 'a AND b', ['a', 'AND', 'b']],
      ['simple OR', 'a OR b', ['a', 'OR', 'b']],
      ['simple NOT', 'NOT a', ['NOT', 'a']],
      ['case-insensitive operators', 'a aNd b oR nOt c', ['a', 'AND', 'b', 'OR', 'NOT', 'c']],
      ['operators only when standalone word', 'candy AND oryx OR notation', ['candy', 'AND', 'oryx', 'OR', 'notation']],
      ['operator substrings inside words stay terms', 'ANDy OR ORacle AND NOTary', ['ANDy', 'OR', 'ORacle', 'AND', 'NOTary']],
      ['glued to underscores stays term', 'x_and_y OR not_me', ['x_and_y', 'OR', 'not_me']],
      ['digits around operator substrings stay term', 'or2 AND 2or', ['or2', 'AND', '2or']],
      ['unicode terms in boolean mode', '中文123 AND Привіт_42 OR test', ['中文123', 'AND', 'Привіт_42', 'OR', 'test']],
      ['newlines and tabs', '\n\t(a\tAND\nb)\tOR\r\nc', ['(', 'a', 'AND', 'b', ')', 'OR', 'c']],
      ['deep parentheses', '((((a))))', ['(', '(', '(', '(', 'a', ')', ')', ')', ')']],
      [
        'complex example',
        'NOT (some AND text) OR test OR (value AND key AND button AND NOT input)',
        ['NOT', '(', 'some', 'AND', 'text', ')', 'OR', 'test', 'OR', '(', 'value', 'AND', 'key', 'AND', 'button', 'AND', 'NOT', 'input', ')'],
      ],
    ])('%s', async (_name, input, expected) => {
      expect(tokenize(input, true)).toEqual(expected);
    });

    describe('throws on unexpected input (boolean mode)', () => {
      it.concurrent.each<[name: string, input: string, expectedMsg: RegExp]>([
        ['unexpected symbol &', 'a & b', /Unexpected input/i],
        ['unexpected punctuation $', 'a AND b$', /Unexpected input/i],
        ['emoji is unexpected', 'a AND 🙂', /Unexpected input/i],
      ])('%s', async (_name, input, expectedMsg) => {
        expect(() => tokenize(input, true)).toThrow(expectedMsg);
      });

      it.concurrent('error includes the offending chunk and position (spot-check)', () => {
        try {
          tokenize('a & b', true);
          throw new Error('Expected tokenize to throw');
        } catch (e) {
          const msg = (e as Error).message;
          expect(msg).toMatch(/Unexpected input:/);
          expect(msg).toMatch(/&/);
          expect(msg).toMatch(/position/i);
        }
      });
    });

    describe('does not throw on syntactically invalid but lexically valid input (parser should reject)', () => {
      it.concurrent.each<[name: string, input: string, expected: string[]]>([
        ['stray ) at start is still a valid lexeme', ') a', [')', 'a']],
        ['unclosed ( at end is still a valid lexeme', 'a AND (', ['a', 'AND', '(']],
        ['empty parens are lexically valid', '()', ['(', ')']],
      ])('%s', async (_name, input, expected) => {
        expect(tokenize(input, true)).toEqual(expected);
      });
    });

    describe('operator normalization details', () => {
      it.concurrent.each<
        [name: string, input: string, expected: string[]]
      >([
        ['AND lowercased becomes AND', 'a and b', ['a', 'AND', 'b']],
        ['Or mixed becomes OR', 'a oR b', ['a', 'OR', 'b']],
        ['not mixed becomes NOT', 'nOt a', ['NOT', 'a']],
        ['term casing is preserved', 'Foo AND Bar', ['Foo', 'AND', 'Bar']],
      ])('%s', async (_name, input, expected) => {
        expect(tokenize(input, true)).toEqual(expected);
      });

      it.concurrent('operator words inside longer words are NOT normalized', () => {
        expect(tokenize('candy AND oryx OR notation', true)).toEqual([
          'candy',
          'AND',
          'oryx',
          'OR',
          'notation',
        ]);
      });
    });

    describe('spacing quirks', () => {
      it.concurrent.each<
        [name: string, input: string, expected: string[]]
      >([
        ['no spaces around parentheses', '(aANDb)', ['(', 'aANDb', ')']], // no implicit splitting inside WORD chars
        ['spaces between every token', ' ( a ) AND ( b ) ', ['(', 'a', ')', 'AND', '(', 'b', ')']],
        ['multiple spaces', 'a   AND   b', ['a', 'AND', 'b']],
      ])('%s', async (_name, input, expected) => {
        expect(tokenize(input, true)).toEqual(expected);
      });
    });
  });
});
