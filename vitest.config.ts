import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect)
    globals: true,
    // Use jsdom for DOM-related tests
    environment: 'jsdom',
    // Setup file for test utilities
    setupFiles: ['./src/__tests__/setup.ts'],
    // Test file patterns
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
    },
    // Output directory for test artifacts (visualizations)
    outputFile: {
      json: './src/__tests__/output/results.json',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
