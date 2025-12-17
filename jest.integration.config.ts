import { Config } from '@jest/types';

const config: Config.InitialOptions = {
  roots: ['<rootDir>/src', '<rootDir>/test'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,

  testMatch: [
    '**/*.integration-test.ts',
  ],

  testTimeout: 30000,

  maxWorkers: 1,

  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};

export default config;
