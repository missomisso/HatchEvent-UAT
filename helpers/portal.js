// helpers/portal.js — page knowledge for portal.staging.hatchevent.com (verified 26 Nov 2026)
const { expect } = require('@playwright/test');

const EO_STATE = '.auth/eo.json';
const VENDOR_STATE = '.auth/vendor.json';
const NO_STATE = { cookies: [], origins: [] };

// Sidebar label → route → heading the page must show
const EO_PAGES = [
  { label: 'Dashboard',        path: '/eo',              heading: /^Hi /,               },
  { label: 'Event enquiries',  path: '/eo/enquiries',    heading: 'Event Enquiries'     },
  { label: 'Event services',   path: '/eo/services',     heading: 'Event Services'      },
  { label: 'Event guest list', path: '/eo/guest-list',   heading: 'Guest List'          },
  { label: 'Address book',     path: '/eo/address-book', heading: 'Address Book'        },
  { label: 'RSVPs',            path: '/eo/rsvp',         heading: 'RSVPs'               },
  { label: 'Billing',          path: '/eo/billing',      heading: 'Invoices'            },
  { label: 'Profile',          path: '/eo/profile',      heading: 'Profile'             },
  { label: 'Settings',         path: '/eo/settings',     heading: 'Settings'            },
];
const VENDOR_PAGES = [
  { label: 'Dashboard',          path: '/vendor/dashboard',       heading: /^Hi /                   },
  { label: 'Listing',            path: '/vendor/listing',         heading: 'Listing'                },
  { label: 'RFQs',               path: '/vendor/rfqs',            heading: 'Request for quotations' },
  { label: 'Membership',         path: '/vendor/member-ship',     heading: 'Membership'             },
  { label: 'Credits and points', path: '/vendor/credit-points',   heading: 'Credits and points'     },
  { label: 'Sponsored links',    path: '/vendor/sponsored-links', heading: 'Sponsored Links'        },
  { label: 'EDMs',               path: '/vendor/edms',            heading: 'EDMs'                   },
  { label: 'Invoices',           path: '/vendor/invoice',         heading: 'Invoices'               },
  { label: 'Profile',            path: '/vendor/profile',         heading: 'Profile'                },
  { label: 'Team',               path: '/vendor/team',            heading: 'Team members'           },
  { label: 'Settings',           path: '/vendor/settings',        heading: 'Settings'               },
];
// Purchase / flow pages that live outside the sidebar
const FLOW_PAGES = {
  eo: ['/eo/favourite-vendor', '/events/create/ai', '/events/create/wizard', '/eo/settings/change-password'],
  vendor: ['/vendor/membership', '/vendor/credits', '/vendor/edm', '/vendor/listing/create'],
};

/** Navigate and wait until the SPA has settled. Returns load time in ms. */
async function open(page, path) {
  const t0 = Date.now();
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  return Date.now() - t0;
}

function heading(page, h) {
  return typeof h === 'string'
    ? page.getByRole('heading', { name: h, exact: true }).first()
    : page.getByRole('heading', { name: h }).first();
}

/** Toast messages render in .toast-item */
function toast(page, text) {
  return page.locator('.toast-item').filter({ hasText: text }).first();
}
async function expectToast(page, text) {
  await expect(toast(page, text)).toBeVisible({ timeout: 12_000 });
}

/** Event section on Enquiries/RSVP/Guest list/Services pages, located by its H3 title */
function eventSection(page, title) {
  return page.getByRole('heading', { name: title, exact: true }).first()
    .locator("xpath=ancestor::*[./*[contains(@class,'card-body')]][1]");
}
/** Event cards on Enquiries can be collapsed (past events are). The clickable header is a <div>
 *  (.card-header--clickable) — not keyboard-focusable, noted as an accessibility finding. */
async function expandBlock(page, n = 0) {
  const card = page.locator('.card-header--clickable').nth(n).locator('xpath=..');
  const body = card.locator('> .card-body');
  if (!(await body.isVisible())) await page.locator('.card-header--clickable').nth(n).click();
  await expect(body).toBeVisible();
  return card;
}

