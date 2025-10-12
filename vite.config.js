import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
    include: ['src/**/*.test.js'],
    exclude: ['e2e/**/*']
  }
});
