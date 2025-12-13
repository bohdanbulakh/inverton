import { Transform, TransformCallback } from 'stream';
import { Token } from './types';

export class TokenizerStream extends Transform {
  private lineCounter = 0;
  private wordPosCounter = 0;

  constructor () {
    super({ objectMode: true });
  }

  _transform (line: string, _encoding: string, callback: TransformCallback): void {
    this.lineCounter++;

    const wordRegex = /[\p{L}\p{N}_]+/gu;

    let match;
    while ((match = wordRegex.exec(line)) !== null) {
      this.wordPosCounter++;
      const term = match[0];

      const token: Token = {
        term: term,
        line: this.lineCounter,
        pos: this.wordPosCounter,
        len: term.length,
      };

      this.push(token);
    }

    callback();
  }
}
