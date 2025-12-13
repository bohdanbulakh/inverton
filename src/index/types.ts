export interface DocumentData {
  documentId: string;
  title: string;
  path: string;
}

export interface Position {
  line: number;
  position: number;
  length: number;
}

export interface Token extends Position {
  term: string;
}

export interface NormalizedToken extends Token {
  lemma: string;
}
