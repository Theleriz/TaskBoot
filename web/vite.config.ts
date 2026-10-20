/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Ships the generated license notices with every build (spec rule D-03). */
function thirdPartyNotices(): Plugin {
  return {
    name: 'third-party-notices',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'THIRD_PARTY_NOTICES.md',
        source: readFileSync(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8'),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), thirdPartyNotices()],
  // Relative asset paths: the same build works on GitHub Pages (/TaskBoot/)
  // and inside the WebView2 shell (https://app.local/).
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: true,
  },
});
