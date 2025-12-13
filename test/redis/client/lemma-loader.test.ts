import { Writable } from 'stream';
import { finished } from 'stream/promises';
import { LemmaRedisLoader } from '../../../src/redis/client/lemma-loader';
import { RedisClient } from '../../../src/redis/client/client';

const mockPipeline = {
  set: jest.fn(),
  exec: jest.fn().mockResolvedValue([]),
};

const mockRedisClient = {
  pipeline: jest.fn(() => mockPipeline),
} as unknown as RedisClient;

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
  let loader: LemmaRedisLoader;

  beforeEach(() => {
    jest.clearAllMocks();
    loader = new LemmaRedisLoader(mockRedisClient);
  });

  it('should batch items and flush only when the stream ends', async () => {
    const lines = ['run;ran', 'go;went'];

    await runStream(loader, lines);

    expect(mockRedisClient.pipeline).toHaveBeenCalledTimes(1);

    expect(mockPipeline.set).toHaveBeenCalledTimes(2);
    expect(mockPipeline.set).toHaveBeenCalledWith('run', 'ran');
    expect(mockPipeline.set).toHaveBeenCalledWith('go', 'went');

    expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
  });

  it('should convert terms to lowercase', async () => {
    const lines = ['Run;ran', 'GO;went'];

    await runStream(loader, lines);

    expect(mockPipeline.set).toHaveBeenCalledWith('run', 'ran');
    expect(mockPipeline.set).toHaveBeenCalledWith('go', 'went');
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

    expect(mockRedisClient.pipeline).toHaveBeenCalledTimes(1);
    expect(mockPipeline.set).toHaveBeenCalledTimes(2);
    expect(mockPipeline.set).toHaveBeenCalledWith('valid', 'data');
    expect(mockPipeline.set).toHaveBeenCalledWith('another', 'valid');
  });

  it('should flush mid-stream when batch size is reached', async () => {
    const lines = [
      'one;1',
      'two;2',
      'three;3',
    ];
    const loaderWithSmallBatch = new LemmaRedisLoader(mockRedisClient, 2);

    await runStream(loaderWithSmallBatch, lines);

    expect(mockRedisClient.pipeline).toHaveBeenCalledTimes(2);

    expect(mockPipeline.set).toHaveBeenCalledWith('one', '1');
    expect(mockPipeline.set).toHaveBeenCalledWith('two', '2');

    expect(mockPipeline.set).toHaveBeenCalledWith('three', '3');

    expect(mockPipeline.exec).toHaveBeenCalledTimes(2);
  });

  it('should emit an error if pipeline execution fails', async () => {
    const loaderWithSmallBatch = new LemmaRedisLoader(mockRedisClient, 1);
    const error = new Error('Redis Failed');

    mockPipeline.exec.mockRejectedValueOnce(error);

    const streamFinished = finished(loaderWithSmallBatch);

    loaderWithSmallBatch.write('one;1');
    loaderWithSmallBatch.end();

    await expect(streamFinished).rejects.toThrow(error);
  });

  it('should not call pipeline if stream is empty', async () => {
    await runStream(loader, []);

    expect(mockRedisClient.pipeline).not.toHaveBeenCalled();
  });
});
