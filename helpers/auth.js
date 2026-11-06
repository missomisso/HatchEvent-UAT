// helpers/auth.js — Login helpers for EO, Vendor, and Admin

/**
 * Fill the email input using multiple fallback selectors.
 */
async function fillEmail(page, email) {
  const field = page.locator('input[type="email"]').first()
    .or(page.getByLabel(/email/i).first())
    .or(page.getByPlaceholder(/email/i).first())
    .or(page.locator('input[name*="email" i]').first());
  await field.waitFor({ state: 'visible', timeout: 15_000 });
  await field.fill(email);
}

/**
 * Fill the password input using multiple fallback selectors.
 */
async function fillPassword(page, password) {
  const field = page.locator('input[type="password"]').first()
    .or(page.getByLabel(/password/i).first())
    .or(page.getByPlaceholder(/password/i).first())
    .or(page.locator('input[name*="password" i]').first());
  await field.waitFor({ state: 'visible', timeout: 15_000 });
  await field.fill(password);
}

/**
 * Click the submit/login button using multiple fallback selectors.
 */
async function clickLogin(page) {
  const btn = page.getByRole('button', { name: /log\s*in|sign\s*in|submit/i }).first()
    .or(page.locator('button[type="submit"]').first());
  await btn.click();
}

async function loginAsEO(page, email, password) {
  email    = email    || process.env.EO_EMAIL;
  password = password || process.env.EO_PASSWORD;
  if (!email || !password) throw new Error('EO credentials not set. Fill in .env (EO_EMAIL / EO_PASSWORD).');

  await page.goto('/auth/login');
  await fillEmail(page, email);
  await fillPassword(page, password);
  await clickLogin(page);
  // Wait for navigation away from the login page
  await page.waitForURL(url => !/\/auth\/login/i.test(url.toString()), { timeout: 20_000 });
}

async function loginAsVendor(page, email, password) {
  email    = email    || process.env.VENDOR_EMAIL;
  password = password || process.env.VENDOR_PASSWORD;
  if (!email || !password) throw new Error('Vendor credentials not set. Fill in .env (VENDOR_EMAIL / VENDOR_PASSWORD).');

  await page.goto('/auth/login');
  await fillEmail(page, email);
  await fillPassword(page, password);
  await clickLogin(page);
  await page.waitForURL(url => !/\/auth\/login/i.test(url.toString()), { timeout: 20_000 });
}

async function loginAsAdmin(page, email, password) {
  const adminUrl = process.env.ADMIN_URL || 'https://portal.hatchevent.com/admin';
  email    = email    || process.env.ADMIN_EMAIL;
  password = password || process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Admin credentials not set. Fill in .env (ADMIN_EMAIL / ADMIN_PASSWORD).');

  await page.goto(adminUrl + '/auth/login');
  await fillEmail(page, email);
  await fillPassword(page, password);
  await clickLogin(page);
  await page.waitForURL(url => !/\/auth\/login/i.test(url.toString()), { timeout: 20_000 });
}

async function logout(page) {
  const logoutBtn = page.getByRole('button', { name: /log\s*out|sign\s*out/i })
                    .or(page.getByRole('link',   { name: /log\s*out|sign\s*out/i }));
  if (await logoutBtn.count() > 0) {
    await logoutBtn.first().click();
  } else {
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    });
    await page.goto('/auth/login');
  }
}

module.exports = { loginAsEO, loginAsVendor, loginAsAdmin, logout };
