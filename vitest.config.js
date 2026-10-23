import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vitest configuration, kept separate from vite.config.js so the production
 * build never pulls in test-only settings.
 *
 * The environment is jsdom because the point of this suite is to mount real
 * components: `test-fixes.cjs` greps source text and `test-integrity.mjs`
 * imports plain modules, so neither can catch a render crash. Every P0 the QA
 * audit found was either a render crash or a data bug — this closes that gap.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    // The app is heavy (docx, pdfjs, html2pdf). None of that is needed to
    // render a template, and importing it slows every test file down.
    server: {
      deps: {
        inline: [/@testing-library/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      include: ['src/components/**', 'src/utils/**'],
      exclude: ['src/**/*.test.*', 'src/test/**', 'src/agents/**'],
    },
  },
});
