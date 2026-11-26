// tests/zz-logout.spec.js — runs LAST so that, if the portal ends every session on logout,
// no other test loses its shared login.
const { test, expect, meta } = require('../helpers/fixtures');
const { open, NO_STATE } = require('../helpers/portal');
const { loginAsEO, loginAsVendor } = require('../helpers/auth');

test.describe('AC · Logout', () => {
  // Uses a fresh login so the shared session used by other tests is not ended.
  test.use({ storageState: NO_STATE });

  test('AC-TC-19 · EO logout asks for confirmation, then ends the session', meta('Full'), async ({ page }) => {
    await loginAsEO(page);
    await page.getByRole('button', { name: 'Logout' }).first().click();
    await test.step('Confirmation offers No / Yes', async () => {
      await expect(page.getByRole('button', { name: 'No', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'No', exact: true }).click();
      await expect(page).toHaveURL(/\/eo/);
    });
    await test.step('Yes logs out', async () => {
      await page.getByRole('button', { name: 'Logout' }).first().click();
      await page.getByRole('button', { name: 'Yes', exact: true }).click();
      await expect(page).toHaveURL(/\/auth\/login/);
    });
    await test.step('Protected page no longer opens (back-button / bookmark)', async () => {
      await open(page, '/eo/billing');
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  });

  test('AC-TC-20 · Vendor logout ends the session', meta('Full'), async ({ page }) => {
    await loginAsVendor(page);
    await page.getByRole('button', { name: 'Logout' }).first().click();
    await page.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await open(page, '/vendor/rfqs');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
