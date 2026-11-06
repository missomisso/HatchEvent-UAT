// helpers/auth.js — Login helpers for EO, Vendor, and Admin

/**
 * Log in as an Event Organizer.
 * @param {import('@playwright/test').Page} page
 * @param {string} email    defaults to EO_EMAIL env var
 * @param {string} password defaults to EO_PASSWORD env var
 */
async function loginAsEO(page, email, password) {
  email    = email    || process.env.EO_EMAIL;
  password = password || process.env.EO_PASSWORD;
  if (!email || !password) throw new Error('EO credentials not set. Fill in .env (EO_EMAIL / EO_PASSWORD).');

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await page.waitForURL(/dashboard|home/i, { timeout: 15_000 });
}

/**
 * Log in as a Vendor.
 * @param {import('@playwright/test').Page} page
 */
async function loginAsVendor(page, email, password) {
  email    = email    || process.env.VENDOR_EMAIL;
  password = password || process.env.VENDOR_PASSWORD;
  if (!email || !password) throw new Error('Vendor credentials not set. Fill in .env (VENDOR_EMAIL / VENDOR_PASSWORD).');

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await page.waitForURL(/dashboard|home/i, { timeout: 15_000 });
}

/**
 * Log in to the Admin portal.
 * @param {import('@playwright/test').Page} page
 */
async function loginAsAdmin(page, email, password) {
  const adminUrl = process.env.ADMIN_URL || 'https://portal.hatchevent.com/admin';
  email    = email    || process.env.ADMIN_EMAIL;
  password = password || process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Admin credentials not set. Fill in .env (ADMIN_EMAIL / ADMIN_PASSWORD).');

  await page.goto(adminUrl + '/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await page.waitForURL(/admin/i, { timeout: 15_000 });
}

/**
 * Log out from the current session.
 * @param {import('@playwright/test').Page} page
 */
async function logout(page) {
  // Try common logout patterns — adjust selector if your nav differs
  const logoutBtn = page.getByRole('button', { name: /log out|sign out/i })
                    .or(page.getByRole('link', { name: /log out|sign out/i }));
  if (await logoutBtn.count() > 0) {
    await logoutBtn.first().click();
  } else {
    // Fallback: clear session via storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/login');
  }
}

module.exports = { loginAsEO, loginAsVendor, loginAsAdmin, logout };
