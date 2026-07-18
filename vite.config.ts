import { defineConfig } from 'vite';

export default defineConfig({
  root: 'blockly_app',
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
