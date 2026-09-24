# MochaTrade Market Entry Readiness

**ACM MarketSphere 2026 -- Round 2 (Build) -- Track 1: Market Entry & Regulatory Strategy**
Team: **The Wealth Architects** (Aditya Tomar, Aryan Banerjee, Ameya Deshmukh, Devesh Pandey)

## What this is

A working "Market Entry Readiness" tool for MochaTrade (India-focused, INR/UPI-funded US-stock + crypto-perpetuals app). It takes a candidate market and returns a weighted screening score across 5 regulatory dimensions, a raw ranking of all 9 screened markets, and our recommended entry sequence (Dubai to Brazil to Indonesia), which is NOT the same as the raw ranking -- the tool must show why (Round 1's own "score does not equal sequence" finding). It also surfaces risks and mitigations, required compliance/product adjustments per market, go-gates, and an 18-month roadmap with "if delayed" fallbacks per market.

This is Round 2: operationalizing the Round 1 recommendation into something a real MochaTrade ops/legal team could use, not a new pitch.

## What changed in the Round 2 polish pass

- **Score a new market** -- the brief's literal input. A form for any country not in the Round 1 screen; it is ranked and sequenced with the same rubric and formula, tagged "your entry", persisted in localStorage.
- **Decision card** at the top of every market: verdict (Go / Go with conditions / Do not enter now), recommended entry approach, window, the conditions to close before launch, and a 0-100 **regulatory risk score** built from the four regulatory dimensions.
- **Adaptation cost and execution dependency are now derived**, not typed in: `1 + 2*product_rebuild + rail_via_partner` and `1 + partners + localisation + partner_fronted_onboarding`, from countable `entry_facts` read off the Round 1 deep dive. Reproduces Dubai 1/1, Brazil 3/2, Indonesia 4/5 -- the sequence is explained by facts, not tuned.
- **Compare mode** -- tick up to three markets for overlaid radars and a side-by-side table.
- **Robustness strip** -- the entry order under all four weight presets (it holds 4/4).
- **Market-specific risk clauses** (`market_notes` in `data/risks.json`) shown first in the risk panel; screened-out markets show why.
- **Readiness checklist** now includes go-gates, shows a readiness %, and persists per market. Print / save-as-PDF via the header button.
- **Plain language**: glossary hover-definitions on every regulator, licence and rail; internal labels ("engine_reconstruction", "before this goes on stage") replaced; first-run "how to read this" overlay; slider behaviour explained.
- Removed the unused `framer-motion` dependency. 111 tests.

## Final pass (pre-submission)

- **Verdicts now discriminate.** Every cleared market used to read "Go, with conditions". The verdict is now stage-based and comes with a one-line reason: **Enter now** (Dubai, #1), **Enter next** (Brazil, #2 -- file while Dubai builds), **Enter later** (Indonesia, #3), **Do not enter now** (screened out). A #1 market whose crypto-derivatives route is still unconfirmed (e.g. any user-entered market) is capped at "Enter next".
- **Deck precision everywhere.** Divergence text and compare view show scores to one decimal (3.9 / 3.8 / 3.6), matching Round 1, and no longer print raw penalty / priority-index arithmetic that could not add up after rounding.
- **Priority index made visual.** A "score, minus the cost of getting in" bar per market under the slopegraph: the screening score on a 0-5 track with the adaptation and execution penalties hatched off the end. Exact figures on hover.
- **Legibility.** All small text stepped up one size (10px labels -> 11px, 11 -> 12, etc.); faint text colour raised from #5E6C7A (3.6:1) to #7C8A98 (5.5:1) to pass WCAG AA on the dark background.
- **FX row earns its place.** It now converts the capital requirement each market cites into dollars (AED 800k, Rp100bn) at the live or fallback rate.
- 134 tests.

## Source of truth

See `docs/SPEC.md` for architecture, data schema, engine contracts, screen map, team split and milestones. See `docs/round1-source-map.md` for every hardcoded figure traced back to its Round 1 slide/source, plus what still needs verification. The Round 1 deck and the official Round 2 build brief are not committed here, ask Aditya if you need them re-shared.

## Stack

React + Vite + TypeScript + Tailwind. No backend, everything is computed client-side from static data in `src/data/`.

## Team split

| Person | Owns | Tools |
|---|---|---|
| Aditya | Data schema, scoring + sequencing engine, integration contract | Claude Max |
| Devesh | Frontend/UX, all screens | Claude Max |
| Ameya | Feature wiring, testing, integration | Cursor / Lovable / Antigravity |
| Aryan | Regulatory research, verification of flagged assumptions | (no coding) |

## Getting started

Clone this repo, run `npm install` then `npm run dev`. Read `docs/SPEC.md` before writing UI code, it defines the exact function signatures P2/P3 build against so nobody blocks on P1.

## Deploy (Vercel)

`vercel.json` pins the build (`npm ci`, `npm run build`, output `dist`). The build is deterministic: a correct deploy serves `assets/index-DOOR6W26.js`. Check it by opening the live site, DevTools -> Network, and confirming that file name. (`verify-deploy.py` is not in this repo; if you still use it, update the expected hash in it to the one above.)