// ── Event-creation Wizard ────────────────────────────────────────────────
const wizard = {
  forward: page => page.getByRole('button', { name: 'Save for later' }).locator('xpath=following-sibling::button[1]'),
  saveForLater: page => page.getByRole('button', { name: 'Save for later' }),
  async start(page, type = 'Birthday') {
    await open(page, '/events/create/wizard');
    const box = page.getByRole('textbox').first();
    await box.fill(type); await box.press('Enter');
    await page.waitForURL(/wizard\/details/, { timeout: 20_000 });
    await expect(page.getByText('When is your event?')).toBeVisible();
  },
  async pickDate(page, pickerIndex, date) {
    await page.getByRole('button', { name: 'Open date picker' }).nth(pickerIndex).click();
    const label = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const cal = page.locator('.flatpickr-calendar.open');
    for (let i = 0; i < 18; i++) {
      const cell = cal.locator(`.flatpickr-day[aria-label="${label}"]:not(.prevMonthDay):not(.nextMonthDay)`);
      if (await cell.count()) { await cell.first().click(); return; }
      await cal.locator('.flatpickr-next-month').click();
    }
    throw new Error('Date not found in picker: ' + label);
  },
  async typeTime(page, idx, hhmm, ampm) {
    const t = page.getByPlaceholder('HH:MM').nth(idx);
    await t.click(); await t.pressSequentially(hhmm.replace(':', '')); await t.blur();
    await page.getByLabel('Select AM or PM').nth(idx).selectOption(ampm);
  },
  /** Fills the "When is your event?" step with a valid future slot */
  async fillWhen(page, { daysAhead = 60, guests = 25 } = {}) {
    const d = new Date(Date.now() + daysAhead * 864e5);
    await this.pickDate(page, 0, d);
    await this.typeTime(page, 0, '10:00', 'am');
    await this.pickDate(page, 1, d);
    await this.typeTime(page, 1, '04:00', 'pm');
    await page.getByPlaceholder('Enter number of guests').fill(String(guests));
    return d;
  },
  /** Walks to the final screen ("Save for later" + "Request for quotation now"). Never clicks RFQ. */
  async walkToFinal(page, category = 'Catering') {
    await this.start(page);
    await this.fillWhen(page);
    await this.forward(page).click();
    await expect(page.getByText('Do you have a preferred location?')).toBeVisible();
    await page.getByLabel('Near me').check({ force: true });
    await this.forward(page).click();
    await expect(page.getByText('What would you need for your event?')).toBeVisible();
    await page.getByRole('button', { name: category, exact: true }).click();
    await this.forward(page).click();
    await expect(page.getByRole('heading', { name: 'Curated vendors perfect for your occasion' })).toBeVisible({ timeout: 30_000 });
    await page.locator('.card').first().click();
    await this.forward(page).click();
    await expect(page.getByRole('button', { name: 'Request for quotation now' })).toBeVisible();
  },
};

// ── RSVP editor (Create — Invite — Selection — Summary — Complete) ──────────
const rsvp = {
  continue: page => page.getByRole('button', { name: 'Continue', exact: true }),
  async step(page, urlPart) { await expect(page).toHaveURL(new RegExp(urlPart), { timeout: 45_000 }); },
  /** Opens "Edit RSVP" for the first ongoing event. The loading screen can take ~10 s. */
  async openEditor(page) {
    await open(page, '/eo/rsvp');
    await page.getByRole('button', { name: 'Edit RSVP' }).first().click();
    await this.step(page, 'rsvp/event-name');
    await expect(page.getByRole('heading', { name: /review your RSVP details/i })).toBeVisible();
    await expect(page.locator('input[name=eventName]')).not.toHaveValue('', { timeout: 20_000 });
  },
  async toLocation(page) {
    await this.openEditor(page);
    await this.next(page, 'rsvp/event-timing');
    await expect(page.getByPlaceholder('HH:MM').first()).not.toHaveValue('', { timeout: 20_000 });
    await this.next(page, 'rsvp/event-location');
  },
  /** Click Continue and wait for the next step; retries once if the SPA swallowed the first click */
  async next(page, urlPart) {
    await this.continue(page).click();
    try { await expect(page).toHaveURL(new RegExp(urlPart), { timeout: 15_000 }); }
    catch { await this.continue(page).click(); await this.step(page, urlPart); }
  },
};

/** T&C checkbox is an sr-only input inside a styled label; tick it without following the T&C link */
async function tickTerms(page) {
  const cb = page.locator('input#agree, input[type=checkbox]').first();
  await cb.check({ force: true });
  await expect(cb).toBeChecked();
}

/** Returns the page's visible text, whitespace-collapsed */
async function bodyText(page) {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ');
}

/** Common page-quality checks used by the health spec */
async function qualityScan(page) {
  return page.evaluate(() => {
    const text = document.body.innerText;
    const imgs = [...document.images].filter(i => i.offsetParent !== null);
    return {
      lorem: /lorem ipsum/i.test(text),
      badTokens: (text.match(/\b(undefined|NaN|\[object Object\])\b/g) || []).slice(0, 5),
      imgsNoAlt: imgs.filter(i => !i.hasAttribute('alt')).map(i => i.src.split('/').pop()).slice(0, 5),
      imgsBroken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.split('/').pop()).slice(0, 5),
      unnamedButtons: [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null && !b.innerText.trim() && !b.getAttribute('aria-label') && !b.title).length,
      hScroll: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  });
}

module.exports = {
  EO_STATE, VENDOR_STATE, NO_STATE, EO_PAGES, VENDOR_PAGES, FLOW_PAGES,
  open, heading, toast, expectToast, eventSection, expandBlock, wizard, rsvp, tickTerms, bodyText, qualityScan,
};
