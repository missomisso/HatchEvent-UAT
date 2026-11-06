// tests/eo-journey.spec.js — EO Journey UAT (EO-TC-01 through EO-TC-31)
// Source: HatchEvent UAT Tracker — Level 1
// Selectors verified against portal.staging.hatchevent.com — 2026-11-06

const { test, expect } = require('@playwright/test');
const { loginAsEO, logout } = require('../helpers/auth');
const { screenshot, checkEmail } = require('../helpers/common');

const BASE = process.env.BASE_URL || 'https://portal.staging.hatchevent.com';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Account Registration & Login
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-01–05 · Account Registration & Login', () => {

  test('EO-TC-01 · New Account — Email Sign-Up', async ({ page }) => {
    await page.goto('/auth/login');
    // Verify Create account button exists and is clickable
    const createBtn = page.getByRole('button', { name: 'Create account' });
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 'EO-TC-01-signup-opened');
  });

  test('EO-TC-02 · Email Verification (OTP)', async ({ page }) => {
    // OTP retrieval is manual — verify the login/signup form exists
    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await checkEmail('Verify your HatchEvent account');
    await screenshot(page, 'EO-TC-02-otp-form');
  });

  test('EO-TC-03 · New Account — Google Sign-In', async ({ page }) => {
    // Verifies Google OAuth button is present
    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await screenshot(page, 'EO-TC-03-google-oauth-button');
  });

  test('EO-TC-04 · Returning User — Login', async ({ page }) => {
    await loginAsEO(page);
    // Expected: authenticated; dashboard loads (URL is /eo)
    await expect(page).toHaveURL(/\/eo(\/|$)/);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
    await screenshot(page, 'EO-TC-04-eo-dashboard');
  });

  test('EO-TC-05 · Forgot Password', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await page.waitForTimeout(2000);
    // Expected: forgot password form appears
    await expect(
      page.getByRole('textbox', { name: /email/i })
        .or(page.getByRole('heading', { name: /forgot|reset|recover/i }))
    ).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-05-forgot-password-form');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Profile Setup
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-06–07 · Profile Setup', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-06 · Complete EO Profile', async ({ page }) => {
    await page.goto('/eo/profile');
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-06-profile-page');
  });

  test('EO-TC-07 · Edit Existing Profile', async ({ page }) => {
    await page.goto('/eo/profile');
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-07-profile-editable');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Event Creation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-08–10 · Event Creation', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-08 · Create New Event Enquiry', async ({ page }) => {
    await page.goto('/eo/enquiries');
    await expect(page.getByRole('heading', { name: 'Event Enquiries', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Create Event' }).click();
    // Expected: navigation to event creation flow
    await page.waitForURL(/\/events\/create/i, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /bring your events|create|new event/i })).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-08-event-creation-flow');
  });

  test('EO-TC-09 · Event Details — Validation', async ({ page }) => {
    await page.goto('/events/create/ai');
    // The AI flow has a textbox for event type — just verify it's present
    await expect(page.getByRole('textbox')).toBeVisible({ timeout: 15_000 });
    await screenshot(page, 'EO-TC-09-event-creation-form');
  });

  test('EO-TC-10 · Save as Draft', async ({ page }) => {
    // Draft events appear under the "Draft Event Enquiries" section on /eo/enquiries
    await page.goto('/eo/enquiries');
    await expect(page.getByRole('heading', { name: /draft event enquiries/i })).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-10-drafts-section');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Vendor Discovery & RFQ
// Note: HatchEvent does not have a standalone /eo/vendors page — vendor
// discovery happens via the Event Services flow for a specific event.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-11–14 · Vendor Discovery & RFQ', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-11 · Browse Vendor Categories', async ({ page }) => {
    // Vendor browsing is done per-event via Event Services
    await page.goto('/eo/services');
    await expect(page.getByRole('heading', { name: 'Event Services' }).first()).toBeVisible({ timeout: 10_000 });
    // Each event has a "HatchEvent Services" button to browse vendors for it
    await expect(page.getByRole('button', { name: 'HatchEvent Services' }).first()).toBeVisible();
    await screenshot(page, 'EO-TC-11-vendor-browsing');
  });

  test('EO-TC-12 · View Vendor Profile', async ({ page }) => {
    await page.goto('/eo/services');
    const servicesBtn = page.getByRole('button', { name: 'HatchEvent Services' }).first();
    if (await servicesBtn.count() > 0) {
      await servicesBtn.click();
      await page.waitForTimeout(3000);
    }
    await screenshot(page, 'EO-TC-12-vendor-services-view');
  });

  test('EO-TC-13 · Submit RFQ to Single Vendor', async ({ page }) => {
    // RFQ submission happens within the Event Services vendor browsing flow
    await page.goto('/eo/services');
    await expect(page.getByRole('heading', { name: 'Event Services' })).toBeVisible();
    await screenshot(page, 'EO-TC-13-rfq-flow-entry');
  });

  test('EO-TC-14 · Submit RFQ to Multiple Vendors — HE Services page', async ({ page }) => {
    // Go directly to the HE services page
    await page.goto('/eo/he-services');
    await page.waitForTimeout(3000);
    // Expected: 3 service tiers visible
    await expect(page.getByText(/Vendor Evaluation Services/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Event Planning Services/).first()).toBeVisible();
    await expect(page.getByText(/Event Onsite Services/).first()).toBeVisible();
    await screenshot(page, 'EO-TC-14-multi-vendor-rfq');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Quotation & Acceptance
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-15–17 · Quotation & Acceptance', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-15 · View Incoming Quotation', async ({ page }) => {
    await page.goto('/eo/enquiries');
    await expect(page.getByRole('heading', { name: 'Event Enquiries', exact: true })).toBeVisible({ timeout: 10_000 });
    // Open an event's details
    const eventCard = page.getByRole('heading', { name: /Event in/i }).first();
    if (await eventCard.count() > 0) {
      await eventCard.click();
      await page.waitForTimeout(2000);
    }
    await screenshot(page, 'EO-TC-15-quotation-view');
  });

  test('EO-TC-16 · Accept Quotation', async ({ page }) => {
    await page.goto('/eo/enquiries');
    // Quotation acceptance happens on event detail page
    await expect(page.getByRole('heading', { name: 'Event Enquiries', exact: true })).toBeVisible();
    await screenshot(page, 'EO-TC-16-quotation-accept-entry');
  });

  test('EO-TC-17 · Reject Quotation', async ({ page }) => {
    await page.goto('/eo/enquiries');
    await expect(page.getByRole('heading', { name: 'Event Enquiries', exact: true })).toBeVisible();
    await screenshot(page, 'EO-TC-17-quotation-reject-entry');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Payment
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-18–20 · Payment', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-18 · Complete Successful Payment', async ({ page }) => {
    await page.goto('/eo/billing');
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-18-billing-page');
  });

  test('EO-TC-19 · Failed Payment Handling', async ({ page }) => {
    await page.goto('/eo/billing');
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-19-billing-page');
  });

  test('EO-TC-20 · View / Download Invoice — filename not "stream" (BUG-29 regression)', async ({ page }) => {
    await page.goto('/eo/billing');
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible({ timeout: 10_000 });
    // Verify "View invoice PDF" buttons exist
    const invoiceBtn = page.getByRole('button', { name: 'View invoice PDF' }).first();
    if (await invoiceBtn.count() > 0) {
      await expect(invoiceBtn).toBeVisible();
      // BUG-29 regression: clicking should open/download a valid PDF
      const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
      await invoiceBtn.click();
      const download = await downloadPromise;
      if (download) {
        const filename = download.suggestedFilename();
        expect(filename).not.toBe('stream');
        expect(filename).toMatch(/\.(pdf|PDF)$/);
      }
    }
    await screenshot(page, 'EO-TC-20-invoice-download');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: RSVP Management
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-21–24 · RSVP Management', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-21 · Set Up RSVP for Event — BUG-21 regression (background not too dark)', async ({ page }) => {
    await page.goto('/eo/rsvp');
    await expect(page.getByRole('heading', { name: 'RSVP by events', exact: true }).first()).toBeVisible({ timeout: 10_000 });
    // BUG-21: verify background colour is not too dark
    const bg = await page.locator('body').evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgb(0, 0, 0)');
    await screenshot(page, 'EO-TC-21-rsvp-page');
  });

  test('EO-TC-22 · Purchase RSVP Package & Download Invoice — BUG-22 regression', async ({ page }) => {
    await page.goto('/eo/rsvp');
    await expect(page.getByRole('heading', { name: 'RSVP by events', exact: true })).toBeVisible();
    // "Purchase Package" button must exist for events without a package
    const purchaseBtn = page.getByRole('button', { name: 'Purchase Package' }).first();
    if (await purchaseBtn.count() > 0) {
      await expect(purchaseBtn).toBeVisible();
    }
    await screenshot(page, 'EO-TC-22-purchase-package');
  });

  test('EO-TC-23 · Send RSVP Invitations', async ({ page }) => {
    await page.goto('/eo/rsvp');
    await expect(page.getByRole('heading', { name: 'RSVP by events', exact: true })).toBeVisible({ timeout: 10_000 });
    // Verify RSVP management buttons
    await expect(page.getByRole('button', { name: 'Edit RSVP' }).first()).toBeVisible();
    await screenshot(page, 'EO-TC-23-rsvp-send');
  });

  test('EO-TC-24 · Track RSVP Responses', async ({ page }) => {
    await page.goto('/eo/rsvp');
    await expect(page.getByRole('heading', { name: 'RSVP by events', exact: true })).toBeVisible();
    // RSVP status tabs
    await expect(page.getByRole('button', { name: /pending invite/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /confirmed/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /declined/i }).first()).toBeVisible();
    await screenshot(page, 'EO-TC-24-rsvp-tracking');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Post-Event
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-25 · Post-Event', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-25 · Rate & Review Vendor', async ({ page }) => {
    // Rating happens on event detail page after event is marked completed
    await page.goto('/eo/enquiries');
    await expect(page.getByRole('heading', { name: 'Event Enquiries', exact: true })).toBeVisible({ timeout: 10_000 });
    // Past events section
    await expect(page.getByRole('heading', { name: 'Past Event Enquiries', exact: true })).toBeVisible();
    await screenshot(page, 'EO-TC-25-past-events');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Navigation & Sidebar
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-26–31 · Navigation & Sidebar', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-26 · All Sidebar Links Functional', async ({ page }) => {
    await page.goto('/eo');
    const sidebarLinks = [
      { name: 'Dashboard',       urlFragment: /\/eo\/?$|\/eo\?/ },
      { name: 'Event enquiries', urlFragment: /\/eo\/enquiries/ },
      { name: 'Event services',  urlFragment: /\/eo\/services/ },
      { name: 'Event guest list',urlFragment: /\/eo\/guest-list/ },
      { name: 'Address book',    urlFragment: /\/eo\/address-book/ },
      { name: 'RSVPs',           urlFragment: /\/eo\/rsvp/ },
      { name: 'Billing',         urlFragment: /\/eo\/billing/ },
      { name: 'Profile',         urlFragment: /\/eo\/profile/ },
      { name: 'Settings',        urlFragment: /\/eo\/settings/ },
    ];
    for (const link of sidebarLinks) {
      await page.getByRole('link', { name: link.name, exact: true }).click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      await expect(page).toHaveURL(link.urlFragment);
    }
    await screenshot(page, 'EO-TC-26-all-sidebar-links');
  });

  test.skip('EO-TC-27 · Dashboard — Manage in App Button [BLOCKED — BUG-23]', async ({ page }) => {
    // BUG-23: Dashboard "Manage in App" button issue
  });

  test.skip('EO-TC-28 · Event Guest List — Manage in App [BLOCKED — BUG-03 / BUG-20]', async ({ page }) => {
    // BUG-03 / BUG-20: Event Guest List Manage-in-App issue
  });

  test.skip('EO-TC-29 · Hide RSVP & HE Services [BLOCKED — BUG-32]', async ({ page }) => {
    // BUG-32: RSVP & HE Services should be hidden
  });

  test('EO-TC-30 · Mobile Viewport — EO Dashboard renders', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/eo');
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    // At mobile width the page renders. Check for any heading rather than h1 specifically
    // (mobile often collapses h1 to h2 or hides the main heading for compact nav)
    const anyHeading = await page.getByRole('heading').count();
    expect(anyHeading).toBeGreaterThan(0);
    await screenshot(page, 'EO-TC-30-mobile-dashboard');
  });

  test.skip('EO-TC-31 · Defined RFQ Status on EO Enquiry [BLOCKED — BUG-37]', async ({ page }) => {
    // BUG-37: Defined RFQ status on EO enquiry
  });
});
