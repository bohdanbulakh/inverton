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

    const onResize = () => setResizeTick((t) => t + 1);
    stdout.on('resize', onResize);

    return () => {
      queue.off('stats', onStats);
      stdout.off('resize', onResize);
    };
  }, [queue, stdout]);

  return (
    <Box flexDirection="column" height={stdout.rows - 1}>
      <Box flexGrow={1}>
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
