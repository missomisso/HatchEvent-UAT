// tests/00-access-control.spec.js — who can reach what (AC-TC-xx)
const { test, expect, meta } = require('../helpers/fixtures');
const { open, NO_STATE, EO_STATE, VENDOR_STATE, heading } = require('../helpers/portal');
const { loginAsEO, loginAsVendor } = require('../helpers/auth');

test.describe('AC · Logged-out visitor', () => {
  test.use({ storageState: NO_STATE });

  for (const [id, path] of [['01', '/eo'], ['02', '/eo/enquiries'], ['03', '/eo/billing'], ['04', '/vendor/dashboard'], ['05', '/vendor/rfqs'], ['06', '/vendor/invoice'], ['07', '/admin']]) {
    test(`AC-TC-${id} · Logged-out visitor is sent to login from ${path}`, meta('Full'), async ({ page }) => {
      await open(page, path);
      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    });
  }

  test('AC-TC-08 · Root URL lands on public home page', meta('Full'), async ({ page }) => {
    await open(page, '/');
    await expect(page).toHaveURL(/\/home/);
  });

  test('AC-TC-09 · Public AI event-creation page is reachable without login', meta('Full', null, 'Confirm with product that /events/create/ai is meant to be public'), async ({ page }) => {
    await open(page, '/events/create/ai');
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });

  test('AC-TC-10 · Unknown route shows a friendly 404 with a way home', meta('Full'), async ({ page }) => {
    await open(page, '/this-page-does-not-exist-uat');
    await expect(page.getByText(/404/).first()).toBeVisible();
    await expect(page.getByText(/Page Not found/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /go back home/i }).or(page.getByRole('link', { name: /go back home/i })).first()).toBeVisible();
  });
});

test.describe('AC · Role separation', () => {
  test.describe('Event Organiser session', () => {
    test.use({ storageState: EO_STATE });
    for (const [id, path] of [['11', '/vendor/dashboard'], ['12', '/vendor/listing'], ['13', '/vendor/invoice']]) {
      test(`AC-TC-${id} · EO cannot open vendor page ${path}`, meta('Full'), async ({ page }) => {
        await open(page, path);
        await expect(page).not.toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '$'));
        await expect(page).toHaveURL(/\/eo/);
      });
    }
    test('AC-TC-14 · EO cannot open the Admin portal', meta('Full'), async ({ page }) => {
      await open(page, '/admin');
      await expect(page).not.toHaveURL(/\/admin/);
    });
  });

  test.describe('Vendor session', () => {
    test.use({ storageState: VENDOR_STATE });
    for (const [id, path] of [['15', '/eo'], ['16', '/eo/enquiries'], ['17', '/eo/address-book']]) {
      test(`AC-TC-${id} · Vendor cannot open EO page ${path}`, meta('Full'), async ({ page }) => {
        await open(page, path);
        await expect(page).toHaveURL(/\/vendor\/dashboard/);
      });
    }
    test('AC-TC-18 · Vendor cannot open the Admin portal', meta('Full'), async ({ page }) => {
      await open(page, '/admin');
      await expect(page).not.toHaveURL(/\/admin/);
    });
  });
});

