// tests/vendor-registration.spec.js — Level 2 · Vendor journey (VD-TC-01 … 26)
const { test, expect, meta } = require('../helpers/fixtures');
const { open, heading, bodyText, tickTerms, wizard, VENDOR_PAGES, VENDOR_STATE, EO_STATE, NO_STATE } = require('../helpers/portal');

async function linkOk(request, url) {
  const r = await request.get(url, { maxRedirects: 5, failOnStatusCode: false });
  return r.status();
}

test.describe('VD-TC-01–04 · Vendor registration (logged out)', () => {
  test.use({ storageState: NO_STATE });

  test('VD-TC-01 · Vendor can start registration (stops before account creation)', meta('Partial', null, 'Account creation is done by Laurent/iFoundries'), async ({ page }) => {
    await open(page, '/auth/register');
    await page.getByRole('button', { name: 'Vendor' }).click();
    await page.getByRole('button', { name: /^continue$/i }).first().click();
    await expect(page.getByText('Field is required').first()).toBeVisible();
  });

  test('VD-TC-02 · Vendor verifies email via OTP', meta('Manual', null, 'Needs a real inbox'), async () => { test.skip(true, 'Manual — OTP email'); });

  test('VD-TC-03 · Vendor Google sign-in option is offered', meta('Partial', null, 'OAuth popup completed by a person'), async ({ page }) => {
    await open(page, '/auth/login');
    await page.getByRole('button', { name: 'Vendor' }).click();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('VD-TC-04 · Knowledge Base and FAQ links resolve (BUG-06)', meta('Full', 'BUG-06'), async ({ page, request }) => {
    await open(page, '/auth/register');
    for (const name of ['Knowledge Base', 'Frequently Asked Questions']) {
      const href = await page.getByRole('link', { name }).first().getAttribute('href');
      expect(href, name).toMatch(/^https?:\/\//);
      expect(await linkOk(request, href), `${name} → ${href}`).toBeLessThan(400);
    }
  });
});

test.describe('VD-TC-05–26 · Signed-in vendor', () => {
  test.use({ storageState: VENDOR_STATE });

  test('VD-TC-05 · Company profile shows company information', meta('Full', null, 'Editing is not offered on web Profile (26 Nov)'), async ({ page }) => {
    await open(page, '/vendor/profile');
    const t = await bodyText(page);
    for (const f of ['Company name', 'Membership no', 'Account type', 'UEN No', 'GST Registration No', 'Company contact number', 'Designation']) expect(t, f).toContain(f);
    expect(t).toMatch(/Account type Company/);
    test.info().annotations.push({ type: 'note', description: /UEN No -/.test(t) ? 'UEN not filled for test vendor' : 'UEN present' });
  });

  test('VD-TC-06 · Vendor uploads business documents', meta('Manual', null, 'No document upload on web profile (26 Nov) — confirm where documents are collected'), async () => { test.skip(true, 'Manual'); });
  test('VD-TC-07 · Vendor uploads logo and cover image', meta('Manual', null, 'Upload not automated — needs real image assets'), async () => { test.skip(true, 'Manual'); });

  test('VD-TC-08 · Membership tiers Gold/Silver/Bronze are shown with prices and current tier', meta('Full'), async ({ page }) => {
    await open(page, '/vendor/membership');
    for (const t of ['Gold', 'Silver', 'Bronze']) await expect(heading(page, t)).toBeVisible();
    await expect(page.getByText('YOUR CURRENT TIER')).toBeVisible();
    expect(await bodyText(page)).toMatch(/\$ ?2,400 \/ year/);
  });

  test('VD-TC-09 · Membership page shows current plan, record and upgrade options', meta('Partial', null, 'Test vendor is Gold (top tier) so a paid upgrade cannot be walked; payment is manual'), async ({ page }) => {
    await open(page, '/vendor/member-ship');
    await expect(heading(page, 'Membership Record')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buy Listings' }).first()).toBeVisible();
    const t = await bodyText(page);
    expect(t).toMatch(/Order ID \d+VC\d+/);
    expect(t).toMatch(/Membership cycle \d{2} \w{3} \d{4} – \d{2} \w{3} \d{4}/);
  });

  test('VD-TC-10 · Listing creation offers self-serve and assisted options (BUG-14)', meta('Partial', 'BUG-14', 'Category step not opened: "Continue" reserves a listing number (POST listing-number) — category duplicates checked manually'), async ({ page }) => {
    await open(page, '/vendor/listing/create');
    await expect(page.getByRole('button', { name: /Create my own listing/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Get help from the Hatch Event team/ })).toBeVisible();
  });

  test('VD-TC-11 · Upload listing photos within 10 MB', meta('Manual', 'BUG-28', 'Would modify a live listing'), async () => { test.skip(true, 'Manual'); });
  test('VD-TC-12 · Photos over 10 MB are rejected with a clear message', meta('Manual', 'BUG-28', 'Would modify a live listing'), async () => { test.skip(true, 'Manual'); });

  test('VD-TC-13 · Edit opens the listing form for a published listing (BUG-13)', meta('Partial', 'BUG-13', 'Changing the type is not saved — check editability by hand'), async ({ page }) => {
    await open(page, '/vendor/listing');
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await expect(page).toHaveURL(/vendor\/form\?mode=edit&id=\d+/);
    await expect(page.getByText(/What kind of service do you offer\?|Listing no/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('VD-TC-14 · Vendor\'s live listing is visible to EOs in search results', meta('Full'), async ({ page, browser }) => {
    await open(page, '/vendor/listing');
    const live = (await page.getByRole('heading', { level: 2 }).allInnerTexts()).find(t => /Listing \d/.test(t) && /Catering/.test(t));
    test.skip(!live, 'No live catering listing on the test vendor');
    const eoCtx = await browser.newContext({ storageState: EO_STATE });
    const eo = await eoCtx.newPage();
    await wizard.start(eo); await wizard.fillWhen(eo);
    await wizard.forward(eo).click();
    await eo.getByLabel('Near me').check({ force: true });
    await wizard.forward(eo).click();
    await eo.getByRole('button', { name: 'Catering', exact: true }).click();
    await wizard.forward(eo).click();
    await expect(eo.getByRole('heading', { name: live }).first()).toBeVisible({ timeout: 30_000 });
    await eoCtx.close();
  });

  test('VD-TC-15 · Admin creates a listing for a vendor', meta('Manual', 'BUG-30', 'Admin portal — manual'), async () => { test.skip(true, 'Manual'); });

  test('VD-TC-16 · RFQs appear in the vendor portal with event details', meta('Partial', null, 'Email notification is manual'), async ({ page }) => {
    await open(page, '/vendor/rfqs');
    await expect(heading(page, 'Current RFQs')).toBeVisible();
    const t = await bodyText(page);
    expect(t).toMatch(/Event enquiry no EE-\d{4}-\d+/);
    for (const f of ['Event date', 'No of pax', 'Your category', 'Your listing', 'Status']) expect(t, f).toContain(f);
  });

  test('VD-TC-17 · RFQ list and "View all" open without 404 (BUG-15)', meta('Partial', 'BUG-15', 'Quotation purchase via Stripe is manual'), async ({ page }) => {
    await open(page, '/vendor/rfqs');
    await page.getByRole('button', { name: 'View all' }).first().click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByText(/404|page not found/i)).toHaveCount(0);
  });

  test('VD-TC-18 · Expired RFQs offer no Submit / Purchase / Reject (BUG-31, BUG-40)', meta('Full', 'BUG-31, BUG-40'), async ({ page }) => {
    await open(page, '/vendor/rfqs');
    await page.getByRole('button', { name: 'Expired', exact: true }).click();
    await expect(page.getByText(/Expiry reason/).first()).toBeVisible();
    const past = page.getByRole('heading', { name: 'Past RFQs' }).locator('xpath=ancestor::section[1] | ancestor::div[.//h2][2]').first();
    for (const b of ['Submit', 'Purchase', 'Reject', 'Accept']) {
      await expect(page.getByRole('button', { name: b, exact: true }), `${b} on expired RFQ`).toHaveCount(0);
    }
  });

  test('VD-TC-19 · Vendor can decline an RFQ with a reason (BUG-35)', meta('Manual', 'BUG-35', 'No pending RFQ on the test vendor today; rejecting is a real write'), async ({ page }) => {
    await open(page, '/vendor/rfqs');
    const reject = page.getByRole('button', { name: /reject|decline/i });
    test.skip(await reject.count() === 0, 'No pending RFQ with a Reject button right now');
    await expect(reject.first()).toBeEnabled();
  });

  test('VD-TC-20 · Every vendor sidebar link opens the right page', meta('Full'), async ({ page }) => {
    await open(page, '/vendor/dashboard');
    for (const p of VENDOR_PAGES) {
      await test.step(p.label, async () => {
        await page.locator('aside').getByRole('link', { name: p.label, exact: true }).first().click();
        await expect(page).toHaveURL(new RegExp(p.path.replace(/\//g, '\\/') + '$'));
        await expect(heading(page, p.heading)).toBeVisible();
      });
    }
  });

  test('VD-TC-21 · Vendor Membership is listed under Vendors in the site footer (BUG-33)', meta('Full', 'BUG-33'), async ({ page, request }) => {
    await open(page, '/vendor/membership');
    const vendors = page.locator('footer').getByText('Vendors', { exact: true });
    await expect(vendors).toBeVisible();
    const href = await page.locator('footer').getByRole('link', { name: 'Membership' }).getAttribute('href');
    expect(await linkOk(request, href)).toBeLessThan(400);
  });

  test('VD-TC-22 · EDM campaign: choosing a listing shows EDM packages', meta('Full', 'BUG-03, NEW-02', 'NEW-02: packages never load after a listing is chosen — Continue stays disabled (26 Nov)'), async ({ page }) => {
    test.fail(true, 'NEW-02 — EDM packages do not load (still present)');
    await open(page, '/vendor/edm');
    await page.locator('select').first().selectOption({ index: 1 });
    await expect(page.getByText(/\$|credits/i).filter({ hasNotText: 'Singapore Dollars' }).first(), 'EDM packages should appear').toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled(); // until a package is chosen
  });

  test('VD-TC-23 · Team invite form opens; Send stays disabled without an email', meta('Partial', null, 'Invite is never sent'), async ({ page }) => {
    await open(page, '/vendor/team');
    expect(await bodyText(page)).toMatch(/All \(\d+\) Member \(\d+\) Manager \(\d+\) Owner \(\d+\)/);
    await page.getByRole('button', { name: 'Invite teammates' }).click();
    await expect(page.getByRole('button', { name: /send invite/i })).toBeDisabled();
  });

  test('VD-TC-24 · Vendor invoice PDF downloads with a real filename (BUG-29)', meta('Full', 'BUG-29'), async ({ page }) => {
    await open(page, '/vendor/invoice');
    const row = page.locator('tbody tr').first();
    const [dl] = await Promise.all([page.waitForEvent('download'), row.locator('button, a').last().click()]);
    expect(dl.suggestedFilename()).toMatch(/\.pdf$/i);
    expect(dl.suggestedFilename()).not.toMatch(/^stream/i);
    expect(require('fs').readFileSync(await dl.path()).subarray(0, 4).toString()).toBe('%PDF');
  });

  test('VD-TC-25 · Vendor portal is usable at phone size 390×844', meta('Full'), async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, '/vendor/dashboard');
    await expect(heading(page, /^Hi /)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
  });
});

test.describe('VD-TC-26 · Registration legal links', () => {
  test.use({ storageState: NO_STATE });
  test('VD-TC-26 · Terms of Use and Privacy Policy links on registration resolve (BUG-34)', meta('Full', 'BUG-34'), async ({ page, request }) => {
    await open(page, '/auth/register');
    for (const name of ['Terms of Use', 'Privacy Policy']) {
      const href = await page.getByRole('link', { name }).first().getAttribute('href');
      expect(await linkOk(request, href), `${name} → ${href}`).toBeLessThan(400);
    }
  });
});
