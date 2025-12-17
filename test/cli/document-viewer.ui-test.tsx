import React from 'react';
import { render } from 'ink-testing-library';
import { jest } from '@jest/globals';
import stripAnsi from 'strip-ansi';

const mockReadFileWindow = jest.fn();
const mockCountLines = jest.fn();

jest.unstable_mockModule('../../src/fs/file-reader', () => ({
  readFileWindow: mockReadFileWindow,
  countLines: mockCountLines,
}));

let DocumentViewer: typeof import('../../src/cli/search/document-viewer').DocumentViewer;

beforeAll(async () => {
  ({ DocumentViewer } = await import('../../src/cli/search/document-viewer'));
});

interface Highlight {
  line: number;
  position: number;
  length: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CLI: DocumentViewer', () => {
  const mockFilePath = '/docs/test.txt';

  const mockHighlights: Highlight[] = [
    { line: 2, position: 5, length: 4 },
    { line: 10, position: 0, length: 3 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockCountLines.mockResolvedValue(20 as never);

    mockReadFileWindow.mockImplementation((path: any, start: any, end: any) => {
      const lines = [];
      for (let i = start; i <= end; i++) {
        lines.push(`Line content ${i}`);
      }
      return Promise.resolve({ lines, startLine: start, endLine: end });
    });
  });

  it('renders file content and highlights', async () => {
    const { lastFrame } = render(
      <DocumentViewer
        filePath={mockFilePath}
        highlights={mockHighlights}
        isActive={true}
        height={5}
      />
    );

    await delay(50);

    const output = stripAnsi(lastFrame() || '');
    expect(output).toContain('Line content 1');
    expect(output).toContain('Line content 2');
    expect(output).toContain('Matches: 2');
  });

  it('scrolls content with Up/Down arrows', async () => {
    const { lastFrame, stdin } = render(
      <DocumentViewer
        filePath={mockFilePath}
        highlights={[]}
        isActive={true}
        height={3}
      />
    );
    await delay(50);

    expect(stripAnsi(lastFrame() || '')).toContain('Line content 1');

    stdin.write('\x1B[B');
    await delay(20);

    const output = stripAnsi(lastFrame() || '');
    expect(output).toContain('Line content 2');
  });

  it('navigates between highlights using n/p keys', async () => {
    const { lastFrame, stdin } = render(
      <DocumentViewer
        filePath={mockFilePath}
        highlights={mockHighlights}
        isActive={true}
        height={3}
      />
    );
    await delay(50);

    stdin.write('n');
    await delay(20);

    const outputNext = stripAnsi(lastFrame() || '');
    expect(outputNext).toContain('Line content 10');

    stdin.write('p');
    await delay(20);

    const outputPrev = stripAnsi(lastFrame() || '');
    expect(outputPrev).toContain('Line content 2');
  });
});
