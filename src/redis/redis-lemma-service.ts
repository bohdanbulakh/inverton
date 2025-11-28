import { Redis } from 'ioredis';

export class RedisLemmaService {
  constructor (private readonly redisClient: Redis) {}

  async set (language: string, term: string, lemma: string): Promise<void> {
    await this.redisClient.set(`lemma:${term}:${language}`, lemma);
  }

  async setMany (language: string, pairs: [string, string][]): Promise<void> {
    const pipeline = this.redisClient.pipeline();
    for (const [term, lemma] of pairs) {
      pipeline.set(`lemma:${term}:${language}`, lemma);
    }
    await pipeline.exec();
  }

  async get (language: string, term: string): Promise<string> {
    const key = `lemma:${language}:${term}`;
    const value = await this.redisClient.get(key);
    if (value === null) {
      throw new Error(`No value with such key: ${key}`);
    }
    return value;
  }

  async getLemmaHash (language: string): Promise<string | null> {
    return this.redisClient.get(`lemma:hash:${language}`);
  }

  async setLemmaHash (language: string, hash: string): Promise<void> {
    await this.redisClient.set(`lemma:hash:${language}`, hash);
  }

  async deleteAllLemmas (language: string): Promise<void> {
    const keyPattern = `lemma:*:${language}`;
    const stream = this.redisClient.scanStream({
      match: keyPattern,
      count: 100,
    });

    let pipeline = this.redisClient.pipeline();
    let keysInPipeline = 0;

    for await (const keys of stream) {
      for (const key of keys as string[]) {
        pipeline.del(key);
        keysInPipeline++;

        if (keysInPipeline >= 500) {
          await pipeline.exec();
          pipeline = this.redisClient.pipeline();
          keysInPipeline = 0;
        }
      }
    }

    if (keysInPipeline > 0) {
      await pipeline.exec();
    }
  }
}
