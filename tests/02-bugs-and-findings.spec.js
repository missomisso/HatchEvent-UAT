// tests/02-bugs-and-findings.spec.js
//   REG-BUG-xx  → regression checks for bugs in the Bug Log not already covered by a journey TC
//   NEW-xx      → issues found during the 26 Nov 2026 deep review (not yet in the Bug Log)
//
// Open bugs use test.fail(): the test PASSES while the bug is still there, and turns RED
// ("unexpected pass") the day it is fixed — that is the signal to re-test and close it.
const { test, expect, meta } = require('../helpers/fixtures');
const { open, heading, bodyText, wizard, NO_STATE, EO_STATE, VENDOR_STATE } = require('../helpers/portal');

const ok = async (request, url) => (await request.get(url, { failOnStatusCode: false, maxRedirects: 5 })).status();

test.describe('Regression · public', () => {
  test.use({ storageState: NO_STATE });

  test('REG-BUG-07 · Blog link on the main page works', meta('Full', 'BUG-07'), async ({ page, request }) => {
    await open(page, '/home');
    const href = await page.getByRole('link', { name: 'Blog', exact: true }).first().getAttribute('href');
    expect(await ok(request, href), href).toBeLessThan(400);
  });

  test('NEW-09 · Footer "Follow Us" social icons point to real profiles', meta('Full', 'NEW-09', 'All five icons link to "#" (26 Nov)'), async ({ page }) => {
    test.fail(true, 'NEW-09 still present');
    await open(page, '/auth/login');
    const hrefs = await page.locator('footer a').evaluateAll(as => as.map(a => a.getAttribute('href')));
    expect(hrefs.filter(h => h === '#' || h === ''), 'empty social links').toEqual([]);
  });
});

