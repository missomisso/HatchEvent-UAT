// playwright.config.js — HatchEvent UAT (v2, rebuilt 26 Nov 2026 against the post-25-Nov staging UI)
const { defineConfig } = require('@playwright/test');
try { require('dotenv').config(); } catch (e) { /* dotenv optional */ }

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  workers: 1,                 // one shared staging account per role → run serially
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'results/results.json' }],
    ['html', { outputFolder: 'results/html-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://portal.staging.hatchevent.com',
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    // 1) Logs in once per role and saves the session to .auth/*.json
    { name: 'setup', testMatch: /auth\.setup\.js/ },
    // 2) Everything else reuses those sessions
    { name: 'uat', testMatch: /.*\.spec\.js/, dependencies: ['setup'] },
  ],
});
