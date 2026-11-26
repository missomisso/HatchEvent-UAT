// tests/03-page-health.spec.js — every page, every night (HLT-TC-xx)
// Checks: loads within budget, shows its heading, no API 5xx, no uncaught JS errors,
// no "undefined"/"NaN" on screen, no broken images, no placeholder (lorem ipsum) copy.
// Console errors and unlabeled buttons are recorded as annotations (not failures).
const { test, expect, meta } = require('../helpers/fixtures');
const { heading, qualityScan, EO_PAGES, VENDOR_PAGES, FLOW_PAGES, EO_STATE, VENDOR_STATE } = require('../helpers/portal');

const BUDGET_MS = 10_000;     // hard fail
const WARN_MS = 5_000;        // annotate as slow
const KNOWN = {
  '/vendor/credits': 'NEW-04 lorem ipsum in package copy',
  '/vendor/listing': 'Test-data: two listing locations are "Lorem Ipsum Sit Amet" addresses',
};

function healthTest(id, role, p) {
  test(`HLT-TC-${id} · ${role} ${p.label || p.path} page is healthy`, meta('Full'), async ({ page, health }) => {
    // Time to usable = navigation start → page heading visible (not network-idle)
    const t0 = Date.now();
    await page.goto(p.path, { waitUntil: 'domcontentloaded' });
    if (p.heading) await expect(heading(page, p.heading)).toBeVisible({ timeout: BUDGET_MS + 5_000 });
    else await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: BUDGET_MS + 5_000 });
    const ms = Date.now() - t0;
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    if (ms > WARN_MS) test.info().annotations.push({ type: 'slow', description: `${p.path} took ${ms} ms` });
    expect(ms, 'load time').toBeLessThan(BUDGET_MS);
    await expect(page).not.toHaveURL(/\/auth\/login/);
    if (p.heading) await expect(heading(page, p.heading)).toBeVisible();
    const q = await qualityScan(page);
    if (q.unnamedButtons) test.info().annotations.push({ type: 'a11y', description: `${q.unnamedButtons} visible button(s) without an accessible name` });
    if (q.imgsNoAlt.length) test.info().annotations.push({ type: 'a11y', description: 'img without alt: ' + q.imgsNoAlt.join(', ') });
    expect(q.badTokens, 'undefined/NaN on screen').toEqual([]);
    expect(q.imgsBroken, 'broken images').toEqual([]);
    if (KNOWN[p.path]) test.info().annotations.push({ type: 'known', description: KNOWN[p.path] });
    else expect(q.lorem, 'placeholder lorem ipsum copy').toBe(false);
    expect(health.serverErrors, 'API 5xx').toEqual([]);
    expect(health.pageErrors, 'uncaught JS errors').toEqual([]);
  });
}

test.describe('HLT · EO pages', () => {
  test.use({ storageState: EO_STATE });
  EO_PAGES.forEach((p, i) => healthTest(String(i + 1).padStart(2, '0'), 'EO', p));
  FLOW_PAGES.eo.forEach((path, i) => healthTest(String(i + 10).padStart(2, '0'), 'EO', { path }));
});

test.describe('HLT · Vendor pages', () => {
  test.use({ storageState: VENDOR_STATE });
  VENDOR_PAGES.forEach((p, i) => healthTest(String(i + 20).padStart(2, '0'), 'Vendor', p));
  FLOW_PAGES.vendor.forEach((path, i) => healthTest(String(i + 31).padStart(2, '0'), 'Vendor', { path }));
});
