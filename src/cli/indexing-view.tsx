import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
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
  const VISIBLE_ITEMS = 10;

  useEffect(() => {
    loadDirectory(cwd);
  }, [cwd]);

  const loadDirectory = (dir: string) => {
    try {
      const files = fs.readdirSync(dir);
      const fileItems: FileItem[] = files.map((file) => {
        const fullPath = path.join(dir, file);
        let isDir = false;
        try {
          isDir = fs.statSync(fullPath).isDirectory();
        } catch {
          // ignore inaccessible files
        }
        return {
          label: isDir ? `[DIR] ${file}` : file,
          value: fullPath,
          isDir,
        };
      });

      // Sort: Directories first, then files
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

  useInput((input, key) => {
    if (key.tab) {
      onNavigate('search');
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));

      if (selectedIndex - 1 < offset) {
        setOffset((oldOffset) => Math.max(0, oldOffset - 1));
      }
    }

    if (key.downArrow) {
      setSelectedIndex(Math.min(items.length - 1, selectedIndex + 1));

      if (selectedIndex + 1 >= offset + VISIBLE_ITEMS) {
        setOffset((oldOffset) => oldOffset + 1);
      }
    }

    if (key.return) {
      handleSelect();
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="double" borderColor="cyan" paddingX={1} marginBottom={1}>
        <Text bold>File Browser (Press Enter to Index, Tab to Search)</Text>
      </Box>

      <Box paddingX={1} marginBottom={1}>
        <Text color="yellow">Current Dir: {cwd}</Text>
      </Box>

      {message && (
        <Box paddingX={1} marginBottom={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}

      <Box flexDirection="column" flexGrow={1}>
        {items.slice(offset, offset + VISIBLE_ITEMS).map((item, index) => {
          const actualIndex = offset + index;
          const isSelected = actualIndex === selectedIndex;

          return (
            <Box key={item.value + index}>
              <Text color={isSelected ? 'green' : 'white'} bold={isSelected}>
                {isSelected ? '> ' : '  '}
                {item.label}
              </Text>
            </Box>
          );
        })}
        {items.length === 0 && <Text color="gray">Directory is empty</Text>}
      </Box>
    </Box>
  );
};
