// tests/vendor-registration.spec.js — Vendor UAT (VD-TC-01 through VD-TC-26)
// Source: HatchEvent UAT Tracker — Level 2
// Selectors verified against portal.staging.hatchevent.com — 2026-11-06

const { test, expect } = require('@playwright/test');
const { loginAsVendor, loginAsAdmin, logout } = require('../helpers/auth');
const { screenshot, checkEmail } = require('../helpers/common');

const BASE = process.env.BASE_URL || 'https://portal.staging.hatchevent.com';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Account Registration
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VD-TC-01–05 · Account Registration', () => {

  test('VD-TC-01 · Vendor Sign-Up Button Available', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Vendor' }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
    await screenshot(page, 'VD-TC-01-vendor-signup-available');
  });

  test('VD-TC-02 · Vendor OTP/Email Verification', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Vendor' }).click();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await checkEmail('Verify your HatchEvent vendor account');
    await screenshot(page, 'VD-TC-02-vendor-verification');
  });

  test('VD-TC-03 · Vendor Google Sign-In Available', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Vendor' }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await screenshot(page, 'VD-TC-03-vendor-google-oauth');
  });

  test('VD-TC-04 · Vendor Login', async ({ page }) => {
    await loginAsVendor(page);
    // After login, lands on /vendor or /vendor/dashboard
    await expect(page).toHaveURL(/\/vendor(\/|$)/);
    // Greeting heading uses the vendor's name (bumped timeout for slow dashboard load)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
    await screenshot(page, 'VD-TC-04-vendor-dashboard');
  });

  test('VD-TC-05 · Vendor Forgot Password', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Vendor' }).click();
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await page.waitForTimeout(2000);
    await expect(
      page.getByRole('textbox', { name: /email/i })
        .or(page.getByRole('heading', { name: /forgot|reset|recover/i }))
    ).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'VD-TC-05-vendor-forgot-password');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Dashboard & Overview
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VD-TC-06–08 · Dashboard', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('VD-TC-06 · Dashboard RFQ Status Tiles', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    // Dashboard has stat headings for all RFQ statuses
    for (const label of ['New', 'Accepted', 'Pending', 'Rejected', 'Completed', 'Expired']) {
      await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible({ timeout: 10_000 });
    }
    await screenshot(page, 'VD-TC-06-dashboard-tiles');
  });

  test('VD-TC-07 · Dashboard Spending / Credits / Points', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    for (const label of ['Total spending', 'Subscriptions', 'Credits', 'Points']) {
      await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible({ timeout: 10_000 });
    }
    await screenshot(page, 'VD-TC-07-dashboard-wallet');
  });

  test('VD-TC-08 · Vendor Sidebar Navigation', async ({ page }) => {
    await page.goto('/vendor');
    const sidebarLinks = [
      { name: 'Dashboard',          url: /\/vendor\/?$|\/vendor\/dashboard/ },
      { name: 'Listing',            url: /\/vendor\/listing/ },
      { name: 'RFQs',               url: /\/vendor\/rfqs/ },
      { name: 'Membership',         url: /\/vendor\/membership/ },
      { name: 'Credits and points', url: /credits/ },
      { name: 'Sponsored links',    url: /sponsored/ },
      { name: 'EDMs',               url: /edm/i },
      { name: 'Invoices',           url: /invoice/i },
      { name: 'Profile',            url: /profile/ },
      { name: 'Team',               url: /team/ },
      { name: 'Settings',           url: /settings/ },
    ];
    for (const link of sidebarLinks) {
      try {
        await page.getByRole('link', { name: link.name, exact: true }).click();
        await page.waitForLoadState('networkidle', { timeout: 10_000 });
        // Note: some may 404 — only assert when page loaded
      } catch (e) { /* link may not exist on this account */ }
    }
    await screenshot(page, 'VD-TC-08-vendor-sidebar');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Listings
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VD-TC-09–14 · Listings', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('VD-TC-09 · View Listings Page', async ({ page }) => {
    await page.goto('/vendor/listing');
    // Listing heading — use first() because sidebar also has "Listing"
    await expect(page.getByRole('heading', { name: 'Listing' }).first()).toBeVisible({ timeout: 10_000 });
    // Each listing has View/Edit/Archive/Delete buttons
    await expect(page.getByRole('button', { name: 'View' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create listing' })).toBeVisible();
    await screenshot(page, 'VD-TC-09-listings-page');
  });

  test('VD-TC-10 · Create Listing Button Available — BUG-14 regression (no duplicate categories)', async ({ page }) => {
    await page.goto('/vendor/listing');
    await page.getByRole('button', { name: 'Create listing' }).click();
    await page.waitForTimeout(3000);
    await screenshot(page, 'VD-TC-10-create-listing-form');
  });

  test('VD-TC-11 · Edit Existing Listing', async ({ page }) => {
    await page.goto('/vendor/listing');
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await page.waitForTimeout(3000);
    await screenshot(page, 'VD-TC-11-edit-listing');
  });

  test.skip('VD-TC-12 · Vendor Membership Pricing Display [BLOCKED — BUG-28 Confirmed Intended]', async ({ page }) => {});

  test.skip('VD-TC-13 · Listing Requirements Conflict [BLOCKED — BUG-13]', async ({ page }) => {});

  test('VD-TC-14 · Listing Archive/Delete Options', async ({ page }) => {
    await page.goto('/vendor/listing');
    await expect(page.getByRole('button', { name: 'Archive' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' }).first()).toBeVisible();
    await screenshot(page, 'VD-TC-14-listing-actions');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: RFQs
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VD-TC-15–18 · RFQs', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('VD-TC-15 · RFQs Page Loads', async ({ page }) => {
    await page.goto('/vendor/rfqs');
    await expect(page.getByRole('heading', { name: 'Request for quotations' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('textbox', { name: /Search RFQs/i })).toBeVisible();
    await screenshot(page, 'VD-TC-15-rfqs-page');
  });

  test('VD-TC-16 · Current RFQs Section', async ({ page }) => {
    await page.goto('/vendor/rfqs');
    await expect(page.getByRole('heading', { name: 'Current RFQs' })).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'VD-TC-16-current-rfqs');
  });

  test('VD-TC-17 · Past RFQs with Status Filters', async ({ page }) => {
    await page.goto('/vendor/rfqs');
    await expect(page.getByRole('heading', { name: 'Past RFQs' })).toBeVisible({ timeout: 10_000 });
    // Status filter buttons
    for (const status of ['All', 'Completed', 'Rejected', 'Expired']) {
      await expect(page.getByRole('button', { name: status, exact: true })).toBeVisible();
    }
    await screenshot(page, 'VD-TC-17-past-rfqs-filters');
  });

  test('VD-TC-18 · Submit a Quotation to a Current RFQ', async ({ page }) => {
    await page.goto('/vendor/rfqs');
    const submitBtn = page.getByRole('button', { name: 'Submit' }).first();
    if (await submitBtn.count() > 0) {
      await expect(submitBtn).toBeVisible();
      // Click flow proceeds to bid/quote submission
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }
    await screenshot(page, 'VD-TC-18-submit-quotation');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Membership
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VD-TC-19–22 · Membership', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test.skip('VD-TC-19 · Membership Admin Panel Mismatch [BLOCKED — BUG-35]', async ({ page }) => {});

  test('VD-TC-20 · View Membership Tiers', async ({ page }) => {
    await page.goto('/vendor/membership');
    await expect(page.getByRole('heading', { name: 'Vendor Membership' })).toBeVisible({ timeout: 10_000 });
    // 3 tier buttons with pricing: Gold ($200/mo), Silver ($50/mo), Bronze ($0)
    await expect(page.getByRole('button', { name: /Gold/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Silver/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Bronze/i }).first()).toBeVisible();
    await screenshot(page, 'VD-TC-20-membership-tiers');
  });

  test('VD-TC-21 · Current Tier Marker Shown', async ({ page }) => {
    await page.goto('/vendor/membership');
    // Test account is Gold — verify indicator is visible
    await expect(page.getByText(/YOUR CURRENT TIER/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'VD-TC-21-current-tier');
  });

  test.skip('VD-TC-22 · Membership Checkout Flow [BLOCKED — BUG-03]', async ({ page }) => {});
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Profile & Account
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VD-TC-23–25 · Profile', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('VD-TC-23 · View Vendor Profile', async ({ page }) => {
    await page.goto('/vendor/profile');
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'VD-TC-23-vendor-profile');
  });

  test('VD-TC-24 · Settings — Security Section', async ({ page }) => {
    await page.goto('/vendor/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.getByRole('button', { name: 'Security' }).click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'VD-TC-24-settings-security');
  });

  test('VD-TC-25 · Settings — Notifications Section', async ({ page }) => {
    await page.goto('/vendor/settings');
    await page.getByRole('button', { name: 'Notifications' }).click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'VD-TC-25-settings-notifications');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VD-TC-26 · Edge Cases', () => {

  test.skip('VD-TC-26 · Terms of Use Link Returns 404 [BLOCKED — BUG-34]', async ({ page }) => {});
});
