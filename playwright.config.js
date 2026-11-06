// @ts-check
const { defineConfig, devices } = require('@playwright/test');
try { require('dotenv').config(); } catch (e) { /* dotenv optional (CI uses env vars directly) */ }

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45_000,           // 45s per test step
  expect: { timeout: 10_000 },
  fullyParallel: false,      // UAT runs sequentially — shared staging state
  retries: 1,                // 1 automatic retry on failure before marking Fail
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'results/results.json' }],
    ['html',  { outputFolder: 'results/html-report', open: 'never' }],
  ],

  use: {
    baseURL:       process.env.BASE_URL || 'https://portal.staging.hatchevent.com',
    headless:      true,    // headless in CI; use --headed CLI flag locally
    viewport:      { width: 1440, height: 900 },
    screenshot:    'only-on-failure',
    video:         'retain-on-failure',
    trace:         'retain-on-failure',
    actionTimeout: 15_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
