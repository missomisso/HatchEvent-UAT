// helpers/common.js — Shared utilities for HatchEvent UAT

const { expect } = require('@playwright/test');

/**
 * Navigate to a path and wait for the page to settle.
 */
async function goto(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/**
 * Fill a form field by its label text (case-insensitive).
 */
async function fillField(page, label, value) {
  await page.getByLabel(new RegExp(label, 'i')).fill(value);
}

/**
 * Click a button or link by its visible text.
 */
async function clickButton(page, name) {
  await page.getByRole('button', { name: new RegExp(name, 'i') })
            .or(page.getByRole('link', { name: new RegExp(name, 'i') }))
            .first()
            .click();
}

/**
 * Assert that a toast, alert, or success message is visible.
 * Pass a partial string to match.
 */
async function expectSuccess(page, text) {
  await expect(
    page.getByText(new RegExp(text, 'i'))
        .or(page.locator('[role="alert"]').filter({ hasText: new RegExp(text, 'i') }))
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * Assert that an error message is visible.
 */
async function expectError(page, text) {
  await expect(
    page.getByText(new RegExp(text, 'i'))
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * Wait for a URL pattern to appear.
 */
async function waitForUrl(page, pattern) {
  await page.waitForURL(new RegExp(pattern), { timeout: 15_000 });
}

/**
 * Take a screenshot labelled with the TC ID and step description.
 * Saved to results/screenshots/ automatically when screenshot: 'only-on-failure' is set.
 */
async function screenshot(page, label) {
  await page.screenshot({ path: `results/screenshots/${label}.png`, fullPage: false });
}

/**
 * Check that an email was received (placeholder — hook into your email provider or Mailtrap).
 * Returns true if found within timeout, false otherwise.
 */
async function checkEmail(subject) {
  // TODO: Connect to staging email inbox (Mailtrap / Mailpit / Ethereal)
  // For now, returns true to allow the test to proceed — mark as manual check.
  console.warn(`⚠  checkEmail("${subject}") — manual verification required`);
  return true;
}

module.exports = { goto, fillField, clickButton, expectSuccess, expectError, waitForUrl, screenshot, checkEmail };
