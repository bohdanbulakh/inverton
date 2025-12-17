import React from 'react';
import { render } from 'ink-testing-library';
import { IndexingQueue } from '../../src/index/indexing-queue';
import { jest } from '@jest/globals';
import stripAnsi from 'strip-ansi';

const mockReaddirSync = jest.fn();
const mockStatSync = jest.fn();

jest.unstable_mockModule('fs', () => ({
  readdirSync: mockReaddirSync,
  statSync: mockStatSync,
}));

let IndexingView: typeof import('../../src/cli/indexing-view').IndexingView;

beforeAll(async () => {
  ({ IndexingView } = await import('../../src/cli/indexing-view'));
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('CLI: IndexingView', () => {
  const mockEnqueue = jest.fn();
  const mockOnNavigate = jest.fn();
  const mockQueue = { enqueue: mockEnqueue } as unknown as IndexingQueue;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReaddirSync.mockImplementation((dirPath: any) => {
      if (dirPath === '/home/user') return ['docs', 'notes.txt'];
      if (dirPath === '/home/user/docs') return ['file1.txt', 'file2.txt'];
      return [];
    });

    mockStatSync.mockImplementation((filePath: any) => ({
      isDirectory: () => !filePath.includes('.txt'),
    }));

    jest.spyOn(process, 'cwd').mockReturnValue('/home/user');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders directory listing', async () => {
    const { lastFrame } = render(
      <IndexingView queue={mockQueue} onNavigate={mockOnNavigate} />
    );
    await delay(50);

    const output = stripAnsi(lastFrame() || '');
    expect(output).toContain('Current Dir: /home/user');
    expect(output).toContain('[DIR] docs');
    expect(output).toContain('notes.txt');
  });

  it('navigates into directories and enqueues files', async () => {
    const { lastFrame, stdin } = render(
      <IndexingView queue={mockQueue} onNavigate={mockOnNavigate} />
    );
    await delay(50);

    stdin.write('\x1B[B');
    await delay(20);

    stdin.write('\r');
    await delay(20);

    const outputDir = stripAnsi(lastFrame() || '');
    expect(outputDir).toContain('Current Dir: /home/user/docs');
    expect(outputDir).toContain('file1.txt');

    stdin.write('\x1B[B');
    await delay(20);
    stdin.write('\r');
    await delay(20);

    expect(mockEnqueue).toHaveBeenCalledWith(expect.stringContaining('file1.txt'));
  });

  it('navigates to Search View on Tab', async () => {
    const { stdin } = render(
      <IndexingView queue={mockQueue} onNavigate={mockOnNavigate} />
    );
    await delay(20);

    stdin.write('\t');
    await delay(20);

    expect(mockOnNavigate).toHaveBeenCalledWith('search');
  });
});
