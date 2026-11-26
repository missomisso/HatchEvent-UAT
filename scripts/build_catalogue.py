#!/usr/bin/env python3
"""
build_catalogue.py — turns a Playwright results.json into HatchEvent_UAT_Test_Catalogue.xlsx

Sheets: Read Me · Summary · Test Catalogue · Bug Coverage · New Findings
Run after a test run:  python3 scripts/build_catalogue.py results/results.json
"""
import sys, json, re, os
from collections import defaultdict
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from update_tracker import load as load_rows, ID_RE, JOURNEY  # same classification as the tracker
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_steps import S as STEPS

RES = sys.argv[1] if len(sys.argv) > 1 else "results/results.json"
OUT = sys.argv[2] if len(sys.argv) > 2 else "HatchEvent_UAT_Test_Catalogue.xlsx"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FINDINGS = json.load(open(os.path.join(ROOT, "helpers", "findings.json"), encoding="utf-8"))

NAVY, F = "1F3A5F", "Arial"
THIN = Side(border_style="thin", color="BFBFBF"); BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
FILL = {"Pass": "C6EFCE", "Pass (flaky)": "E2EFDA", "Fail": "FFC7CE", "Known Bug": "FCE4D6", "Fixed? Re-test": "BDD7EE",
        "Manual": "EDEDED", "Skipped": "FFEB9C", "Full": "C6EFCE", "Partial": "FFEB9C"}


def header(ws, row, cols):
    for i, (label, width) in enumerate(cols, 1):
        c = ws.cell(row=row, column=i, value=label)
        c.font = Font(name=F, size=10, bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor=NAVY)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True); c.border = BORDER
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = width
    ws.freeze_panes = ws.cell(row=row + 1, column=1)


def cell(ws, r, c, v, fill=None, bold=False):
    x = ws.cell(row=r, column=c, value=v)
    x.font = Font(name=F, size=10, bold=bold); x.alignment = Alignment(vertical="top", wrap_text=True); x.border = BORDER
    if fill: x.fill = PatternFill("solid", fgColor=fill)
    return x


def steps_and_location():
    """test title → (file:line, [test.step titles])"""
    data = json.load(open(RES, encoding="utf-8")); out = {}

    def walk(suites, area):
        for s in suites:
            a = s.get("title", "") if not s.get("file") or s.get("title") != s.get("file") else area
            for sp in s.get("specs", []):
                t = sp["tests"][0]; res = t.get("results", [])
                st = [x.get("title") for x in (res[-1].get("steps", []) if res else []) if x.get("category", "test.step") == "test.step"]
                out[sp["title"]] = (f'{sp.get("file", "")}:{sp.get("line", "")}', [x for x in st if x], a)
            walk(s.get("suites", []), a)
    walk(data.get("suites", []), "")
    return out


