import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [tailwindcss(), react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@buildos/shared': path.resolve(__dirname, '../../../packages/shared'),
      '@buildos/agents': path.resolve(__dirname, '../../../packages/agents'),
      '@buildos/ai': path.resolve(__dirname, '../../../packages/ai'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
