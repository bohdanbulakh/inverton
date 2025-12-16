import React, { useState, useEffect } from 'react';
import { render, Text } from 'ink';
import * as path from 'path';
import { RedisClient } from '../../redis/client/client';
import { SearchEngine } from '../../search/search-engine';
import { RedisDocumentInfoService } from '../../search/document-info/document-info-service';
import { SearchView } from '../search-view';

const archivePath = path.join(process.cwd(), 'data', 'dictionaries.zip');

const SearchCommand = () => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [services, setServices] = useState<{
    redis: RedisClient;
    searchEngine: SearchEngine;
    docInfo: RedisDocumentInfoService;
  } | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const redis = new RedisClient({ port: 6379, host: 'localhost' }, 20, archivePath);
        await redis.ready();

        setServices({
          redis,
          searchEngine: new SearchEngine(redis),
          docInfo: new RedisDocumentInfoService(redis),
        });
        setReady(true);
      } catch (err: any) {
        setError(err.message || 'Failed to connect to Redis');
      }
    };
    init();
  }, []);

  if (error) return <Text color="red">Error: {error}</Text>;
  if (!ready || !services) return <Text>Initializing Search Engine...</Text>;

  return (
    <SearchView
      searchEngine={services.searchEngine}
      docInfoService={services.docInfo}
      onNavigate={() => process.exit(0)}
    />
  );
};

render(<SearchCommand />, { exitOnCtrlC: true });
