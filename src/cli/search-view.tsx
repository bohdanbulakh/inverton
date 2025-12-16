import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { Input } from './input';
import { SearchEngine } from '../search/search-engine';
import { SearchMode, SearchResult } from '../search/types';
import { SearchResultsLayout } from './search/search-results-layout';
import { DocumentInfoService } from '../search/document-info/document-info.interface';
import { tokenize } from '../index/tokenizer';

interface Props {
  searchEngine: SearchEngine;
  docInfoService: DocumentInfoService;
  onNavigate: (view: 'index') => void;
}

export const SearchView: React.FC<Props> = ({ searchEngine, docInfoService, onNavigate }) => {
  const [viewState, setViewState] = useState<'input' | 'results'>('input');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<SearchMode>(SearchMode.Keyword);
  const [activeElement, setActiveElement] = useState<'mode' | 'input'>('input');
  const [error, setError] = useState<string | null>(null);

  const [searchTerms, setSearchTerms] = useState<string[]>([]);

  useInput((_input, key) => {
    if (viewState === 'results') return;

    if (key.tab) {
      if (activeElement === 'mode') setActiveElement('input');
    }

    if (key.escape) {
      setActiveElement(activeElement === 'input' ? 'mode' : 'input');
    }
  });

  const handleSearch = async (value: string) => {
    if (!value.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await searchEngine.search(value, { limit: 20, mode });
      setResults(res);

      const tokens = tokenize(value, mode === SearchMode.Boolean);
      setSearchTerms(tokens);

      setViewState('results');
    } catch (err: any) {
      setResults([]);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const modeItems = [
    { label: 'Keyword (TF-IDF)', value: SearchMode.Keyword },
    { label: 'Phrase (Exact Sequence)', value: SearchMode.Phrase },
    { label: 'Boolean', value: SearchMode.Boolean },
  ];

  if (viewState === 'results') {
    return (
      <SearchResultsLayout
        results={results}
        terms={searchTerms}
        docInfoService={docInfoService}
        onExit={() => onNavigate('index')}
        onBack={() => setViewState('input')}
      />
    );
  }

  return (
    <Box flexDirection="column" height="100%" width="100%">
      <Box borderStyle="double" borderColor="magenta" paddingX={1} marginBottom={1} width="100%">
        <Text bold>
          {'Search Engine\n\nTab      - Toggle Focus\nEscape   - Toggle Mode\nCtrl + C - Exit'}
        </Text>
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
        {loading && <Text color="yellow">Searching...</Text>}
        {error && (
          <Box borderStyle="single" borderColor="red" paddingX={1}>
            <Text color="red">{error}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
