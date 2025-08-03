import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      buffer: 'buffer',
      events: 'events',
      util: 'util',
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
    },
  },
  optimizeDeps: {
    include: [
      'buffer', 
      'events', 
      'util', 
      'stream-browserify', 
      'crypto-browserify'
    ],
  },
  define: {
    'global': 'window',
    'process.env': {},
  },
  build: {
    rollupOptions: {
      external: [],
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
