import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false, // Run test files sequentially to prevent database state collision
  },
});

