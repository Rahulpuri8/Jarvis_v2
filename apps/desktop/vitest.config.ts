import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@buildos/shared': path.resolve(__dirname, '../../packages/shared'),
      '@buildos/ai': path.resolve(__dirname, '../../packages/ai'),
      '@buildos/agents': path.resolve(__dirname, '../../packages/agents'),
    },
  },
});
