import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { AsyncQueue } from '../async';
import { IndexingService } from './pipeline';

export interface QueueStats {
  total: number;
  processed: number;
  failed: number;
  active: number;
}

export class IndexingQueue extends EventEmitter {
  private queue: AsyncQueue;
  private stats: QueueStats = {
    total: 0,
    processed: 0,
    failed: 0,
    active: 0,
  };

  constructor (
    private readonly indexingService: IndexingService,
    concurrency: number
  ) {
    super();
    this.queue = new AsyncQueue(concurrency);
  }

  enqueue (filePath: string): void {
    this.stats.total++;
    this.emit('stats', this.stats);

    const task = async () => {
      this.stats.active++;
      this.emit('stats', this.stats);

      const docId = crypto.createHash('md5').update(filePath).digest('hex');

      try {
        await this.indexingService.indexFile(filePath, docId);
        this.stats.processed++;
        this.emit('processed', filePath);
      } catch (error) {
        this.stats.failed++;
        this.emit('failed', { file: filePath, error });
      } finally {
        this.stats.active--;
        this.emit('stats', this.stats);
      }
    };

    this.queue.addTasks(task);
  }

  async waitForCompletion (): Promise<void> {
    await this.queue.onDone();
  }

  getStats (): QueueStats {
    return { ...this.stats };
  }
}
