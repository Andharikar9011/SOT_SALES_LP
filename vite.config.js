import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/SOT_SALES_LP/',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800, // the three.js chunk is ~740KB raw (~187KB gzip)
    rollupOptions: {
      output: {
        // three.js in its own chunk so the UI shell loads and caches independently
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
          return undefined;
        }
      }
    }
  }
});
