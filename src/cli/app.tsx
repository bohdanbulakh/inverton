import React, { useState, useEffect } from 'react';
import { Box, useStdout } from 'ink';
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
  const { stdout } = useStdout();
  const [, setResizeTick] = useState(0);

  useEffect(() => {
    const onStats = (newStats: QueueStats) => setStats({ ...newStats });
    queue.on('stats', onStats);

    if (stdout) {
      const onResize = () => {
        setResizeTick((t) => t + 1);
      };
      stdout.on('resize', onResize);
      return () => {
        queue.off('stats', onStats);
        stdout.off('resize', onResize);
      };
    } else {
      return () => queue.off('stats', onStats);
    }
  }, [queue, stdout]);

  return (
    <Box flexDirection="column" height="100%" width="100%">
      <Box flexGrow={1} width="100%">
        {view === 'index' ? (
          <IndexingView key="index" queue={queue} onNavigate={setView} />
        ) : (
          <SearchView key="search" searchEngine={searchEngine} onNavigate={setView} />
        )}
      </Box>
      <StatusBar stats={stats} />
    </Box>
  );
};
