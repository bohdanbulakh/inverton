import { Transform, TransformCallback } from 'stream';
import { Token } from '../types';
import { tokenize } from './tokenizer';

export class TokenizerStream extends Transform {
  private lineCounter = 0;
  private wordPosCounter = 0;

  constructor () {
    super({ objectMode: true });
  }

  _transform (line: string, _encoding: string, callback: TransformCallback): void {
    this.lineCounter++;

    for (const term of tokenize(line)) {
      this.wordPosCounter++;

      const token: Token = {
        term,
        line: this.lineCounter,
        position: this.wordPosCounter,
        length: term.length,
      };

      this.push(token);
    }

    callback();
  }
}
