# HatchEvent UAT — Playwright suite (v2)

Live dashboard: https://missomisso.github.io/HatchEvent-UAT/

Automated UAT for **portal.staging.hatchevent.com**, rebuilt on 26 Nov 2026 against the post-25-Nov UI.
Runs every weekday at 03:00 SGT on GitHub Actions. Each run produces a results workbook (ready to append to the UAT Tracker), an Excel test catalogue and an HTML report.

## What is tested

| File | IDs | What it covers |
|---|---|---|
| `tests/eo-journey.spec.js` | EO-TC-01…31 | Event Organiser journey (same IDs as the tracker) |
| `tests/vendor-registration.spec.js` | VD-TC-01…26 | Vendor journey |
| `tests/rfq-process.spec.js` | RFQ-TC-01…18 | RFQ process, both sides |
| `tests/event-service.spec.js` | SVC-TC-01…16 | Services & RSVP |
| `tests/00-access-control.spec.js` + `zz-logout.spec.js` | AC-TC-01…20 | Logged-out redirects, role separation, 404, logout |
| `tests/01-validation.spec.js` | NEG-TC-01…20 | Error messages and blocked submissions |
| `tests/02-bugs-and-findings.spec.js` | REG-BUG-xx, NEW-xx | Bug Log regressions + new findings |
| `tests/03-page-health.spec.js` | HLT-TC-xx | Every page: load time, heading, API 5xx, JS errors, broken images, placeholder text |
| `tests/04-write-flows.spec.js` | WR-TC-xx | Data-changing flows on **UAT-AUTO** data only |

Every test is labelled with a **depth**:

- **Full**: automated end to end.
- **Partial**: automated up to a safety gate (Stripe checkout, *Request for quotation now*, *Start Campaign*, *Send invite*).
- **Manual**: needs a person (OTP email, Google OAuth, real payment, mobile app). These show as *Manual* in the tracker. They are not reported as passes.

## Safety

`helpers/fixtures.js` adds a **write-guard** to every test. It blocks every non-GET API call except:

- login and logout, plus the read-only vendor search
- the scopes a write test asks for: `contacts`, `eventTitle`, `draft` (status=draft only) and `rsvpDesign`

Stripe checkout pages are always blocked, and so is anything that looks like payment, an RFQ, a quotation, a campaign, an invite or a send.
Each test lists the calls it blocked under the `write-guard-blocked` annotation in the HTML report.

Data the tests create:

- **Contact**: `UAT-AUTO Contact <uat-auto+…@example.com>`. It is created, edited and then deleted in the same test. Anything left over is removed the next night.
- **Draft event**: one `UAT-AUTO Wizard Draft`, created once and then reused. Drafts can't be deleted in the portal, so the suite never creates a second one.
- **RSVP design**: only re-saved when `WRITE_FLOWS=rsvp` (opt-in), so nightly runs never overwrite a design someone is testing by hand.

## Reading results

`update_tracker.py` writes **HatchEvent_Playwright_Runs.xlsx**, which holds one row per test per run in an Excel Table named `PlaywrightRuns`. Your Power Automate flow (or a copy-paste) appends those rows to the live tracker.
The script no longer re-saves the tracker itself, because openpyxl drops the tracker's cross-sheet dropdowns and some conditional formatting. If you really need to write into a tracker, use `--into-tracker` on a copy. The Result column means:

| Result | Meaning |
|---|---|
| Pass / Fail | As usual |
| Known Bug | The linked bug is still there (expected failure) |
| **Fixed? Re-test** | A test that expected a bug has passed. The bug looks fixed, so re-test it by hand and close it |
| Manual | A person needs to do this one |
| Pass (flaky) | Passed only on the retry |

`scripts/build_catalogue.py` builds **HatchEvent_UAT_Test_Catalogue.xlsx**, which has five sheets: Summary, Test Catalogue (steps, depth, bugs and latest result), Bug Coverage and New Findings.

## Run it

```bash
npm install && npx playwright install chromium
cp .env.example .env        # fill in the staging test accounts
npm test                    # everything (~45 min)
npm run test:eo             # one suite; also test:vendor, test:rfq, test:svc, test:access, test:validation, test:bugs, test:health, test:writes
npm run test:report         # open the HTML report
npm run catalogue           # build the Excel catalogue from the last run
```

On GitHub, go to **Actions**, open **HatchEvent UAT** and click **Run workflow**. Pick a suite, and choose whether to include the RSVP design write.
Repository secrets: `BASE_URL`, `EO_EMAIL`, `EO_PASSWORD`, `VENDOR_EMAIL`, `VENDOR_PASSWORD`.

## When the portal changes

Page knowledge lives in `helpers/portal.js`: routes, headings, the Wizard and RSVP step helpers. A UI rename usually needs a one-line change there.
When a bug is fixed and its `Known Bug` test flips to **Fixed? Re-test**, remove its `test.fail(...)` line. From then on it guards against the bug coming back.
