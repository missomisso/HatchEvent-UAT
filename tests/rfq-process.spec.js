// tests/rfq-process.spec.js — Level 3 · RFQ process (RFQ-TC-01 … 18)
const { test, expect, meta } = require('../helpers/fixtures');
const { open, heading, bodyText, wizard, expectToast, EO_STATE, VENDOR_STATE } = require('../helpers/portal');

test.describe('RFQ · EO side', () => {
  test.use({ storageState: EO_STATE });

  test('RFQ-TC-01 · Complete RFQ is ready to send (stops at the send button)', meta('Partial', null, '"Request for quotation now" is never clicked'), async ({ page }) => {
    await wizard.walkToFinal(page);
    await expect(page.getByRole('button', { name: 'Request for quotation now' })).toBeEnabled();
  });

  test('RFQ-TC-02 · RFQ is blocked when required details are missing', meta('Full'), async ({ page }) => {
    await wizard.start(page);
    await wizard.forward(page).click();
    await expectToast(page, 'Start date is required');
    await expect(page.getByRole('button', { name: 'Request for quotation now' })).toHaveCount(0);
  });

  test('RFQ-TC-03 · RFQ to 2+ vendors — up to 3 selectable', meta('Partial', null, 'Never sends'), async ({ page }) => {
    await wizard.start(page); await wizard.fillWhen(page);
    await wizard.forward(page).click();
    await page.getByLabel('Near me').check({ force: true });
    await wizard.forward(page).click();
    await page.getByRole('button', { name: 'Catering', exact: true }).click();
    await wizard.forward(page).click();
    const cards = page.locator('.card');
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });
    await cards.nth(0).click(); await cards.nth(1).click();
    await expect(page.locator('.card.card--selected')).toHaveCount(2);
  });

  test('RFQ-TC-07 · EO is emailed when a vendor submits a quotation', meta('Manual', 'BUG-47'), async () => { test.skip(true, 'Manual — email'); });

  test('RFQ-TC-08 · Accepting a quotation: Acknowledge is offered', meta('Partial', null, 'Never clicked'), async ({ page }) => {
    await open(page, '/eo/enquiries');
    await expect(page.getByRole('button', { name: 'Acknowledge' }).first()).toBeEnabled();
  });

  test('RFQ-TC-09 · EO rejects a quotation with reason', meta('Manual'), async () => { test.skip(true, 'Manual — would change a live quotation'); });

  test('RFQ-TC-10 · Enquiries page shows no server error / stack trace (BUG-18)', meta('Full', 'BUG-18'), async ({ page, health }) => {
    await open(page, '/eo/enquiries');
    expect(await bodyText(page)).not.toMatch(/exception|stack trace|SQLSTATE|Internal Server Error|at \w+\.\w+ \(/i);
    expect(health.serverErrors).toEqual([]);
  });

  test('RFQ-TC-11 · Quotation PDF under Quote Price (BUG-19)', meta('Manual', 'BUG-19', 'No PDF button on the 26 Nov enquiries layout — confirm where the quote PDF now lives'), async ({ page }) => {
    await open(page, '/eo/enquiries');
    const pdf = page.getByRole('button', { name: /pdf/i }).or(page.getByRole('link', { name: /pdf/i }));
    test.skip(await pdf.count() === 0, 'No PDF control on enquiries');
  });

  for (const [id, name, bug] of [['12', 'EO pays the deposit', null], ['13', 'Card payment end-to-end', null], ['14', 'FPX bank-transfer payment', null]]) {
    test(`RFQ-TC-${id} · ${name}`, meta('Manual', bug, 'Real payment — Stripe test mode by a person'), async () => { test.skip(true, 'Manual — payment'); });
  }

  test('RFQ-TC-15 · Billing summary (count & total amount) matches the invoice list', meta('Full', 'BUG-29, NEW-03', 'NEW-03: 26 Nov — summary says 6 invoices / $2,027 but list shows 5 rows totalling $1,155'), async ({ page }) => {
    test.fail(true, 'NEW-03 — Billing summary does not match invoice list (still present)');
    await open(page, '/eo/billing');
    const t = await bodyText(page);
    const total = +(t.match(/Total invoices (\d+)/) || [])[1];
    const amount = +((t.match(/Total amount \$ ?([\d,]+(\.\d+)?)/) || [])[1] || '0').replace(/,/g, '');
    const rows = await page.locator('tbody tr').allInnerTexts();
    const sum = rows.reduce((a, r) => a + +((r.match(/\$ ?([\d,]+(\.\d+)?)/) || [])[1] || '0').replace(/,/g, ''), 0);
    test.info().annotations.push({ type: 'note', description: `Summary: ${total} invoices / $${amount}. List: ${rows.length} rows / $${sum}` });
    expect(rows.length).toBe(Math.min(total, 10));
    if (total <= 10) expect(sum).toBeCloseTo(amount, 0);
  });

  test('RFQ-TC-17 · EO notified when all vendors miss the deadline', meta('Manual'), async () => { test.skip(true, 'Manual — email/notification'); });

  test('RFQ-TC-18 · EO can choose other services after a rejection (BUG-36)', meta('Partial', 'BUG-36'), async ({ page }) => {
    await open(page, '/eo/services');
    await expect(page.getByRole('button', { name: 'Buy other services' }).first()).toBeVisible();
  });
});

test.describe('RFQ · Vendor side', () => {
  test.use({ storageState: VENDOR_STATE });

  test('RFQ-TC-04 · RFQ shows in vendor portal with EO contact info (BUG-31, BUG-58)', meta('Full', 'BUG-31, BUG-58'), async ({ page }) => {
    await open(page, '/vendor/rfqs');
    expect(await bodyText(page)).toMatch(/Event enquiry no EE-\d{4}-\d+/);
    await page.getByRole('button', { name: 'Event organiser info' }).first().click();
    await expect(heading(page, 'Event organiser details')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).last().click();
  });

  test('RFQ-TC-05 · Vendor adds line items; totals auto-calculate', meta('Manual', 'BUG-54', 'Requires submitting a real quotation'), async () => { test.skip(true, 'Manual'); });
  test('RFQ-TC-06 · Vendor sets deposit % and balance due date', meta('Manual', null, 'Requires submitting a real quotation'), async () => { test.skip(true, 'Manual'); });

  test('RFQ-TC-16 · Expired RFQs show reason and no actions (BUG-31, BUG-40)', meta('Full', 'BUG-31, BUG-40'), async ({ page }) => {
    await open(page, '/vendor/rfqs');
    await page.getByRole('button', { name: 'Expired', exact: true }).click();
    const t = await bodyText(page);
    expect(t).toMatch(/Status Expired/);
    expect(t).toMatch(/Expiry reason/);
    await expect(page.getByRole('button', { name: /^(Submit|Purchase|Reject)$/ })).toHaveCount(0);
  });
});
