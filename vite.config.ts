import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Vendor chunks: keeps every chunk under 500 KB and lets the browser cache libraries across releases.
const vendor = (id: string): string | undefined => {
  if (!id.includes('node_modules')) return undefined;
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
  if (/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return 'framer-motion';
  if (/node_modules\/(@firebase|firebase)\//.test(id)) return 'firebase';
  return undefined;
};

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: { output: { manualChunks: vendor } },
  },
});
