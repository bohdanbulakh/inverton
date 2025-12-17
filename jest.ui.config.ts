import { Config } from '@jest/types';

const config: Config.InitialOptions = {
  roots: ['<rootDir>/src', '<rootDir>/test'],
  verbose: true,
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  passWithNoTests: true,

  testMatch: [
    '**/*.ui-test.tsx',
  ],

  extensionsToTreatAsEsm: ['.ts', '.tsx'],

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
};

export default config;
