import { AsyncQueue, sleep } from '../../src/async';

describe('AsyncQueue', () => {
  it.concurrent('should process tasks respecting maxConcurrency', async () => {
    const queue = new AsyncQueue(2);
    const result: number[] = [];

    const tasks = [3, 2, 2, 4].map((item) => (async () => {
      await sleep(item * 100);
      result.push(item);
    }));

    queue.addTasks(...tasks);
    await queue.onDone();

    expect(result).toEqual([2, 3, 2, 4]);
  });

  it.concurrent('should work correctly with multiple calls of addTasks', async () => {
    const queue = new AsyncQueue(2);
    const result: number[] = [];

    for (const item of [3, 2, 2, 4]) {
      queue.addTasks((async () => {
        await sleep(item * 100);
        result.push(item);
      }));
    }

    await queue.onDone();
    expect(result).toEqual([2, 3, 2, 4]);
  });

  it.concurrent('should work correctly when task adds other tasks', async () => {
    const queue = new AsyncQueue(2);
    const result: number[] = [];

    for (const item of [3, 2, 4]) {
      queue.addTasks((async () => {
        await sleep(item * 100);
        result.push(item);

        if (item === 2) {
          queue.addTasks(async () => {
            const item = 1;
            await sleep(item * 100);
            result.push(item);
          });
        }
      }));
    }

    await queue.onDone();
    expect(result).toEqual([2, 3, 1, 4]);
  });
});
