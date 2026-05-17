import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Process forks isolate the module graph between specs — important because
    // config.ts exports mutable `let` bindings that tests intentionally rewrite.
    // Without isolation, one test's applyParameters() leaks into another.
    pool: 'forks',
    isolate: true,
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
  },
});
