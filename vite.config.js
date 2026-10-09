import { defineConfig } from 'vite'

export default defineConfig({
  // relative asset paths, so the build works under any GitHub Pages sub-path
  base: './',
  // the lazy full-text search index is one large chunk by design
  build: { chunkSizeWarningLimit: 1600 },
})
