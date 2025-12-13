export interface DocumentData {
	docId: number;
	title: string;
	path: string;
}

export interface PostingsList {
	tf: number;
	positions: Position[];
}

export interface Position {
  line: number;
  start: number;
  length: number;
}

export type TermDocuments = Map<string, PostingsList>
export type InvertedIndex = Map<string, TermDocuments>
