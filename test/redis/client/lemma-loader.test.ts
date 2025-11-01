import { Writable } from 'stream';
import { finished } from 'stream/promises';
import { RedisLemmaService } from '../../../src/redis/redis-lemma-service';
import { LemmaRedisLoader } from '../../../src/redis/client/lemma-loader';

const mockSetMany = jest.fn<Promise<void>, [string, [string, string][]]>();

const mockRedisService = {
  setMany: mockSetMany,
} as unknown as RedisLemmaService;

async function runStream (
  stream: Writable,
  chunks: (string | Buffer)[],
): Promise<void> {
  const streamFinished = finished(stream);

  for (const chunk of chunks) {
    stream.write(chunk);
  }
  stream.end();

  await streamFinished;
}

describe('LemmaRedisLoader', () => {
  const langCode = 'en';
  let loader: LemmaRedisLoader;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetMany.mockResolvedValue(undefined);
    loader = new LemmaRedisLoader(mockRedisService, langCode);
  });

  it('should batch items and flush only when the stream ends', async () => {
    const lines = ['run;ran', 'go;went'];

    await runStream(loader, lines);

    expect(mockSetMany).toHaveBeenCalledTimes(1);
    expect(mockSetMany).toHaveBeenCalledWith(langCode, [
      ['run', 'ran'],
      ['go', 'went'],
    ]);
  });

  it('should skip invalid lines and empty strings', async () => {
    const lines = [
      'valid;data',
      'invalid_line_no_separator',
      ';',
      'term;_',
      '_;lemma',
      'same;same',
      '',
      'another;valid',
    ];

    await runStream(loader, lines);

    expect(mockSetMany).toHaveBeenCalledTimes(1);

    expect(mockSetMany).toHaveBeenCalledWith(langCode, [
      ['valid', 'data'],
      ['another', 'valid'],
    ]);
  });

  it('should flush mid-stream when batch size is reached', async () => {
    const lines = [
      'one;1',
      'two;2',
      'three;3',
    ];
    const loaderWithSmallBatch = new LemmaRedisLoader(mockRedisService, langCode, 2);

    await runStream(loaderWithSmallBatch, lines);

    expect(mockSetMany).toHaveBeenCalledTimes(2);

    expect(mockSetMany).toHaveBeenNthCalledWith(1, langCode, [
      ['one', '1'],
      ['two', '2'],
    ]);

    expect(mockSetMany).toHaveBeenNthCalledWith(2, langCode, [['three', '3']]);
  });

  it('should emit an error if _write flush fails', async () => {
    const loaderWithSmallBatch = new LemmaRedisLoader(mockRedisService, langCode, 1);
    const error = new Error('Redis Failed');
    mockSetMany.mockRejectedValue(error);

    const streamFinished = finished(loaderWithSmallBatch);

    loaderWithSmallBatch.write('one;1');
    loaderWithSmallBatch.end();

    await expect(streamFinished).rejects.toThrow(error);
    expect(mockSetMany).toHaveBeenCalledTimes(1);
  });

  it('should emit an error if _final flush fails', async () => {
    const error = new Error('Redis Failed');
    mockSetMany.mockRejectedValue(error);

    const streamFinished = finished(loader);

    loader.write('one;1');
    loader.end();

    await expect(streamFinished).rejects.toThrow(error);
    expect(mockSetMany).toHaveBeenCalledTimes(1);
  });

  it('should not call setMany if stream is empty', async () => {
    await runStream(loader, []);

    expect(mockSetMany).not.toHaveBeenCalled();
  });
});

