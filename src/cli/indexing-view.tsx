import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import * as fs from 'fs';
import * as path from 'path';
import { IndexingQueue } from '../index/indexing-queue';

interface Props {
  queue: IndexingQueue;
  onNavigate: (view: 'search') => void;
}

export const IndexingView: React.FC<Props> = ({ queue, onNavigate }) => {
  const [cwd, setCwd] = useState(process.cwd());
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadDirectory(cwd);
  }, [cwd]);

  const loadDirectory = (dir: string) => {
    try {
      const files = fs.readdirSync(dir);
      const fileItems = files.map((file) => {
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

      // Add parent directory option
      if (path.dirname(dir) !== dir) {
        fileItems.unshift({ label: '..', value: path.dirname(dir), isDir: true });
      }

      setItems(fileItems);
    } catch (err) {
      setMessage(`Error reading directory: ${err}`);
    }
  };

  const handleSelect = (item: any) => {
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

      <Box flexGrow={1} overflowY="hidden">
        <SelectInput items={items} onSelect={handleSelect} limit={10} />
      </Box>
    </Box>
  );
};
