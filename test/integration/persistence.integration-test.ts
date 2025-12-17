import { RedisClient } from '../../src/redis/client/client';
import { IndexingService } from '../../src/index/pipeline';
import { SearchEngine } from '../../src/search/search-engine';
import { SearchMode } from '../../src/search/types';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Helper to create a temporary text file
const createTempFile = (content: string): string => {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `inverton-test-${Date.now()}.txt`);
  fs.writeFileSync(filePath, content);
  return filePath;
};

describe('Integration: Persistence Cycle', () => {
  const redisConfig = { port: 6379, host: 'localhost' };
  const dictionaryPath = path.join(process.cwd(), 'data', 'dictionaries.zip');

  // We use a distinct prefix or database in a real app,
  // but here we assume a test environment (flushdb).
  let indexerClient: RedisClient;
  let searcherClient: RedisClient;
  let testFile: string;

  beforeAll(async () => {
    // 1. Setup: Create a temp file
    testFile = createTempFile('The quick brown fox jumps over the lazy dog.');
  });

  afterAll(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  it('indexes data, restarts services, and retrieves correct results', async () => {
    // --- PHASE 1: INDEXING ---
    // Simulate "Process A": Connect, Index, then Die.
    indexerClient = new RedisClient(redisConfig, 20, dictionaryPath);
    await indexerClient.ready();

    // Clean state for the test
    await indexerClient.flushdb();

    const indexingService = new IndexingService(indexerClient);

    // Ingest the file
    await indexingService.ingestFile(testFile);

    // Simulate "Process Death": Close the connection explicitly
    await indexerClient.disconnect(false);

    // --- PHASE 2: RESTART & SEARCH ---
    // Simulate "Process B": New process starts, connects to SAME Redis.
    searcherClient = new RedisClient(redisConfig, 20, dictionaryPath);
    await searcherClient.ready();

    const searchEngine = new SearchEngine(searcherClient);

    // Execute Search
    // We expect "fox" to be found because it was persisted in Redis
    const results = await searchEngine.search('fox', {
      mode: SearchMode.Keyword,
      limit: 10,
    });

    // --- ASSERTIONS ---
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe(testFile);

    const docId = results[0].docId;
    expect(docId).toBeDefined();

    await searcherClient.disconnect(false);
  });
});
