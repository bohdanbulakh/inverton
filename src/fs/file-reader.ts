import * as fs from 'fs';
import * as readline from 'readline';

export interface FileWindow {
  lines: string[];
  startLine: number;
  totalLines?: number;
}

export async function readFileWindow (
  filePath: string,
  startLine: number,
  endLine: number
): Promise<FileWindow> {
  const fileStream = fs.createReadStream(filePath, {
    encoding: 'utf8',
    highWaterMark: 64 * 1024,
  });

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const lines: string[] = [];
  let currentLine = 0;

  for await (const line of rl) {
    currentLine++;
    if (currentLine >= startLine && currentLine <= endLine) {
      lines.push(line);
    }
    if (currentLine > endLine) {
      rl.close();
      fileStream.destroy();
      break;
    }
  }

  return { lines, startLine };
}

export async function countLines (filePath: string): Promise<number> {
  const stream = fs.createReadStream(filePath);
  let count = 0;
  for await (const chunk of stream) {
    for (const char of chunk as Buffer) {
      if (char === 10) count++;
    }
  }
  return count + 1;
}
