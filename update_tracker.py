#!/usr/bin/env python3
"""
update_tracker.py — Reads Playwright results.json and logs them into a
"Playwright Runs" sheet in the HatchEvent UAT Tracker.

IMPORTANT: The tracker's Status column (H) in each journey sheet is a FORMULA
(=IF(AA5>0,"Blocked",IF(R5="","Pass",Z5))) that auto-derives status from the
Bug Log cross-reference. We do NOT overwrite it — that would destroy the
tracker's core logic. Instead, every Playwright run appends rows to a dedicated
"Playwright Runs" sheet, preserving every formula in the journey sheets.

Usage:
    python3 update_tracker.py [results.json] [tracker.xlsx]

Defaults:
    results.json  → results/results.json
    tracker.xlsx  → auto-detected HatchEvent-UAT-Tracker*.xlsx in cwd
"""

import sys
import json
import os
import re
from datetime import date, datetime
from pathlib import Path

try:
    import openpyxl
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    print("Installing openpyxl...")
    os.system("pip install openpyxl --break-system-packages -q")
    import openpyxl
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

# ── Config ───────────────────────────────────────────────────────────────────
DEFAULT_RESULTS = "results/results.json"
DEFAULT_TRACKER = next(
    (str(f) for f in Path(".").glob("HatchEvent*UAT*Tracker*.xlsx") if "~$" not in f.name),
    "HatchEvent-UAT-Tracker-31102026.xlsx"
)
TESTER_NAME = os.environ.get("TESTER_NAME", "Laurent Misso")
RUN_TIMESTAMP = datetime.now().strftime("%Y-%m-%d %H:%M")
RUN_DATE = date.today().strftime("%d/%m/%Y")

PLAYWRIGHT_SHEET = "Playwright Runs"

# HatchEvent brand colours for the header
HE_HEADER_FILL = PatternFill("solid", fgColor="1F3A5F")   # deep navy
HE_HEADER_FONT = Font(name="Arial", size=10, bold=True, color="FFFFFF")

# Status pill fills
STATUS_FILL = {
    "Pass":    PatternFill("solid", fgColor="C6EFCE"),
    "Fail":    PatternFill("solid", fgColor="FFC7CE"),
    "Skipped": PatternFill("solid", fgColor="FFEB9C"),
}
STATUS_FONT = {
    "Pass":    Font(name="Arial", size=10, color="375623", bold=True),
    "Fail":    Font(name="Arial", size=10, color="9C0006", bold=True),
    "Skipped": Font(name="Arial", size=10, color="9C6500", bold=True),
}

