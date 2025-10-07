import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/storage/schema.ts', 'src/counter.ts', 'src/main.ts'],
      all: true,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.ts'],
    setupFiles: [],
  },
});
