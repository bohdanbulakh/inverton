export interface DocumentData {
  docId: string;
  title: string;
  path: string;
}

export interface Position {
  line: number;
  pos: number;
  len: number;
}

export interface Token extends Position {
  term: string;
}

export interface NormalizedToken extends Token {
  lemma: string;
}
