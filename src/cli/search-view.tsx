import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Input } from './input';
import { SearchEngine } from '../search/search-engine';
import { SearchMode, SearchResult } from '../search/types';
import SelectInput from 'ink-select-input';

interface Props {
  searchEngine: SearchEngine;
  onNavigate: (view: 'index') => void;
}

function toErrorMessage (err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

export const SearchView: React.FC<Props> = ({ searchEngine, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<SearchMode>(SearchMode.Keyword);
  const [activeElement, setActiveElement] = useState<'mode' | 'input'>('input');
  const [error, setError] = useState<string | null>(null);

  useInput((input, key) => {
    if (key.tab) {
      if (activeElement === 'mode') setActiveElement('input');
      else onNavigate('index');
    }
    if (key.escape) {
      setActiveElement(activeElement === 'input' ? 'mode' : 'input');
    }
    if (error) setError(null);
  });

  const handleSearch = async (value: string) => {
    if (!value.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await searchEngine.search(value, { limit: 10, mode });
      setResults(res);
    } catch (err) {
      setResults([]);
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const modeItems = [
    { label: 'Keyword (TF-IDF)', value: SearchMode.Keyword },
    { label: 'Phrase (Exact Sequence)', value: SearchMode.Phrase },
    { label: 'Boolean (AND)', value: SearchMode.Boolean },
  ];

  return (
    <Box flexDirection="column" height="100%" width="100%">
      <Box borderStyle="double" borderColor="magenta" paddingX={1} marginBottom={1} width="100%">
        <Text bold>Search Engine (Tab: Index | Esc: Toggle Mode/Input)</Text>
      </Box>

      <Box
        flexDirection="column"
        marginBottom={1}
        borderStyle={activeElement === 'mode' ? 'round' : undefined}
        borderColor="green"
      >
        <Text bold>
          Search Mode: <Text color="cyan">{mode.toUpperCase()}</Text>
        </Text>

        {activeElement === 'mode' && (
          <SelectInput
            items={modeItems}
            onSelect={(item) => {
              setMode(item.value as SearchMode);
              setActiveElement('input');
              setError(null);
              setResults([]);
            }}
          />
        )}
      </Box>

      {activeElement === 'input' && (
        <Input
          label="Query"
          value={query}
          onChange={(v) => {
            setQuery(v);
            if (error) setError(null);
          }}
          onSubmit={handleSearch}
          placeholder={`Enter ${mode} search...`}
        />
      )}

      {activeElement !== 'input' && (
        <Box borderStyle="single" borderColor="grey" paddingX={1}>
          <Text color="grey">Select mode above...</Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column" width="100%" flexGrow={1}>
        {loading && <Text>Searching...</Text>}

        {!loading && error && (
          <Box borderStyle="single" borderColor="red" paddingX={1} flexDirection="column" width="100%">
            <Text bold color="red">Search error</Text>
            <Text color="red">{error}</Text>
          </Box>
        )}

        {!loading && !error && results.length === 0 && query && (
          <Text color="grey">No results found.</Text>
        )}

        {!loading && !error && results.map((res, idx) => (
          <Box
            key={idx}
            borderStyle="single"
            paddingX={1}
            marginBottom={1}
            flexDirection="column"
            width="100%"
          >
            <Box justifyContent="space-between" width="100%">
              <Text bold color="cyan">{res.path}</Text>
              <Text color="yellow">Score: {res.score.toFixed(4)}</Text>
            </Box>
            <Text color="gray">ID: {res.docId}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
