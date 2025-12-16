import { render } from 'ink';
import * as path from 'path';
import { RedisClient } from './redis/client/client';
import { IndexingService } from './index/pipeline';
import { IndexingQueue } from './index/indexing-queue';
import { SearchEngine } from './search/search-engine';
import { App } from './cli/app';
import React from 'react';

const archivePath = path.join(process.cwd(), 'data', 'dictionaries.zip');

const redisClient = new RedisClient({
  port: 6379,
  host: 'localhost',
}, 20, archivePath);

console.log('Initializing Redis and loading dictionaries...');
redisClient.ready().then(() => {
  console.clear();

  const indexingService = new IndexingService(redisClient);
  const queue = new IndexingQueue(indexingService, 5);
  const searchEngine = new SearchEngine(redisClient);

  render(<App queue={queue} searchEngine={searchEngine} />, { exitOnCtrlC: false });
}).catch((err) => {
  console.error('Failed to initialize:', err);
  process.exit(1);
});
