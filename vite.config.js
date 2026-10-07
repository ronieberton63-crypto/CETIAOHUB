import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      // Alias needed for events module required by PouchDB in Electron
      events: path.resolve(__dirname, 'node_modules/events/')
    }
  },
  build: {
    outDir: 'dist',
    // Ensure electron can load assets via file protocol
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // Preserve entry name for Electron main process if needed
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]'
      }
    }
  }
});
