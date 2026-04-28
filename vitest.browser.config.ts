import { defineConfig } from 'vitest/config';

/**
 * Browser-mode test config. Runs against real Chromium via Playwright so
 * the actual canvas/decoder paths get exercised — happy-dom can't.
 *
 * Run with: `pnpm test:browser` (one-shot) or `pnpm test:browser:watch`.
 * CI installs the Chromium binary via `pnpm exec playwright install chromium`.
 */
export default defineConfig({
  test: {
    include: ['test/browser/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
});
