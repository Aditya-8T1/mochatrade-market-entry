# MochaTrade Market Entry Readiness

**ACM MarketSphere 2026 -- Round 2 (Build) -- Track 1: Market Entry & Regulatory Strategy**
Team: **The Wealth Architects** (Aditya Tomar, Aryan Banerjee, Ameya Deshmukh, Devesh Pandey)

## What this is

A working "Market Entry Readiness" tool for MochaTrade (India-focused, INR/UPI-funded US-stock + crypto-perpetuals app). It takes a candidate market and returns a weighted screening score across 5 regulatory dimensions, a raw ranking of all 9 screened markets, and our recommended entry sequence (Dubai to Brazil to Indonesia), which is NOT the same as the raw ranking -- the tool must show why (Round 1's own "score does not equal sequence" finding). It also surfaces risks and mitigations, required compliance/product adjustments per market, go-gates, and an 18-month roadmap with "if delayed" fallbacks per market.

This is Round 2: operationalizing the Round 1 recommendation into something a real MochaTrade ops/legal team could use, not a new pitch.

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
