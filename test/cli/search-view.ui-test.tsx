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

describe('CLI: SearchView Flow', () => {
  const mockSearch = jest.fn<SearchMethod>();
  const mockGetTermPositions = jest.fn<DocumentInfoService['getTermPositions']>();
  const mockOnNavigate = jest.fn();

  const mockSearchEngine = { search: mockSearch } as unknown as SearchEngine;
  const mockDocInfoService = { getTermPositions: mockGetTermPositions } as unknown as DocumentInfoService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCountLines.mockResolvedValue(200 as never);
    mockReadFileWindow.mockImplementation((_path: any, start: any, end: any) => {
      const lines: string[] = [];
      for (let i = start; i <= end; i++) lines.push(`Line content ${i}`);
      return Promise.resolve({ lines, startLine: start, endLine: end });
    });
  });

  it('renders initial state with Keyword mode', async () => {
    const { lastFrame } = render(
      <SearchView
        searchEngine={mockSearchEngine}
        docInfoService={mockDocInfoService}
        onNavigate={mockOnNavigate}
      />
    );
    await delay(50);

    const output = stripAnsi(lastFrame() || '');
    expect(output).toContain('Search Engine');
    expect(output).toContain('Search Mode: KEYWORD');
    expect(output).toContain('Query:');
  });

  it('switches search mode when interacting with SelectInput', async () => {
    const { lastFrame, stdin } = render(
      <SearchView
        searchEngine={mockSearchEngine}
        docInfoService={mockDocInfoService}
        onNavigate={mockOnNavigate}
      />
    );
    await delay(50);

    stdin.write('\x1B');
    await delay(50);

    expect(stripAnsi(lastFrame() || '')).toContain('Select mode above...');

    stdin.write('\x1B[B');
    await delay(50);

    stdin.write('\r');
    await delay(50);

    const output = stripAnsi(lastFrame() || '');
    expect(output).toContain('Search Mode: PHRASE');
    expect(output.toLowerCase()).toContain('enter phrase search...');
  });

  it('executes search and displays results', async () => {
    mockSearch.mockResolvedValue([
      { docId: '1', path: '/file1.txt', score: 1.5 },
      { docId: '2', path: '/file2.txt', score: 0.9 },
    ]);

    const { lastFrame, stdin } = render(
      <SearchView
        searchEngine={mockSearchEngine}
        docInfoService={mockDocInfoService}
        onNavigate={mockOnNavigate}
      />
    );
    await delay(50);

    stdin.write('a');
    await delay(50);

    stdin.write('\r');
    await delay(100);

    expect(mockSearch).toHaveBeenCalledWith('a', expect.objectContaining({
      mode: SearchMode.Keyword,
    }));

    const output = stripAnsi(lastFrame() || '');
    expect(output).toContain('Results (2)');
    expect(output).toContain('file1.txt');
  });

  it('displays error message when search fails', async () => {
    mockSearch.mockRejectedValue(new Error('Redis connection failed'));

    const { lastFrame, stdin } = render(
      <SearchView
        searchEngine={mockSearchEngine}
        docInfoService={mockDocInfoService}
        onNavigate={mockOnNavigate}
      />
    );
    await delay(50);

    stdin.write('a');
    await delay(50);

    stdin.write('\r');
    await delay(100);

    expect(stripAnsi(lastFrame() || '')).toContain('Redis connection failed');
  });
});
