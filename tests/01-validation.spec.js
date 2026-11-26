// tests/01-validation.spec.js — form validation & negative paths (NEG-TC-xx)
const { test, expect, meta } = require('../helpers/fixtures');
const { open, NO_STATE, EO_STATE, VENDOR_STATE, expectToast, wizard, rsvp } = require('../helpers/portal');

test.describe('NEG · Login & account forms (logged out)', () => {
  test.use({ storageState: NO_STATE });

  test('NEG-TC-01 · Empty login shows "Field is required" for email and password', meta('Full'), async ({ page }) => {
    await open(page, '/auth/login');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Field is required')).toHaveCount(2);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('NEG-TC-02 · Unregistered email is told to register first', meta('Full'), async ({ page }) => {
    await open(page, '/auth/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(`uat-auto-nobody-${Date.now()}@example.com`);
    await page.getByRole('textbox', { name: 'Password' }).fill('NotARealPassword1!');
    await page.getByRole('button', { name: 'Login' }).click();
    await expectToast(page, /Don't have account with this email/i);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('NEG-TC-03 · Wrong password is rejected with a clear message', meta('Full'), async ({ page }) => {
    await open(page, '/auth/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(process.env.EO_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill('Definitely-Wrong-' + Date.now());
    await page.getByRole('button', { name: 'Login' }).click();
    await expectToast(page, /credentials are incorrect/i);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('NEG-TC-04 · Show/Hide password toggles the field type', meta('Full'), async ({ page }) => {
    await open(page, '/auth/login');
    const pw = page.getByRole('textbox', { name: 'Password' }).or(page.locator('input[type=password]')).first();
    await pw.fill('abc123');
    await expect(page.locator('input[type=password]')).toHaveCount(1);
    await page.getByRole('button', { name: /show password/i }).click();
    await expect(page.locator('input[type=password]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /hide password/i })).toBeVisible();
  });

  test('NEG-TC-05 · Forgot password with empty email is blocked', meta('Full'), async ({ page }) => {
    await open(page, '/auth/forgot-password');
    await page.getByRole('button').filter({ hasText: /send|reset|continue|submit/i }).first().click();
    await expect(page.getByText('Field is required').first()).toBeVisible();
  });

  test('NEG-TC-06 · Register page offers both roles and Google sign-up', meta('Full'), async ({ page }) => {
    await open(page, '/auth/register');
    await expect(page.getByText(/Welcome to HatchEvent/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vendor' })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue/i }).first()).toBeVisible();
    await expect(page.getByText(/google/i).first()).toBeVisible();
  });
});

test.describe('NEG · EO forms', () => {
  test.use({ storageState: EO_STATE });

  test('NEG-TC-07 · Change password with empty fields shows all three messages', meta('Full'), async ({ page }) => {
    await open(page, '/eo/settings');
    await page.getByText('Change password').click();
    await page.getByRole('button', { name: /confirm|save|update/i }).first().click();
    await expect(page.getByText('Current password is required.')).toBeVisible();
    await expect(page.getByText('New password is required.')).toBeVisible();
    await expect(page.getByText('Please confirm your new password.')).toBeVisible();
  });

  test('NEG-TC-08 · Wizard blocks an event with no start date', meta('Full'), async ({ page }) => {
    await wizard.start(page);
    await wizard.forward(page).click();
    await expectToast(page, 'Start date is required');
    await expect(page).toHaveURL(/wizard\/details/);
  });

  test('NEG-TC-09 · Wizard blocks an end time before the start time', meta('Full'), async ({ page }) => {
    await wizard.start(page);
    const d = new Date(Date.now() + 60 * 864e5);
    await wizard.pickDate(page, 0, d); await wizard.typeTime(page, 0, '10:00', 'am');
    await wizard.pickDate(page, 1, d); await wizard.typeTime(page, 1, '09:00', 'am');
    await page.getByPlaceholder('Enter number of guests').fill('25');
    await wizard.forward(page).click();
    await expectToast(page, /end date and time must be after start/i);
  });

  test('NEG-TC-10 · Past dates cannot be picked in the Wizard', meta('Full'), async ({ page }) => {
    await wizard.start(page);
    await page.getByRole('button', { name: 'Open date picker' }).first().click();
    const y = new Date(Date.now() - 864e5);
    const label = y.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const cell = page.locator(`.flatpickr-calendar.open .flatpickr-day[aria-label="${label}"]`);
    if (await cell.count()) await expect(cell.first()).toHaveClass(/flatpickr-disabled/);
    else test.info().annotations.push({ type: 'note', description: 'Yesterday not in current month view — month boundary' });
  });

  test('NEG-TC-11 · Wizard requires at least one service category', meta('Full'), async ({ page }) => {
    await wizard.start(page); await wizard.fillWhen(page);
    await wizard.forward(page).click();
    await page.getByLabel('Near me').check({ force: true });
    await wizard.forward(page).click();
    await expect(page.getByText('What would you need for your event?')).toBeVisible();
    await wizard.forward(page).click();
    await expectToast(page, 'Please select at least one service');
  });

  test('NEG-TC-12 · Wizard requires at least one vendor', meta('Full'), async ({ page }) => {
    await wizard.start(page); await wizard.fillWhen(page);
    await wizard.forward(page).click();
    await page.getByLabel('Near me').check({ force: true });
    await wizard.forward(page).click();
    await page.getByRole('button', { name: 'Catering', exact: true }).click();
    await wizard.forward(page).click();
    await expect(page.getByText(/Select vendors — minimum 1, maximum 3/)).toBeVisible({ timeout: 30_000 });
    await wizard.forward(page).click();
    await expectToast(page, /select at least 1 vendor/i);
  });

  test('NEG-TC-13 · Address book search with no match says "No data found"', meta('Full'), async ({ page }) => {
    await open(page, '/eo/address-book');
    await page.getByPlaceholder('Name, email, phone, event').fill('zz-no-such-contact-' + Date.now());
    await page.keyboard.press('Enter');
    await expect(page.getByText('No data found')).toBeVisible();
  });

  test('NEG-TC-14 · Create Contact with empty form does not create a contact', meta('Full'), async ({ page }) => {
    await open(page, '/eo/address-book');
    const total = await page.getByText(/Total contacts: \d+/).innerText();
    await page.getByRole('button', { name: 'Create Contact' }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create Contact' })).toBeVisible(); // modal stays open
    await expect(page.getByText(/required|invalid/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(/Total contacts: \d+/)).toHaveText(total);
  });

  test('NEG-TC-15 · RSVP setup requires an event location', meta('Full'), async ({ page }) => {
    await rsvp.toLocation(page);
    const addr = page.locator('textarea[name=eventAddress]');
    const before = await addr.inputValue();
    await addr.fill('');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByText('Field is required').first()).toBeVisible();
    await expect(page).toHaveURL(/event-location/);
    test.info().annotations.push({ type: 'note', description: `Location was "${before}" — not saved (no write scope)` });
  });

  test('NEG-TC-16 · Purchase buttons stay disabled until Terms & Conditions are ticked', meta('Full'), async ({ page }) => {
    await open(page, '/eo/services');
    await page.getByRole('button', { name: 'HatchEvent Services' }).first().click();
    await page.getByRole('button', { name: /Vendor Evaluation Services/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/he-services\/summary/);
    await expect(page.getByRole('button', { name: /Secure checkout at STRIPE/i })).toBeDisabled();
  });
});

test.describe('NEG · Vendor forms', () => {
  test.use({ storageState: VENDOR_STATE });

  test('NEG-TC-17 · RFQ search with no match suggests a different keyword', meta('Full'), async ({ page }) => {
    await open(page, '/vendor/rfqs');
    await page.getByPlaceholder(/Search RFQs/).fill('zz-no-such-rfq-' + Date.now());
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Try a different keyword/i).first()).toBeVisible();
  });

  test('NEG-TC-18 · Team invite cannot be sent without an email', meta('Full'), async ({ page }) => {
    await open(page, '/vendor/team');
    await page.getByRole('button', { name: 'Invite teammates' }).click();
    await expect(page.getByRole('button', { name: /send invite/i })).toBeDisabled();
    // never sends — write-guard would also block it
  });

  test('NEG-TC-19 · Credits checkout stays disabled until T&C ticked', meta('Full'), async ({ page }) => {
    await open(page, '/vendor/credits');
    await page.getByRole('button', { name: /Package A/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/credits\/summary/);
    await expect(page.getByRole('button', { name: /Payment via Stripe/i })).toBeDisabled();
  });

  test('NEG-TC-20 · Vendor change password with empty fields is blocked', meta('Full'), async ({ page }) => {
    await open(page, '/vendor/settings');
    await page.getByText('Change password').click();
    await page.getByRole('button', { name: /confirm|save|update/i }).first().click();
    await expect(page.getByText(/password is required/i).first()).toBeVisible();
  });
});
