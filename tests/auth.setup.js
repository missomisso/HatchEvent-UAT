// tests/auth.setup.js — logs in once per role and stores the session for every spec.
// Credentials come ONLY from environment variables / GitHub Secrets. Never commit them.
const { test: setup, expect } = require('@playwright/test');
const fs = require('fs');
const { loginAsEO, loginAsVendor } = require('../helpers/auth');

fs.mkdirSync('.auth', { recursive: true });

setup('authenticate Event Organiser', async ({ page }) => {
  await loginAsEO(page);
  await expect(page).toHaveURL(/\/eo/);
  await page.context().storageState({ path: '.auth/eo.json' });
});

setup('authenticate Vendor', async ({ page }) => {
  await loginAsVendor(page);
  await expect(page).toHaveURL(/\/vendor/);
  await page.context().storageState({ path: '.auth/vendor.json' });
});
