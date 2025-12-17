import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { SearchResult } from '../../search/types';
import { DocumentViewer, Highlight } from './document-viewer';
import { DocumentInfoService } from '../../search/document-info/document-info.interface';

interface Props {
  results: SearchResult[];
  terms: string[];
  docInfoService: DocumentInfoService;
  onExit: () => void;
  onBack: () => void;
  onOpenDocument: (docId: string) => void;
}

export const SearchResultsLayout: React.FC<Props> = ({
  results,
  terms,
  docInfoService,
  onExit,
  onBack,
  onOpenDocument,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activePane, setActivePane] = useState<'list' | 'content'>('content');
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  const { stdout } = useStdout();
  const height = Math.max(8, (stdout?.rows || 24) - 2);

  const listViewportSize = Math.max(1, height - 4);
  const listScrollOffset = Math.min(
    Math.max(0, activeIndex - Math.floor(listViewportSize / 2)),
    Math.max(0, results.length - listViewportSize)
  );
  const visibleResults = results.slice(listScrollOffset, listScrollOffset + listViewportSize);

  const currentResult = results[activeIndex];

  useEffect(() => {
    if (currentResult) {
      const docId = currentResult.docId;
      Promise.all(terms.map(async (term) => {
        try {
          const posStrings = await docInfoService.getTermPositions(term, docId);
          return posStrings.map((s) => {
            const [line, pos, len] = s.split(':').map(Number);
            return { line, position: pos, length: len };
          });
        } catch {
          return [];
        }
      })).then((arrays) => {
        setHighlights(arrays.flat());
      });
    } else {
      setHighlights([]);
    }
  }, [activeIndex, currentResult, terms, docInfoService]);

  useInput((_input, key) => {
    if (key.escape) {
      if (activePane === 'content') setActivePane('list');
      else onBack();
      return;
    }

    if (key.tab && results.length > 0) {
      setActivePane((prev) => prev === 'list' ? 'content' : 'list');
      return;
    }

    if (activePane === 'list' && results.length > 0) {
      if (key.upArrow) setActiveIndex((i) => Math.max(0, i - 1));
      if (key.downArrow) setActiveIndex((i) => Math.min(results.length - 1, i + 1));

      if (key.return) {
        const selected = results[activeIndex];
        if (selected) onOpenDocument(selected.docId);
      }
    }
  });

  return (
    <Box flexDirection="row" width="100%" height={height}>
      {/* Left Pane: Documents List */}
      <Box
        flexDirection="column"
        width="30%"
        borderStyle="single"
        borderColor={activePane === 'list' ? 'green' : 'grey'}
      >
        <Box borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} marginBottom={1}>
          <Text bold>Results ({results.length})</Text>
        </Box>

        {results.length === 0 ? (
          <Text color="gray" italic>No results found.</Text>
        ) : (
          <Box flexDirection="column" height={listViewportSize} overflow="hidden">
            {visibleResults.map((res, idx) => {
              const i = listScrollOffset + idx;
              return (
                <Box key={res.docId}>
                  <Text color={i === activeIndex ? 'cyan' : 'white'} wrap="truncate-end">
                    {i === activeIndex ? '> ' : '  '}
                    {res.path.split('/').pop()}
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Right Pane: Content Viewer */}
      <Box width="70%" flexDirection="column" paddingLeft={1}>
        {currentResult ? (
          <DocumentViewer
            filePath={currentResult.path}
            highlights={highlights}
            isActive={activePane === 'content'}
            height={height - 2}
          />
        ) : (
          <Box
            height={height - 2}
            borderStyle="single"
            borderColor="grey"
            justifyContent="center"
            alignItems="center"
          >
            <Text color="gray">Select a document to view content.</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
