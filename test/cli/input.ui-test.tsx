import React from 'react';
import { render } from 'ink-testing-library';
import { Input } from '../../src/cli/input';
import { jest } from '@jest/globals';
import stripAnsi from 'strip-ansi';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CLI Component: Input', () => {
  it('renders label and handles user typing', async () => {
    const onChange = jest.fn();
    const onSubmit = jest.fn();

    const { lastFrame, stdin } = render(
      <Input
        label="Search"
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    await delay(50);
    expect(stripAnsi(lastFrame() || '')).toContain('Search:');

    stdin.write('h');
    await delay(50);

    expect(onChange).toHaveBeenCalledWith('h');
  });

  it('triggers onSubmit when Enter is pressed', async () => {
    const onSubmit = jest.fn();

    const { stdin } = render(
      <Input
        label="Search"
        value="final query"
        onChange={() => {}}
        onSubmit={onSubmit}
      />
    );

    await delay(50);

    stdin.write('\r');
    await delay(50);

    expect(onSubmit).toHaveBeenCalledWith('final query');
  });
});
