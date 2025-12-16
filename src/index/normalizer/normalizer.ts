import { DocumentInfoService } from '../../search/document-info/document-info.interface';

const BOOL_OPS = new Set(['AND', 'OR', 'NOT']);

export class Normalizer {
  constructor (private readonly docInfo: DocumentInfoService) {}

  async normalizeTerms (terms: string[], isBooleanQuery = false): Promise<string[]> {
    if (!isBooleanQuery) {
      const lemmas = await this.fetchLemmas(terms);
      const isStop = await this.checkStopWords(lemmas);

      const out: string[] = [];
      for (let i = 0; i < terms.length; i++) {
        if (!isStop[i]) out.push(lemmas[i]);
      }
      return out;
    }

    const termValues: string[] = [];
    for (const t of terms) {
      const upper = t.toUpperCase();
      if (t === '(' || t === ')') continue;
      if (BOOL_OPS.has(upper)) continue;
      termValues.push(t);
    }

    const lemmas = await this.fetchLemmas(termValues);

    const out: string[] = [];
    let termPtr = 0;

    for (const t of terms) {
      const upper = t.toUpperCase();

      if (t === '(' || t === ')') {
        out.push(t);
        continue;
      }

      if (BOOL_OPS.has(upper)) {
        out.push(upper);
        continue;
      }

      out.push(lemmas[termPtr]);
      termPtr++;
    }

    return out;
  }

  async normalizeForIndexing (terms: string[]): Promise<(string | null)[]> {
    const lemmas = await this.fetchLemmas(terms);
    const isStop = await this.checkStopWords(lemmas);

    return terms.map((_, i) => (isStop[i] ? null : lemmas[i]));
  }

  private async fetchLemmas (terms: string[]): Promise<string[]> {
    if (terms.length === 0) return [];

    const vals = await this.docInfo.getLemmas(terms);
    return vals.map((val, i) => (val ? val : terms[i].toLowerCase()));
  }

  private async checkStopWords (lemmas: string[]): Promise<boolean[]> {
    if (lemmas.length === 0) return [];
    return this.docInfo.areStopWords(lemmas);
  }
}
