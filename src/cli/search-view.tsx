import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SearchEngine } from '../search/search-engine';
import { SearchResult } from '../search/types';
import { Input } from './input';

interface Props {
  searchEngine: SearchEngine;
  onNavigate: (view: 'index') => void;
}

export const SearchView: React.FC<Props> = ({ searchEngine, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useInput((input, key) => {
    if (key.tab) {
      onNavigate('index');
    }
  });

  const handleSearch = async (value: string) => {
    if (!value.trim()) return;
    setLoading(true);
    try {
      const res = await searchEngine.search(value, { limit: 10 });
      setResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="double" borderColor="magenta" paddingX={1} marginBottom={1}>
        <Text bold>Search Engine (Tab to Browse Files)</Text>
      </Box>

      <Input
        label="Query"
        value={query}
        onChange={setQuery}
        onSubmit={handleSearch}
        placeholder="Enter search terms..."
      />

      <Box marginTop={1} flexDirection="column">
        {loading && <Text>Searching...</Text>}

        {!loading && results.length === 0 && query && (
          <Text color="grey">No results found.</Text>
        )}

        {results.map((res, idx) => (
          <Box key={idx} borderStyle="single" paddingX={1} marginBottom={1} flexDirection="column">
            <Box justifyContent="space-between">
              <Text bold color="cyan">{res.docId}</Text>
              <Text color="yellow">Score: {res.score.toFixed(4)}</Text>
            </Box>
            <Text>Match found in document.</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
