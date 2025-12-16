import { AsyncQueue, sleep } from '../../src/async';

describe('AsyncQueue - Property Based Safety', () => {

  it('INVARIANT: Active workers never exceed concurrency limit under chaotic load', async () => {
    const CONCURRENCY_LIMIT = 5;
    const queue = new AsyncQueue(CONCURRENCY_LIMIT);

    let maxObservedConcurrency = 0;
    let completedTasks = 0;

    let currentConcurrent = 0;

    const taskFactory = (depth: number) => async () => {
      currentConcurrent++;
      maxObservedConcurrency = Math.max(maxObservedConcurrency, currentConcurrent);

      if (currentConcurrent > CONCURRENCY_LIMIT) {
        throw new Error(`Invariant Violated: ${currentConcurrent} > ${CONCURRENCY_LIMIT}`);
      }

      await sleep(Math.floor(Math.random() * 20));

      if (depth < 3 && Math.random() > 0.9) {
        queue.addTasks(taskFactory(depth + 1));
      }

      currentConcurrent--;
      completedTasks++;
    };

    const initialTasks = Array.from({ length: 100 }, () => taskFactory(0));
    queue.addTasks(...initialTasks);

    for (let i = 0; i < 50; i++) {
      queue.addTasks(taskFactory(0));
      await sleep(2);
    }

    await queue.onDone();

    expect(maxObservedConcurrency).toBeLessThanOrEqual(CONCURRENCY_LIMIT);
    expect(completedTasks).toBeGreaterThanOrEqual(150);
  });

  it('INVARIANT: Queue continues processing remaining tasks even when some throw errors', async () => {
    const queue = new AsyncQueue(3);
    const totalTasks = 100;
    const failureRate = 0.2; // 20% failure chance

    let successCount = 0;
    let failureCount = 0;

    const tasks = Array.from({ length: totalTasks }, (_, i) => async () => {
      await sleep(Math.random() * 5);
      if (Math.random() < failureRate) {
        failureCount++;
        throw new Error(`Random Failure Task ${i}`);
      }
      successCount++;
    });

    queue.addTasks(...tasks);

    try {
      await queue.onDone();
    } catch (e) {}

    await sleep(50);

    expect(successCount + failureCount).toBe(totalTasks);
  });

  it('INVARIANT: Tasks are started in FIFO order', async () => {
    const queue = new AsyncQueue(1);
    const processedOrder: number[] = [];

    const tasks = Array.from({ length: 50 }, (_, i) => async () => {
      processedOrder.push(i);
      await sleep(1);
    });

    queue.addTasks(...tasks);
    await queue.onDone();

    const expectedOrder = Array.from({ length: 50 }, (_, i) => i);
    expect(processedOrder).toEqual(expectedOrder);
  });
});
