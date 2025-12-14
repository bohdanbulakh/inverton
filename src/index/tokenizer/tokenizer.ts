const WORD_REGEX = /[\p{L}\p{N}_]+/gu;

export function tokenize (query: string): string[] {
  const regExp = new RegExp(WORD_REGEX.source, WORD_REGEX.flags);
  return query.match(regExp) || [];
}