THIN = Side(border_style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


# ── Parse Playwright results ──────────────────────────────────────────────────
def load_results(results_path: str) -> list:
    """
    Returns a list of result dicts:
      [{tc_id, status, error, duration_ms, journey}]
    Playwright JSON reporter shape:
      { suites: [ { title, suites: [ { title, specs: [ { title, ok, tests: [...] } ] } ] } ] }
    The test title is e.g. "EO-TC-01 · New Account — Email Sign-Up"
    """
    with open(results_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    results = []

    def walk_suites(suites, current_file=""):
        for suite in suites:
            file_title = suite.get("title", current_file)
            if "specs" in suite:
                for spec in suite["specs"]:
                    title = spec.get("title", "")
                    m = re.match(r"((EO|VD|RFQ|SVC)-TC-\d+)", title)
                    if not m:
                        continue
                    tc_id = m.group(1)
                    prefix = m.group(2)
                    journey = {
                        "EO":  "EO Journey",
                        "VD":  "Vendor Registration",
                        "RFQ": "RFQ Process",
                        "SVC": "Event Service & RSVP",
                    }.get(prefix, prefix)

                    tests = spec.get("tests", [])
                    if not tests:
                        continue

                    # Skip detection
                    is_skipped = any(
                        a.get("type") == "skip"
                        for t in tests for a in t.get("annotations", [])
                    )

                    if is_skipped:
                        status = "Skipped"
                        error_msg = ""
                    else:
                        ok = spec.get("ok", False)
                        status = "Pass" if ok else "Fail"
                        error_msg = ""
                        if not ok:
                            for t in tests:
                                for result in t.get("results", []):
                                    for err in result.get("errors", []):
                                        msg = err.get("message", "")
                                        if msg:
                                            # Strip ANSI codes for readability
                                            msg = re.sub(r"\x1b\[[0-9;]*m", "", msg)
                                            error_msg = msg[:400]
                                            break

                    # Duration (sum of all test runs)
                    duration_ms = 0
                    for t in tests:
                        for r in t.get("results", []):
                            duration_ms += r.get("duration", 0)

                    results.append({
                        "tc_id":       tc_id,
                        "journey":     journey,
                        "scenario":    title.split("·", 1)[-1].strip() if "·" in title else title,
                        "status":      status,
                        "error":       error_msg,
                        "duration_ms": duration_ms,
                    })
            if "suites" in suite:
                walk_suites(suite["suites"], file_title)

    walk_suites(data.get("suites", []))
    return results


# ── Write to the Playwright Runs sheet ────────────────────────────────────────
def ensure_playwright_sheet(wb) -> openpyxl.worksheet.worksheet.Worksheet:
    """Return the Playwright Runs sheet, creating it (with header) if missing."""
    if PLAYWRIGHT_SHEET in wb.sheetnames:
        return wb[PLAYWRIGHT_SHEET]

    ws = wb.create_sheet(PLAYWRIGHT_SHEET)

    # Title row
    ws["A1"] = "Playwright Automated Test Runs"
    ws["A1"].font = Font(name="Arial", size=12, bold=True, color="1F3A5F")
    ws.merge_cells("A1:H1")

    ws["A2"] = "Auto-generated by update_tracker.py — each row = one test case per run"
    ws["A2"].font = Font(name="Arial", size=9, italic=True, color="595959")
    ws.merge_cells("A2:H2")

    # Header row at row 4
    headers = [
        ("A", "Run Date",       14),
        ("B", "Tester",         18),
        ("C", "Journey",        24),
        ("D", "TC ID",          13),
        ("E", "Scenario",       52),
        ("F", "Result",         10),
        ("G", "Duration (s)",   12),
        ("H", "Error Message",  60),
    ]
    for col, label, width in headers:
        c = ws[f"{col}4"]
        c.value = label
        c.fill = HE_HEADER_FILL
        c.font = HE_HEADER_FONT
        c.alignment = Alignment(horizontal="center", vertical="center")
        c.border = BORDER
        ws.column_dimensions[col].width = width

    ws.row_dimensions[4].height = 22
    ws.freeze_panes = "A5"
    return ws


def append_run(ws, results: list):
    """Append each result as a new row below the existing data."""
    # Find next empty row (starting from row 5)
    next_row = 5
    while ws.cell(row=next_row, column=1).value is not None:
        next_row += 1

    for r in results:
        row = next_row
        ws.cell(row=row, column=1, value=RUN_DATE)
        ws.cell(row=row, column=2, value=TESTER_NAME)
        ws.cell(row=row, column=3, value=r["journey"])
        ws.cell(row=row, column=4, value=r["tc_id"])
        ws.cell(row=row, column=5, value=r["scenario"])
        ws.cell(row=row, column=6, value=r["status"])
        ws.cell(row=row, column=7, value=round(r["duration_ms"] / 1000, 1))
        ws.cell(row=row, column=8, value=r["error"])

        # Style every cell
        for col_idx in range(1, 9):
            cell = ws.cell(row=row, column=col_idx)
            cell.font = Font(name="Arial", size=10)
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            cell.border = BORDER

        # Status pill
        status_cell = ws.cell(row=row, column=6)
        if r["status"] in STATUS_FILL:
            status_cell.fill = STATUS_FILL[r["status"]]
            status_cell.font = STATUS_FONT[r["status"]]
            status_cell.alignment = Alignment(horizontal="center", vertical="center")

        next_row += 1


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    results_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_RESULTS
    tracker_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_TRACKER

    if not os.path.exists(results_path):
        print(f"ERROR: Results file not found: {results_path}")
        print("Run: npm test  (from the playwright-uat/ directory) first.")
        sys.exit(1)

    if not os.path.exists(tracker_path):
        print(f"ERROR: Tracker file not found: {tracker_path}")
        sys.exit(1)

    print(f"Loading results from: {results_path}")
    print(f"Updating tracker:     {tracker_path}")
    print(f"Tester:               {TESTER_NAME}")
    print(f"Run timestamp:        {RUN_TIMESTAMP}\n")

    results = load_results(results_path)
    print(f"Found {len(results)} TC results in Playwright output")

    if not results:
        print("No TC results to log — exiting.")
        return

    wb = openpyxl.load_workbook(tracker_path)
    ws = ensure_playwright_sheet(wb)
    append_run(ws, results)
    wb.save(tracker_path)

    # Summary
    pass_n = sum(1 for r in results if r["status"] == "Pass")
    fail_n = sum(1 for r in results if r["status"] == "Fail")
    skip_n = sum(1 for r in results if r["status"] == "Skipped")
    print(f"\n  ✓ Pass:     {pass_n}")
    print(f"  ✗ Fail:     {fail_n}")
    print(f"  ↷ Skipped:  {skip_n}")
    print(f"\nLogged to sheet: '{PLAYWRIGHT_SHEET}' in {tracker_path}")
    print("Journey sheets were NOT modified — all formulas preserved.")


if __name__ == "__main__":
    main()
