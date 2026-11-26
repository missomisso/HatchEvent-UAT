#!/usr/bin/env python3
"""
update_tracker.py — logs one row per test per run.

DEFAULT (recommended): appends to HatchEvent_Playwright_Runs.xlsx — a small workbook with an
Excel Table named "PlaywrightRuns". Power Automate (or copy-paste) appends those rows into the
live SharePoint tracker, so the tracker itself is never re-saved by a script.

Why: re-saving the full UAT Tracker with openpyxl silently drops its cross-sheet dropdowns
(x14 data validations) and some conditional formatting. Use --into-tracker only on a COPY.

Result values written:
  Pass            test passed
  Fail            test failed — look at it
  Known Bug       test.fail() test still failing → the linked bug is still present
  Fixed? Re-test  test.fail() test PASSED → the linked bug looks fixed, re-test by hand and close it
  Manual          test is marked Manual (needs a person: OTP email, OAuth, payment, mobile app)
  Skipped         skipped for another reason (see Notes)
  Pass (flaky)    passed only on retry

Usage:
  python3 update_tracker.py [results/results.json]                       → HatchEvent_Playwright_Runs.xlsx
  python3 update_tracker.py results/results.json --into-tracker X.xlsx    → "Playwright Runs" sheet inside X (lossy)
"""
import sys, json, os, re
from datetime import date
from pathlib import Path
import openpyxl
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side

DEFAULT_RESULTS = "results/results.json"
RUNS_BOOK = "HatchEvent_Playwright_Runs.xlsx"
TESTER = os.environ.get("TESTER_NAME", "Laurent Misso")
SHEET = "Playwright Runs"

ID_RE = re.compile(r"^((?:EO|VD|RFQ|SVC|AC|NEG|HLT|WR)-TC-\d+[a-z]?|REG-BUG-\d+[a-z]?|NEW-\d+[a-z]?)")
JOURNEY = {"EO": "EO Journey", "VD": "Vendor Registration", "RFQ": "RFQ Process", "SVC": "Event Service & RSVP",
           "AC": "Access Control", "NEG": "Validation", "HLT": "Page Health", "WR": "Write Flows (UAT-AUTO)",
           "REG": "Bug Regression", "NEW": "New Findings"}

HEADERS = [("A", "Run Date", 12), ("B", "Tester", 18), ("C", "Journey", 22), ("D", "TC ID", 13), ("E", "Scenario", 55),
           ("F", "Result", 15), ("G", "Duration (s)", 11), ("H", "Error Message", 55), ("I", "Depth", 9),
           ("J", "Linked Bugs", 16), ("K", "Notes", 50)]
FILL = {"Pass": "C6EFCE", "Pass (flaky)": "E2EFDA", "Fail": "FFC7CE", "Known Bug": "FCE4D6", "Fixed? Re-test": "BDD7EE",
        "Manual": "EDEDED", "Skipped": "FFEB9C"}
THIN = Side(border_style="thin", color="BFBFBF"); BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def ann(test, typ):
    return "; ".join(a.get("description", "") for a in test.get("annotations", []) if a.get("type") == typ)


def classify(spec):
    t = spec["tests"][0]
    results = t.get("results", [])
    last = results[-1] if results else {}
    status, expected = last.get("status", "skipped"), t.get("expectedStatus", "passed")
    depth = ann(t, "depth")
    if status == "skipped" or t.get("status") == "skipped":
        return ("Manual" if depth == "Manual" else "Skipped"), ""
    err = ""
    for r in results:
        for e in r.get("errors", []) or ([r["error"]] if r.get("error") else []):
            err = re.sub(r"\x1b\[[0-9;]*m", "", e.get("message", ""))[:400]
    if expected == "failed":
        return ("Known Bug", "") if status == "failed" else ("Fixed? Re-test", "Expected-failure test passed — bug may be fixed")
    if status == "passed":
        return ("Pass (flaky)" if len(results) > 1 else "Pass"), ""
    return "Fail", err


