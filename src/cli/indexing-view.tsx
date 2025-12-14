import React, { useState, useEffect, useCallback } from 'react';
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
  const [windowHeight, setWindowHeight] = useState(stdout?.rows || 24);

  const VISIBLE_ITEMS = Math.max(1, windowHeight - 12);

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => {
      setWindowHeight(stdout.rows);
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  useEffect(() => {
    loadDirectory(cwd);
  }, [cwd]);

  useEffect(() => {
    if (selectedIndex >= offset + VISIBLE_ITEMS) {
      setOffset(Math.max(0, selectedIndex - VISIBLE_ITEMS + 1));
    } else if (selectedIndex < offset) {
      setOffset(selectedIndex);
    }
  }, [selectedIndex, offset, VISIBLE_ITEMS]);

  const loadDirectory = (dir: string) => {
    try {
      const files = fs.readdirSync(dir);
      const fileItems: FileItem[] = files.map((file) => {
        const fullPath = path.join(dir, file);
        let isDir = false;
        try {
          isDir = fs.statSync(fullPath).isDirectory();
        } catch {}
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
    } catch (err) {
      setMessage(`Error reading directory: ${err}`);
    }
  };

  const handleSelect = () => {
    const item = items[selectedIndex];
    if (!item) return;

    if (item.isDir) {
      setCwd(item.value);
    } else {
      queue.enqueue(item.value);
      setMessage(`Queued: ${path.basename(item.value)}`);
      setTimeout(() => setMessage(''), 2000);
    }
  };

  const handleReturnToParent = useCallback(() => {
    const [parent] = items.filter((file) => file.isDir && file.label === '..');

    if (parent) {
      setCwd(parent.value);
    }
  }, [items]);

  useInput((_input, key) => {
    if (key.tab) {
      onNavigate('search'); return;
    }
    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }
    if (key.downArrow) {
      setSelectedIndex(Math.min(items.length - 1, selectedIndex + 1));
    }
    if (key.leftArrow) {
      handleReturnToParent();
    }
    if (key.return || key.rightArrow) {
      handleSelect();
    }
  });

  const visibleItems = items.slice(offset, offset + VISIBLE_ITEMS);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box borderStyle="double" borderColor="cyan" paddingX={1} marginBottom={1}>
        <Text bold>File Browser (Press Enter to Index, Tab to Search)</Text>
      </Box>
      <Box paddingX={1} marginBottom={1} width="100%">
        <Text color="yellow">Current Dir: {cwd}</Text>
      </Box>
      {message && (
        <Box paddingX={1} marginBottom={1} width="100%">
          <Text color="green">{message}</Text>
        </Box>
      )}
      <Box flexDirection="column" flexGrow={1} width="100%">
        {visibleItems.length > 0 ? visibleItems.map((item, index) => {
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
        }) : (
          <Text color="gray">Directory is empty</Text>
        )}
      </Box>
    </Box>
  );
};
