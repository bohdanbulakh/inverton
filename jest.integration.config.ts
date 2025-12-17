import { Config } from '@jest/types';

const config: Config.InitialOptions = {
  roots: ['<rootDir>/src', '<rootDir>/test'],
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  verbose: true,

  testMatch: [
    '**/*.integration-test.ts',
  ],

  globalSetup: '<rootDir>/test/integration/global-setup.ts',
  globalTeardown: '<rootDir>/test/integration/global-teardown.ts',

  testTimeout: 30000,
  maxWorkers: 1,

  extensionsToTreatAsEsm: ['.ts'],

  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },

  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};

export default config;
