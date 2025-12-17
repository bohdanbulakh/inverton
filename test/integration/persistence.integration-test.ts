import { RedisClient } from '../../src/redis/client/client';
import { IndexingService } from '../../src/index/pipeline';
import { SearchEngine } from '../../src/search/search-engine';
import { SearchMode } from '../../src/search/types';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const createTempFile = (content: string): string => {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `inverton-test-${Date.now()}.txt`);
  fs.writeFileSync(filePath, content);
  return filePath;
};

describe('Integration: Persistence Cycle', () => {
  const redisConfig = { port: 6379, host: 'localhost' };
  const dictionaryPath = path.join(process.cwd(), 'data', 'dictionaries.zip');

  let indexerClient: RedisClient;
  let searcherClient: RedisClient;
  let testFile: string;

  beforeAll(async () => {
    testFile = createTempFile('The quick brown fox jumps over the lazy dog.');
  });

  afterAll(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  it('indexes data, restarts services, and retrieves correct results', async () => {
    indexerClient = new RedisClient(redisConfig, 20, dictionaryPath);
    await indexerClient.ready();

    await indexerClient.flushdb();

    const indexingService = new IndexingService(indexerClient);

    await indexingService.ingestFile(testFile);

    await indexerClient.disconnect(false);

    searcherClient = new RedisClient(redisConfig, 20, dictionaryPath);
    await searcherClient.ready();

    const searchEngine = new SearchEngine(searcherClient);

    const results = await searchEngine.search('fox', {
      mode: SearchMode.Keyword,
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe(testFile);

    const docId = results[0].docId;
    expect(docId).toBeDefined();

    await searcherClient.disconnect(false);
  });
});
