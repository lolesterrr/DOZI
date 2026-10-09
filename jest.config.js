/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Path alias: `@/` → `src/` (mirrors tsconfig.json "paths").
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    // Jest can't read lucide's ESM (.mjs) build; use its CommonJS build in tests.
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
