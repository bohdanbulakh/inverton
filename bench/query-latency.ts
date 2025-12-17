import * as path from 'path';
import { RedisClient } from '../src/redis/client/client';
import { SearchMode } from '../src/search/types';
import { SearchEngine } from '../src/search/search-engine';

const DOC_COUNT = 10000;
const REDIS_CONFIG = { port: 6379, host: 'localhost' };
const DICT_PATH = path.join(process.cwd(), 'data', 'dictionaries.zip'); // Path to existing dicts

async function seedDatabase (client: RedisClient) {
  console.log(`Seeding database with ${DOC_COUNT} synthetic documents...`);

  const pipeline = client.pipeline();

  for (let i = 0; i < DOC_COUNT; i++) {
    const docId = `bench-${i}`;

    pipeline.set(`doc:${docId}:path`, `/bench/file-${i}.txt`);

    if (i % 2 === 0) pipeline.sadd('lemma:apple', docId);
    if (i % 5 === 0) pipeline.sadd('lemma:banana', docId);
    if (i % 10 === 0) pipeline.sadd('lemma:orange', docId);
  }

  await pipeline.exec();
  console.log('Seeding complete.');
}

async function benchmarkQuery (
  name: string,
  engine: SearchEngine,
  query: string,
  mode: SearchMode
) {
  const SAMPLES = 100;
  let totalTime = 0;

  await engine.search(query, { mode, limit: 10 });

  process.stdout.write(`Benchmarking "${name}" ... `);

  for (let i = 0; i < SAMPLES; i++) {
    const start = performance.now();
    await engine.search(query, { mode, limit: 10 });
    const end = performance.now();
    totalTime += (end - start);
  }

  const avg = (totalTime / SAMPLES).toFixed(3);
  console.log(`${avg} ms / query`);
}

async function runBenchmark () {
  const client = new RedisClient(REDIS_CONFIG, 20, DICT_PATH);
  await client.ready();

  await seedDatabase(client);

  const engine = new SearchEngine(client);

  console.log('\n=== QUERY LATENCY BENCHMARK ===');
  console.log(`Index Size: ${DOC_COUNT} Docs | Samples: 100 per query\n`);

  await benchmarkQuery('Keyword: "apple" (High freq)', engine, 'apple', SearchMode.Keyword);
  await benchmarkQuery('Keyword: "orange" (Low freq)', engine, 'orange', SearchMode.Keyword);

  await benchmarkQuery('Boolean: "apple AND banana"', engine, 'apple AND banana', SearchMode.Boolean);
  await benchmarkQuery('Boolean: "apple OR orange"', engine, 'apple OR orange', SearchMode.Boolean);

  await client.quit();
  process.exit(0);
}

runBenchmark().catch(console.error);
