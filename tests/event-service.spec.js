// tests/event-service.spec.js — Level 4 · Event service & RSVP (SVC-TC-01 … 16)
const { test, expect, meta } = require('../helpers/fixtures');
const { open, heading, bodyText, rsvp, tickTerms, expandBlock, wizard, EO_STATE, VENDOR_STATE } = require('../helpers/portal');

test.describe('SVC · Vendor jobs', () => {
  test.use({ storageState: VENDOR_STATE });

  test('SVC-TC-01 · Vendor dashboard shows quotation-request counters by status', meta('Partial', null, 'Assignment email is manual'), async ({ page }) => {
    await open(page, '/vendor/dashboard');
    for (const s of ['New', 'Accepted', 'Pending', 'Rejected', 'Completed', 'Expired']) {
      await expect(page.locator('button').filter({ hasText: new RegExp(`^\\s*${s}\\s*\\d+\\s*$`) }).first(), s).toBeVisible();
    }
  });

  test('SVC-TC-02 · Acknowledged / Accepted jobs can be filtered on RFQs', meta('Partial'), async ({ page }) => {
    await open(page, '/vendor/rfqs');
    const opts = await page.locator('select').nth(1).locator('option').allInnerTexts();
    for (const o of ['Accepted', 'Acknowledged', 'Completed', 'Expired']) expect(opts, o).toContain(o);
  });

  test('SVC-TC-03 · Vendor marks job "In progress" on event day', meta('Manual', null, 'No in-progress action on web; mobile app'), async () => { test.skip(true, 'Manual'); });

  test('SVC-TC-04 · Completed jobs are filterable', meta('Partial'), async ({ page }) => {
    await open(page, '/vendor/rfqs');
    await page.getByRole('button', { name: 'Completed', exact: true }).click();
    await page.waitForTimeout(1000);
    const past = (await bodyText(page)).split('Past RFQs').pop();
    expect(past, 'Completed filter must hide expired RFQs').not.toMatch(/Expiry reason/);
  });
});

test.describe('SVC · EO services & RSVP', () => {
  test.use({ storageState: EO_STATE });

  test('SVC-TC-05 · EO sees the 1–5 star rating on past events (BUG-39)', meta('Partial', 'BUG-39', 'Not clicked'), async ({ page }) => {
    await open(page, '/eo/enquiries');
    await page.getByLabel('Filter section').selectOption('past');
    const card = await expandBlock(page, 0);
    await expect(card.getByRole('button', { name: 'Rate 5 out of 5' }).first()).toBeVisible();
  });

  test('SVC-TC-06 · Vendor ratings are shown on listing cards', meta('Full'), async ({ page }) => {
    await wizard.start(page); await wizard.fillWhen(page);
    await wizard.forward(page).click();
    await page.getByLabel('Near me').check({ force: true });
    await wizard.forward(page).click();
    await page.getByRole('button', { name: 'Catering', exact: true }).click();
    await wizard.forward(page).click();
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.card .card__info-text').filter({ hasText: /\d\.\d ⭐/ }).first()).toBeVisible();
  });

  test('SVC-TC-07 · RSVP form editor opens with event details pre-filled (BUG-21)', meta('Full', 'BUG-21', 'Not saved'), async ({ page }) => {
    await rsvp.openEditor(page);
    await expect(page.locator('input[name=eventName]')).not.toHaveValue('');
    expect(await bodyText(page)).toMatch(/Create\W+Invite\W+Selection\W+Summary\W+Complete/);
  });

  test('SVC-TC-08 · RSVP package purchase reaches the Stripe gate (BUG-04/41/44/45)', meta('Partial', 'BUG-04, BUG-41, BUG-44, BUG-45', 'Never pays'), async ({ page }) => {
    await open(page, '/eo/rsvp');
    await page.getByRole('button', { name: 'Purchase Package' }).first().click();
    await expect(page).toHaveURL(/rsvp\/package/, { timeout: 30_000 });
    await page.getByRole('button', { name: /^Bronze Package/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/package\/summary/);
    const pay = page.getByRole('button', { name: /Secure checkout at STRIPE/i });
    await expect(pay).toBeDisabled(); await tickTerms(page); await expect(pay).toBeEnabled();
  });

  test('SVC-TC-09 · RSVP package invoices are listed and download (BUG-22)', meta('Full', 'BUG-22'), async ({ page }) => {
    await open(page, '/eo/billing');
    const all = await page.locator('tbody tr').count();
    await page.getByText('RSVP Packages', { exact: true }).click();
    await page.waitForTimeout(1200);
    const rsvpRows = await page.locator('tbody tr').count();
    test.info().annotations.push({ type: 'note', description: `All=${all}, RSVP Packages=${rsvpRows}` });
    test.skip(rsvpRows === 0, 'No RSVP-package invoices on the test EO');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('tbody tr').first().getByRole('button', { name: /view invoice pdf/i }).click()]);
    expect(dl.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('SVC-TC-10 · External guest submits RSVP via shared link', meta('Manual', 'BUG-49', 'Needs a live RSVP campaign'), async () => { test.skip(true, 'Manual'); });

  test('SVC-TC-11 · Events without a package show "No RSVP package purchased" and no Resend (BUG-04/50)', meta('Full', 'BUG-04, BUG-50'), async ({ page }) => {
    await open(page, '/eo/rsvp');
    await expect(page.getByText('No RSVP package purchased for this event').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /resend/i }).filter({ has: page.locator(':not([disabled])') })).toHaveCount(0);
  });

  test('SVC-TC-12 · Guest list CSV export has the expected columns (BUG-51/53)', meta('Full', 'BUG-51, BUG-53'), async ({ page }) => {
    await open(page, '/eo/guest-list');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).first().click()]);
    expect(dl.suggestedFilename()).toMatch(/\.csv$/i);
    const head = require('fs').readFileSync(await dl.path(), 'utf8').split(/\r?\n/)[0];
    expect(head).toBe('ID,First Name,Last Name,Email,Phone,Group,Permission,Plus Ones');
  });

  test('SVC-TC-13 · Guest check-in', meta('Manual', 'BUG-48', 'Mobile app'), async () => { test.skip(true, 'Manual'); });
  test('SVC-TC-14 · Post-event survey', meta('Manual'), async () => { test.skip(true, 'Manual'); });
  test('SVC-TC-15 · EO mobile app message/email action', meta('Manual', 'BUG-05', 'Mobile app'), async () => { test.skip(true, 'Manual'); });

  test('SVC-TC-16 · Event name is the same on RSVP editor, RSVP list and enquiries (BUG-38)', meta('Full', 'BUG-38'), async ({ page }) => {
    await rsvp.openEditor(page);
    await expect(page.locator('input[name=eventName]')).not.toHaveValue('');
    const name = await page.locator('input[name=eventName]').inputValue();
    const ee = ((await bodyText(page)).match(/EE-\d{4}-\d+/) || [])[0];
    expect(name).not.toBe('');
    const near = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '.{0,90}' + ee);
    await open(page, '/eo/rsvp');
    expect(await bodyText(page), 'RSVP list').toMatch(near);
    await open(page, '/eo/enquiries');
    expect(await bodyText(page), 'Enquiries').toMatch(near);
  });
});
