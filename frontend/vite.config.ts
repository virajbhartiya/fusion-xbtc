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
preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'swap.virajbhartiya.com',
      '.virajbhartiya.com'  // This allows all subdomains
    ]
  }
});