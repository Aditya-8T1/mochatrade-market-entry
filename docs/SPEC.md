# SPEC -- MochaTrade Market Entry Readiness

Track 1 (Market Entry & Regulatory Strategy), ACM MarketSphere 2026, Round 2.
Team: The Wealth Architects. This document is the contract the team builds against so P1/P2/P3 can work in parallel without blocking each other.

Grounded entirely in the Round 1 deck (slides 3-9) and the official Round 2 build brief. Nothing in here replaces the Round 1 recommendation with a generic assumption -- where the deck doesn't say something, it's flagged, not invented (see "Open questions" at the bottom, and `docs/round1-source-map.md`).

---

## A. Architecture

Client-side only. No backend, no database, no server to keep alive during a live demo.

Four layers:

1. **Data layer** -- `data/markets.json`, `data/risks.json`. Static, versioned in git, the single source of truth for every Round 1 fact/figure. Every field is tagged with a `source_type` (verified_fact / calculated / assumption / route_requires_confirmation / engine_reconstruction) mirroring the deck's own fact-vs-assumption taxonomy from slide 9.
2. **Engine layer** -- `src/engine/`. Pure TypeScript functions with no React and no DOM dependency, fully unit-testable on their own. This is P1's territory. Exposes exactly one entry point: `src/engine/index.ts`.
3. **Hooks layer** -- `src/hooks/`. Thin React wrappers around the engine (selected market, current weights, memoized engine calls). Shared by P2 and P3.
4. **UI layer** -- `src/components/` and `src/screens/`. P2 owns composition and visual design; P3 wires interactivity and tests across all 9 markets.

Rule that keeps P1/P2/P3 from blocking each other: **nobody imports from `src/engine/scoring.ts` or `sequencing.ts` directly.** Everything goes through `src/engine/index.ts`'s `engine` object, which is typed by `src/engine/types.ts`. P1 can rewrite the internals daily without breaking P2/P3's code, as long as the exported shape doesn't change.

## B. Folder structure

```
mochatrade-market-entry/
  README.md
  docs/
    SPEC.md                    <- this file
    round1-source-map.md       <- traceability + open questions
  data/
    markets.json               <- DONE: all 9 markets, rubric, weight presets
    risks.json                 <- DONE: the 4 strategic risks
  src/
    engine/
      types.ts                 <- DONE: the contract
      index.ts                 <- STUB: P1 implements the real math here
      scoring.ts                <- (P1 creates) weighted screening score
      sequencing.ts             <- (P1 creates) adaptation/execution-adjusted sequence
      risks.ts                  <- (P1 creates, optional split) risk lookup
    hooks/
      useEngine.ts              <- (P1/P3) memoized engine access
      useWeights.ts             <- (P1/P3) weight-preset + slider state
      useSelectedMarket.ts       <- (P3) selection state
    components/                 <- (P2) MarketSelector, ScoreCard, RankingVsSequence,
                                    RiskPanel, GoGateTimeline, ComplianceChecklist,
                                    WeightControls -- stubs already scaffolded
    screens/
      Dashboard.tsx              <- (P2) assembles the components above
    App.tsx
    main.tsx
  package.json / vite.config.ts / tailwind.config.js / tsconfig.json
```

## C. Data schema

See `data/markets.json` and `data/risks.json` directly -- they're the schema (JSON is self-documenting here, and every field that isn't a verbatim deck fact carries a `source_type` and often a `_rationale` explaining how it was derived). Summary of the shape:

- **Rubric**: 5 dimensions (market_opportunity 25%, legality 25%, licence 20%, fx_custody 15%, clarity 15%), plus 4 named weight presets (base, regulation_heavy, market_heavy, capital_tight) for the scenario/stress-test feature.
- **Markets**: all 9 screened markets, each with per-dimension 1-5 scores, a `cleared` boolean, and (for the 3 cleared markets only) a `deep_dive` block, a `sequence` block, and `adaptation_cost` / `execution_dependency` scores.
- **Risks**: the 4 cross-cutting risks from slide 7, each tagged with the market ids it applies to.

## D. Engine contracts

Full interface in `src/engine/types.ts`. The eight functions on the `engine` object:

`getAllMarkets`, `getMarket`, `computeScreeningScore`, `rankMarkets`, `recommendedSequence`, `explainDivergence`, `getRisksForMarket`, `getWeightPresets`.

`src/engine/index.ts` currently ships a **stub** -- it returns correctly-shaped data (so P2/P3 can render real screens today) but doesn't recalculate anything; it just echoes the deck's own printed numbers. P1's job is to replace the internals with real math, in the two files below, without changing what's exported.

## E. Scoring vs. sequencing -- kept as two separate modules on purpose

This is the single most important design decision, because the deck is explicit: **SCORE != SEQUENCE** (slide 6). Brazil has the highest raw screening score (3.9) but the deck sequences it *second*; Dubai (3.8) goes *first*; Indonesia (3.6) goes *last*.

- `scoring.ts` -- weighted screening score only. Answers "how strong is this market on the rubric." Adjustable via `weights: RubricWeights`.
- `sequencing.ts` -- takes the screening score plus `adaptation_cost` and `execution_dependency` (both 1-5, in `data/markets.json`, tagged `engine_reconstruction` since the deck states these qualitatively, not numerically) and produces a `priorityIndex` that the recommended entry order is actually sorted by.