def main():
    rows = load_rows(RES)
    extra = steps_and_location()
    wb = openpyxl.Workbook()

    # ── Read Me ──
    ws = wb.active; ws.title = "Read Me"
    lines = [
        ("HatchEvent UAT — Automated Test Catalogue", True),
        ("Generated from the latest Playwright run against portal.staging.hatchevent.com.", False),
        ("", False),
        ("Depth", True),
        ("Full — automated end-to-end; asserts the real outcome.", False),
        ("Partial — automated up to a safety gate (Stripe checkout, Request for quotation, Start Campaign, Send invite) or only part is verifiable.", False),
        ("Manual — needs a person: email OTP, Google OAuth, real payment, mobile app, or would change live data.", False),
        ("", False),
        ("Result", True),
        ("Pass / Fail — as usual.   Known Bug — test expects the linked bug and it is still there.", False),
        ("Fixed? Re-test — test expected a bug but passed: the bug looks fixed — re-test by hand and close it.", False),
        ("", False),
        ("Safety", True),
        ("A write-guard blocks every non-GET API call except: login, vendor search, and the UAT-AUTO scopes (address-book contact, draft title, draft create, RSVP design). Stripe pages are always blocked.", False),
        ("Data created by tests is always named UAT-AUTO and cleaned up (contacts) or reused (one draft event).", False),
    ]
    for i, (t, b) in enumerate(lines, 1):
        c = ws.cell(row=i, column=1, value=t); c.font = Font(name=F, size=14 if i == 1 else 10, bold=b, color=NAVY if b else "000000")
        c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.column_dimensions["A"].width = 120

    # ── Test Catalogue ──
    cat = wb.create_sheet("Test Catalogue")
    cols = [("TC ID", 12), ("Journey / Suite", 20), ("Scenario", 44), ("Depth", 9), ("Linked bugs", 14),
            ("Pre-conditions", 28), ("Steps", 62), ("Expected result", 50), ("Latest result", 13), ("Notes", 40), ("Code", 26)]
    header(cat, 1, cols)
    have = {x["tc"] for x in rows}
    for tc in STEPS:                                   # tests added since the last run
        if tc not in have:
            rows.append(dict(tc=tc, journey=JOURNEY.get(tc.split("-")[0], ""), scenario="(added after this run)", result="Not run yet",
                             error="", secs="", depth="Full", bugs="", notes=""))
    order = list(JOURNEY.keys())
    rows.sort(key=lambda x: (order.index(re.split("-", x["tc"])[0]), int(re.search(r"\d+", x["tc"]).group()), x["tc"]))
    missing = []
    for i, x in enumerate(rows, 2):
        title = next((k for k in extra if k.startswith(x["tc"] + " ")), None)
        loc, _, _ = extra.get(title, ("", [], ""))
        pre, steps, exp = STEPS.get(x["tc"], ("", [], ""))
        if x["tc"] not in STEPS: missing.append(x["tc"])
        vals = [x["tc"], x["journey"], x["scenario"], x["depth"], x["bugs"], pre,
                "\n".join(f"{n}. {st}" for n, st in enumerate(steps, 1)), exp, x["result"], x["notes"] or x["error"][:200], loc]
        for j, v in enumerate(vals, 1):
            cell(cat, i, j, v, fill=FILL.get(v) if j in (4, 9) else None, bold=(j == 1))
    last = len(rows) + 1
    cat.auto_filter.ref = f"A1:K{last}"
    if missing: print("No written steps for:", ", ".join(missing))

    # ── Summary (formulas over the catalogue) ──
    sm = wb.create_sheet("Summary", 1)
    results = ["Pass", "Pass (flaky)", "Fail", "Known Bug", "Fixed? Re-test", "Manual", "Skipped", "Not run yet"]
    header(sm, 1, [("Journey / Suite", 26)] + [(r, 12) for r in results] + [("Total", 9), ("Full", 8), ("Partial", 9), ("Manual depth", 12)])
    for i, j in enumerate(JOURNEY.values(), 2):
        cell(sm, i, 1, j, bold=True)
        for k, r in enumerate(results, 2):
            cell(sm, i, k, f"=COUNTIFS('Test Catalogue'!$B:$B,$A{i},'Test Catalogue'!$I:$I,\"{r}\")")
        n = len(results) + 2
        cell(sm, i, n, f"=COUNTIF('Test Catalogue'!$B:$B,$A{i})", bold=True)
        for k, d in enumerate(["Full", "Partial", "Manual"], n + 1):
            cell(sm, i, k, f"=COUNTIFS('Test Catalogue'!$B:$B,$A{i},'Test Catalogue'!$D:$D,\"{d}\")")
    tr = len(JOURNEY) + 2
    cell(sm, tr, 1, "TOTAL", bold=True)
    for k in range(2, len(results) + 6):
        L = openpyxl.utils.get_column_letter(k)
        cell(sm, tr, k, f"=SUM({L}2:{L}{tr - 1})", bold=True, fill="DDEBF7")
    cell(sm, tr + 2, 1, "Automated share (Full + Partial)", bold=True)
    fl, pl, tl = [openpyxl.utils.get_column_letter(len(results) + c) for c in (3, 4, 2)]
    c = cell(sm, tr + 2, 2, f"=({fl}{tr}+{pl}{tr})/{tl}{tr}", bold=True); c.number_format = "0%"

    # ── Bug Coverage ──
    bc = wb.create_sheet("Bug Coverage")
    header(bc, 1, [("Bug", 10), ("Covered by tests", 44), ("Latest results", 40), ("How", 40)])
    by = defaultdict(list)
    for x in rows:
        for b in re.findall(r"(BUG-\d+|NEW-\d+)", x["bugs"] or ""):
            by[b].append(x)
    for i, b in enumerate(sorted(by, key=lambda s: (s[:3], int(s.split("-")[1]))), 2):
        xs = by[b]
        cell(bc, i, 1, b, bold=True)
        cell(bc, i, 2, ", ".join(x["tc"] for x in xs))
        cell(bc, i, 3, ", ".join(f'{x["tc"]}: {x["result"]}' for x in xs))
        cell(bc, i, 4, ", ".join(sorted(set(x["depth"] for x in xs))))

    # ── New Findings ──
    nf = wb.create_sheet("New Findings")
    header(nf, 1, [("ID", 8), ("Severity", 10), ("Area", 24), ("Finding", 46), ("Detail / how to reproduce", 70), ("Test", 18), ("Bug Log ID (fill in)", 16)])
    for i, f in enumerate(FINDINGS, 2):
        for j, k in enumerate(["id", "severity", "area", "title", "detail", "test"], 1):
            cell(nf, i, j, f[k], bold=(j == 1), fill={"High": "FFC7CE", "Medium": "FCE4D6", "Low": "FFF2CC"}.get(f[k]) if j == 2 else None)
        cell(nf, i, 7, "", fill="FFFF00")
    wb.save(OUT)
    print(f"Catalogue: {OUT}  ({len(rows)} tests, {len(FINDINGS)} findings)")


if __name__ == "__main__":
    main()
