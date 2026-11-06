// tests/eo-journey.spec.js — EO Journey UAT (EO-TC-01 through EO-TC-31)
// Source: HatchEvent UAT Tracker — Level 1

const { test, expect } = require('@playwright/test');
const { loginAsEO, logout }   = require('../helpers/auth');
const { goto, fillField, clickButton, expectSuccess, expectError, waitForUrl, screenshot, checkEmail } = require('../helpers/common');

const BASE = process.env.BASE_URL || 'https://portal.staging.hatchevent.com';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Account Registration & Login
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-01–05 · Account Registration & Login', () => {

  test('EO-TC-01 · New Account — Email Sign-Up', async ({ page }) => {
    const testEmail = `uat+eo${Date.now()}@hatchevent.com`;
    await goto(page, '/eo');
    await clickButton(page, 'Sign Up');
    await fillField(page, 'name', 'UAT Tester');
    await fillField(page, 'email', testEmail);
    await fillField(page, 'password', 'Test@1234!');
    await clickButton(page, 'Sign Up');
    // Expected: account created; verification email sent; redirected to verification page
    await expect(page.getByText(/verify|verification|otp/i)).toBeVisible({ timeout: 15_000 });
    await screenshot(page, 'EO-TC-01-signup-verification-page');
  });

  test('EO-TC-02 · Email Verification (OTP)', async ({ page }) => {
    // Pre-condition: new account created in EO-TC-01
    // OTP retrieval is manual — automate navigation only; verify form exists
    await goto(page, '/eo');
    await expect(page.getByLabel(/otp|verification code/i)
      .or(page.getByPlaceholder(/otp|code/i))
      .or(page.getByRole('textbox', { name: /otp|code/i }))
    ).toBeVisible({ timeout: 10_000 });
    // NOTE: Full end-to-end requires Mailtrap/Mailpit integration — see helpers/common.js checkEmail()
    await checkEmail('Verify your HatchEvent account');
    await screenshot(page, 'EO-TC-02-otp-form');
  });

  test('EO-TC-03 · New Account — Google Sign-In', async ({ page }) => {
    // Google OAuth cannot be fully automated — verifies button is present and initiates redirect
    await goto(page, '/eo');
    const googleBtn = page.getByRole('button', { name: /continue with google|google/i })
      .or(page.getByRole('link', { name: /continue with google|google/i }));
    await expect(googleBtn).toBeVisible();
    await screenshot(page, 'EO-TC-03-google-oauth-button');
    // Manual step: complete Google OAuth in browser
  });

  test('EO-TC-04 · Returning User — Login', async ({ page }) => {
    await loginAsEO(page);
    // Expected: authenticated; dashboard loads
    await expect(page).toHaveURL(/dashboard|home/i);
    await screenshot(page, 'EO-TC-04-eo-dashboard');
  });

  test('EO-TC-05 · Forgot Password', async ({ page }) => {
    await goto(page, '/eo');
    await clickButton(page, 'Forgot Password');
    await fillField(page, 'email', process.env.EO_EMAIL);
    await clickButton(page, 'Send|Reset|Submit');
    // Expected: reset link sent
    await expect(page.getByText(/email sent|check your email|reset link/i)).toBeVisible({ timeout: 10_000 });
    await checkEmail('Reset your HatchEvent password');
    await screenshot(page, 'EO-TC-05-forgot-password-sent');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Profile Setup
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-06–07 · Profile Setup', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-06 · Complete EO Profile', async ({ page }) => {
    await goto(page, '/eo/profile');
    await fillField(page, 'name', 'UAT Event Organizer');
    await fillField(page, 'phone', '+60123456789');
    await fillField(page, 'company', 'UAT Events Sdn Bhd');
    await fillField(page, 'address', '123 Test Street, Kuala Lumpur');
    await clickButton(page, 'Save');
    // Expected: profile saved; confirmation displayed; persists on refresh
    await expectSuccess(page, 'saved|updated|success');
    await page.reload();
    await expect(page.getByDisplayValue(/UAT Event Organizer/i)
      .or(page.getByText(/UAT Event Organizer/i))).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-06-profile-saved');
  });

  test('EO-TC-07 · Edit Existing Profile', async ({ page }) => {
    await goto(page, '/eo/profile');
    await clickButton(page, 'Edit');
    await fillField(page, 'phone', '+60199999999');
    await fillField(page, 'company', 'UAT Events Updated Sdn Bhd');
    await clickButton(page, 'Save');
    // Expected: changes saved and reflected immediately
    await expectSuccess(page, 'saved|updated|success');
    await screenshot(page, 'EO-TC-07-profile-edited');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Event Creation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-08–10 · Event Creation', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-08 · Create New Event Enquiry', async ({ page }) => {
    await goto(page, '/eo/dashboard');
    await clickButton(page, 'Create Event');
    await fillField(page, 'event name', 'UAT Test Event ' + Date.now());
    await fillField(page, 'date', '2026-12-01');
    await fillField(page, 'location', 'Kuala Lumpur Convention Centre');
    await fillField(page, 'guest count', '100');
    await fillField(page, 'budget', '10000');
    await clickButton(page, 'Submit|Create');
    // Expected: event created; appears with Enquiry ID; status 'Draft' or 'Open'
    await expect(page.getByText(/enquiry|ENQ/i)).toBeVisible({ timeout: 15_000 });
    await screenshot(page, 'EO-TC-08-event-created');
  });

  test('EO-TC-09 · Event Details — Validation', async ({ page }) => {
    await goto(page, '/eo/dashboard');
    await clickButton(page, 'Create Event');
    // Leave mandatory fields blank
    await clickButton(page, 'Submit|Create');
    // Expected: validation errors per empty field; form not submitted
    await expect(page.getByText(/required|cannot be empty|mandatory/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).not.toHaveURL(/enquiry/i);
    await screenshot(page, 'EO-TC-09-validation-errors');
  });

  test('EO-TC-10 · Save as Draft', async ({ page }) => {
    await goto(page, '/eo/dashboard');
    await clickButton(page, 'Create Event');
    await fillField(page, 'event name', 'Draft Event ' + Date.now());
    await fillField(page, 'date', '2026-12-15');
    await clickButton(page, 'Save as Draft|Save Draft');
    // Expected: draft saved
    await expectSuccess(page, 'draft saved|saved');
    // Log out and back in; reopen draft
    await logout(page);
    await loginAsEO(page);
    await goto(page, '/eo/dashboard');
    await expect(page.getByText(/draft/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-10-draft-persists');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Vendor Discovery & RFQ
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-11–14 · Vendor Discovery & RFQ', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-11 · Browse Vendor Categories', async ({ page }) => {
    // Pre-condition: event enquiry exists
    await goto(page, '/eo/dashboard');
    // Open an existing enquiry or create one
    await page.getByText(/enquiry|event/i).first().click();
    await expect(page.getByText(/catering|venue|photography|category/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-11-vendor-categories');
  });

  test('EO-TC-12 · View Vendor Profile', async ({ page }) => {
    // Click on a vendor card; verify full profile loads
    await goto(page, '/eo/vendors');
    const vendorCard = page.getByRole('article').first()
      .or(page.locator('[data-testid="vendor-card"]').first())
      .or(page.locator('.vendor-card').first());
    await vendorCard.click();
    // Expected: full profile: description, photos, pricing, reviews
    await expect(page.getByText(/about|description|price|review/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-12-vendor-profile');
  });

  test('EO-TC-13 · Submit RFQ to Single Vendor', async ({ page }) => {
    await goto(page, '/eo/vendors');
    const vendorCard = page.getByRole('article').first()
      .or(page.locator('[data-testid="vendor-card"]').first());
    await vendorCard.click();
    await clickButton(page, 'Request Quote');
    await fillField(page, 'date', '2026-12-01');
    await fillField(page, 'pax|guest count|number of guests', '100');
    await fillField(page, 'budget', '5000');
    await fillField(page, 'notes|message', 'UAT test RFQ');
    await clickButton(page, 'Submit|Send');
    // Expected: RFQ submitted; vendor notified; status = 'Pending'
    await expect(page.getByText(/pending|submitted|rfq sent/i)).toBeVisible({ timeout: 15_000 });
    await screenshot(page, 'EO-TC-13-rfq-submitted');
  });

  test('EO-TC-14 · Submit RFQ to Multiple Vendors', async ({ page }) => {
    await goto(page, '/eo/vendors');
    // Add 2+ vendors to RFQ
    const vendorCards = page.getByRole('article')
      .or(page.locator('[data-testid="vendor-card"]'));
    await vendorCards.nth(0).click();
    await clickButton(page, 'Request Quote|Add to RFQ');
    await page.goBack();
    await vendorCards.nth(1).click();
    await clickButton(page, 'Request Quote|Add to RFQ');
    await clickButton(page, 'Submit All|Submit RFQ');
    // Expected: individual RFQs sent to each vendor; both appear in event
    await expect(page.getByText(/pending|rfq sent/i)).toBeVisible({ timeout: 15_000 });
    await screenshot(page, 'EO-TC-14-multiple-rfq');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Quotation & Acceptance
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-15–17 · Quotation & Acceptance', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-15 · View Incoming Quotation', async ({ page }) => {
    // Pre-condition: vendor has submitted a quotation
    await goto(page, '/eo/dashboard');
    await page.getByText(/enquiry|event/i).first().click();
    await page.getByText(/quote|quotation/i).first().click();
    // Expected: line items, total, terms visible
    await expect(page.getByText(/total|line item|terms/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-15-quotation-view');
  });

  test('EO-TC-16 · Accept Quotation', async ({ page }) => {
    await goto(page, '/eo/dashboard');
    await page.getByText(/enquiry|event/i).first().click();
    await page.getByText(/quote|quotation/i).first().click();
    await clickButton(page, 'Accept');
    await clickButton(page, 'Confirm');
    // Expected: accepted; vendor notified; payment flow initiated
    await expect(page.getByText(/accepted|payment|proceed/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-16-quotation-accepted');
  });

  test('EO-TC-17 · Reject Quotation', async ({ page }) => {
    await goto(page, '/eo/dashboard');
    await page.getByText(/enquiry|event/i).first().click();
    await page.getByText(/quote|quotation/i).first().click();
    await clickButton(page, 'Reject');
    await fillField(page, 'reason', 'UAT test rejection');
    await clickButton(page, 'Confirm');
    // Expected: rejected; vendor notified; status updated
    await expect(page.getByText(/rejected|declined/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-17-quotation-rejected');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Payment
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-18–20 · Payment', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-18 · Complete Successful Payment', async ({ page }) => {
    // Pre-condition: accepted quotation; payment page loaded
    await goto(page, '/eo/dashboard');
    await page.getByText(/pay now|complete payment|proceed to payment/i).first().click();
    // Stripe test card: 4242 4242 4242 4242
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/card number/i).fill('4242424242424242');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/expiry|mm/i).fill('12/28');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/cvc/i).fill('123');
    await clickButton(page, 'Pay|Confirm Payment');
    // Expected: payment successful; confirmation shown; invoice available; vendor notified
    await expect(page.getByText(/payment successful|confirmed|thank you/i)).toBeVisible({ timeout: 30_000 });
    await screenshot(page, 'EO-TC-18-payment-success');
  });

  test('EO-TC-19 · Failed Payment Handling', async ({ page }) => {
    await goto(page, '/eo/dashboard');
    await page.getByText(/pay now|complete payment|proceed to payment/i).first().click();
    // Stripe decline test card: 4000 0000 0000 0002
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/card number/i).fill('4000000000000002');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/expiry|mm/i).fill('12/28');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/cvc/i).fill('123');
    await clickButton(page, 'Pay|Confirm Payment');
    // Expected: clear error; no duplicate charge; booking not confirmed
    await expect(page.getByText(/declined|failed|error/i)).toBeVisible({ timeout: 20_000 });
    await expect(page).not.toHaveURL(/success|confirmed/i);
    await screenshot(page, 'EO-TC-19-payment-declined');
  });

  test('EO-TC-20 · View / Download Invoice — filename not "stream" (BUG-29 regression)', async ({ page }) => {
    await goto(page, '/eo/billing');
    // Expected: invoice available with proper filename (not 'stream')
    const downloadPromise = page.waitForEvent('download');
    await page.getByText(/download|pdf/i).first().click();
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    expect(filename).not.toBe('stream');
    expect(filename).toMatch(/\.(pdf|PDF)$/);
    await screenshot(page, 'EO-TC-20-invoice-downloaded');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: RSVP Management
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-21–24 · RSVP Management', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-21 · Set Up RSVP for Event — BUG-21 regression (background not too dark)', async ({ page }) => {
    await goto(page, '/eo/rsvp');
    await clickButton(page, 'Create RSVP|Set Up RSVP');
    await fillField(page, 'title', 'UAT Test RSVP');
    await fillField(page, 'deadline', '2026-11-30');
    await clickButton(page, 'Save|Create');
    // Expected: RSVP configured; link generated; BUG-21 — background not too dark
    await expectSuccess(page, 'created|saved|rsvp');
    // BUG-21 regression: check RSVP background is not excessively dark
    const rsvpPreview = page.locator('[class*="rsvp"], [data-testid*="rsvp"]').first();
    if (await rsvpPreview.count() > 0) {
      const bgColor = await rsvpPreview.evaluate(el => window.getComputedStyle(el).backgroundColor);
      // Ensure it's not pure black or very dark
      expect(bgColor).not.toBe('rgb(0, 0, 0)');
    }
    await screenshot(page, 'EO-TC-21-rsvp-setup');
  });

  test('EO-TC-22 · Purchase RSVP Package & Download Invoice — BUG-22 regression', async ({ page }) => {
    await goto(page, '/eo/rsvp');
    // Purchase RSVP package
    await clickButton(page, 'Purchase|Buy Package|Upgrade');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/card number/i).fill('4242424242424242');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/expiry|mm/i).fill('12/28');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/cvc/i).fill('123');
    await clickButton(page, 'Pay|Confirm');
    await expectSuccess(page, 'success|purchased|activated');
    // BUG-22 regression: invoice downloads correctly (not broken)
    const downloadPromise = page.waitForEvent('download');
    await page.getByText(/download invoice|pdf/i).first().click();
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    expect(filename).not.toBe('stream');
    expect(filename).toMatch(/\.(pdf|PDF)$/);
    await screenshot(page, 'EO-TC-22-rsvp-invoice');
  });

  test('EO-TC-23 · Send RSVP Invitations', async ({ page }) => {
    await goto(page, '/eo/rsvp');
    await page.getByText(/rsvp/i).first().click();
    await clickButton(page, 'Send Invitations|Invite Guests');
    await fillField(page, 'email', 'uat-guest@hatchevent.com');
    await clickButton(page, 'Send|Invite');
    // Expected: guests receive email with RSVP link
    await expectSuccess(page, 'sent|invite');
    await checkEmail('You are invited');
    await screenshot(page, 'EO-TC-23-rsvp-invitations-sent');
  });

  test('EO-TC-24 · Track RSVP Responses', async ({ page }) => {
    await goto(page, '/eo/rsvp');
    await page.getByText(/rsvp/i).first().click();
    // Expected: dashboard shows Invited, Accepted, Declined, Pending
    await expect(page.getByText(/invited|accepted|declined|pending/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'EO-TC-24-rsvp-dashboard');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Post-Event
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-25 · Post-Event', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-25 · Rate & Review Vendor', async ({ page }) => {
    // Pre-condition: event marked complete
    await goto(page, '/eo/dashboard');
    await page.getByText(/completed|past event/i).first().click();
    await clickButton(page, 'Rate Vendor|Write Review');
    // Click 4 stars
    await page.locator('[data-testid="star-4"], [aria-label="4 stars"], .star').nth(3).click();
    await fillField(page, 'review|comment', 'Great vendor, UAT test review');
    await clickButton(page, 'Submit');
    // Expected: review submitted; appears on vendor listing
    await expectSuccess(page, 'review submitted|thank you');
    await screenshot(page, 'EO-TC-25-vendor-rated');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Navigation & Sidebar
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EO-TC-26–31 · Navigation & Sidebar', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('EO-TC-26 · All Sidebar Links Functional', async ({ page }) => {
    await goto(page, '/eo/dashboard');
    const sidebarLinks = [
      { name: 'Dashboard',           urlPattern: /dashboard/i },
      { name: 'Event Enquiries',     urlPattern: /enquir/i },
      { name: 'Event Services',      urlPattern: /service/i },
      { name: 'Event Guest List',    urlPattern: /guest/i },
      { name: 'RSVPs',               urlPattern: /rsvp/i },
      { name: 'Address Book',        urlPattern: /address/i },
      { name: 'Billing',             urlPattern: /billing/i },
      { name: 'Profile',             urlPattern: /profile/i },
      { name: 'Settings',            urlPattern: /setting/i },
    ];
    for (const link of sidebarLinks) {
      await page.getByRole('link', { name: new RegExp(link.name, 'i') })
               .or(page.getByRole('menuitem', { name: new RegExp(link.name, 'i') }))
               .first().click();
      await expect(page).toHaveURL(link.urlPattern, { timeout: 10_000 });
      await expect(page.getByText(/error|404|not found/i)).not.toBeVisible();
    }
    await screenshot(page, 'EO-TC-26-sidebar-all-links');
  });

  test.skip('EO-TC-27 · Dashboard — Manage in App Button [BLOCKED — BUG-23]', async ({ page }) => {
    // BUG-23: Manage in App button — iOS: TestFlight redirect; Android: HatchEvent static page
    // Blocked pending iFoundries update
  });

  test.skip('EO-TC-28 · Event Guest List — Manage in App [BLOCKED — BUG-03 / BUG-20]', async ({ page }) => {
    // BUG-03 / BUG-20: Manage in App link after app launch
    // Blocked pending iFoundries link update
  });

  test.skip('EO-TC-29 · Hide RSVP & HE Services [BLOCKED — BUG-32]', async ({ page }) => {
    // BUG-32: RSVP and HE Services sections should be hidden from EO
    // Blocked pending fix
  });

  test('EO-TC-30 · Mobile Viewport — EO Dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goto(page, '/eo/dashboard');
    // Expected: responsive layout; no horizontal scroll; touch targets accessible
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(390 + 5); // 5px tolerance
    await goto(page, '/eo/enquiries');
    await goto(page, '/eo/profile');
    await screenshot(page, 'EO-TC-30-mobile-viewport');
  });

  test.skip('EO-TC-31 · Defined RFQ Status on EO Enquiry [BLOCKED — BUG-37]', async ({ page }) => {
    // BUG-37: RFQ should display a defined, approved status (no "Unknown" label)
    // Blocked: regression from currently open defect; confirm business rule with owner
  });
});
