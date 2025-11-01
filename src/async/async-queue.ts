export type AsyncQueueTask = () => Promise<void>;

export class AsyncQueue {
  private queue: AsyncQueueTask[] = [];
  private activeWorkers = 0;
  private drainPromise: Promise<void> | null = null;
  private drainResolve: (() => void) | null = null;

  constructor (private maxConcurrency: number) {}

  addTasks (...tasks: AsyncQueueTask[]): void {
    this.queue.push(...tasks);
    this.processNext();
  }

  onDone (): Promise<void> {
    if (this.queue.length === 0 && this.activeWorkers === 0) {
      return Promise.resolve();
    }

    if (!this.drainPromise) {
      this.drainPromise = new Promise((resolve) => {
        this.drainResolve = resolve;
      });
    }
    return this.drainPromise;
  }

  private processNext (): void {
    while (this.activeWorkers < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.activeWorkers++;
      this.runWorker(task).catch(console.error);
    }
  }

  private async runWorker (task: AsyncQueueTask): Promise<void> {
    try {
      await task();
    } finally {
      this.activeWorkers--;

      if (this.queue.length > 0) {
        this.processNext();
      } else if (this.activeWorkers === 0 && this.drainResolve) {
        this.drainResolve();
        this.drainPromise = null;
        this.drainResolve = null;
      }
    }
  }
}
