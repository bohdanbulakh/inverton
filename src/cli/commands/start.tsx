import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput } from 'ink';
import { UncontrolledTextInput } from 'ink-text-input';
import * as path from 'path';
import { RedisClient } from '../../redis/client/client';
import { IndexingService } from '../../index/pipeline';
import { IndexingQueue, QueueStats } from '../../index/indexing-queue';
import { StatusBar } from '../status-bar';

const archivePath = path.join(process.cwd(), 'data', 'dictionaries.zip');

// Monitor UI Component
const MonitorApp = ({ queue, redis }: { queue: IndexingQueue, redis: RedisClient }) => {
  const [stats, setStats] = useState<QueueStats>(queue.getStats());
  const [dbSize, setDbSize] = useState(0);

  useEffect(() => {
    // Poll stats every second
    const interval = setInterval(async () => {
      const sizeStr = await redis.get('total_docs');
      setDbSize(sizeStr ? parseInt(sizeStr, 10) : 0);
      setStats({ ...queue.getStats() });
    }, 1000);
    return () => clearInterval(interval);
  }, [queue, redis]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') process.exit(0);
  });

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" padding={1} width={60}>
      <Text bold>Inverton System Monitor</Text>
      <Box marginTop={1} flexDirection="column" marginBottom={1}>
        <Text>Total Documents Indexed: <Text color="green">{dbSize}</Text></Text>
        <Text>Active Workers: <Text color="blue">{stats.active}</Text></Text>
        <Text>Queue Length: <Text color="yellow">{stats.total - stats.processed - stats.failed}</Text></Text>
      </Box>
      <StatusBar stats={stats} />
      <Box marginTop={1}>
        <Text dimColor>Process is running. Waiting for commands (index, search)...</Text>
      </Box>
    </Box>
  );
};

// Setup Component
const StartCommand = () => {
  const [concurrency, setConcurrency] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [client, setClient] = useState<RedisClient | null>(null);
  const [queue, setQueue] = useState<IndexingQueue | null>(null);

  const handleSubmit = (value: string) => {
    const limit = parseInt(value, 10);
    const validLimit = isNaN(limit) || limit < 1 ? 5 : limit;

    // Initialize System
    const redis = new RedisClient({ port: 6379, host: 'localhost' }, 20, archivePath);
    console.log('Initializing Redis and loading dictionaries...');

    redis.ready().then(() => {
      console.clear();
      const service = new IndexingService(redis);
      const q = new IndexingQueue(service, validLimit);
      setClient(redis);
      setQueue(q);
      setReady(true);
    });
    setConcurrency(validLimit.toString());
  };

  if (!concurrency) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Enter concurrency limit (Default: 5):</Text>
        <UncontrolledTextInput onSubmit={handleSubmit} placeholder="5" />
      </Box>
    );
  }

  if (!ready || !client || !queue) {
    return <Text>Loading...</Text>;
  }

  return <MonitorApp queue={queue} redis={client} />;
};

render(<StartCommand />, { exitOnCtrlC: false });
