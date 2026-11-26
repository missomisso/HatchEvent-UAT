// helpers/fixtures.js — the `test` every spec imports.
//
// Adds two automatic safety/quality layers to every test:
//
// 1. WRITE GUARD — every non-GET call to the portal API is BLOCKED unless it is on
//    the allow-list below (or a test opts in with test.use({ allowWrites: [...] })).
//    Stripe checkout pages are always blocked. This is what guarantees the suite can
//    never pay, send an RFQ, accept/acknowledge a quotation, start an RSVP campaign or
//    send an invitation — even if the UI changes underneath a selector.
//
// 2. HEALTH MONITOR — records console errors, uncaught page errors, API 5xx and
//    blocked writes, and attaches them to the report as annotations.
const base = require('@playwright/test');

// Writes every test may make (login/logout, read-only searches).
const ALWAYS_ALLOWED = [
  /\/api\/proxy\/auth\//,                     // login / logout / token refresh
  /\/api\/proxy\/vendor-listings\/search/,    // wizard vendor search (POST but read-only)
];

// Opt-in write scopes used by the UAT-AUTO write-flow tests.
const WRITE_SCOPES = {
  contacts:   [/\/api\/proxy\/rsvp\/address-book/],                 // create / delete UAT-AUTO contact
  eventTitle: [/\/api\/proxy\/events\/\d+\/title$/],                // rename UAT-AUTO draft
  draft:      [/\/api\/proxy\/events$/],                            // Save for later (status: draft only, checked below)
  rsvpDesign: [/\/api\/proxy\/rsvp\/projects$/],                    // save RSVP design (no sending)
};

const NEVER = [/stripe\.com/, /checkout/i, /\/payment/i, /quotation/i, /rfq/i, /campaign/i, /invite/i, /acknowledge/i, /send/i];

const test = base.test.extend({
  allowWrites: [[], { option: true }],   // e.g. test.use({ allowWrites: ['contacts'] })

  health: [async ({ page, allowWrites }, use, testInfo) => {
    const h = { consoleErrors: [], pageErrors: [], serverErrors: [], blocked: [], writes: [] };
    const allowed = [...ALWAYS_ALLOWED, ...allowWrites.flatMap(s => WRITE_SCOPES[s] || [])];

    page.on('console', m => { if (m.type() === 'error') h.consoleErrors.push(m.text().slice(0, 250)); });
    page.on('pageerror', e => h.pageErrors.push(String(e.message).slice(0, 250)));
    page.on('response', r => { if (r.status() >= 500) h.serverErrors.push(`${r.status()} ${r.request().method()} ${r.url().split('?')[0]}`); });

    await page.context().route(/checkout\.stripe\.com|js\.stripe\.com\/v3\/checkout/, route => {
      h.blocked.push('STRIPE ' + route.request().url()); return route.abort();
    });
    await page.context().route(/\/api\/proxy\/|api\.staging\.hatchevent\.com\/api/, route => {
      const req = route.request(); const url = req.url(); const method = req.method();
      if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return route.continue();
      const isAllowed = allowed.some(re => re.test(url));
      const isNever = NEVER.some(re => re.test(url.replace(/^https?:\/\/[^/]+/, ''))) && !ALWAYS_ALLOWED.some(re => re.test(url));
      let ok = isAllowed && !isNever;
      // Draft scope: only allow event creation if the body says status=draft
      if (ok && /\/api\/proxy\/events$/.test(url.split('?')[0])) ok = /"status"\s*:\s*"draft"/.test(req.postData() || '');
      if (ok) { h.writes.push(`${method} ${url.split('?')[0]}`); return route.continue(); }
      h.blocked.push(`${method} ${url.split('?')[0]}`);
      return route.fulfill({ status: 418, contentType: 'application/json', body: JSON.stringify({ message: 'Blocked by UAT write-guard' }) });
    });

    await use(h);

    const note = (type, arr) => { if (arr.length) testInfo.annotations.push({ type, description: [...new Set(arr)].slice(0, 8).join(' | ') }); };
    note('api-5xx', h.serverErrors);
    note('page-error', h.pageErrors);
    note('console-error', h.consoleErrors);
    note('write-guard-blocked', h.blocked);
    note('writes-made', h.writes);
  }, { auto: true }],
});

module.exports = { test, expect: base.expect, WRITE_SCOPES };

/**
 * Test metadata helper → used by the catalogue + tracker.
 *   meta('Full')                     – fully automated, asserts the real outcome
 *   meta('Partial', 'BUG-41')        – automated up to a safety gate (payment/send) or partly verifiable
 *   meta('Manual', null, 'why')      – needs a human (email OTP, Google OAuth, mobile app, real payment)
 */
function meta(depth, bugs, note) {
  const annotation = [{ type: 'depth', description: depth }];
  if (bugs) annotation.push({ type: 'bug', description: bugs });
  if (note) annotation.push({ type: 'note', description: note });
  return { annotation };
}
module.exports.meta = meta;
