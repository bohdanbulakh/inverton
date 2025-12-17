import React from 'react';
import { render } from 'ink-testing-library';
import { SearchEngine } from '../../src/search/search-engine';
import { SearchMode } from '../../src/search/types';
import { DocumentInfoService } from '../../src/search/document-info/document-info.interface';
import { jest } from '@jest/globals';
import stripAnsi from 'strip-ansi';

jest.unstable_mockModule('../../src/index/tokenizer', () => ({
  tokenize: jest.fn(() => ['test', 'query']),
}));

const mockReadFileWindow = jest.fn();
const mockCountLines = jest.fn();
jest.unstable_mockModule('../../src/fs/file-reader', () => ({
  readFileWindow: mockReadFileWindow,
  countLines: mockCountLines,
}));

let SearchView: typeof import('../../src/cli/search-view').SearchView;

beforeAll(async () => {
  ({ SearchView } = await import('../../src/cli/search-view'));
});

type SearchMethod = SearchEngine['search'];
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CLI: SearchView Advanced Interactions', () => {
  const mockSearch = jest.fn<SearchMethod>();
  const mockGetTermPositions = jest.fn<DocumentInfoService['getTermPositions']>();
  const mockOnNavigate = jest.fn();

  const mockSearchEngine = { search: mockSearch } as unknown as SearchEngine;
  const mockDocInfoService = { getTermPositions: mockGetTermPositions } as unknown as DocumentInfoService;

  const originalRows = process.stdout.rows;

  beforeEach(() => {
    jest.clearAllMocks();
    if (process.stdout.columns) (process.stdout as any).columns = 100;
    if (process.stdout.rows) (process.stdout as any).rows = 40;

    mockCountLines.mockResolvedValue(200 as never);
    mockReadFileWindow.mockImplementation((_path: any, start: any, end: any) => {
      const lines: string[] = [];
      for (let i = start; i <= end; i++) lines.push(`Line content ${i}`);
      return Promise.resolve({ lines, startLine: start, endLine: end });
    });
  });

  afterAll(() => {
    if (process.stdout.rows) (process.stdout as any).rows = originalRows;
  });

  it('allows navigating to results list via Tab and selecting a document', async () => {
    mockSearch.mockResolvedValue([
      { docId: '101', path: 'alpha.txt', score: 1.0 },
      { docId: '102', path: 'bravo.txt', score: 0.8 },
    ]);

    const { stdin } = render(
      <SearchView
        searchEngine={mockSearchEngine}
        docInfoService={mockDocInfoService}
        onNavigate={mockOnNavigate}
      />
    );
    await delay(100);

    stdin.write('test');
    await delay(50);
    stdin.write('\r');
    await delay(100);

    stdin.write('\t');
    await delay(200);

    stdin.write('\x1B[B');
    await delay(100);

    stdin.write('\r');
    await delay(100);

    expect(mockOnNavigate).toHaveBeenCalledWith('102');
  });

  it('handles result pagination (scrolling)', async () => {
    if (process.stdout.rows) (process.stdout as any).rows = 15;

    const manyResults = Array.from({ length: 50 }, (_, i) => ({
      docId: `${i}`,
      path: `file_${i}.txt`,
      score: 1.0,
    }));
    mockSearch.mockResolvedValue(manyResults);

    const { lastFrame, stdin } = render(
      <SearchView
        searchEngine={mockSearchEngine}
        docInfoService={mockDocInfoService}
        onNavigate={mockOnNavigate}
      />
    );
    await delay(100);

    stdin.write('scroll');
    await delay(50);
    stdin.write('\r');
    await delay(100);

    const initialOutput = stripAnsi(lastFrame() || '');

    const seesTopFiles = initialOutput.includes('file_0.txt') || initialOutput.includes('file_1.txt');
    expect(seesTopFiles).toBe(true);

    expect(initialOutput).not.toContain('file_49.txt');

    stdin.write('\t');
    await delay(100);

    for (let i = 0; i < 55; i++) {
      stdin.write('\x1B[B');
      if (i % 5 === 0) await delay(10);
    }
    await delay(300);

    const finalOutput = stripAnsi(lastFrame() || '');

    expect(finalOutput).toContain('file_49.txt');
  });

  it('performs Boolean search correctly', async () => {
    mockSearch.mockResolvedValue([]);

    const { lastFrame, stdin } = render(
      <SearchView
        searchEngine={mockSearchEngine}
        docInfoService={mockDocInfoService}
        onNavigate={mockOnNavigate}
      />
    );
    await delay(100);

    stdin.write('\x1B');
    await delay(50);

    stdin.write('\x1B[B');
    await delay(30);
    stdin.write('\x1B[B');
    await delay(30);
    stdin.write('\r');
    await delay(50);

    expect(stripAnsi(lastFrame() || '')).toContain('Search Mode: BOOLEAN');

    stdin.write('cat AND dog');
    await delay(50);
    stdin.write('\r');
    await delay(50);

    expect(mockSearch).toHaveBeenCalledWith('cat AND dog', expect.objectContaining({
      mode: SearchMode.Boolean,
    }));
  });
});
