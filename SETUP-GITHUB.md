# GitHub Actions Setup — HatchEvent UAT

**Repository:** https://github.com/missomisso/HatchEvent-UAT
**Owner:** Laurent Misso (`missomisso`)
**Tracker included:** `HatchEvent_UAT_Tracker_31102026.xlsx` (dated 2026-11-05)
**Schedule:** Monday–Friday 03:00 Singapore time
**Runner:** GitHub-hosted Ubuntu (Node 20, Python 3.11, Chromium)

One-time setup. After step 4 it runs itself.

---

## Step 1 — Push everything to your repo (one command block)

Open Terminal, go to the extracted `playwright-uat/` folder, then run:

```bash
cd ~/Downloads/playwright-uat                 # adjust path if needed

git init
git branch -M main
git add .
git commit -m "Initial Playwright UAT suite — 91 TCs across 4 journeys"
git remote add origin https://github.com/missomisso/HatchEvent-UAT.git
git push -u origin main
```

**When prompted for a password**, paste a **Personal Access Token**, not your GitHub password:
→ https://github.com/settings/tokens → **Generate new token (classic)** → tick **`repo`** → copy the token → paste it as the password

The tracker Excel file is already in the folder, so it ships with this first commit.

---

## Step 2 — Add your staging credentials as GitHub Secrets

Click here: **https://github.com/missomisso/HatchEvent-UAT/settings/secrets/actions**

Click **"New repository secret"** for each row below:

| Secret Name       | Value                                             | Required |
|-------------------|---------------------------------------------------|----------|
| `BASE_URL`        | `https://portal.staging.hatchevent.com`           | ✅ |
| `EO_EMAIL`        | *your staging EO account email*                   | ✅ |
| `EO_PASSWORD`     | *your staging EO account password*                | ✅ |
| `VENDOR_EMAIL`    | *your staging Vendor account email*               | ✅ |
| `VENDOR_PASSWORD` | *your staging Vendor account password*            | ✅ |
| `ADMIN_URL`       | `https://portal.hatchevent.com/admin`             | optional |
| `ADMIN_EMAIL`     | *your admin email*                                | optional |
| `ADMIN_PASSWORD`  | *your admin password*                             | optional |

> Secrets are encrypted at rest. GitHub cannot show them to you after saving — only overwrite.
> They are never printed in logs even if a test prints env vars.

---

## Step 3 — Enable Actions

→ **https://github.com/missomisso/HatchEvent-UAT/actions**

If GitHub shows a banner: click **"I understand my workflows, go ahead and enable them"**.

---

## Step 4 — Run it the first time

1. On the Actions tab → click **HatchEvent UAT** (left sidebar)
2. Click the **Run workflow** dropdown (top right)
3. Pick a journey (start with `eo` to test the plumbing — faster)
4. Click the green **Run workflow** button

Wait ~5–15 min. Then:

- ✅ green tick = all tests passed · ❌ red X = at least one failure
- Click into the run → scroll to **Artifacts** → download:
  - **HatchEvent-UAT-Tracker-N.xlsx** — your tracker, now with a `Playwright Runs` sheet showing today's results
  - **playwright-report-N** — zipped HTML report with screenshots of every failure

---

## From then on — scheduled runs

Set and forget. Every weekday at 03:00 SGT the workflow runs itself. Check the Actions tab each morning.

**Get email on failure:** https://github.com/settings/notifications → scroll to **Actions** → tick **Email**, choose **"Only failed workflows"**.

---

## Changing the schedule

Edit `.github/workflows/uat.yml`, line:

```yaml
- cron: '0 19 * * 0-4'   # UTC — Sun-Thu 19:00 = Mon-Fri 03:00 SGT
```

Cron fields: `minute hour day-of-month month day-of-week`. GitHub cron is always UTC. Singapore = UTC+8.

Examples:
- Every day 03:00 SGT: `0 19 * * *`
- Mondays only 09:00 SGT: `0 1 * * 1`
- Every 6 hours: `0 */6 * * *`

Commit the change and push. The new schedule is picked up within a minute or two.

**To disable the schedule entirely**, delete or comment out the whole `schedule:` block in `uat.yml`. The manual "Run workflow" button still works.

---

## Updating the tracker version

When iFoundries or you make changes to the tracker (new TCs, new columns, etc.):

```bash
# From the playwright-uat folder
cp ~/Downloads/HatchEvent_UAT_Tracker_LATEST.xlsx .
git add *.xlsx
git commit -m "Update tracker"
git push
```

The next workflow run picks it up automatically.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `remote: Support for password authentication was removed` | Use a Personal Access Token (step 1) |
| Workflow runs but every test fails at login | Secrets are wrong — check `EO_EMAIL` and `EO_PASSWORD` in the secrets page |
| "No tracker .xlsx found" warning | The `*.xlsx` wasn't committed — add it and push |
| Workflow stopped running on schedule | GitHub disables scheduled workflows on repos with no activity for 60 days. Push any commit to reactivate. |
| Playwright timeouts | Staging is slow or down — re-run the workflow |
| Want Slack notifications | Ask Claude to add a Slack webhook step |

---

## What this setup does NOT do (yet)

- **Does not push the updated tracker back to SharePoint** — the updated file lives in the Actions artifacts. If you want SharePoint sync, we'd add a Microsoft Graph API step (needs an Azure AD app registration — ask when ready).
- **Does not screenshot every passing test** — only failures get screenshots (standard Playwright behaviour, saves disk space).
- **Does not test the mobile apps** (EO Mobile, Vendor Mobile sheets) — Playwright drives web browsers only. Mobile UAT stays manual, or needs Appium/Maestro.
