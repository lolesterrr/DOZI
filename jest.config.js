/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Path alias: `@/` → `src/` (mirrors tsconfig.json "paths").
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
