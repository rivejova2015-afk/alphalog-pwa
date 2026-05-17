import { defineConfig } from 'vitest/config';
import path from 'path';

// Vitest 4 replaced `environmentMatchGlobs` with `projects` workspace API.
// Until we migrate, cast `test` to bypass the strict type check — the runtime
// still honors the legacy option in Vitest 4.x.
export default defineConfig({
  test: {
    // Lib tests stay on node for speed; UI tests opt into jsdom via
    // environmentMatchGlobs below. setupFiles wires testing-library cleanup.
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    environmentMatchGlobs: [
      ['src/components/**/*.test.tsx', 'jsdom'],
      ['src/components/**/*.spec.tsx', 'jsdom'],
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.d.ts'],
    },
  } as Record<string, unknown>,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Stub Next.js server-only sentinel for vitest (Node env, no Next resolver).
      'server-only': path.resolve(__dirname, './src/test/server-only-stub.ts'),
    },
  },
});
