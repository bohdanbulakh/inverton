import { Transform, TransformCallback } from 'stream';
import { Token } from '../types';

const WORD_REGEX = /[\p{L}\p{N}_]+/gu;

export class TokenizerStream extends Transform {
  private lineCounter = 0;

  constructor () {
    super({ objectMode: true });
  }

  _transform (line: string, _encoding: string, callback: TransformCallback): void {
    this.lineCounter++;

    for (const match of line.matchAll(WORD_REGEX)) {
      const term = match[0];
      const position = match.index;

      if (position !== undefined) {
        const token: Token = {
          term,
          line: this.lineCounter,
          position: position,
          length: term.length,
        };

        this.push(token);
      }
    }

    callback();
  }
}
