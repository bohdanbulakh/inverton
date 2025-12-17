import React from 'react';
import { render } from 'ink-testing-library';
import stripAnsi from 'strip-ansi';
import { StatusBar } from '../../src/cli/status-bar';

describe('CLI: StatusBar', () => {
  it('displays correct queue statistics', () => {
    const stats = {
      active: 2,
      processed: 10,
      failed: 1,
      total: 13,
      pending: 0,
    };

    const { lastFrame } = render(<StatusBar stats={stats} />);
    const output = stripAnsi(lastFrame() || '');

    expect(output).toContain('Active: 2');
    expect(output).toContain('Done: 10');
    expect(output).toContain('Failed: 1');
    expect(output).toContain('Total: 13');
  });

  it('updates when props change', () => {
    const { lastFrame, rerender } = render(
      <StatusBar stats={{ active: 0, processed: 0, failed: 0, total: 0 }} />
    );

    expect(stripAnsi(lastFrame() || '')).toContain('Total: 0');

    rerender(<StatusBar stats={{ active: 5, processed: 20, failed: 0, total: 25 }} />);

    expect(stripAnsi(lastFrame() || '')).toContain('Total: 25');
    expect(stripAnsi(lastFrame() || '')).toContain('Active: 5');
  });
});