test.describe('Regression · EO', () => {
  test.use({ storageState: EO_STATE });

  test('REG-BUG-43 · "Send vendor summary email" (envelope/share icon) is shown', meta('Full', 'BUG-43'), async ({ page }) => {
    await open(page, '/eo/enquiries');
    await expect(page.getByRole('button', { name: 'Send vendor summary email' }).first()).toBeVisible();
  });

  test('REG-BUG-41 · "here" on the RSVP package page is a working link', meta('Full', 'BUG-41'), async ({ page }) => {
    test.fail(true, 'BUG-41 open — "here" is plain text with no link');
    await open(page, '/eo/rsvp');
    await page.getByRole('button', { name: 'Purchase Package' }).first().click();
    await expect(page).toHaveURL(/rsvp\/package/, { timeout: 30_000 });
    const here = page.getByText(/^here$/i).first();
    await expect(here).toBeVisible();
    expect(await here.evaluate(e => !!e.closest('a[href]') || e.getAttribute('role') === 'link')).toBe(true);
  });

  test('REG-BUG-45 · RSVP package page opened directly still lists the packages', meta('Full', 'BUG-45', 'Via "Purchase Package" it works; opened directly (bookmark/refresh) it shows no packages'), async ({ page }) => {
    test.fail(true, 'BUG-45 open — direct /eo/rsvp/package shows no packages');
    await open(page, '/eo/rsvp/package');
    await expect(heading(page, 'Gold Package')).toBeVisible({ timeout: 15_000 });
  });

  test('REG-BUG-45b · RSVP package page survives a browser refresh', meta('Full', 'BUG-45'), async ({ page }) => {
    test.fail(true, 'BUG-45 open — refresh loses event context');
    await open(page, '/eo/rsvp');
    await page.getByRole('button', { name: 'Purchase Package' }).first().click();
    await expect(heading(page, 'Gold Package')).toBeVisible({ timeout: 30_000 });
    await page.reload(); await page.waitForLoadState('networkidle').catch(() => {});
    await expect(heading(page, 'Gold Package')).toBeVisible({ timeout: 15_000 });
  });

  for (const [id, path] of [['a', '/eo/billing'], ['b', '/eo/enquiries'], ['c', '/eo/rsvp'], ['d', '/eo/services'], ['e', '/eo/guest-list']]) {
    test(`NEW-01${id} · "Export" on ${path} produces a file`, meta('Full', 'NEW-01', 'Export button does nothing — no download, no request (26 Nov)'), async ({ page }) => {
      test.fail(true, 'NEW-01 still present');
      await open(page, path);
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8_000 }), page.getByRole('button', { name: 'Export', exact: true }).first().click()]);
      expect(dl.suggestedFilename()).toMatch(/\.(csv|xlsx|pdf)$/i);
    });
  }

  test('NEW-05 · HatchEvent Services pages talk about HE Services, not RSVP packages', meta('Full', 'NEW-05', 'Page is titled "HatchEvent RSVP Menu"; summary says "What happens after you purchased a RSVP Package?" and "RSVP Services contract"'), async ({ page }) => {
    test.fail(true, 'NEW-05 still present');
    await open(page, '/eo/services');
    await page.getByRole('button', { name: 'HatchEvent Services' }).first().click();
    await expect(page.getByRole('button', { name: /Vendor Evaluation Services/ })).toBeVisible();
    expect(await bodyText(page)).not.toMatch(/RSVP Menu/);
    await page.getByRole('button', { name: /Vendor Evaluation Services/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    expect(await bodyText(page)).not.toMatch(/RSVP Package|RSVP Services contract/);
  });

  test('NEW-06 · Draft events are not listed as "Ongoing" on the Guest List', meta('Full', 'NEW-06'), async ({ page }) => {
    await open(page, '/eo/enquiries');
    await page.getByLabel('Filter section').selectOption('draft');
    await page.waitForTimeout(1500);
    const drafts = (await page.locator('h3').allInnerTexts()).map(s => s.trim()).filter(s => s && !/Event Enquiries|Draft Events/.test(s));
    test.skip(!drafts.length, 'No draft events');
    await open(page, '/eo/guest-list');
    const t = await bodyText(page);
    const ongoing = t.split('Ongoing Events')[1]?.split('Past Events')[0] || '';
    const leaked = drafts.filter(d => ongoing.includes(d));
    test.info().annotations.push({ type: 'note', description: 'Drafts shown as ongoing: ' + (leaked.join(', ') || 'none') });
    test.fail(leaked.length > 0, 'NEW-06 still present');
    expect(leaked).toEqual([]);
  });

  test('NEW-07 · RSVP invite templates contain no test/junk entries', meta('Full', 'NEW-07', 'Template "ergergerg" is offered to EOs'), async ({ page }) => {
    const { rsvp } = require('../helpers/portal');
    await rsvp.toLocation(page);
    if (!(await page.locator('textarea[name=eventAddress]').inputValue())) await page.locator('textarea[name=eventAddress]').fill('UAT-AUTO (not saved)');
    await rsvp.next(page, 'additional-guests');
    await rsvp.next(page, 'event-url');
    await rsvp.next(page, 'invite-background');
    const names = (await page.locator('main button').allInnerTexts()).map(s => s.trim()).filter(Boolean);
    const junk = names.filter(n => !/RSVP$|^Continue$/.test(n));
    test.info().annotations.push({ type: 'note', description: 'Templates: ' + names.join(', ') });
    test.fail(junk.length > 0, 'NEW-07 still present');
    expect(junk).toEqual([]);
  });

  test('NEW-08 · Wizard back/forward buttons have accessible names', meta('Full', 'NEW-08', 'Screen-reader users hear "button" only'), async ({ page }) => {
    test.fail(true, 'NEW-08 still present');
    await wizard.start(page);
    const name = await wizard.forward(page).evaluate(b => (b.getAttribute('aria-label') || b.innerText || b.title || '').trim());
    expect(name).not.toBe('');
  });

  test('NEW-10 · Wizard keeps a 12-hour time when PM is chosen', meta('Full', 'NEW-10', 'Typing 04:00 then PM shows "16:00" next to "PM"'), async ({ page }) => {
    test.fail(true, 'NEW-10 still present');
    await wizard.start(page);
    await wizard.typeTime(page, 1, '04:00', 'pm');
    await expect(page.getByPlaceholder('HH:MM').nth(1)).toHaveValue('04:00');
  });

  test('NEW-10b · Choosing PM before typing the time keeps PM', meta('Full', 'NEW-10', 'PM resets to AM after typing → event saved 12 h early'), async ({ page }) => {
    test.fail(true, 'NEW-10 still present');
    await wizard.start(page);
    await page.getByLabel('Select AM or PM').nth(1).selectOption('pm');
    const t = page.getByPlaceholder('HH:MM').nth(1);
    await t.click(); await t.pressSequentially('0600'); await t.blur();
    await expect(page.getByLabel('Select AM or PM').nth(1)).toHaveValue('pm');
  });

  test('NEW-10c · Retyping a time replaces the old value', meta('Full', 'NEW-10', 'Second typing is ignored (09:00 stays 09:00)'), async ({ page }) => {
    test.fail(true, 'NEW-10 still present');
    await wizard.start(page);
    const t = page.getByPlaceholder('HH:MM').nth(1);
    await t.click(); await t.pressSequentially('0900'); await t.blur();
    await t.click(); await t.pressSequentially('0400'); await t.blur();
    await expect(t).toHaveValue('04:00');
  });

  test('NEW-11 · Enquiry cards can be expanded with the keyboard', meta('Full', 'NEW-11', 'Card header is a clickable <div> with no role/tabindex'), async ({ page }) => {
    test.fail(true, 'NEW-11 still present');
    await open(page, '/eo/enquiries');
    await page.getByLabel('Filter section').selectOption('past');
    const h = page.locator('.card-header--clickable').first();
    expect(await h.evaluate(e => e.tagName === 'BUTTON' || e.getAttribute('role') === 'button' || e.tabIndex >= 0)).toBe(true);
  });
});

test.describe('Regression · Vendor', () => {
  test.use({ storageState: VENDOR_STATE });

  test('NEW-04 · Credits packages have real copy (no lorem ipsum)', meta('Full', 'NEW-04'), async ({ page }) => {
    test.fail(true, 'NEW-04 still present');
    await open(page, '/vendor/credits');
    expect(await bodyText(page)).not.toMatch(/lorem ipsum/i);
  });

  for (const [id, path] of [['f', '/vendor/rfqs'], ['g', '/vendor/invoice'], ['h', '/vendor/listing']]) {
    test(`NEW-01${id} · Vendor "Export" on ${path} produces a file`, meta('Full', 'NEW-01'), async ({ page }) => {
      await open(page, path);
      const got = await Promise.all([
        page.waitForEvent('download', { timeout: 8_000 }).then(d => d.suggestedFilename()).catch(() => null),
        page.getByRole('button', { name: /^Export/ }).first().click(),
      ]).then(r => r[0]);
      test.info().annotations.push({ type: 'note', description: `Download: ${got || 'none'}` });
      test.fail(!got, 'NEW-01 also on vendor side');
      expect(got).toBeTruthy();
    });
  }
});
