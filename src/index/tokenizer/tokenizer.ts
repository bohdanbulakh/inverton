import { BOOLEAN_LEXEME_REGEX } from '../../search/boolean-query-resolver';

const WORD_REGEX = /[\p{L}\p{N}_]+/gu;

const BOOL_OPS = new Set(['AND', 'OR', 'NOT']);

export function tokenize (query: string, isBooleanQuery = false): string[] {
  if (!isBooleanQuery) {
    const regExp = new RegExp(WORD_REGEX.source, WORD_REGEX.flags);
    return query.match(regExp) || [];
  }

  const out: string[] = [];
  let consumed = 0;

  for (const match of query.matchAll(BOOLEAN_LEXEME_REGEX)) {
    const [full, lexeme] = match;
    const start = match.index ?? 0;

    if (start > consumed) {
      const skipped = query.slice(consumed, start);
      if (skipped.trim().length) {
        throw new Error(`Unexpected input: "${skipped}" at position ${consumed}`);
      }
    }

    consumed = start + full.length;

    if (lexeme === '(' || lexeme === ')') {
      out.push(lexeme);
      continue;
    }

    const upper = lexeme.toUpperCase();
    out.push(BOOL_OPS.has(upper) ? upper : lexeme);
  }

  if (consumed < query.length) {
    const rest = query.slice(consumed);
    if (rest.trim().length) {
      throw new Error(`Unexpected input: "${rest}" at position ${consumed}`);
    }
  }

  return out;
}
