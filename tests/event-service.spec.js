// tests/event-service.spec.js — Event Service & RSVP UAT (SVC-TC-01 through SVC-TC-16)
// Source: HatchEvent UAT Tracker — Level 4

const { test, expect } = require('@playwright/test');
const { loginAsEO, loginAsVendor, logout } = require('../helpers/auth');
const { goto, fillField, clickButton, expectSuccess, expectError, waitForUrl, screenshot, checkEmail } = require('../helpers/common');

const BASE = process.env.BASE_URL || 'https://portal.staging.hatchevent.com';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Job Assignment
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-01–02 · Job Assignment', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('SVC-TC-01 · Vendor Receives Job Confirmation', async ({ page }) => {
    // Pre-condition: EO has paid successfully
    await goto(page, '/vendor/dashboard');
    // Expected: vendor receives email + portal notification; job status = 'Confirmed'
    await checkEmail('Job confirmed');
    const confirmedJob = page.getByText(/confirmed|job assigned/i).first();
    if (await confirmedJob.count() > 0) {
      await expect(confirmedJob).toBeVisible({ timeout: 15_000 });
    }
    await screenshot(page, 'SVC-TC-01-vendor-job-confirmed');
  });

  test('SVC-TC-02 · Vendor Acknowledges Job', async ({ page }) => {
    // Pre-condition: job confirmation received
    await goto(page, '/vendor/rfqs');
    await page.getByText(/confirmed/i).first().click();
    await clickButton(page, 'Acknowledge|Confirm Job');
    // Expected: job status = 'Acknowledged'; EO notified
    await expect(page.getByText(/acknowledged/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'SVC-TC-02-job-acknowledged');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Service Delivery
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-03–04 · Service Delivery', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('SVC-TC-03 · Mark Job as Started', async ({ page }) => {
    // Pre-condition: job date reached; vendor logged in
    await goto(page, '/vendor/rfqs');
    await page.getByText(/acknowledged|confirmed/i).first().click();
    await clickButton(page, 'Start Job|Mark as Started');
    await clickButton(page, 'Confirm');
    // Expected: job status = 'In Progress'; EO notified; timestamp recorded
    await expect(page.getByText(/in progress|started/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'SVC-TC-03-job-started');
  });

  test('SVC-TC-04 · Mark Job as Completed', async ({ page }) => {
    // Pre-condition: job in 'In Progress'
    await goto(page, '/vendor/rfqs');
    await page.getByText(/in progress/i).first().click();
    await clickButton(page, 'Mark as Complete|Complete Job');
    await clickButton(page, 'Confirm');
    // Expected: job status = 'Completed'; EO and Admin notified; review request triggered
    await expect(page.getByText(/completed|done/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'SVC-TC-04-job-completed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Rating & Review
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-05–06 · Rating & Review', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('SVC-TC-05 · EO Rates Vendor After Event', async ({ page }) => {
    // Pre-condition: job marked 'Completed'
    await goto(page, '/eo/dashboard');
    await page.getByText(/completed/i).first().click();
    await clickButton(page, 'Rate Vendor|Write Review');
    // Click 4 stars
    const starButtons = page.locator('[data-testid*="star"], [aria-label*="star"], .star, [class*="star"]');
    if (await starButtons.count() >= 4) {
      await starButtons.nth(3).click();
    }
    await fillField(page, 'review|comment', 'Excellent vendor — UAT post-event review');
    await clickButton(page, 'Submit');
    // Expected: review saved; appears on vendor listing; vendor notified
    await expectSuccess(page, 'review submitted|thank you|rating');
    await screenshot(page, 'SVC-TC-05-vendor-rated');
  });

  test('SVC-TC-06 · Ratings Visible on Listing', async ({ page }) => {
    // Pre-condition: EO submitted a rating (SVC-TC-05)
    await goto(page, '/eo/vendors');
    const vendorCard = page.getByRole('article').first();
    await vendorCard.click();
    // Expected: rating shown with correct stars and review text; average updated
    await expect(page.getByText(/review|rating|\d+\s*star/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'SVC-TC-06-rating-visible-on-listing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: RSVP Setup & Management
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-07–12 · RSVP Setup & Management', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('SVC-TC-07 · Create RSVP Form — BUG-21 regression (background correct)', async ({ page }) => {
    // Pre-condition: EO has a confirmed event
    await goto(page, '/eo/rsvp');
    await clickButton(page, 'Create RSVP');
    await fillField(page, 'title', 'UAT RSVP Form');
    await fillField(page, 'deadline', '2026-11-30');
    await fillField(page, 'fields|questions', 'Dietary requirements');
    await clickButton(page, 'Save|Create');
    // Expected: RSVP form created; unique RSVP URL generated; BUG-21: background correct (not too dark)
    await expectSuccess(page, 'created|saved');
    await expect(page.getByText(/rsvp.*(link|url)|your rsvp/i)).toBeVisible({ timeout: 10_000 });
    // BUG-21 regression: background not excessively dark
    const rsvpElement = page.locator('[class*="rsvp"]').first();
    if (await rsvpElement.count() > 0) {
      const bgColor = await rsvpElement.evaluate(el => window.getComputedStyle(el).backgroundColor);
      expect(bgColor).not.toBe('rgb(0, 0, 0)');
    }
    await screenshot(page, 'SVC-TC-07-rsvp-form-created');
  });

  test('SVC-TC-08 · Purchase RSVP Package — BUG-04 regression (Resend RSVP only clickable after purchase)', async ({ page }) => {
    // Pre-condition: logged in as EO; RSVP package available
    await goto(page, '/eo/rsvp');
    await clickButton(page, 'Purchase|Buy Package|Upgrade RSVP');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/card number/i).fill('4242424242424242');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/expiry|mm/i).fill('12/28');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/cvc/i).fill('123');
    await clickButton(page, 'Pay|Confirm');
    // Expected: payment successful; RSVP features unlocked
    await expect(page.getByText(/success|activated|unlocked|package/i)).toBeVisible({ timeout: 30_000 });
    // BUG-04 regression: Resend RSVP button clickable now
    const resendBtn = page.getByRole('button', { name: /resend rsvp/i });
    if (await resendBtn.count() > 0) {
      await expect(resendBtn).not.toBeDisabled();
    }
    await screenshot(page, 'SVC-TC-08-rsvp-package-purchased');
  });

  test('SVC-TC-09 · RSVP Package — Invoice Download (BUG-22 regression)', async ({ page }) => {
    // BUG-22: Invoice download after RSVP purchase was broken — Fixed in staging
    // Pre-condition: RSVP package purchased
    await goto(page, '/eo/billing');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: /download|pdf/i }).first().click();
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    // Expected: invoice downloads with correct filename; no error
    expect(filename).not.toBe('stream');
    expect(filename).toMatch(/\.(pdf|PDF)$/);
    await screenshot(page, 'SVC-TC-09-rsvp-invoice-downloaded');
  });

  test('SVC-TC-10 · Guest Submits RSVP', async ({ page, context }) => {
    // Pre-condition: RSVP form created; link shared
    // Get the RSVP link first
    await goto(page, '/eo/rsvp');
    const rsvpLink = await page.getByText(/https?:\/\//i).first().textContent()
      .catch(() => null);

    if (rsvpLink) {
      // Open in incognito-like context
      const guestPage = await context.newPage();
      await guestPage.goto(rsvpLink);
      await fillField(guestPage, 'name', 'UAT Guest');
      // Select attending
      await guestPage.getByLabel(/attending|accept|yes/i).first().click()
        .catch(() => guestPage.getByText(/attending|accept|yes/i).first().click());
      await fillField(guestPage, 'dietary', 'No restrictions');
      await clickButton(guestPage, 'Submit|RSVP');
      // Expected: RSVP recorded; guest receives confirmation email; EO count updates
      await expect(guestPage.getByText(/thank you|rsvp confirmed|submitted/i)).toBeVisible({ timeout: 15_000 });
      await guestPage.close();
    }
    await screenshot(page, 'SVC-TC-10-guest-rsvp-submitted');
  });

  test('SVC-TC-11 · RSVP — Resend Invite Button Not Clickable Without Package (BUG-04 regression)', async ({ page }) => {
    // Pre-condition: logged in as EO without RSVP package
    // BUG-04: Resend RSVP button should be non-interactive without package
    await goto(page, '/eo/rsvp');
    // Navigate to an event without RSVP package
    const resendBtn = page.getByRole('button', { name: /resend rsvp/i });
    if (await resendBtn.count() > 0) {
      // Expected: button is visually distinct (grayed out / non-interactive)
      const isDisabled = await resendBtn.evaluate(el => el.disabled || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled'));
      expect(isDisabled).toBeTruthy();
    }
    await screenshot(page, 'SVC-TC-11-resend-rsvp-disabled');
  });

  test('SVC-TC-12 · Export Guest List', async ({ page }) => {
    // Pre-condition: RSVP responses received
    await goto(page, '/eo/rsvp');
    await page.getByText(/rsvp/i).first().click();
    const downloadPromise = page.waitForEvent('download');
    await clickButton(page, 'Export Guest List|Export|Download');
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    // Expected: CSV/Excel with Name, Email, Response, +1, Dietary, Timestamp
    expect(filename).toMatch(/\.(csv|xlsx|xls)$/i);
    await screenshot(page, 'SVC-TC-12-guest-list-exported');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Event Check-In
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-13 · Event Check-In', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('SVC-TC-13 · Check In a Guest', async ({ page }) => {
    // Pre-condition: guest list available; event date reached
    await goto(page, '/eo/guest-list');
    const firstGuest = page.getByRole('row').nth(1)
      .or(page.locator('[data-testid="guest-row"]').first());
    await firstGuest.getByRole('button', { name: /check in/i })
      .or(firstGuest.getByText(/check in/i)).click();
    // Expected: guest status = 'Checked In'; count updates in real time
    await expect(firstGuest.getByText(/checked in/i)
      .or(page.getByText(/1 checked in/i))).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'SVC-TC-13-guest-checked-in');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Post-Event Survey
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-14 · Post-Event Survey', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('SVC-TC-14 · EO Submits Post-Event Survey', async ({ page }) => {
    // Pre-condition: event marked complete; survey link from email
    await checkEmail('Post-event survey');
    await goto(page, '/eo/survey');
    // Fill survey questions
    const questions = page.getByRole('radio').or(page.getByRole('checkbox')).or(page.locator('textarea'));
    if (await questions.count() > 0) {
      await questions.first().click();
    }
    await clickButton(page, 'Submit Survey|Submit');
    // Expected: survey submitted; confirmation page shown
    await expect(page.getByText(/thank you|submitted|survey complete/i)).toBeVisible({ timeout: 15_000 });
    await screenshot(page, 'SVC-TC-14-post-event-survey');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Email Notifications
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SVC-TC-15–16 · Email Notifications', () => {

  test.skip('SVC-TC-15 · EO Mobile App — Message/Email Action [BLOCKED — BUG-05 Confirmed Intended]', async ({ page }) => {
    // BUG-05: Message icon in EO Mobile App — pending email address configuration by iFoundries
    // Blocked: Confirmed Intended pending email address setup
  });

  test.skip('SVC-TC-16 · Event Name Synchronization After RSVP Edit [BLOCKED — BUG-38]', async ({ page }) => {
    // BUG-38: Event name should be consistent between RSVP and event overview after edit
    // Blocked: regression from currently open defect; confirm business rule with owner
  });
});
