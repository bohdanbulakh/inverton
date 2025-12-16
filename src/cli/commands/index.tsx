import React, { useState } from 'react';
import { render, Text } from 'ink';
import meow from 'meow';
import * as path from 'path';
import { RedisClient } from '../../redis/client/client';
import { IndexingService } from '../../index/pipeline';
import { IndexingQueue } from '../../index/indexing-queue';
import { IndexingView } from '../indexing-view';

const archivePath = path.join(process.cwd(), 'data', 'dictionaries.zip');

const cli = meow(`
	Usage
	  $ yarn index -f <path>

	Options
	  --file, -f  Path to file or directory to index
`, {
  importMeta: import.meta,
  flags: {
    file: {
      type: 'string',
      alias: 'f',
    },
  },
});

const IndexCommand = () => {
  const [ready, setReady] = useState(false);
  const [queue, setQueue] = useState<IndexingQueue | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  React.useEffect(() => {
    const redis = new RedisClient({ port: 6379, host: 'localhost' }, 20, archivePath);

    redis.ready().then(() => {
      const service = new IndexingService(redis);
      const q = new IndexingQueue(service, 5);
      setQueue(q);
      setReady(true);

      if (cli.flags.file) {
        const targetPath = path.resolve(process.cwd(), cli.flags.file);
        q.enqueue(targetPath);
        const checkDone = setInterval(() => {
          const stats = q.getStats();
          if (stats.active === 0 && stats.processed + stats.failed >= stats.total) {
            clearInterval(checkDone);
            console.log('Indexing complete.');
            process.exit(0);
          }
        }, 500);
      }
    }).catch((err) => setInitError(err.message));
  }, []);

  if (initError) return <Text color="red">Error: {initError}</Text>;
  if (!ready || !queue) return <Text>Initializing...</Text>;

  if (cli.flags.file) {
    return <Text>Indexing {cli.flags.file}...</Text>;
  }

  return (
    <IndexingView
      queue={queue}
      onNavigate={() => process.exit(0)}
    />
  );
};

render(<IndexCommand />);
