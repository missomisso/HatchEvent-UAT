// tests/vendor-registration.spec.js — Vendor Registration UAT (VD-TC-01 through VD-TC-26)
// Source: HatchEvent UAT Tracker — Level 2

const { test, expect } = require('@playwright/test');
const { loginAsVendor, loginAsAdmin, logout } = require('../helpers/auth');
const { goto, fillField, clickButton, expectSuccess, expectError, waitForUrl, screenshot, checkEmail } = require('../helpers/common');

const BASE = process.env.BASE_URL || 'https://portal.staging.hatchevent.com';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Account Registration
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VD-TC-01–04 · Account Registration', () => {

  test('VD-TC-01 · New Vendor — Email Sign-Up', async ({ page }) => {
    const testEmail = `uat+vd${Date.now()}@hatchevent.com`;
    await goto(page, '/vendor');
    await clickButton(page, 'Register|Sign Up');
    await fillField(page, 'name', 'UAT Vendor Company');
    await fillField(page, 'email', testEmail);
    await fillField(page, 'password', 'Test@1234!');
    await clickButton(page, 'Register|Sign Up|Submit');
    // Expected: account created; verification email sent
    await expect(page.getByText(/verify|verification|email sent/i)).toBeVisible({ timeout: 15_000 });
    await screenshot(page, 'VD-TC-01-vendor-signup');
  });

  test('VD-TC-02 · Email Verification', async ({ page }) => {
    // Verify OTP/link form is present; full automation needs email integration
    await goto(page, '/vendor');
    const otpInput = page.getByLabel(/otp|verification code/i)
      .or(page.getByPlaceholder(/otp|code/i));
    if (await otpInput.count() > 0) {
      await expect(otpInput).toBeVisible();
    }
    await checkEmail('Verify your HatchEvent vendor account');
    await screenshot(page, 'VD-TC-02-vendor-otp-form');
  });

  test('VD-TC-03 · Google OAuth Sign-In', async ({ page }) => {
    await goto(page, '/vendor');
    const googleBtn = page.getByRole('button', { name: /continue with google|google/i })
      .or(page.getByRole('link', { name: /continue with google|google/i }));
    await expect(googleBtn).toBeVisible();
    await screenshot(page, 'VD-TC-03-vendor-google-oauth');
    // Manual: complete Google OAuth
  });

  test('VD-TC-04 · Knowledge Base Link on Sign-Up — BUG-06 regression', async ({ page }) => {
    // BUG-06: Knowledge Base link was 404 — now Fixed
    await loginAsVendor(page);
    const kbLink = page.getByRole('link', { name: /knowledge base|faq|help/i });
    await expect(kbLink).toBeVisible();
    // Click and verify no 404
    const [popup] = await Promise.all([
      page.waitForEvent('popup').catch(() => null),
      kbLink.click(),
    ]);
    if (popup) {
      await popup.waitForLoadState('load');
      await expect(popup).not.toHaveURL(/404/i);
      expect(popup.url()).not.toContain('404');
    } else {
      await expect(page).not.toHaveURL(/404/i);
    }
    await screenshot(page, 'VD-TC-04-knowledge-base-link');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Company Profile Setup
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VD-TC-05–07 · Company Profile Setup', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('VD-TC-05 · Enter Company Details', async ({ page }) => {
    await goto(page, '/vendor/profile');
    await fillField(page, 'company name', 'UAT Catering Sdn Bhd');
    await fillField(page, 'category', 'Catering');
    await fillField(page, 'address', '456 Vendor Street, KL');
    await fillField(page, 'contact|phone', '+60112345678');
    await clickButton(page, 'Save');
    // Expected: company details saved; moves to next onboarding step
    await expectSuccess(page, 'saved|updated|success');
    await screenshot(page, 'VD-TC-05-company-details-saved');
  });

  test('VD-TC-06 · Upload Company Documents (IC/BR/SSM)', async ({ page }) => {
    await goto(page, '/vendor/documents');
    // Upload a test PDF
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test document'),
    });
    await clickButton(page, 'Upload|Submit');
    // Expected: documents uploaded; shown as 'Pending Review'
    await expect(page.getByText(/pending review|uploaded|submitted/i)).toBeVisible({ timeout: 15_000 });
    await screenshot(page, 'VD-TC-06-documents-uploaded');
  });

  test('VD-TC-07 · Upload Profile / Cover Photo', async ({ page }) => {
    await goto(page, '/vendor/listing');
    // Upload a small test PNG for logo
    const logoInput = page.locator('input[type="file"][accept*="image"]').first();
    await logoInput.setInputFiles({
      name: 'test-logo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    });
    await clickButton(page, 'Save|Upload');
    // Expected: images saved and shown on listing preview
    await expectSuccess(page, 'saved|uploaded');
    await screenshot(page, 'VD-TC-07-photos-uploaded');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Membership & Payment
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VD-TC-08–09 · Membership & Payment', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('VD-TC-08 · Select Membership Tier', async ({ page }) => {
    await goto(page, '/vendor/membership');
    // Expected: tiers listed; select Silver
    await expect(page.getByText(/bronze|silver|gold/i)).toBeVisible({ timeout: 10_000 });
    await page.getByText(/silver/i).first().click();
    // Expected: payment page initiated with correct price
    await expect(page.getByText(/payment|proceed|subscribe/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'VD-TC-08-membership-tier-selected');
  });

  test('VD-TC-09 · Complete Membership Payment', async ({ page }) => {
    await goto(page, '/vendor/membership');
    await page.getByText(/silver/i).first().click();
    await clickButton(page, 'Subscribe|Pay|Proceed');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/card number/i).fill('4242424242424242');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/expiry|mm/i).fill('12/28');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/cvc/i).fill('123');
    await clickButton(page, 'Pay|Confirm');
    // Expected: payment successful; membership upgraded; account status updated
    await expect(page.getByText(/success|active|upgraded|silver/i)).toBeVisible({ timeout: 30_000 });
    await screenshot(page, 'VD-TC-09-membership-payment-success');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Listing Management
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VD-TC-10–15 · Listing Management', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('VD-TC-10 · Create New Listing — Category Selection — BUG-14 regression (no duplicates)', async ({ page }) => {
    await goto(page, '/vendor/listings');
    await clickButton(page, 'Create Listing|New Listing');
    // Expected: no duplicate options in category/type dropdowns (BUG-14 fixed)
    const categoryDropdown = page.getByLabel(/category|type/i).first();
    await expect(categoryDropdown).toBeVisible();
    const options = await categoryDropdown.locator('option').allTextContents();
    const unique = new Set(options);
    expect(unique.size).toBe(options.length); // no duplicates
    await screenshot(page, 'VD-TC-10-listing-categories');
  });

  test('VD-TC-11 · Create New Listing — Photos (Under 10MB)', async ({ page }) => {
    await goto(page, '/vendor/listings');
    await clickButton(page, 'Create Listing|New Listing');
    const photoInput = page.locator('input[type="file"][accept*="image"]').first();
    // Upload a small PNG (well under 10MB)
    await photoInput.setInputFiles({
      name: 'listing-photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    });
    // Expected: photo uploaded successfully (no error)
    await expect(page.getByText(/error|too large|exceeds/i)).not.toBeVisible({ timeout: 5_000 });
    await screenshot(page, 'VD-TC-11-photo-under-10mb');
  });

  test.skip('VD-TC-12 · Create New Listing — Photos (Over 10MB) [BLOCKED — BUG-28 Confirmed Intended]', async ({ page }) => {
    // BUG-28: System rejects photos over 10MB — Confirmed Intended behaviour
    // Blocked: behaviour is confirmed as intended; test kept for documentation
  });

  test.skip('VD-TC-13 · Edit Listing — Change Listing Type [BLOCKED — BUG-13 Open, requirement conflict]', async ({ page }) => {
    // BUG-13: Editing a listing type that was previously published — requirement conflict pending resolution
  });

  test('VD-TC-14 · Listing Approved by Admin', async ({ page }) => {
    // This test requires Admin login
    await loginAsAdmin(page);
    await goto(page, process.env.ADMIN_URL + '/listings?status=pending');
    const pendingRow = page.getByText(/pending/i).first();
    if (await pendingRow.count() > 0) {
      await pendingRow.click();
      await clickButton(page, 'Approve');
      await expectSuccess(page, 'approved|active');
    }
    await screenshot(page, 'VD-TC-14-listing-approved');
  });

  test('VD-TC-15 · Admin Creates Listing on Behalf of Vendor — BUG-30 (Work in Progress)', async ({ page }) => {
    // BUG-30: Admin can create listing for vendor — Work in Progress
    await loginAsAdmin(page);
    await goto(page, process.env.ADMIN_URL + '/vendors');
    const vendorRow = page.getByRole('row').nth(1);
    if (await vendorRow.count() > 0) {
      await vendorRow.click();
      const createBtn = page.getByRole('button', { name: /create listing|add listing/i });
      if (await createBtn.count() > 0) {
        await createBtn.click();
        await expectSuccess(page, 'created|listing');
      } else {
        test.skip(); // Feature still WIP
      }
    }
    await screenshot(page, 'VD-TC-15-admin-creates-listing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: RFQ Management (Vendor side)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VD-TC-16–19 · RFQ Management', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('VD-TC-16 · Receive RFQ Notification', async ({ page }) => {
    // Pre-condition: EO has submitted RFQ to this vendor
    await goto(page, '/vendor/rfqs');
    // Expected: both email and portal notification; RFQ visible
    await expect(page.getByText(/rfq|request for quote|new request/i)).toBeVisible({ timeout: 15_000 });
    await checkEmail('New RFQ from');
    await screenshot(page, 'VD-TC-16-rfq-received');
  });

  test('VD-TC-17 · Accept RFQ and Submit Quotation via Stripe — BUG-15 regression (no 404)', async ({ page }) => {
    // BUG-15: Vendor accept RFQ caused 404 — Fixed
    await goto(page, '/vendor/rfqs');
    const newRfq = page.getByText(/new|pending/i).first();
    await newRfq.click();
    await clickButton(page, 'Bid For RFQ|Accept');
    // Stripe payment for RFQ bid
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/card number/i).fill('4242424242424242');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/expiry|mm/i).fill('12/28');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/cvc/i).fill('123');
    await clickButton(page, 'Pay|Confirm');
    // Expected: no 404; payment processed; EO notified
    await expect(page).not.toHaveURL(/404/i);
    await expectSuccess(page, 'submitted|success|quotation sent');
    await screenshot(page, 'VD-TC-17-rfq-accepted-no-404');
  });

  test('VD-TC-18 · RFQ Expiry — Cannot Act After Deadline — BUG-31 regression', async ({ page }) => {
    // BUG-31: Vendor blocked after RFQ deadline — Fixed
    await goto(page, '/vendor/rfqs');
    // Look for an expired RFQ
    const expiredRfq = page.getByText(/expired|closed|deadline passed/i).first();
    if (await expiredRfq.count() > 0) {
      await expiredRfq.click();
      // Expected: expired state shown; action buttons locked
      const bidBtn = page.getByRole('button', { name: /bid|purchase|reject/i });
      if (await bidBtn.count() > 0) {
        await expect(bidBtn).toBeDisabled();
      }
    }
    await screenshot(page, 'VD-TC-18-expired-rfq-locked');
  });

  test.skip('VD-TC-19 · Reject RFQ [BLOCKED — BUG-35]', async ({ page }) => {
    // BUG-35: Vendor cannot reject RFQ — blocked pending fix
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Vendor Dashboard
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VD-TC-20–26 · Vendor Dashboard', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('VD-TC-20 · All Sidebar Links Functional', async ({ page }) => {
    await goto(page, '/vendor/dashboard');
    const sidebarLinks = [
      { name: 'Dashboard',           urlPattern: /dashboard/i },
      { name: 'Listing',             urlPattern: /listing/i },
      { name: 'RFQs',                urlPattern: /rfq/i },
      { name: 'Membership',          urlPattern: /membership/i },
      { name: 'Credits and Points',  urlPattern: /credit|point/i },
      { name: 'Sponsored Links',     urlPattern: /sponsor/i },
      { name: 'EDMs',                urlPattern: /edm/i },
      { name: 'Invoices',            urlPattern: /invoice/i },
      { name: 'Profile',             urlPattern: /profile/i },
      { name: 'Team',                urlPattern: /team/i },
      { name: 'Settings',            urlPattern: /setting/i },
    ];
    for (const link of sidebarLinks) {
      const navLink = page.getByRole('link', { name: new RegExp(link.name, 'i') })
        .or(page.getByRole('menuitem', { name: new RegExp(link.name, 'i') }));
      if (await navLink.count() > 0) {
        await navLink.first().click();
        await expect(page.getByText(/error|404|not found/i)).not.toBeVisible({ timeout: 8_000 });
      }
    }
    await screenshot(page, 'VD-TC-20-vendor-sidebar-links');
  });

  test('VD-TC-21 · Vendor Membership Under Vendors Tab — BUG-33 regression', async ({ page }) => {
    // BUG-33: Vendor Membership should appear under Vendors tab (staging OK, production closed)
    await goto(page, '/vendor/dashboard');
    // Check for Vendor Membership under Vendors section
    const vendorsSection = page.getByText(/vendors/i).first();
    await expect(vendorsSection).toBeVisible();
    const membershipItem = page.getByRole('link', { name: /membership/i })
      .or(page.getByText(/vendor membership/i));
    await expect(membershipItem).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'VD-TC-21-vendor-membership-tab');
  });

  test.skip('VD-TC-22 · EDMs — Add Campaign [BLOCKED — BUG-03]', async ({ page }) => {
    // BUG-03: EDM Add Campaign — blocked pending fix
  });

  test('VD-TC-23 · Invite Teammates', async ({ page }) => {
    await goto(page, '/vendor/team');
    await clickButton(page, 'Invite Teammates|Invite Team Member');
    await fillField(page, 'email', `uat+teammate${Date.now()}@hatchevent.com`);
    await clickButton(page, 'Send|Invite');
    // Expected: invite sent; invitee receives email; pending invite in Team list
    await expectSuccess(page, 'invite sent|invited');
    await expect(page.getByText(/pending/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'VD-TC-23-teammate-invited');
  });

  test('VD-TC-24 · Invoice Download — Correct Filename — BUG-29 regression', async ({ page }) => {
    // BUG-29: Invoice filename was 'stream' — Fixed in staging
    await goto(page, '/vendor/invoices');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: /pdf|download|open/i }).first().click();
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    // Expected: readable filename (e.g. invoice_VC00109_2026.pdf), not 'stream'
    expect(filename).not.toBe('stream');
    expect(filename).toMatch(/\.(pdf|PDF)$/);
    await screenshot(page, 'VD-TC-24-invoice-filename');
  });

  test('VD-TC-25 · Mobile Viewport — Vendor Dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goto(page, '/vendor/dashboard');
    // Expected: responsive; no horizontal scroll; touch targets adequate
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(390 + 5);
    await goto(page, '/vendor/listings');
    await goto(page, '/vendor/rfqs');
    await screenshot(page, 'VD-TC-25-vendor-mobile-viewport');
  });

  test.skip('VD-TC-26 · Registration Terms of Use Link [BLOCKED — BUG-34]', async ({ page }) => {
    // BUG-34: Registration Terms of Use link — blocked pending fix
    // Expected: https://hatchevent.com/terms-of-use-for-registration opens with no 404
  });
});