**Recommended formula** (tune the lambdas until this reproduces Dubai(1) -> Brazil(2) -> Indonesia(3) against the base weights -- that reproduction is the acceptance test):

```
priorityIndex = weightedScore - (lambda_adaptation_cost * adaptation_cost) - (lambda_execution_dependency * execution_dependency)
```

Starting point in `data/markets.json` under `sequencing_weights`: both lambdas at 0.35. Sort `recommendedSequence()` descending by `priorityIndex`. If it doesn't reproduce the deck's order with these numbers, that's a real signal -- either retune the lambdas or revisit the adaptation_cost/execution_dependency estimates (they're reconstructions, not deck numbers -- see open questions).

`explainDivergence()` is the function that makes this legible on screen: for any market, it should say in one sentence why its raw rank and its sequence rank differ (or that they don't), grounded in the market's own `sequence.rationale` field in the data.

## F. Screens / feature map

1. **Market Selector** -- all 9 markets, cleared vs. screened-out visually distinct, one-line `market_signal` per market.
2. **Scoring Rubric View** -- the 5 dimensions with their weights, per-market breakdown (bar or radar), weight sliders wired to the 4 presets + free adjustment.
3. **Ranking vs. Sequence** (the centerpiece) -- raw ranked list next to the recommended entry sequence, `explainDivergence()` output shown inline. This is the screen that proves the tool understood Round 1, not just displays it.
4. **Market Deep-Dive** -- for the 3 cleared markets: crypto route, equities route, required product changes, capital & licensing, payment rail, main hurdle. For screened-out markets: just `screened_out_reason`.
5. **Risk & Mitigation Panel** -- filtered to the selected market via `getRisksForMarket()`.
6. **Go-Gate & Roadmap Timeline** -- months 0-9 / 6-12 / 12-18, each market's go-gates, and its "if delayed" fallback.
7. **Compliance Adjustment Checklist** -- `required_product_changes` per market, as a checkable list.
8. **Source/confidence tags** -- a small reusable badge (fact / calculated / assumption / route-requires-confirmation), used everywhere a number or claim appears. Small effort, disproportionate credibility with judges who saw your Round 1 deck.

## G. Team split -- what runs in parallel without conflict

| Person | Files they own | Depends on |
|---|---|---|
| P1 (Aditya) | `data/*`, `src/engine/*` | nothing -- starts immediately |
| P2 | `src/components/*`, `src/screens/*` | only `src/engine/index.ts`'s public shape (already stubbed -- starts immediately, doesn't wait for real math) |
| P3 | `src/hooks/*`, wiring inside `src/screens/Dashboard.tsx`, tests | P1's stub (already there) + P2's component shells |
| P4 | `docs/round1-source-map.md`, chasing the "requires confirmation" items | nothing -- starts immediately |

Because the stub in `src/engine/index.ts` already returns real, correctly-shaped data, **P2 and P3 do not have to wait for P1 to finish the real scoring/sequencing math.** P1 swaps stub internals for real logic later without anyone else's code changing. This is what avoids the "P1 and P2 start independently and P2 builds a UI that expects data P1 doesn't provide" failure mode.

## H. First coding milestone

**Milestone 0 (done, this repo):** scaffold, data schema, engine contract + stub, docs.

**Milestone 1 (P1, next):** implement `scoring.ts` and `sequencing.ts` for real; get `recommendedSequence()` to reproduce Dubai -> Brazil -> Indonesia; write a quick script/test asserting that order doesn't regress.

**Milestone 2 (P2/P3, parallel with Milestone 1):** build the 7 screens against the existing stub; swap nothing when P1 ships real logic, since the shape doesn't change.

**Milestone 3:** integration pass (P3), demo script rehearsed against all 9 markets, not just the 3 cleared ones.

## Tech stack

React + Vite + TypeScript + Tailwind CSS. No backend, no database. Rationale: matches what Lovable (P3's tool) natively scaffolds, nothing to deploy or crash on stage, `npm run dev` is the entire demo setup.

## Open questions / needs verification before it's fully hardcoded

See `docs/round1-source-map.md` for the full list with sources. Short version:

- **US-equities route** in all three markets, and **Indonesia's partner terms** -- the deck itself flags these as "route requires confirmation," not settled fact.
- **The exact numbers behind the "regulation-heavy / market-heavy / capital-tight" stress test** slide 4 mentions -- the deck names the three scenarios but doesn't print the weight values. `data/markets.json`'s presets for these are reconstructions (tagged `engine_reconstruction`). If the team has the real working numbers from Round 1, use those instead.
- **`adaptation_cost` / `execution_dependency` numeric scores** (1-5) for Dubai/Brazil/Indonesia -- these don't exist as numbers in the deck, only as qualitative reasoning ("lowest capital," "product rebuild," "highest partner + localisation load"). They were reverse-engineered so `sequencing.ts`'s formula reproduces the deck's own sequence. Worth a 10-minute team gut-check before demo day, since this is the crux of the score-vs-sequence logic a judge is most likely to probe.
