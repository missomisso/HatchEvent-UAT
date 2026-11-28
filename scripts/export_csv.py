#!/usr/bin/env python3
"""
export_csv.py - publish Playwright results as two CSV files the UAT Tracker can read.

  data/latest-results.csv   one row per test: its most recent automated result.
                            A partial run (e.g. suite = rfq) only updates the tests it ran.
  data/results-history.csv  one row per test per run, newest runs appended at the bottom.

The GitHub workflow commits both files to main after every run. Excel reads them from
https://raw.githubusercontent.com/missomisso/HatchEvent-UAT/main/data/latest-results.csv

Usage:  python3 scripts/export_csv.py results/results.json
"""
import csv, os, sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from update_tracker import load  # same Pass / Fail / Known Bug / Manual classification as the run workbook

DATA = "data"
LATEST = os.path.join(DATA, "latest-results.csv")
HISTORY = os.path.join(DATA, "results-history.csv")
COLS = ["TC ID", "Suite", "Scenario", "Result", "Run Date", "Run Number", "Depth", "Linked Bugs", "Error"]
SGT = timezone(timedelta(hours=8))


def first_line(text, limit=200):
    line = (text or "").strip().splitlines()[0] if (text or "").strip() else ""
    return line[:limit]


def read(path):
    if not os.path.exists(path):
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(rows)


def main():
    src = next((a for a in sys.argv[1:] if not a.startswith("--")), "results/results.json")
    if not os.path.exists(src):
        print(f"::warning::{src} not found - nothing exported"); return
    os.makedirs(DATA, exist_ok=True)

    run_no = os.environ.get("GITHUB_RUN_NUMBER", "local")
    run_date = datetime.now(SGT).strftime("%Y-%m-%d")
    new = [{"TC ID": r["tc"], "Suite": r["journey"], "Scenario": r["scenario"], "Result": r["result"],
            "Run Date": run_date, "Run Number": run_no, "Depth": r["depth"] or "",
            "Linked Bugs": r["bugs"] or "", "Error": first_line(r["error"])} for r in load(src)]

    # latest: replace the tests this run covered, keep the rest
    latest = {r["TC ID"]: r for r in read(LATEST)}
    latest.update({r["TC ID"]: r for r in new})
    write(LATEST, sorted(latest.values(), key=lambda r: r["TC ID"]))

    # history: drop any earlier copy of this run (re-runs), then append
    history = [r for r in read(HISTORY) if r["Run Number"] != run_no] + new
    write(HISTORY, history)
    print(f"Exported {len(new)} results from run #{run_no}: {LATEST} ({len(latest)} tests), {HISTORY} ({len(history)} rows)")


if __name__ == "__main__":
    main()
