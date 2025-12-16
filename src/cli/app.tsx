import React, { useState, useEffect } from 'react';
import { Box, useInput } from 'ink';
import { SearchEngine } from '../search/search-engine';
import { IndexingQueue, QueueStats } from '../index/indexing-queue';
import { IndexingView } from './indexing-view';
import { SearchView } from './search-view';
import { StatusBar } from './status-bar';

interface Props {
  queue: IndexingQueue;
  searchEngine: SearchEngine;
}

export const App: React.FC<Props> = ({ queue, searchEngine }) => {
  const [view, setView] = useState<'index' | 'search'>('index');
  const [stats, setStats] = useState<QueueStats>(queue.getStats());

  useInput((input, key) => {
    if (input.toLowerCase() === 'c' && key.ctrl) process.exit(0);
  });

  useEffect(() => {
    const onStats = (newStats: QueueStats) => setStats({ ...newStats });
    queue.on('stats', onStats);
    return () => {
      queue.off('stats', onStats);
    };
  }, [queue]);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexDirection="column" flexGrow={1}>
        {view === 'index' ? (
          <IndexingView queue={queue} onNavigate={setView} />
        ) : (
          <SearchView searchEngine={searchEngine} onNavigate={setView} />
        )}
      </Box>

      <StatusBar stats={stats} />
    </Box>
  );
};
