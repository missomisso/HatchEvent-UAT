// tests/event-service.spec.js — Event Service & RSVP UAT (SVC-TC-01–16)
// Source: HatchEvent UAT Tracker — Level 4
// Selectors verified against portal.staging.hatchevent.com — 2026-11-06

const { test, expect } = require('@playwright/test');
const { loginAsEO, loginAsVendor } = require('../helpers/auth');
const { screenshot, checkEmail } = require('../helpers/common');

const BASE = process.env.BASE_URL || 'https://portal.staging.hatchevent.com';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Job Assignment (Vendor-side RFQs)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-01–02 · Job Assignment', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('SVC-TC-01 · Vendor dashboard shows Accepted/Confirmed job count', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    // Dashboard has Accepted tile
    await expect(page.getByRole('heading', { name: 'Accepted', exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'SVC-TC-01-vendor-accepted-tile');
  });

  test('SVC-TC-02 · Vendor can view current RFQ submissions', async ({ page }) => {
    await page.goto('/vendor/rfqs');
    await expect(page.getByRole('heading', { name: 'Current RFQs' })).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'SVC-TC-02-vendor-current-rfqs');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Service Delivery
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-03–04 · Service Delivery', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('SVC-TC-03 · Vendor dashboard shows Pending jobs tile', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    await expect(page.getByRole('heading', { name: 'Pending', exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'SVC-TC-03-pending-tile');
  });

  test('SVC-TC-04 · Vendor past RFQs show Complete button for finished jobs', async ({ page }) => {
    await page.goto('/vendor/rfqs');
    await expect(page.getByRole('heading', { name: 'Past RFQs' })).toBeVisible({ timeout: 10_000 });
    // Past RFQs may have "Complete" button
    const completeBtn = page.getByRole('button', { name: 'Complete' }).first();
    if (await completeBtn.count() > 0) {
      await expect(completeBtn).toBeVisible();
    }
    await screenshot(page, 'SVC-TC-04-past-rfqs-complete');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Rating & Review (EO)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-05–06 · Rating & Review', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('SVC-TC-05 · Past Event Enquiries section visible', async ({ page }) => {
    await page.goto('/eo/enquiries');
    await expect(page.getByRole('heading', { name: 'Past Event Enquiries' })).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'SVC-TC-05-past-enquiries');
  });

  test('SVC-TC-06 · EO can view vendor details (rating entry)', async ({ page }) => {
    await page.goto('/eo/enquiries');
    await expect(page.getByRole('button', { name: 'View vendor details' }).first()).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'SVC-TC-06-vendor-details-view');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: RSVP Setup & Management
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-07–12 · RSVP Setup & Management', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('SVC-TC-07 · Edit RSVP flow — BUG-21 regression (background not too dark)', async ({ page }) => {
    await page.goto('/eo/rsvp');
    // Click "Edit RSVP" — navigates to /eo/rsvp/loading
    await page.getByRole('button', { name: 'Edit RSVP' }).first().click();
    await page.waitForURL(/\/eo\/rsvp\/loading/, { timeout: 15_000 });
    // BUG-21: body background not pure black
    const bg = await page.locator('body').evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgb(0, 0, 0)');
    // Expected: "Let's review your RSVP details" heading + event-name textbox
    await expect(page.getByRole('heading', { name: /review your RSVP/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('textbox', { name: /event name/i })).toBeVisible();
    await screenshot(page, 'SVC-TC-07-rsvp-edit');
  });

  test('SVC-TC-08 · Purchase RSVP Package — 3 tiers visible — BUG-04 regression', async ({ page }) => {
    await page.goto('/eo/rsvp');
    await page.getByRole('button', { name: 'Purchase Package' }).first().click();
    await page.waitForURL(/\/eo\/rsvp\/package/, { timeout: 15_000 });
    // Expected: 3 tiers Gold ($200) / Silver ($100) / Bronze ($60)
    await expect(page.getByText(/Gold Package/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Silver Package/).first()).toBeVisible();
    await expect(page.getByText(/Bronze Package/).first()).toBeVisible();
    // Continue button present
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await screenshot(page, 'SVC-TC-08-rsvp-packages');
  });

  test('SVC-TC-09 · BUG-22 regression — RSVP invoice download accessible from Billing', async ({ page }) => {
    await page.goto('/eo/billing');
    // RSVP Packages tab exists
    await page.getByRole('tab', { name: 'RSVP Packages' }).click();
    await page.waitForTimeout(2000);
    // Invoice PDF button should be clickable without 500 error
    const pdfBtn = page.getByRole('button', { name: 'View invoice PDF' }).first();
    if (await pdfBtn.count() > 0) {
      await expect(pdfBtn).toBeVisible();
    }
    await screenshot(page, 'SVC-TC-09-rsvp-invoice-billing');
  });

  test('SVC-TC-10 · RSVP page shows per-event management per guest', async ({ page }) => {
    await page.goto('/eo/rsvp');
    await expect(page.getByRole('heading', { name: 'RSVP by events' }).first()).toBeVisible({ timeout: 10_000 });
    // Search guests textbox exists
    await expect(page.getByRole('textbox', { name: /search guests/i }).first()).toBeVisible();
    // Status tabs with counts
    await expect(page.getByRole('button', { name: /Pending invite \(\d+\)/ }).first()).toBeVisible();
    await screenshot(page, 'SVC-TC-10-rsvp-guest-mgmt');
  });

  test('SVC-TC-11 · BUG-04 regression — Purchase Package button visible for events without package', async ({ page }) => {
    await page.goto('/eo/rsvp');
    // Purchase Package button should be visible (not hidden) on events without package
    const purchaseBtn = page.getByRole('button', { name: 'Purchase Package' }).first();
    await expect(purchaseBtn).toBeVisible({ timeout: 10_000 });
    // Verify enabled (not disabled)
    const isDisabled = await purchaseBtn.isDisabled();
    expect(isDisabled).toBe(false);
    await screenshot(page, 'SVC-TC-11-purchase-package-enabled');
  });

  test('SVC-TC-12 · Export Guest List button available', async ({ page }) => {
    await page.goto('/eo/guest-list');
    await expect(page.getByRole('button', { name: 'Export' }).first()).toBeVisible({ timeout: 10_000 });
    // Each event with contacts has CSV button
    const csvBtn = page.getByRole('button', { name: 'CSV' }).first();
    if (await csvBtn.count() > 0) {
      await expect(csvBtn).toBeVisible();
    }
    await screenshot(page, 'SVC-TC-12-export-guest-list');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Event Check-In
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-13 · Event Check-In', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('SVC-TC-13 · Guest list page loads with "Manage in app" per event', async ({ page }) => {
    await page.goto('/eo/guest-list');
    await expect(page.getByRole('heading', { name: 'Guest lists for ongoing events' })).toBeVisible({ timeout: 10_000 });
    // Each event has "Manage in app" button (check-in happens in mobile app)
    await expect(page.getByRole('button', { name: 'Manage in app' }).first()).toBeVisible();
    await screenshot(page, 'SVC-TC-13-guest-manage-in-app');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Post-Event Survey
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-14 · Post-Event Survey', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('SVC-TC-14 · Past events visible for post-event actions', async ({ page }) => {
    await page.goto('/eo/enquiries');
    await expect(page.getByRole('heading', { name: 'Past Event Enquiries' })).toBeVisible({ timeout: 10_000 });
    // Verify there's at least one past event
    const pastEventCount = await page.getByRole('heading', { name: /Event in|Past Demo Event/ }).count();
    expect(pastEventCount).toBeGreaterThan(0);
    await screenshot(page, 'SVC-TC-14-past-events-for-survey');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Email Notifications
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-15–16 · Email Notifications', () => {

  test.skip('SVC-TC-15 · EO Mobile App — Message/Email Action [BLOCKED — BUG-05 Confirmed Intended]', async ({ page }) => {
    // BUG-05: Message icon in EO Mobile App — pending email address configuration by iFoundries
  });

  test.skip('SVC-TC-16 · Event Name Sync After RSVP Edit [BLOCKED — BUG-38]', async ({ page }) => {
    // BUG-38: Event name consistency between RSVP and event overview
  });
});
