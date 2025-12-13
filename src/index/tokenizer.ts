import { Transform, TransformCallback } from 'stream';
import { Token } from './types';

export const WORD_REGEX = /[\p{L}\p{N}_]+/gu;

export class Tokenizer extends Transform {
  private lineCounter = 0;
  private wordPosCounter = 0;

  constructor () {
    super({ objectMode: true });
  }

  _transform (line: string, _encoding: string, callback: TransformCallback): void {
    this.lineCounter++;

    const wordRegex = new RegExp(WORD_REGEX.source, WORD_REGEX.flags);

    let match;
    while ((match = wordRegex.exec(line)) !== null) {
      this.wordPosCounter++;
      const term = match[0];

      const token: Token = {
        term: term,
        line: this.lineCounter,
        position: this.wordPosCounter,
        length: term.length,
      };

      this.push(token);
    }

    callback();
  }
}
