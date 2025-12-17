import { Config } from '@jest/types';

const config: Config.InitialOptions = {
  roots: ['<rootDir>/src', '<rootDir>/test'],
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  passWithNoTests: true,
};

export default config;
