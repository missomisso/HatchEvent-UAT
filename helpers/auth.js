// helpers/auth.js — Login helpers for EO, Vendor, and Admin
// Selectors verified via Playwright codegen against portal.staging.hatchevent.com

async function loginAsEO(page, email, password) {
  email    = email    || process.env.EO_EMAIL;
  password = password || process.env.EO_PASSWORD;
  if (!email || !password) throw new Error('EO credentials not set (EO_EMAIL / EO_PASSWORD).');

  await page.goto('/auth/login');
  // EO is the default view — no role picker click needed.
  // But click Event Organiser button if it's there, defensively.
  const eoBtn = page.getByRole('button', { name: /event organiser|event organizer/i });
  if (await eoBtn.count() > 0 && await eoBtn.isVisible().catch(() => false)) {
    await eoBtn.click();
  }
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(url => !/\/auth\/login/i.test(url.toString()), { timeout: 20_000 });
}

async function loginAsVendor(page, email, password) {
  email    = email    || process.env.VENDOR_EMAIL;
  password = password || process.env.VENDOR_PASSWORD;
  if (!email || !password) throw new Error('Vendor credentials not set (VENDOR_EMAIL / VENDOR_PASSWORD).');

  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Vendor' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(url => !/\/auth\/login/i.test(url.toString()), { timeout: 20_000 });
}

async function loginAsAdmin(page, email, password) {
  const adminUrl = process.env.ADMIN_URL || 'https://portal.hatchevent.com/admin';
  email    = email    || process.env.ADMIN_EMAIL;
  password = password || process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Admin credentials not set (ADMIN_EMAIL / ADMIN_PASSWORD).');

  await page.goto(adminUrl + '/auth/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
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
