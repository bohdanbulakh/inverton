import { sleep } from '../async';
import { IndexingService } from '../index/pipeline';
import { IndexingQueue } from '../index/indexing-queue';

class MockIndexingService {
  async indexFile (filePath: string, docId: string): Promise<void> {
    await sleep(50);
  }
}

async function runBenchmark () {
  console.log('=== QUEUE THROUGHPUT BENCHMARK ===');
  console.log('Workload: 500 tasks, 50ms simulated latency per task\n');

  const concurrencyLevels = [1, 5, 10, 20, 50];
  const TOTAL_TASKS = 500;

  console.log('| Concurrency (N) | Total Time (ms) | Throughput (docs/sec) | Speedup |');
  console.log('|-----------------|-----------------|-----------------------|---------|');

  let baselineTime = 0;

  for (const N of concurrencyLevels) {
    const service = new MockIndexingService() as unknown as IndexingService;
    const queue = new IndexingQueue(service, N);

    const start = performance.now();
    for (let i = 0; i < TOTAL_TASKS; i++) {
      queue.enqueue(`file_${i}.txt`);
    }

    await queue.waitForCompletion();
    const end = performance.now();

    const duration = end - start;
    const throughput = (TOTAL_TASKS / (duration / 1000)).toFixed(2);

    if (N === 1) baselineTime = duration;
    const speedup = (baselineTime / duration).toFixed(2) + 'x';

    console.log(
      `| ${N.toString().padEnd(15)} ` +
      `| ${duration.toFixed(0).padEnd(15)} ` +
      `| ${throughput.padEnd(21)} ` +
      `| ${speedup.padEnd(7)} |`
    );
  }
  console.log('\nDone.');
}

runBenchmark().catch(console.error);
