import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import * as fs from 'fs';
import * as path from 'path';
import { IndexingQueue } from '../index/indexing-queue';

interface Props {
  queue: IndexingQueue;
  onNavigate: (view: 'search') => void;
}

interface FileItem {
  label: string;
  value: string;
  isDir: boolean;
}

export const IndexingView: React.FC<Props> = ({ queue, onNavigate }) => {
  const [cwd, setCwd] = useState(process.cwd());
  const [items, setItems] = useState<FileItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [offset, setOffset] = useState(0);

  const { stdout } = useStdout();

  const [termHeight, setTermHeight] = useState(() => stdout?.rows ?? 24);

  useEffect(() => {
    if (!stdout) return;

    const onResize = () => setTermHeight(stdout.rows);
    stdout.on('resize', onResize);

    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  const VISIBLE_ITEMS = useMemo(() => Math.max(1, termHeight - 12), [termHeight]);

  const loadDirectory = useCallback((dir: string) => {
    try {
      const files = fs.readdirSync(dir);

      const fileItems: FileItem[] = files.map((file) => {
        const fullPath = path.join(dir, file);
        let isDir = false;
        try {
          isDir = fs.statSync(fullPath).isDirectory();
        } catch {
          // ignore stat errors
        }
        return { label: isDir ? `[DIR] ${file}` : file, value: fullPath, isDir };
      });

      fileItems.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.label.localeCompare(b.label);
      });

      const parentDir = path.dirname(dir);
      if (parentDir !== dir) {
        fileItems.unshift({ label: '..', value: parentDir, isDir: true });
      }

      setItems(fileItems);
      setSelectedIndex(0);
      setOffset(0);
      setMessage('');
    } catch (err) {
      setMessage(`Error reading directory: ${String(err)}`);
      setItems([]);
      setSelectedIndex(0);
      setOffset(0);
    }
  }, []);

  useEffect(() => {
    loadDirectory(cwd);
  }, [cwd, loadDirectory]);

  useEffect(() => {
    setOffset((prev) => {
      if (selectedIndex >= prev + VISIBLE_ITEMS) return Math.max(0, selectedIndex - VISIBLE_ITEMS + 1);
      if (selectedIndex < prev) return selectedIndex;
      return prev;
    });
  }, [selectedIndex, VISIBLE_ITEMS]);

  const handleReturnToParent = useCallback(() => {
    const parent = items.find((f) => f.isDir && f.label === '..');
    if (parent) setCwd(parent.value);
  }, [items]);

  const handleSelect = useCallback(() => {
    const item = items[selectedIndex];
    if (!item) return;

    if (item.isDir) {
      setCwd(item.value);
      return;
    }

    queue.enqueue(item.value);
    setMessage(`Queued: ${path.basename(item.value)}`);
    setTimeout(() => setMessage(''), 2000);
  }, [items, selectedIndex, queue]);

  useInput((_input, key) => {
    if (key.tab) {
      onNavigate('search');
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
      return;
    }

    if (key.leftArrow) {
      handleReturnToParent();
      return;
    }

    if (key.return || key.rightArrow) {
      handleSelect();
    }
  });

  const visibleItems = items.slice(offset, offset + VISIBLE_ITEMS);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box borderStyle="double" borderColor="magenta" paddingX={1} marginBottom={1}>
        <Text bold>
          {'File Browser\n\nEnter   - Open\nTab     - Search\nEsc     - Exit'}
        </Text>
      </Box>

      <Box paddingX={1} marginBottom={1} width="100%">
        <Text color="yellow">Current Dir: {cwd}</Text>
      </Box>

      {message ? (
        <Box paddingX={1} marginBottom={1} width="100%">
          <Text color="green">{message}</Text>
        </Box>
      ) : null}

      <Box flexDirection="column" flexGrow={1} width="100%">
        {visibleItems.length > 0 ? (
          visibleItems.map((item, index) => {
            const actualIndex = offset + index;
            const isSelected = actualIndex === selectedIndex;

            return (
              <Box key={item.value + actualIndex} width="100%">
                <Text color={isSelected ? 'green' : 'white'} bold={isSelected} wrap="truncate-end">
                  {isSelected ? '> ' : '  '}
                  {item.label}
                </Text>
              </Box>
            );
          })
        ) : (
          <Text color="gray">Directory is empty</Text>
        )}
      </Box>
    </Box>
  );
};
