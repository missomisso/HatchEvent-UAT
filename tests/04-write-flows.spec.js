// tests/04-write-flows.spec.js — flows that create/change data, ALWAYS named "UAT-AUTO" and cleaned up (WR-TC-xx)
//
// Safety: each block declares exactly which writes it may make (allowWrites). Everything
// else — payments, RFQs, quotations, invitations, campaigns — is blocked by the write-guard.
//
// WR-TC-01/02 run every night (self-cleaning, no side effects for real users).
// WR-TC-03/04 re-save the RSVP design of the first ongoing event; they only run when
// WRITE_FLOWS=rsvp (or all) so a nightly run never overwrites a design someone is testing by hand.
const { test, expect, meta } = require('../helpers/fixtures');
const { open, heading, expectToast, eventSection, wizard, rsvp, bodyText, EO_STATE } = require('../helpers/portal');

const DRAFT = 'UAT-AUTO Wizard Draft';
const RSVP_ON = /^(rsvp|all)$/i.test(process.env.WRITE_FLOWS || '');

test.describe('WR · Address-book contact lifecycle', () => {
  test.use({ storageState: EO_STATE, allowWrites: ['contacts'] });

  async function cleanup(page) {
    await open(page, '/eo/address-book');
    for (let i = 0; i < 5; i++) {
      const row = page.getByRole('row').filter({ hasText: /uat-auto\+/ }).first();
      if (!(await row.count())) break;
      await row.getByRole('button', { name: 'Open actions' }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
      await expectToast(page, /deleted/i);
    }
  }

  test('WR-TC-01 · Create → find → edit → delete a UAT-AUTO contact', meta('Full'), async ({ page }) => {
    await cleanup(page);
    const email = `uat-auto+${Date.now()}@example.com`;
    const total = () => page.getByText(/Total contacts: \d+/).innerText();
    const before = await total();

    await test.step('Create', async () => {
      await page.getByRole('button', { name: 'Create Contact' }).click();
      await page.getByPlaceholder('First name').fill('UAT-AUTO');
      await page.getByPlaceholder('Last name').fill('Contact');
      await page.getByPlaceholder('email@example.com').fill(email);
      await page.getByPlaceholder('eg. 88888888').fill('88880000');
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await expectToast(page, 'Contact created successfully.');
      await expect(page.getByRole('row').filter({ hasText: email })).toBeVisible();
      await expect(page.getByRole('row').filter({ hasText: email })).toContainText('+6588880000');
    });
    await test.step('Search finds it', async () => {
      await page.getByPlaceholder('Name, email, phone, event').fill(email);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('row').filter({ hasText: email })).toBeVisible();
    });
    await test.step('Edit group tag', async () => {
      const row = page.getByRole('row').filter({ hasText: email });
      await row.getByRole('button', { name: 'Open actions' }).click();
      await page.getByRole('button', { name: 'Edit contact' }).click();
      await page.getByPlaceholder('VIP / Family').fill('UAT');
      await page.getByRole('button', { name: /^(save|update)/i }).last().click();
      await expect(page.getByRole('row').filter({ hasText: email })).toContainText('UAT');
    });
    await test.step('Delete', async () => {
      const row = page.getByRole('row').filter({ hasText: email });
      await row.getByRole('button', { name: 'Open actions' }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
      await expectToast(page, 'Contact permanently deleted successfully.');
      await open(page, '/eo/address-book');
      await expect(page.getByRole('row').filter({ hasText: email })).toHaveCount(0);
      expect(await total()).toBe(before);
    });
  });
});

test.describe('WR · The single reusable UAT-AUTO draft', () => {
  test.use({ storageState: EO_STATE, allowWrites: ['eventTitle', 'draft'] });

  test('WR-TC-02 · Draft exists (Save for later, created once) and can be renamed and renamed back', meta('Full', null, 'Creates a draft only if none exists — drafts cannot be deleted (finding)'), async ({ page }) => {
    await open(page, '/eo/enquiries');
    await page.getByLabel('Filter section').selectOption('draft');
    if (!(await page.getByRole('heading', { name: DRAFT, exact: true }).count())) {
      await test.step('Create via Wizard → Save for later', async () => {
        await wizard.walkToFinal(page);
        await wizard.saveForLater(page).click();
        await expectToast(page, 'Draft saved successfully.');
        await open(page, '/eo/enquiries');
        await page.getByLabel('Filter section').selectOption('draft');
        await eventSection(page, (await page.locator('h3').nth(2).innerText()).trim()).getByRole('button', { name: 'Edit event name' }).click();
        await page.getByRole('textbox', { name: /event name/i }).fill(DRAFT);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expectToast(page, 'Event name updated successfully.');
      });
    }
    const renamed = `${DRAFT} (renamed ${new Date().toISOString().slice(0, 10)})`;
    await test.step('Rename', async () => {
      await eventSection(page, DRAFT).getByRole('button', { name: 'Edit event name' }).click();
      await expect(page.getByRole('textbox', { name: /event name/i })).toHaveValue(DRAFT);
      await page.getByRole('textbox', { name: /event name/i }).fill(renamed);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expectToast(page, 'Event name updated successfully.');
      await expect(heading(page, renamed)).toBeVisible();
    });
    await test.step('Name change is reflected after reload', async () => {
      await page.reload(); await page.getByLabel('Filter section').selectOption('draft');
      await expect(heading(page, renamed)).toBeVisible();
    });
    await test.step('Rename back', async () => {
      await eventSection(page, renamed).getByRole('button', { name: 'Edit event name' }).click();
      await page.getByRole('textbox', { name: /event name/i }).fill(DRAFT);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expectToast(page, 'Event name updated successfully.');
      await expect(heading(page, DRAFT)).toBeVisible();
    });
  });

  test('WR-TC-02b · Rename cancelled with Cancel keeps the old name', meta('Full'), async ({ page }) => {
    await open(page, '/eo/enquiries');
    await page.getByLabel('Filter section').selectOption('draft');
    test.skip(!(await page.getByRole('heading', { name: DRAFT, exact: true }).count()), 'No UAT-AUTO draft');
    await eventSection(page, DRAFT).getByRole('button', { name: 'Edit event name' }).click();
    await page.getByRole('textbox', { name: /event name/i }).fill('SHOULD NOT SAVE');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(heading(page, DRAFT)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SHOULD NOT SAVE' })).toHaveCount(0);
  });
});

test.describe('WR · RSVP design save (opt-in)', () => {
  test.use({ storageState: EO_STATE, allowWrites: ['rsvpDesign'] });
  test.skip(!RSVP_ON, 'Set WRITE_FLOWS=rsvp to run (re-saves the RSVP design of the first ongoing event)');

  async function toInviteStage(page) {
    await rsvp.toLocation(page);
    if (!(await page.locator('textarea[name=eventAddress]').inputValue())) await page.locator('textarea[name=eventAddress]').fill('UAT-AUTO Test Venue');
    await rsvp.next(page, 'additional-guests');
    await rsvp.next(page, 'event-url');
    await rsvp.next(page, 'invite-background');
    await page.getByRole('button', { name: 'Birthday Party RSVP' }).click();
    await rsvp.next(page, 'rsvp/review');
    await page.getByRole('button', { name: 'Preview RSVP' }).click();
    await rsvp.step(page, 'rsvp/preview');
  }

  test('WR-TC-03 · RSVP design saves and moves to the Invite (add contacts) stage', meta('Full'), async ({ page }) => {
    await toInviteStage(page);
    await expect(page.getByRole('button', { name: 'RSVP Now' })).toBeVisible();
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await rsvp.step(page, 'rsvp/upload-contacts');
    for (const h of ['Add a single contact', 'Import contacts', 'Add via the app']) await expect(heading(page, h)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Legal Disclaimer' })).toBeVisible();
  });

  test('WR-TC-04 · Invite stage wording matches the sidebar ("Event guest list") (BUG-55)', meta('Full', 'BUG-55'), async ({ page }) => {
    test.fail(true, 'BUG-55 open — button says "Guest List Management dashboard"');
    await toInviteStage(page);
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await rsvp.step(page, 'rsvp/upload-contacts');
    await expect(page.getByRole('button', { name: /Event guest list/i })).toBeVisible({ timeout: 5_000 });
  });
});