def load(path):
    data = json.load(open(path, encoding="utf-8"))
    out = []

    def walk(suites, trail):
        for s in suites:
            for spec in s.get("specs", []):
                m = ID_RE.match(spec.get("title", ""))
                if not m or not spec.get("tests"):
                    continue
                tc = m.group(1)
                t = spec["tests"][0]
                if t.get("projectName") == "setup":
                    continue
                res, err = classify(spec)
                notes = "; ".join(filter(None, [ann(t, "note"), ann(t, "known"), ann(t, "slow"), ann(t, "skip"),
                                                ann(t, "write-guard-blocked") and "write-guard blocked: " + ann(t, "write-guard-blocked")]))
                out.append(dict(tc=tc, journey=JOURNEY.get(re.split(r"-", tc)[0], ""),
                                scenario=spec["title"].split("·", 1)[-1].strip(), result=res, error=err,
                                secs=round(sum(r.get("duration", 0) for r in t.get("results", [])) / 1000, 1),
                                depth=ann(t, "depth"), bugs=ann(t, "bug"), notes=notes[:500]))
            walk(s.get("suites", []), trail + [s.get("title", "")])
    walk(data.get("suites", []), [])
    return out


def sheet(wb):
    ws = wb[SHEET] if SHEET in wb.sheetnames else wb.create_sheet(SHEET)
    if ws["A1"].value is None:
        ws["A1"] = "Playwright Automated Test Runs"; ws["A1"].font = Font(name="Arial", size=12, bold=True, color="1F3A5F")
        ws["A2"] = "Appended by update_tracker.py — one row per test per run. Journey sheets are never modified."
        ws["A2"].font = Font(name="Arial", size=9, italic=True, color="595959")
    for col, label, width in HEADERS:          # (re)write header so old 8-column sheets gain I–K
        c = ws[f"{col}4"]; c.value = label
        c.fill = PatternFill("solid", fgColor="1F3A5F"); c.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
        c.alignment = Alignment(horizontal="center", vertical="center"); c.border = BORDER
        ws.column_dimensions[col].width = width
    ws.freeze_panes = "A5"
    return ws


def write_rows(ws, rows, first_row):
    r = first_row
    while ws.cell(row=r, column=1).value is not None: r += 1
    today = date.today().strftime("%d/%m/%Y")
    for x in rows:
        vals = [today, TESTER, x["journey"], x["tc"], x["scenario"], x["result"], x["secs"], x["error"], x["depth"], x["bugs"], x["notes"]]
        for i, v in enumerate(vals, 1):
            c = ws.cell(row=r, column=i, value=v)
            c.font = Font(name="Arial", size=10); c.alignment = Alignment(vertical="top", wrap_text=True); c.border = BORDER
        rc = ws.cell(row=r, column=6)
        if x["result"] in FILL:
            rc.fill = PatternFill("solid", fgColor=FILL[x["result"]]); rc.font = Font(name="Arial", size=10, bold=True)
        r += 1
    return r - 1


def runs_book(rows):
    if os.path.exists(RUNS_BOOK):
        wb = openpyxl.load_workbook(RUNS_BOOK); ws = wb["PlaywrightRuns"]
    else:
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = "PlaywrightRuns"
        for i, (col, label, width) in enumerate(HEADERS, 1):
            c = ws.cell(row=1, column=i, value=label)
            c.font = Font(name="Arial", size=10, bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="1F3A5F")
            c.alignment = Alignment(horizontal="center", vertical="center"); ws.column_dimensions[col].width = width
        ws.freeze_panes = "A2"
    last = write_rows(ws, rows, 2)
    ref = f"A1:K{max(last, 2)}"
    if "PlaywrightRuns" in ws.tables:
        ws.tables["PlaywrightRuns"].ref = ref
    else:
        t = Table(displayName="PlaywrightRuns", ref=ref)
        t.tableStyleInfo = TableStyleInfo(name="TableStyleLight9", showRowStripes=True)
        ws.add_table(t)
    wb.save(RUNS_BOOK)
    return RUNS_BOOK


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    rp = args[0] if args else DEFAULT_RESULTS
    if not os.path.exists(rp): sys.exit(f"Results not found: {rp}")
    rows = load(rp)
    if "--into-tracker" in sys.argv:
        tp = args[1] if len(args) > 1 else ""
        if not os.path.exists(tp): sys.exit(f"Tracker not found: {tp}")
        print("WARNING: re-saving the tracker with openpyxl drops cross-sheet dropdowns and some conditional formatting. Use a copy.")
        wb = openpyxl.load_workbook(tp); ws = sheet(wb); write_rows(ws, rows, 5); wb.save(tp); target = tp
    else:
        target = runs_book(rows)
    print(f"{len(rows)} test results → {target}")
    from collections import Counter
    for k, v in Counter(x["result"] for x in rows).most_common(): print(f"  {k:15s} {v}")


if __name__ == "__main__":
    main()
