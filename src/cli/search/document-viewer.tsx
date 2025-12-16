import React, { useEffect, useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { readFileWindow } from '../../fs/file-reader';

export interface Highlight {
  line: number;
  position: number;
  length: number;
}

interface Props {
  filePath: string;
  highlights: Highlight[];
  isActive: boolean;
  height: number;
}

export const DocumentViewer: React.FC<Props> = ({ filePath, highlights, isActive, height }) => {
  const [content, setContent] = useState<string[]>([]);
  const [startLine, setStartLine] = useState(1);
  const [currentHighlightIdx, setCurrentHighlightIdx] = useState(0);

  const sortedHighlights = useMemo(() =>
    [...highlights].sort((a, b) => a.line === b.line ? a.position - b.position : a.line - b.line),
  [highlights]);

  useEffect(() => {
    let mounted = true;
    readFileWindow(filePath, startLine, startLine + height - 1)
      .then((window) => {
        if (mounted) setContent(window.lines);
      })
      .catch(() => {
        if (mounted) setContent(['Error reading file.']);
      });
    return () => {
      mounted = false;
    };
  }, [filePath, startLine, height]);

  useEffect(() => {
    if (sortedHighlights.length > 0) {
      setStartLine(Math.max(1, sortedHighlights[0].line - Math.floor(height / 2)));
      setCurrentHighlightIdx(0);
    } else {
      setStartLine(1);
    }
  }, [filePath, height, sortedHighlights]);

  useInput((input, key) => {
    if (!isActive) return;

    if (key.upArrow) setStartLine((prev) => Math.max(1, prev - 1));
    if (key.downArrow) setStartLine((prev) => prev + 1);

    if (sortedHighlights.length > 0) {
      if (input === 'n') {
        const next = (currentHighlightIdx + 1) % sortedHighlights.length;
        setCurrentHighlightIdx(next);
        setStartLine(Math.max(1, sortedHighlights[next].line - Math.floor(height / 2)));
      }
      if (input === 'p') {
        const prev = currentHighlightIdx === 0 ? sortedHighlights.length - 1 : currentHighlightIdx - 1;
        setCurrentHighlightIdx(prev);
        setStartLine(Math.max(1, sortedHighlights[prev].line - Math.floor(height / 2)));
      }
    }
  });

  const renderLine = (line: string, lineNum: number) => {
    const hits = sortedHighlights.filter((h) => h.line === lineNum);
    if (hits.length === 0) return <Text>{line}</Text>;

    const parts = [];
    let lastIdx = 0;
    hits.forEach((h, i) => {
      if (h.position > lastIdx) parts.push(<Text key={`txt-${i}`}>{line.slice(lastIdx, h.position)}</Text>);
      const isCurrent = sortedHighlights[currentHighlightIdx] === h;
      parts.push(
        <Text key={`hl-${i}`} backgroundColor={isCurrent ? 'yellow' : 'blue'} color="black">
          {line.substr(h.position, h.length)}
        </Text>
      );
      lastIdx = h.position + h.length;
    });
    if (lastIdx < line.length) parts.push(<Text key="tail">{line.slice(lastIdx)}</Text>);
    return <Text>{parts}</Text>;
  };

  return (
    <Box flexDirection="column" width="100%" height={height} borderStyle="single" borderColor={isActive ? 'green' : 'grey'}>
      {content.map((line, idx) => (
        <Box key={idx} width="100%">
          <Text dimColor>{(startLine + idx).toString().padEnd(4)}│ </Text>
          <Box>{renderLine(line, startLine + idx)}</Box>
        </Box>
      ))}
      <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false}>
        <Text dimColor>
          Line: {startLine} | Matches: {sortedHighlights.length} | [n]ext / [p]rev
        </Text>
      </Box>
    </Box>
  );
};
