# HatchEvent — Playwright UAT Suite

Automated UAT runner for the HatchEvent portal.  
Covers **91 test cases** across 4 journeys and writes Pass/Fail results back into the Excel tracker automatically.

---

## Quick Start

```bash
# 1. Install dependencies (once)
npm install

# 2. Set up credentials (once — see Credential Setup below)
cp .env.example .env
# edit .env with your staging credentials

# 3. Run all tests + update tracker
./run-uat.sh
```

---

## Credential Setup

Tests log in to `portal.staging.hatchevent.com` using two portal accounts.  
You need **one EO account** and **one Vendor account** on the staging environment.

### Step 1 — Copy the template

```bash
cp .env.example .env
```

### Step 2 — Open `.env` and fill in your values

```
# Event Organiser (EO) staging account
EO_EMAIL=your_eo_account@example.com
EO_PASSWORD=your_eo_password

# Vendor staging account
VENDOR_EMAIL=your_vendor@example.com
VENDOR_PASSWORD=your_vendor_password

# Admin portal (optional — only used by Admin-side tests)
ADMIN_URL=https://portal.hatchevent.com/admin
ADMIN_EMAIL=your_admin@example.com
ADMIN_PASSWORD=your_admin_password

# Staging base URL (leave as-is unless told otherwise)
BASE_URL=https://portal.staging.hatchevent.com
```

> ⚠️ **Never commit `.env` to git.** It is already in `.gitignore`.

### Where to get the accounts

- **EO account**: Create a staging EO account on `portal.staging.hatchevent.com/register` using an email you control, or ask iFoundries to provision one.
- **Vendor account**: Create a staging Vendor account via the vendor registration flow, or ask iFoundries to provision one with an approved listing so all downstream tests have data to work with.
- **Admin account**: Ask iFoundries for admin credentials if admin-side test cases are in scope.

### Recommended staging accounts

For reproducible results the accounts should have **existing data** — at least:

| Account | Data needed |
|---------|-------------|
| EO      | 1 confirmed event, 1 accepted quotation, 1 paid deposit, 1 RSVP form with responses |
| Vendor  | 1 approved listing, 1 received RFQ, 1 paid bid fee |

Tests are written to be resilient to missing data (most use `.first()` selectors and check element counts before acting), but a clean empty account will cause many tests to be marked Fail.

---

## Running Tests

### All journeys

```bash
./run-uat.sh
```

### Single journey

```bash
./run-uat.sh eo        # EO Journey        (EO-TC-01 – EO-TC-31)
./run-uat.sh vendor    # Vendor Registration (VD-TC-01 – VD-TC-26)
./run-uat.sh rfq       # RFQ Process        (RFQ-TC-01 – RFQ-TC-18)
./run-uat.sh svc       # Event Service & RSVP (SVC-TC-01 – SVC-TC-16)
```

### With visible browser

```bash
./run-uat.sh --headed          # all journeys, browser visible
./run-uat.sh eo --headed       # EO journey, browser visible
```

### Skip tracker update

```bash
./run-uat.sh --no-tracker      # run tests only, don't touch Excel
```

---

## Viewing the HTML Report

After a run, open the Playwright report for screenshots and failure details:

```bash
npx playwright show-report
```

Or open `playwright-report/index.html` directly in your browser.

---

## Updating the Excel Tracker Manually

If you already have a `results/results.json` from a previous run:

```bash
python3 update_tracker.py results/results.json HatchEvent-UAT-Tracker-v6.xlsx
```

The script:
- Reads every TC ID (`EO-TC-xx`, `VD-TC-xx`, `RFQ-TC-xx`, `SVC-TC-xx`) from the JSON
- Writes **Pass** or **Fail** to column H, today's date to column K
- Appends the error snippet to column S (Notes) on failures
- Skips tests marked `test.skip()` — leaves their existing tracker status untouched
- Applies the tracker's colour coding (green = Pass, red = Fail, yellow = Blocked)

---

## Test Coverage

| Journey | Sheet | TCs | Blocked (skipped) |
|---------|-------|-----|-------------------|
| EO Journey | EO Journey | 31 | 4 (EO-TC-27, 28, 29, 31) |
| Vendor Registration | Vendor Registration | 26 | 5 (VD-TC-12, 13, 19, 22, 26) |
| RFQ Process | RFQ Process | 18 | 1 (RFQ-TC-18) |
| Event Service & RSVP | Event Service & RSVP | 16 | 2 (SVC-TC-15, 16) |
| **Total** | | **91** | **12** |

Blocked tests are `test.skip()` and map to known open bugs. They do **not** overwrite the tracker — their status stays as set manually.

---

## Project Structure

```
playwright-uat/
├── .env                      ← credentials (never commit this)
├── .env.example              ← template to copy
├── playwright.config.js      ← Playwright configuration
├── package.json              ← npm scripts
├── run-uat.sh                ← one-command runner (this file)
├── update_tracker.py         ← writes results back to Excel
├── helpers/
│   ├── auth.js               ← loginAsEO(), loginAsVendor(), loginAsAdmin()
│   └── common.js             ← goto(), fillField(), clickButton(), etc.
├── tests/
│   ├── eo-journey.spec.js
│   ├── vendor-registration.spec.js
│   ├── rfq-process.spec.js
│   └── event-service.spec.js
├── results/
│   └── results.json          ← generated by Playwright after each run
└── playwright-report/
    └── index.html            ← generated HTML report
```

---

## Troubleshooting

### "Credentials missing or have placeholder values"
Edit `.env` and replace every `your_*` value with real staging credentials.

### Tests fail immediately at login
- Verify the EO/Vendor accounts exist on staging and the passwords are correct.
- Run with `--headed` to watch the browser and see what's happening.

### "results/results.json not found"
The Playwright JSON reporter wasn't configured or the test run itself failed before writing output. Check `playwright.config.js` → `reporter` section.

### openpyxl not installed
The tracker updater self-installs it on first run. If it fails:
```bash
pip install openpyxl --break-system-packages
```

### Stripe payment tests
Tests that go through Stripe (RFQ-TC-12, RFQ-TC-13, SVC-TC-08) use the test card `4242 4242 4242 4242`. This only works if the staging Stripe integration is in **test mode**. If staging is wired to a live Stripe key, those tests will fail — mark them Blocked manually.
