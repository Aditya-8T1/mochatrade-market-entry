#!/usr/bin/env python3
"""Import the Round 2 market-research workbook into data/round2-research.json.

  python3 scripts/import-round2-research.py [path/to/MochaTrade_market_data_research.xlsx]

Needs `pip install openpyxl`. The workbook is copied under data/source/ for
provenance. Nothing in the app reads the .xlsx at runtime -- only the JSON.

Sheets:
  A_Six_Round1           research notes for the six markets screened out in Round 1
                          (scores stay the deck's; notes and deck checks are added)
  B_Sixteen_Additional   16 new markets: 5 rubric scores + researched adaptation /
                          execution + licensing, rail, KYC, product, sources, flags
  Screened_out_reserve   8 markets screened out on score / regulatory grounds
"""
import json, re, sys, datetime
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data/source/MochaTrade_market_data_research.xlsx"
OUT = ROOT / "data/round2-research.json"
DIMS = ["market_opportunity", "legality", "licence", "fx_custody", "clarity"]
ROUND1_IDS = {"Philippines": "philippines", "Nigeria": "nigeria", "Pakistan": "pakistan",
              "Thailand": "thailand", "South Africa": "south_africa", "Vietnam": "vietnam"}
URL = re.compile(r"https?://[^\s;]+")

def slug(name): return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
def clean(v): return None if v is None else re.sub(r"\s+", " ", str(v)).strip()

def rated(text):
    """'3/5 [D] Local entity + CNAD approval.' -> (3, '[D] Local entity + CNAD approval.')"""
    m = re.match(r"\s*(\d+(?:\.\d+)?)\s*/\s*5\s*(.*)", text or "")
    if not m: raise ValueError(f"expected 'n/5 ...', got {text!r}")
    return float(m.group(1)) if "." in m.group(1) else int(m.group(1)), m.group(2).strip()

def scores(text):
    parts = [p.strip() for p in str(text).split("/")]
    if len(parts) != 5: raise ValueError(f"expected 5 scores, got {text!r}")
    return {k: (float(p) if "." in p else int(p)) for k, p in zip(DIMS, parts)}

def sources(text):
    text = clean(text) or ""
    urls = URL.findall(text)
    basis = URL.sub("", text).strip(" ;.")
    basis = re.sub(r"\s*;\s*(;\s*)*", "; ", basis).strip(" ;")
    return basis or None, [u.rstrip(".,)") for u in urls]

def rows(ws):
    hdr = [clean(c.value) for c in ws[1]]
    for r in ws.iter_rows(min_row=2, values_only=True):
        if r and r[0]: yield dict(zip(hdr, [clean(v) for v in r]))

def research(r, sources_col):
    a, a_why = rated(r["Adaptation cost"]); e, e_why = rated(r["Execution dependency"])
    basis, urls = sources(r[sources_col])
    out = {"adaptation_cost": a, "adaptation_rationale": a_why,
           "execution_dependency": e, "execution_rationale": e_why,
           "payment_rail": r["Payment rail"], "capital_and_licensing": r["Capital & licensing"],
           "kyc_aml": r["KYC / AML"], "product_changes": r["Product changes"],
           "regulatory_basis": basis, "sources": urls}
    return {k: v for k, v in out.items() if v not in (None, "", [])}

wb = openpyxl.load_workbook(SRC, data_only=True)
round1 = {}
for r in rows(wb["A_Six_Round1"]):
    rec = research(r, "Regulatory basis / sources")
    if r.get("Check vs PPT"): rec["deck_check"] = r["Check vs PPT"]
    round1[ROUND1_IDS[r["Country"]]] = rec

markets = []
for r in rows(wb["B_Sixteen_Additional"]):
    rec = research(r, "Key regulatory source(s)")
    if r.get("Flags"): rec["flags"] = r["Flags"]
    markets.append({"id": slug(r["Country"]), "name": r["Country"], "list": "additional",
                    "scores": scores(r["Opp/Leg/Lic/FX/Clarity"]),
                    "screening_score_sheet": float(r["Weighted screening score (/5)"]),
                    "priority_index_sheet": float(r["Indicative priority index (score - 0.35*adapt - 0.35*exec; same formula as site)"]),
                    "research": rec})
for r in rows(wb["Screened_out_reserve"]):
    basis, urls = sources(r["Reason"])
    markets.append({"id": slug(r["Country"]), "name": r["Country"], "list": "reserve",
                    "scores": scores(r["Opp/Leg/Lic/FX/Clarity"]),
                    "screening_score_sheet": float(r["Score"]),
                    "research": {k: v for k, v in {"reserve_reason": r["Reason"], "sources": urls}.items() if v}})

out = {
  "_meta": {
    "title": "Round 2 market research (MochaTrade Track 1)",
    "source": f"data/source/{SRC.name}",
    "imported": datetime.date.today().isoformat(),
    "importer": "scripts/import-round2-research.py",
    "evidence_tags": {
      "[V]": "verified against a primary source (regulator, FATF, statute)",
      "[V-secondary]": "verified via a law-firm, news or other secondary source",
      "[V-draft]": "verified, but the rule is a draft / not in force",
      "[A]": "assumption or limited evidence -- confirm before relying on it",
      "[D]": "derived by the researcher from the facts cited"},
    "scoring": "Scores use the Round 1 rubric (25/25/20/15/15). 'screening_score_sheet' is the workbook's printed total; the engine recomputes it and a test checks they agree.",
    "clearing": "A market clears at base weights when score >= the 3.0 threshold AND it passes the regulatory knock-out (legality > 2 and licence > 1). Computed by the engine, not stored.",
    "sequencing": "Round 2 markets are NOT sequenced: the workbook has no entry route, timing window or go-gates. Cleared ones get the 'shortlist' verdict; researched adaptation / execution are shown and used only for an indicative priority comparison against the Round 1 plan.",
    "round1_notes": "Round 1 markets keep their deck scores and text verbatim. Research notes and 'deck_check' refinements are shown alongside, never substituted."},
  "round1_notes": round1,
  "markets": markets,
}
OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {OUT.relative_to(ROOT)}: {len(round1)} Round 1 notes, {len(markets)} markets")
