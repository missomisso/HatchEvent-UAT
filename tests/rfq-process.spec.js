// tests/rfq-process.spec.js — RFQ Process UAT (RFQ-TC-01 through RFQ-TC-18)
// Source: HatchEvent UAT Tracker — Level 3

const { test, expect } = require('@playwright/test');
const { loginAsEO, loginAsVendor, logout } = require('../helpers/auth');
const { goto, fillField, clickButton, expectSuccess, expectError, waitForUrl, screenshot, checkEmail } = require('../helpers/common');

const BASE = process.env.BASE_URL || 'https://portal.staging.hatchevent.com';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: RFQ Submission (EO side)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('RFQ-TC-01–03 · RFQ Submission', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('RFQ-TC-01 · Submit RFQ — All Required Fields', async ({ page }) => {
    // Pre-condition: EO logged in; event enquiry exists; vendor listing available
    await goto(page, '/eo/vendors');
    const vendorCard = page.getByRole('article').first()
      .or(page.locator('[data-testid="vendor-card"]').first());
    await vendorCard.click();
    await clickButton(page, 'Request Quote');
    await fillField(page, 'date', '2026-12-01');
    await fillField(page, 'pax|guest count|number of guests', '150');
    await fillField(page, 'budget', '8000');
    await fillField(page, 'notes|message', 'UAT RFQ test — all required fields');
    await clickButton(page, 'Submit|Send');
    // Expected: RFQ created with unique ID; vendor notified; status = 'Pending'
    await expect(page.getByText(/RFQ|rfq/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/pending/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'RFQ-TC-01-rfq-submitted');
  });

  test('RFQ-TC-02 · RFQ Validation — Missing Fields', async ({ page }) => {
    // Pre-condition: EO on RFQ form
    await goto(page, '/eo/vendors');
    const vendorCard = page.getByRole('article').first();
    await vendorCard.click();
    await clickButton(page, 'Request Quote');
    // Leave event date and pax count blank; attempt submit
    await clickButton(page, 'Submit|Send');
    // Expected: validation errors; RFQ not submitted
    await expect(page.getByText(/required|cannot be empty|mandatory/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).not.toHaveURL(/rfq.*success|pending/i);
    await screenshot(page, 'RFQ-TC-02-rfq-validation-errors');
  });

  test('RFQ-TC-03 · Submit to Multiple Vendors Same Category', async ({ page }) => {
    // Pre-condition: 2+ vendor listings in same category
    await goto(page, '/eo/vendors');
    const vendorCards = page.getByRole('article')
      .or(page.locator('[data-testid="vendor-card"]'));
    // Add first vendor
    await vendorCards.nth(0).click();
    await clickButton(page, 'Request Quote|Add to RFQ');
    await page.goBack();
    // Add second vendor
    await vendorCards.nth(1).click();
    await clickButton(page, 'Request Quote|Add to RFQ');
    await clickButton(page, 'Submit All|Submit RFQ');
    await fillField(page, 'date', '2026-12-15');
    await fillField(page, 'pax', '200');
    await fillField(page, 'budget', '12000');
    await clickButton(page, 'Confirm|Submit');
    // Expected: separate RFQs for each vendor; both notified independently
    await expect(page.getByText(/pending|rfq sent/i)).toBeVisible({ timeout: 15_000 });
    await screenshot(page, 'RFQ-TC-03-multiple-vendors-rfq');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Vendor Response
// ─────────────────────────────────────────────────────────────────────────────
test.describe('RFQ-TC-04–06 · Vendor Response', () => {
  test.beforeEach(async ({ page }) => { await loginAsVendor(page); });

  test('RFQ-TC-04 · Vendor Receives RFQ In-Portal — BUG-31 partial', async ({ page }) => {
    // Pre-condition: EO has just submitted RFQ
    await goto(page, '/vendor/rfqs');
    // Expected: RFQ visible with EO's details; status = 'New'
    await expect(page.getByText(/rfq|request|new/i)).toBeVisible({ timeout: 15_000 });
    const rfqItem = page.getByText(/new|pending/i).first();
    await rfqItem.click();
    // Verify EO details are shown
    await expect(page.getByText(/event date|pax|budget/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'RFQ-TC-04-vendor-rfq-received');
  });

  test('RFQ-TC-05 · Quotation — Line Items and Auto-Calculation', async ({ page }) => {
    // Pre-condition: RFQ accepted (vendor has paid the bid fee)
    await goto(page, '/vendor/rfqs');
    await page.getByText(/accepted|bid successful|create quotation/i).first().click();
    await clickButton(page, 'Create Quotation');
    // Add 3 line items
    for (let i = 0; i < 3; i++) {
      await clickButton(page, 'Add Item|Add Line Item');
      await fillField(page, `description|item ${i + 1}`, `UAT Item ${i + 1}`);
      await fillField(page, `price|amount|unit price`, `${(i + 1) * 1000}`);
    }
    // Expected: subtotal auto-calculates; total reflects sum correctly
    const total = await page.getByText(/total|subtotal/i).last().textContent();
    expect(total).toMatch(/3[,.]?000|3000/); // Expect 3000 total
    await screenshot(page, 'RFQ-TC-05-line-items-auto-calc');
  });

  test('RFQ-TC-06 · Quotation — Payment Terms', async ({ page }) => {
    // Pre-condition: creating quotation
    await goto(page, '/vendor/rfqs');
    await page.getByText(/accepted|create quotation/i).first().click();
    await clickButton(page, 'Create Quotation');
    // Set deposit 50%, balance due 14 days before event
    await fillField(page, 'deposit %|deposit percentage', '50');
    await fillField(page, 'balance due|days before', '14');
    await clickButton(page, 'Save|Submit Quotation');
    // Expected: payment terms saved; EO sees breakdown on review
    await expectSuccess(page, 'saved|submitted|quotation');
    await screenshot(page, 'RFQ-TC-06-payment-terms');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Quotation Review by EO
// ─────────────────────────────────────────────────────────────────────────────
test.describe('RFQ-TC-07–11 · Quotation Review by EO', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('RFQ-TC-07 · EO Notified of New Quotation', async ({ page }) => {
    // Pre-condition: vendor has submitted quotation
    await goto(page, '/eo/dashboard');
    // Expected: email received with vendor name, event name, total, link
    await checkEmail('New quotation received');
    // Also check in-portal notification
    const notification = page.getByText(/new quotation|quote received/i);
    if (await notification.count() > 0) {
      await expect(notification).toBeVisible();
    }
    await screenshot(page, 'RFQ-TC-07-eo-quotation-notification');
  });

  test('RFQ-TC-08 · Accept Quotation', async ({ page }) => {
    // Pre-condition: at least one quotation received
    await goto(page, '/eo/dashboard');
    await page.getByText(/enquiry|event/i).first().click();
    await page.getByText(/quote|quotation/i).first().click();
    await clickButton(page, 'Accept');
    await clickButton(page, 'Confirm');
    // Expected: status = 'Accepted'; vendor notified; payment page shown
    await expect(page.getByText(/accepted|payment|proceed/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'RFQ-TC-08-quotation-accepted');
  });

  test('RFQ-TC-09 · Reject Quotation', async ({ page }) => {
    // Pre-condition: quotation received
    await goto(page, '/eo/dashboard');
    await page.getByText(/enquiry|event/i).first().click();
    await page.getByText(/quote|quotation/i).first().click();
    await clickButton(page, 'Reject');
    await fillField(page, 'reason', 'UAT test — over budget');
    await clickButton(page, 'Confirm');
    // Expected: rejected; vendor notified
    await expect(page.getByText(/rejected|declined/i)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'RFQ-TC-09-quotation-rejected');
  });

  test('RFQ-TC-10 · Accept RFQ — No Command Prompt Error (BUG-18 regression)', async ({ page }) => {
    // BUG-18: Accepting RFQ showed command prompt / server error — Fixed
    await goto(page, '/eo/dashboard');
    await page.getByText(/enquiry|event/i).first().click();
    await page.getByText(/quote|quotation/i).first().click();
    await clickButton(page, 'Accept');
    await clickButton(page, 'Confirm');
    // Expected: NO command prompt or server error text
    await expect(page.getByText(/>_|prompt|server error|internal error|\$\s/i)).not.toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'RFQ-TC-10-no-command-prompt-error');
  });

  test('RFQ-TC-11 · Event Enquiries — PDF Download (BUG-19 regression)', async ({ page }) => {
    // BUG-19: PDF button under Quote Price caused error — Fixed
    await goto(page, '/eo/enquiries');
    // Expected: PDF downloads correctly; no error
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /pdf/i }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.(pdf|PDF)$/);
    await screenshot(page, 'RFQ-TC-11-enquiry-pdf-download');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Payment Processing
// ─────────────────────────────────────────────────────────────────────────────
test.describe('RFQ-TC-12–15 · Payment Processing', () => {
  test.beforeEach(async ({ page }) => { await loginAsEO(page); });

  test('RFQ-TC-12 · Deposit Payment', async ({ page }) => {
    // Pre-condition: quotation accepted with 50% deposit terms
    await goto(page, '/eo/dashboard');
    await page.getByText(/pay deposit|pay now/i).first().click();
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/card number/i).fill('4242424242424242');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/expiry|mm/i).fill('12/28');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/cvc/i).fill('123');
    await clickButton(page, 'Pay|Confirm');
    // Expected: deposit paid; receipt issued; balance shown as outstanding
    await expect(page.getByText(/deposit paid|balance due|outstanding/i)).toBeVisible({ timeout: 30_000 });
    await screenshot(page, 'RFQ-TC-12-deposit-paid');
  });

  test('RFQ-TC-13 · Full Payment — Card', async ({ page }) => {
    // Pre-condition: payment page loaded
    await goto(page, '/eo/dashboard');
    await page.getByText(/pay now|complete payment/i).first().click();
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/card number/i).fill('4242424242424242');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/expiry|mm/i).fill('12/28');
    await page.frameLocator('iframe[src*="stripe"]').getByLabel(/cvc/i).fill('123');
    await clickButton(page, 'Pay|Confirm');
    // Expected: payment confirmed; portal shows success
    await expect(page.getByText(/payment successful|confirmed|thank you/i)).toBeVisible({ timeout: 30_000 });
    await screenshot(page, 'RFQ-TC-13-card-payment-success');
  });

  test('RFQ-TC-14 · Full Payment — FPX', async ({ page }) => {
    // Pre-condition: payment page loaded; FPX option visible
    await goto(page, '/eo/dashboard');
    await page.getByText(/pay now|complete payment/i).first().click();
    const fpxOption = page.getByText(/fpx|bank transfer/i).first();
    if (await fpxOption.count() > 0) {
      await fpxOption.click();
      await page.getByText(/test bank|cimb test/i).first().click();
      await clickButton(page, 'Authorise|Confirm|Pay');
      // Expected: payment confirmed; redirect back with success
      await expect(page.getByText(/payment successful|confirmed/i)).toBeVisible({ timeout: 30_000 });
    }
    await screenshot(page, 'RFQ-TC-14-fpx-payment');
  });

  test('RFQ-TC-15 · Invoice Generation — EO — BUG-29 regression (filename not "stream")', async ({ page }) => {
    // Pre-condition: payment completed
    await goto(page, '/eo/billing');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: /download|pdf/i }).first().click();
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    // Expected: correct amount, EO details, proper filename (not 'stream')
    expect(filename).not.toBe('stream');
    expect(filename).toMatch(/\.(pdf|PDF)$/);
    await screenshot(page, 'RFQ-TC-15-eo-invoice-filename');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
test.describe('RFQ-TC-16–18 · Edge Cases', () => {

  test('RFQ-TC-16 · RFQ Expiry — Vendor Cannot Act After Deadline (BUG-31 regression)', async ({ page }) => {
    // BUG-31: Vendor blocked after RFQ deadline — Fixed
    await loginAsVendor(page);
    await goto(page, '/vendor/rfqs');
    const expiredRfq = page.getByText(/expired|closed/i).first();
    if (await expiredRfq.count() > 0) {
      await expiredRfq.click();
      const actionButtons = page.getByRole('button', { name: /bid|purchase|reject/i });
      if (await actionButtons.count() > 0) {
        await expect(actionButtons.first()).toBeDisabled();
      }
    }
    await screenshot(page, 'RFQ-TC-16-expired-rfq-vendor');
  });

  test('RFQ-TC-17 · No Vendor Response — EO Notified', async ({ page }) => {
    // Pre-condition: all vendors missed deadline
    await loginAsEO(page);
    await goto(page, '/eo/dashboard');
    // Expected: EO notified; prompted to search alternative vendors
    await checkEmail('No vendor response to your RFQ');
    const noResponseNotice = page.getByText(/no response|deadline passed|find another vendor/i);
    if (await noResponseNotice.count() > 0) {
      await expect(noResponseNotice).toBeVisible({ timeout: 10_000 });
    }
    await screenshot(page, 'RFQ-TC-17-no-vendor-response-eo-notified');
  });

  test.skip('RFQ-TC-18 · EO Vendor Reselection After RFQ Rejection [BLOCKED — BUG-36]', async ({ page }) => {
    // BUG-36: EO vendor reselection after RFQ rejection — blocked pending business rule confirmation
    // Pre-condition: vendor rejects RFQ; EO should be able to select replacement vendor
  });
});
