#!/usr/bin/env python3
"""
clickup_sync.py — push a Playwright run into ClickUp after every GitHub Actions run.

What it does (all against the "UAT and Bugs" Space):
  1. Test Cases list  → each test's status becomes its latest result
                        (pass / fail / known bug / fixed - re-test / manual / skipped).
                        A test that is new to the catalogue is created.
  2. Bug Log list     → when a "Known Bug" test now PASSES ("Fixed? Re-test"), each linked bug
                        that is still open / in progress moves to "fixed - pending retest",
                        with a comment pointing at the run.
  3. Test Runs list   → one task per run: counts, what needs attention, link to the run.

The ClickUp dashboard cards read these lists, so the dashboard updates by itself.

Needs the repository secret CLICKUP_TOKEN (a ClickUp personal API token).
Without it the script prints a warning and exits 0, so the test job is never blocked.

Usage:  python3 scripts/clickup_sync.py results/results.json [--dry-run]
"""
import json, os, sys, time, urllib.request, urllib.error
from collections import Counter
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from update_tracker import load  # same classification as the run workbook

API = "https://api.clickup.com/api/v2"
TEST_LIST = os.environ.get("CLICKUP_TEST_LIST_ID", "1100330000207979")
BUG_LIST = os.environ.get("CLICKUP_BUG_LIST_ID", "1100330000207139")
RUNS_LIST = os.environ.get("CLICKUP_RUNS_LIST_ID", "")
TOKEN = os.environ.get("CLICKUP_TOKEN", "").strip()
DRY = "--dry-run" in sys.argv

# Playwright result → ClickUp status on the Test Cases list
STATUS = {"Pass": "pass", "Pass (flaky)": "pass", "Fail": "fail", "Known Bug": "known bug",
          "Fixed? Re-test": "fixed - re-test", "Manual": "manual", "Skipped": "skipped"}
SUITE_TAG = {"EO Journey": "event organizer journey", "Vendor Registration": "vendor registration",
             "RFQ Process": "rfq process", "Event Service & RSVP": "event service and rsvp",
             "Access Control": "access control", "Validation": "validation", "Page Health": "page health",
             "Write Flows (UAT-AUTO)": "write flows", "Bug Regression": "bug regression", "New Findings": "new findings"}
OPEN_BUG = {"open", "in progress"}
SGT = timezone(timedelta(hours=8))


def call(method, path, body=None, tries=4):
    if DRY and method != "GET":
        print(f"  [dry-run] {method} {path} {json.dumps(body)[:160] if body else ''}")
        return {}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method,
                                 headers={"Authorization": TOKEN, "Content-Type": "application/json"})
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                time.sleep(0.65)  # stay under ClickUp's 100 requests/minute
                return json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                time.sleep(15 * (i + 1)); continue
            raise RuntimeError(f"{method} {path} → {e.code} {e.read()[:300]!r}")
    raise RuntimeError(f"{method} {path} kept failing")


def tasks(list_id):
    out, page = [], 0
    while True:
        r = call("GET", f"/list/{list_id}/task?include_closed=true&subtasks=true&page={page}")
        out += r.get("tasks", [])
        if r.get("last_page", True) or not r.get("tasks"):
            return out
        page += 1


def key(name):
    return name.split(" · ", 1)[0].strip()


def main():
    path = next((a for a in sys.argv[1:] if not a.startswith("--")), "results/results.json")
    if not TOKEN and not DRY:
        print("::warning::CLICKUP_TOKEN secret not set — skipping ClickUp sync."); return
    if not os.path.exists(path):
        print(f"::warning::{path} not found — skipping ClickUp sync."); return

    rows = load(path)
    counts = Counter(r["result"] for r in rows)
    run_no = os.environ.get("GITHUB_RUN_NUMBER", "local")
    run_url = (f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/"
               f"{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}")
    stamp = datetime.now(SGT).strftime("%d %b %Y %H:%M SGT")
    print(f"Run #{run_no}: {len(rows)} tests — {dict(counts)}")

    existing = {key(t["name"]): t for t in (tasks(TEST_LIST) if TOKEN else [])}
    changed = created = 0
    for r in rows:
        want = STATUS.get(r["result"], "manual")
        t = existing.get(r["tc"])
        if t is None:
            body = {"name": f"{r['tc']} · {r['scenario']}", "status": want,
                    "tags": [f"suite: {SUITE_TAG.get(r['journey'], r['journey'].lower())}",
                             f"depth: {(r['depth'] or 'full').lower()}"],
                    "markdown_description": f"Suite: {r['journey']}\nDepth: {r['depth']}\n"
                                            f"Linked bugs: {r['bugs'] or '-'}\n\nAdded by run #{run_no}."}
            call("POST", f"/list/{TEST_LIST}/task", body); created += 1
            continue
        if (t.get("status", {}).get("status") or "").lower() != want:
            call("PUT", f"/task/{t['id']}", {"status": want}); changed += 1
            if r["result"] == "Fail" and r["error"]:
                call("POST", f"/task/{t['id']}/comment",
                     {"comment_text": f"Run #{run_no} ({stamp}) failed:\n{r['error'][:900]}\n{run_url}"})
    print(f"Test Cases: {changed} status changes, {created} new tests")

    # Bugs whose expected-failure test now passes
    fixed_bugs = {}
    for r in rows:
        if r["result"] == "Fixed? Re-test":
            for b in [x.strip() for x in (r["bugs"] or "").replace(";", ",").split(",") if x.strip()]:
                fixed_bugs.setdefault(b, []).append(r["tc"])
    flagged = []
    if fixed_bugs:
        bugs = {key(t["name"]): t for t in (tasks(BUG_LIST) if TOKEN else [])}
        for bug, tcs in fixed_bugs.items():
            t = bugs.get(bug)
            if not t or (t.get("status", {}).get("status") or "").lower() not in OPEN_BUG:
                continue
            call("PUT", f"/task/{t['id']}", {"status": "fixed - pending retest"})
            call("POST", f"/task/{t['id']}/comment",
                 {"comment_text": f"Automated run #{run_no} ({stamp}): {', '.join(tcs)} now passes, so this bug "
                                  f"looks fixed. Please re-test by hand and close it.\n{run_url}"})
            flagged.append(bug)
    print(f"Bug Log: moved to 'fixed - pending retest': {flagged or 'none'}")

    # One task per run
    if RUNS_LIST:
        attention = [r for r in rows if r["result"] in ("Fail", "Fixed? Re-test")]
        lines = [f"Run #{run_no} · {stamp}", f"Results: {run_url}", "",
                 *[f"- {k}: {counts.get(k, 0)}" for k in STATUS], ""]
        if attention:
            lines += ["Needs attention:"] + [f"- {r['tc']} {r['scenario']} — {r['result']}" for r in attention]
        if flagged:
            lines += ["", "Bugs moved to fixed - pending retest: " + ", ".join(flagged)]
        name = (f"Run #{run_no} · {datetime.now(SGT):%d %b %Y} · {counts.get('Pass', 0) + counts.get('Pass (flaky)', 0)} pass"
                f" · {counts.get('Fail', 0)} fail · {counts.get('Known Bug', 0)} known bug")
        call("POST", f"/list/{RUNS_LIST}/task",
             {"name": name, "markdown_description": "\n".join(lines),
              "tags": ["run: failures" if counts.get("Fail") else "run: clean"]})
        print("Test Runs: logged", name)


if __name__ == "__main__":
    main()
