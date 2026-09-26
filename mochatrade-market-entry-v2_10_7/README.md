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
- Removed the unused `framer-motion` dependency. (111 tests at the time; see "Tests" below for the current count.)

## v2.10.7 — readiness for all 33 markets

The Readiness tab now shows substantive content on every market page, not just the three plan markets.

**Screened-out and shortlist markets** (the 19 listed in this release + the 5 from v2.10.6) get a "watchlist" view: a banner explaining these are steps to track *if and when the blocker lifts*, then a checkable list of what would need to happen first, followed by the same detail rows as the plan-market readiness tabs (Capital & licensing, Local payment rail, Main hurdle, KYC / AML, Crypto route, Equities route). The checklist is persistent per market in localStorage.

Markets added in this release: Mexico, Uruguay, Mauritius, Panama, Georgia, Argentina, Chile, Costa Rica, Ghana, Colombia, Malaysia, Turkey, Oman, Ukraine, Saudi Arabia, Sri Lanka, Morocco, Bangladesh, Egypt.

All content comes from the Round 2 research workbook and is cross-checked against primary sources. Each market's `required_product_changes` is formatted as a checklist of specific steps; `main_hurdle` names the single regulatory event that must happen before entry is possible.

Engine fix: `collectRequiresConfirmation` now returns nothing for screened-out markets — their `route_requires_confirmation` fields are shown on the Readiness watchlist, not as "What we still need to confirm" items on the decision tab.

284 tests, 15 files, all passing.

## v2.10.6 — risks and readiness for every market

**Risks** now appear on every market page, not just the three plan markets.

Three new cross-cutting risks are added to `data/risks.json`, each tagged to the markets where it applies:

- **No Licensed Route Today** (high, 21 markets): tagged to every Do-not-enter market. Shows the specific enforcement trigger — Turkey: "Leveraged trading, derivatives and margin in crypto expressly prohibited (Communiqué III-35/B.1)."; Philippines: "BSP moratorium on new VASP licences; perpetuals have no SEC CASP basis. Actively blocking foreign platforms."
- **Partner / Single Point of Failure** (high, 21 markets): every market where standalone entry is not possible. Each note says which partner track is required and what the backup plan is.
- **Derivatives Product Gap** (medium, 16 markets): every market where the regulatory treatment of retail perpetuals is unconfirmed. Each note says exactly what is needed to resolve it (pre-application meeting, counsel opinion, separate approval track).

The original four deck risks (Regulatory Change, FX / Capital Controls, Licensing + Timeline, Reputational / Enforcement) are unchanged and still tagged to UAE / Brazil / Indonesia only.

**Readiness** tab now has a proper checklist for the five cleared Round 2 shortlist markets: El Salvador, Kazakhstan, Kenya, Bahrain and Peru. `deep_dive` fields (required product changes, KYC/AML, capital & licensing, local payment rail, main hurdle, crypto/equities route) are added to `data/round2-research.json` for each, sourced from the research workbook and re-checked 2026-09-25.

Tests: existing suite updated for the new risk count and coverage — all 284 pass.

## v2.10.5 — a real "Why not now" for every Do-not-enter market

Every screened-out market used to open with a generic line ("Researched in Round 2 and does not clear screening: see why below") and a one-sentence blocker. All 25 researched Do-not-enter markets (6 from Round 1, 19 from Round 2) now carry a written reason in `data/why-not-now.json`:

- **summary** — two or three sentences on why the market fails, naming the law, regulator and date;
- **dimensions** — one entry per rubric dimension that scores 3/5 or below, with the reason for that score. Only the five rubric dimensions are used; nothing outside the rubric is argued, and the notes explain the team's scores without changing any of them;
- **what_would_change** — the one regulatory event that would reopen the market.

Basis: the Round 2 research workbook, re-checked against primary and secondary sources on 25 Sep 2026 (SPK communiqués for Turkey; FSA/CMA for Oman; Verkhovna Rada and EY/Lexology for Ukraine 10225-d; Daily FT and Sunday Times for Sri Lanka's 28 Jul 2026 Cabinet decision; Bank Al-Maghrib / Morocco World News for Bill 42.25; Bangladesh Bank notices; Article 206 of Egypt Law 194/2020; Banxico 4/2019 and CNBV guidance for Mexico). Reserve markets, which had only a one-line reason before, got the most new material.

On screen, the decision tab of these markets reads: **Why not now** (the summary) → **Where it fails the rubric** (each failing dimension with its score bar and note) → **What would have to change**. The engine sets `Decision.whyNotNow` and turns the dimension notes into `Decision.conditions` ("Legality 1/5 — …"), so the compare view and the exported brief carry the same reasoning. The old one-line blocker is no longer repeated under "What could block us". Public-data screens and user-entered markets keep the generated wording (nobody has researched them).

Test: every researched no-go has a file entry, every listed dimension is a rubric key with a score ≤ 3, and no cleared market carries one (284 tests, 15 files).

## v2.10.4 — definition cards and flags

- **Glossary definitions are now a card, not the browser tooltip.** Hovering, focusing or tapping an underlined term (VARA, SPSAV, Pix…) opens a small card below it — the term in bold, the plain-English definition under it — in the site's own type and colours, in the style of a Wikipedia preview. It flips above the term near the bottom of the screen, renders through a portal so nothing clips it, and closes on mouse-out, blur, Escape, scroll or a tap elsewhere. `Term` in `src/components/ui/Glossary.tsx`; the `abbr title` is gone.
- **Country flag on every market page**, at one fixed size (48×36, 4:3) beside the plan number and verdict chip. Flags are the `flag-icons` 4×3 SVGs bundled by Vite — no network call. A market is matched by ISO code: the 33 named markets by id, public-data screens by the `iso3` in `data/public-screen.json` (now carried onto the market as `iso3`), user-entered markets by the `iso3` the country lookup stored. No match, no flag; nothing is guessed. `src/components/ui/Flag.tsx`.

Tests: two added in `round2-research.test.tsx` — every named market and screen resolves to a flag; the card opens on hover and there is no `title` attribute (283 tests, 15 files).

## v2.10.3 — reasons, not positions

- **Favicon** is now the Mochatrade coffee mark (bowl with three rising bars, coral on ink) from `public/favicon.svg`, replacing the old cyan placeholder dot. It is the same `LogoMark` as the wordmark; swap in the official SVG when you have it.

- **"Why it goes first" now says why.** The verdict reason on each plan market led with its position ("First in the entry sequence…"), which is circular. It now leads with the deck's own rationale for that position (`sequence.rationale`: "Only market where retail perpetuals are explicitly legal — the cheapest proof the product works under regulation.") and ends with what that means for spend. `src/engine/decision.ts`.
- **"What we still need to confirm" holds only actions.** Round 1's limited-evidence marker (`evidence_confidence`) and the Round 2 check-against-deck note (`research.deck_check`) were the last two "open items" on every screened-out Round 1 market. They describe the evidence, not a task, so they join the footnotes under "About this data" (`DERIVED_FIELDS`). The section is now hidden on those markets.
- **Risks tab on a screened-out market** no longer repeats the blocker under a "Why this market was screened out" heading; it says there are no cross-cutting risks because the market is not in the plan, and points to the decision tab.
- **Presenting from the welcome page.** Enter, Space and PageDown now start the presentation as well as →, so a clicker works, and the page takes keyboard focus on load (after typing the URL, focus can stay in the address bar, which made → look dead). Enter and Space on a focused link or button keep their normal meaning. The hint reads "Press → or Enter to start."

Tests: three added in `round2-research.test.tsx` (281 tests, 15 files).

## v2.10.2 — judge's pass: no duplicates, no internals in the UI

Three things a judge reading the decision tab cold would trip on, plus one they would ask about.

- **Blockers no longer repeat the conditions.** On Dubai, "Before we launch" (a–d) and "What could block us" listed the same go-gates; on a screened-out market the blocker paragraph appeared twice. `RecommendationSummary` now takes `alreadyListed` (the decision card's conditions) and hides any blocker that repeats one; the section disappears when nothing is left. The engine's `blockers` are unchanged.
- **Derived numbers are footnotes.** "1/5 = 1 + 2×0 (product rebuild) + 0 (rail via partner) = 1" is how a number was built, not something to confirm. `adaptation_cost` / `execution_dependency` (`DERIVED_FIELDS`) now sit under "About this data" with the method notes; "What we still need to confirm" holds only genuine open items.
- **Round 2 signal column.** The market table's Signal for researched markets was the researcher's first flag ("PDF opened is a 2022 version", "BCU page did not open (certificate error)"). `round2Signal()` in `src/engine/index.ts` now builds it from the licensing regime and payment rail ("CBB Crypto-Asset Module · Fawri+/Benefit"), the same shape as the Round 1 signals. Flags stay on the Research tab. Reserve markets keep the reserve sheet's reason.
- **When a public-data screen out-scores a plan market** (type "Portugal": 3.7, above Indonesia's 3.6), the shortlist reason now says so and says why it does not move into the plan: the tracker cannot see crypto derivatives or retail leverage, so the score is not comparable until researched.

Tests: `edge-cases` checks blockers appear exactly once on the decision tab; `round2-research` adds the signal and footnote checks (278 tests, 15 files).

## v2.10.1 — method notes are not open items

The engine attaches three general notes as "assumptions" to every market they apply to:
- the Round 2 workbook source note (`round2_research`);
- the regulatory knock-out rule (`knockout_rule`);
- the sequencing formula (`sequencing_formula`).

They describe the method, not the market, but they appeared under "What we still need to confirm" on every Round 2 page. For Mexico and the other screened-out Round 2 markets, they were the whole list.

`RecommendationSummary` now sorts by field (`METHOD_FIELDS`). These three notes show as small footnotes under "About this data", and "What we still need to confirm" lists only that market's genuine open items. The section is hidden when there are none. The engine is unchanged, and every statement is still shown verbatim on the same tab.

The Research notes legend now matches the workbook's own tag definitions and names the variants used in the data (`[V-primary]`, `[V-news]`). `[V-draft]` is coloured amber like `[A]` rather than verified green.

Test: `round2-research.test.tsx` checks every Round 2 market (276 tests, 15 files).

## v2.10.0 — depth, motion and touch

Motion and depth are added only where they explain something: what is raised, what can be pressed, and what just changed. Every animation collapses to instant under `prefers-reduced-motion`.

**Depth.** There is a warm-tinted elevation scale in `tailwind.config.js`: `shadow-card` for cards at rest, `shadow-lift` for hover, `shadow-float` for dropdowns, dialogs, the compare bar and the band card, and `shadow-btn` / `shadow-btn-hover` for the primary button (a coral glow with an inner highlight). The header gains a shadow once the page scrolls, and the "Try other weights" card on How we decided stays pinned while you read the rubric.

**Touch and press.** Utilities in `src/index.css`:
- `.press` makes an element dip slightly (1px down, 98% scale) under a finger or cursor.
- `.lift` and `.row-card` raise an element on hover, but only on devices that can hover (`@media (hover: hover)`), so taps never leave a stuck hover state.
- There is no grey tap flash and no double-tap zoom delay on anything tappable. All targets stay at least 44px.

Where it's used:
- **Buttons:** primary, secondary and small buttons get `.press` and `.lift` (secondary and small add the quiet shadow).
- **Pills and chips:** the filter and preset pills, and the compare chips.
- **Lists:** checklist rows, risk rows and compare-picker rows.
- **Raised cards on hover:** plan rows, guide rows and previous/next market become raised cards, with an arrow that nudges forward.

**Pixel band** (`src/components/ui/PixelBand.tsx`). With a mouse, hovering a column spotlights it: the other columns step back, and a floating card shows the country, its score and its verdict. Clicking opens the market. On touch, the first tap previews and a tap on the card opens the market; tapping elsewhere dismisses it. Each column has a full-height invisible hit area, so the gaps between pixels are still tappable. Near a screen edge the card anchors to that edge.

**Motion.**
- **Title page:** it loads as one sequence. The kicker, both headline lines, the paragraph and the buttons rise in order, then the band's columns grow.
- **Page and tab changes:** a new page eases in, and each tab's content fades in. The tab underline slides to the active tab.
- **Floating layers:** the search results pop in, the compare bar slides up, and the "Score a new market" dialog rises over a fading, lightly blurred scrim.
- **Bars:** score and risk bars grow from zero on first paint.

**Fixes found on the way.**
- **Dialog:** "Score a new market" could open with its top cut off when it was taller than the screen; it now scrolls from the top.
- **Portals:** the dialog and the compare bar render through a portal to `<body>`, so page transitions never shift them.
- **Dialog styling:** its old styling (square corners, small buttons) now matches the rest of the site.

Tests: `routing.test.tsx` adds band hover and click, and touch preview-then-open (275 tests, 15 files).

## v2.9.3 — a light title page

The title page (`#/`) now uses the same light palette as every other page, so the site no longer switches from dark to light. The v2.9.2 layout, wordmark, headline and pixel band stay, recoloured for the light background:

- The headline's first line is `ink` and the second is `coral-strong` #B8471F (5.0:1 on the page background).
- In the pixel band, plan markets are rust #C0553A, the shortlist is a pale rust tint, and the rest are the `rule` colour.
- The dark nav variant, the `.on-night` CSS and the cover-only colour tokens (`night`, `cream`, `peach`, `fog`, `smoke`, `rust`) are removed. `tailwind.config.js` is back to the single light palette.

## v2.9.2 — brand cover and logo

The welcome page (`#/`) is now a dark cover in the Mochatrade brand style, built to open a presentation. Every other page stays light.

- **Brand colours** come from the brand image and exist as tokens in `tailwind.config.js`, used on the cover only: `night` #0B0908, `cream` #F1F0EF, `peach` #FFDED2, `fog` #C6C5C2, `smoke` #8B8A87, `rust` #C0553A.
- **Headline**: "Where should MochaTrade go next?", set in Fraunces at a text optical size (`opsz` 36, `SOFT` 0) to match the brand's calmer serif. The first line is cream and the second peach, as in the brand image.
- **Pixel band** (`src/components/ui/PixelBand.tsx`): the brand's pixel strip, rebuilt from the engine's data. There is one column per scored market in rank order, and column height is its screening score. Plan markets are lit rust, the shortlist is dim, and the rest are embers. Hovering a column shows the market, its score and its verdict. The columns rise once on load, and reduced motion is respected. Phones get a one-pixel-wide version.
- **Presenting**: pressing → on the cover goes to the plan. The shortcut is ignored while typing.
- **Logo**: the wordmark is now the Mochatrade logo style on every page: a bowl with three rising bars, "Mocha" in Karla and "trade" in italic Fraunces (`@fontsource-variable/fraunces/full-italic.css`). The bowl is a hand-drawn stand-in (`LogoMark` in `src/pages/Layout.tsx`); replace it with the official SVG when you have it.
- **Nav**: dark on the cover, light everywhere else.

## v2.9.1 — a welcome page

Home is now a welcome screen instead of the answer. It shows what MochaTrade is, the question ("Where should we go next?"), how many countries were scored, and one way in: "See the plan", with a quieter "or check a country". Below the fold, "Finding your way around" (`#/#how`) points to the plan, any market, and how we decided. That guide replaces the pop-up intro, so `IntroOverlay` and the intro state in `AppState` are gone; the help icon now links to `#/#how`.

| Route | Page |
|---|---|
| `#/` | Welcome (`src/pages/Home.tsx`). No market data. |
| `#/plan` | The plan (`src/pages/PlanPage.tsx`): the engine-built headline, numbered plan, "Open <#1>", "Why isn't the top scorer first?", and the country search. |
| `#/markets` | All markets (`src/pages/MarketsPage.tsx`): search, filters, the market table, compare ticks and bar, "Score a new market". |
| `#/market/:id[/:tab]`, `#/compare`, `#/method` | Unchanged from v2.9.0. The market page's back link now goes to `#/markets`. |

The nav reads Home · The plan · Markets · Compare · How we decided; "Markets" stays active on market pages. `src/pages/shared.tsx` holds what the plan and markets pages share (`useDecisions`, `useAddMarket`, `Finder`). In the tests, `renderApp()` now starts at `#/markets`, `planOrder()` and `queueOrder()` go to their own page when needed, and `routing.test.tsx` adds a welcome test and a help-link test (271 tests, 15 files).

## v2.9.0 — multi-page, light design

The single dark dashboard is now a small multi-page site in a light "magazine-lite" design. Layout, navigation and visuals only: the engine, data, data providers and scripts are untouched, and every number, verdict and label on screen still comes from `engine`.

### Routes

Hash routes, so they work on Vercel's static output with no rewrites (`vercel.json` is unchanged).

| Route | Page | What it shows |
|---|---|---|
| `#/` | Home (`src/pages/Home.tsx`) | The answer: headline built from `engine.recommendedSequence`, the numbered plan, "Check any other country" (MarketFinder), and the all-markets table (`#/#all`) with filters and compare ticks. Intro overlay appears here only. |
| `#/market/:id` and `#/market/:id/:tab` | Market page (`src/pages/MarketPage.tsx`) | Header (plan number, verdict chip, name, badges, entry approach) and tabs: `decision` (default), `scores`, `risks`, `readiness`, `research` (only when the market has research). Sidebar: regulatory risk, score and rank, download the brief, add to compare. Previous and next market in rank order. An unknown id shows "We couldn't find that market". |
| `#/compare` | Compare (`src/pages/ComparePage.tsx`) | CompareView for 2–3 markets; with fewer, a search-and-tick picker. Column headers link to market pages. |
| `#/method` | How we decided (`src/pages/MethodPage.tsx`) | Anchored sections: `#rubric` (dimensions, weights, WeightControls), `#order` (RankingVsSequence and the full 18-month GoGateTimeline), `#robustness`, `#data`. |

An unknown route shows a not-found page. Back and forward work, a new page scrolls to the top and moves focus to `<main>`, anchors scroll to their section, and switching tabs on the same market keeps the scroll position.

### What lives where

- `src/router.tsx`: the router (no library). `useRoute()` returns `{ hash, segments, path, anchor }`. `<Link to>` renders a real `<a href>`. `navigate(to)` sets `location.hash` and notifies subscribers synchronously, while `hashchange` still drives back/forward and typed URLs. `marketHref(id, tab?)` builds market URLs.
- `src/state/AppState.tsx`: `AppStateProvider` wraps the existing `useMarketEntry()` (which owns `useWeights` and `useCustomMarkets`) plus the intro flag, so weights, user and public-screen markets and the compare selection are shared across pages. `useAppState()` reads it. All localStorage keys are unchanged (`mochatrade.customMarkets.v1`, `mochatrade.checklist.v1`, `mochatrade.introSeen.v1`).
- `src/pages/Layout.tsx`: the top nav (wordmark, four links with an active underline, help and print icon buttons, and a menu button under 768px) and `PageFrame`, which sets the 1280px width and 80px side padding.
- `src/components/ui/verdict.tsx`: `VerdictChip`, `OutlineChip`, verdict and risk-band colours, `fmtWindow` (display only: "Months 0-9" becomes "months 0–9") and the shared button and input classes.
- `DecisionCard.tsx` now also exports `RiskScoreCard`, the sidebar risk readout, which keeps the `risk-score-panel` test id. `ScoreCard.tsx` exports `scoreMatchLine()`, so the sidebar and the scorecard share the "matches Round 1 deck / research sheet" logic.
- `src/screens/Dashboard.tsx` is deleted.

### Design tokens (`tailwind.config.js`, the only palette)

| Token | Value | Use |
|---|---|---|
| `canvas` / `surface` / `surface-2` | `#FBF8F2` / `#FFFFFF` / `#F4EFE6` | page / cards / subtle fills and tracks |
| `ink` / `ink-2` / `muted` / `rule` | `#1C1A17` / `#4A453E` / `#6B645A` / `#E4DDD0` | text / secondary text / captions / borders |
| `coral` | `#E0663A` | decorative only: wordmark, list letters, underlines |
| `coral-strong` | `#B8471F` | primary button fill (white text) and links |
| `now` `next` `later` `short` `no` (+ `-tint`) | `#1E7A4C` `#1F5FA8` `#9A4A16` `#8A5A00` `#B42318` | verdict text on its tint; risk bands reuse now/later/no |
| `plum`, `teal` | `#7A4FB0`, `#4A7A8C` | dimension colours (with next/now/later), see `ui/dimensionColors.ts` |

Type: Fraunces (display, `SOFT` 100, `WONK` 1 on H1 only) and Karla (body and UI, 17px base). Both are self-hosted through `@fontsource-variable/fraunces` and `@fontsource/karla`; Space Grotesk and IBM Plex Mono are removed. The Fraunces package's `full.css` was checked against the font's `fvar` table: it carries `opsz`, `wght`, `SOFT` (0–100) and `WONK` (0–1). Radii are 14px (buttons and inputs), 20px (cards) and 10px (chips). Focus is a 2px ink outline with a 2px offset. The highlighter (`.hl`, green `.hl-now` in "Enter now" contexts) is the only gradient.

### Tests

`src/test/harness.tsx` renders the real `<App />` at a hash (`renderApp`), navigates (`go`), and reads Home's table and plan order. Every suite that rendered `<Dashboard />` now drives the app page by page with the same engine-derived assertions. `src/test/routing.test.tsx` covers routes, tabs, the research tab, not-found, weights shared across pages, compare shared across pages, keyboard tabs and back navigation.

## v2.8.1 — a specific "why screened out" for every market

- Every screened-out market now states its own reason instead of a shared template. `regulatoryBlocker(scores, detail)` takes the country's evidence: the reserve sheet's reason or the researcher's flags for Round 2 markets, and the tracker's own words for public-data screens (e.g. China: status "General ban", licensing rule absent). A below-threshold Round 2 market names its weakest dimension plus its flags (e.g. Mauritius: Market Opportunity 1/5, a licensing hub rather than a user market).
- The knock-out rule itself is stated once, under Assumptions ("Regulatory knock-out rule"), instead of being repeated in every reason.
- A test checks that all screened-out reasons are distinct. 255 tests.

## v2.8.0 — Round 2 market research (24 new markets)

- **Data.** The research workbook is imported by `scripts/import-round2-research.py` (needs `pip install openpyxl`) into `data/round2-research.json`. The source `.xlsx` is kept in `data/source/`. To update the data, edit the workbook, re-run the script and commit both files.
- **24 new markets:** 16 additional plus 8 screened-out reserve, scored on the Round 1 rubric (25/25/20/15/15). Every workbook score and priority index is reproduced by the engine (tested). Each clears at base weights only if score ≥ 3.0 **and** it passes the regulatory knock-out. Five clear: El Salvador, Kazakhstan, Kenya, Bahrain, Peru. Mexico scores exactly 3.0 but legality is 2, so it is screened out.
- **Round 2 markets are ranked, never sequenced.** The workbook has no entry route, timing or go-gates, so the 18-month plan stays UAE → Brazil → Indonesia under every preset (tested). A cleared Round 2 market gets **Shortlist, research first**. Its decision states an indicative entry priority on the same formula as the sequence: all five cleared markets score above Indonesia (El Salvador 1.65 vs 0.47). This is flagged as a signal for the team, not a sequence position, because the Round 2 adaptation / execution ratings are the researcher's, not derived from entry facts.
- **Round 1 screened-out markets** (Philippines, Nigeria, Pakistan, Thailand, South Africa, Vietnam) show the research notes and the workbook's "check vs PPT" findings **next to** the deck text. Deck scores and wording are unchanged (tested).
- **UI.** New "Round 2 research" panel: licensing, rail, KYC, product changes, researched adaptation / execution, open flags and source links, with the [V] / [A] / [D] evidence tags colour-coded. The market list has a "Round 2 research" group. The decision card carries an "R2 research" badge, and cleared ones show a "Round 2 shortlist" badge in the sidebar. The scorecard says "matches research sheet". Compare and Export brief include the research. Searching a researched country (e.g. Mexico) opens the researched market, not a public-data screen, and a screen saved earlier for that country is dropped on load.
- **Tests.** `round1Engine` (the nine deck markets only) is exported. The Round 1 acceptance suite and the UI mechanics tests (screens, user entries, which use Kenya) run on it so they do not depend on which countries are researched. `src/test/round2-research.test.tsx` covers the new data end to end. 254 tests.

## v2.7.0 — review fixes (verdicts, knock-out, rounding, mitigations)

- **"Shortlist, research first" verdict.** A public-data screen that clears the threshold used to read "Enter next" -- an entry verdict for a market nobody has researched. It now gets its own verdict, `shortlist` (orange). Screens never get an entry verdict. `src/engine/decision.ts`.
- **Regulatory knock-out.** `regulatoryBlocker()` screens out any public-data or user-entered market with legality ≤ 2 or licence ≤ 1, whatever its weighted score. Before this, Mexico ("Partial ban", legality 2, licence 1) cleared 3.0 on market opportunity alone and read "Enter next", while Philippines with near-identical regulatory scores read "Do not enter". The rule is consistent with Round 1: every screened market with legality ≤ 2 or licence ≤ 1 was screened out, and the three cleared markets have legality ≥ 3.5 and licence ≥ 3, so the entry order is unchanged under all presets.
- **Added markets are grouped.** Public-data screens and user entries sit below an "Added in this tool" divider in the market list. Only sequenced markets get the green bar.
- **Half-up score display.** `formatScore()` replaces `toFixed(1)` for every screening score. `(2.05).toFixed(1)` is "2.0" in JavaScript, so South Africa showed 2.0 against the deck's 2.1 while claiming "matches Round 1 deck". All nine markets now display their deck score exactly (tested).
- **Market-specific mitigations.** `mitigation_notes` in `data/risks.json` scope each deck mitigation to one market. Dubai no longer shows Pix, QRIS or "partners in Brazil and Indonesia". The deck text stays verbatim in `mitigation`, which is still the fallback. The deck's fallback now reads "Fallback if delayed: …" instead of posing as a mitigation.
- **Clean checklist items.** `required_product_changes` rewritten so each `;`-separated item is one task ("suitability onboarding. Less revenue per user…" was a fragment). The commentary moved to Dubai's `commercial_adoption`.
- **Less repetition.** No duplicated market name in the divergence explanations. Indonesia's hurdle dedupes against its go-gate. A screened-out market states its reason once, not five times.
- **Robustness wording** says "4 weighting scenarios tested (three are reconstructions)" instead of claiming the order "does not depend" on weighting.
- **Mobile.** The finder and decision card come before the market list on small screens.
- +6 tests in `src/test/review-fixes.test.tsx`. 7 existing assertions updated for the intended changes.

## v2.6.6 — KYC/AML, risk-score formula, lambda robustness

- **KYC / AML** is now a field on each cleared market's deep dive (`deep_dive.kyc_aml`, tagged `assumption` until Aryan verifies against the rulebooks). It appears as a row in the readiness checklist and the compare table, as a `KYC/AML:` item in the decision card's product-and-compliance list, and in the exported brief. The build brief names KYC/AML as an example rubric dimension; it is treated here as a launch condition every market must meet, not a differentiating score.
- **Risk score explained on screen**: hover the 0-100 number for the formula `(5 − weighted mean of the four regulatory dimensions) ÷ 4 × 100` and the band cut-offs.
- **Lambda robustness**: `lambdaRangeForSequence()` in `src/engine/sequencing.ts` computes the range of penalty weight over which the entry order holds; the ranking-vs-sequence panel prints it. With the deck's facts the Dubai → Brazil → Indonesia order holds for any weight above ≈0.05 (engine scores; ≈0.03 with the deck's rounded 3.8/3.9/3.6), so 0.35 is a display choice, not a tuned number. (+2 tests.)
- `package.json` version now tracks the changelog.

## v2.5 — verdict wording fix (v2.6.5)

- A Round 1 screened-out market (e.g. Philippines) could score above the 3.0 clear threshold under the Market-heavy preset (3.05) while the decision card still said "Did not clear the screening threshold". The verdict was right, the wording was not: Round 1 excluded these markets on named regulatory blockers, not on score. The card now says "Screened out in Round 1 on a regulatory blocker, not on score alone, so reweighting the rubric does not reopen it." User-entered markets keep the threshold wording ("at base weights"). Change is in `src/engine/decision.ts`.

## Public-data screen (v2.6)

Typing a country that is in neither Round 1 nor your own entries no longer returns blank sliders: if the country is covered by two public datasets, the market finder offers it as a **public-data screen** (orange tag) ahead of "Score X as a new market". Picking it adds a pre-screened market with coarse 1-5 bands on all five rubric dimensions, a prominent banner, and the verdict **Shortlist, research first** (or **Do not enter now** if it hits the regulatory knock-out). It is ranked, never sequenced, and it is a **screen, not a decision** -- it is never presented as equivalent to the nine Round 1 markets.

### What it can and cannot tell you

| Dimension | Source | Can tell you | Cannot tell you |
|---|---|---|---|
| Legality | Atlantic Council tracker | whether crypto is legal / partially banned / banned, and whether a licensing rule exists | anything about crypto **derivatives**, perpetuals or retail leverage -- so it is **never 5** |
| Licence | Atlantic Council tracker | whether a licensing rule exists | the licence **burden** (capital, local entity) -- so it is **never above 3** |
| Clarity | Atlantic Council tracker | how many of the four rule types (tax, AML/CFT, consumer protection, licensing) exist | whether a usable filing path exists today -- **never 5** |
| FX / custody | Chinn-Ito KAOPEN (`ka_open`) | capital-account openness | self-custody rules |
| Market opportunity | not in the file | filled live at runtime by the existing World Bank provider + `suggestMarketOpportunity()`; a declared neutral 3 placeholder if no indicator data exists | -- |

**Tracker-only countries (Taiwan, Serbia).** A jurisdiction that is in the Atlantic Council tracker but has no usable Chinn-Ito value (Taiwan is not in the index; Serbia is listed with `ka_open` blank in every year) cannot be screened, because fx_custody would be a guess -- but it must not vanish either. It is kept in the file under `unavailable`, shown in the finder as "public-data screen unavailable -- no capital-controls data", and selecting it opens "Score a new market" with legality, licence and clarity prefilled from the tracker and FX / custody left at its default for you to set.

No entry route, payment rail or partner has been researched for a screened country, so it has no deep dive, no entry facts and no sequence position. The decision card, the compare view, the market list, the Assumptions panel ("Public-data screen", with one evidence line per dimension naming dataset, raw value and year/edition) and the exported brief all say so.

"Score a new market" also uses the screen: when the typed country is covered, all five sliders are prefilled and each is marked "public-data screen" with its evidence line. Your edits always win, and a hand-scored market with the same name replaces the screen entry.

### Band mapping (`src/data-provider/publicScreenBands.ts`, unit-tested)

- **legality**: General ban -> 1; Partial ban -> 2; Legal without a licensing rule -> 3; Legal with a licensing rule -> 4. Never 5.
- **licence**: Legal + licensing rule -> 3; Legal, no licensing rule -> 2; any ban -> 1. Never above 3.
- **clarity**: count of the four rule flags present: 0 -> 1, 1 -> 2, 2 -> 3, 3-4 -> 4. Never 5.
- **fx_custody**: Chinn-Ito `ka_open` is a stepped index, not a continuum -- in the 2023 file 84% of countries sit on four levels (0.00, 0.16, 0.42, 0.70, 1.00) and the 64 screened countries on nine. The mapping is therefore an explicit level lookup, calibrated on the nine Round 1 markets (`src/data-provider/test/publicScreenBands.test.ts`): **0.00 -> 1; 0.16, 0.22, 0.30 -> 2; 0.42 -> 2; 0.45-0.69 (incl. 0.446) -> 3; 0.70-0.89 -> 4; 1.00 -> 5.** With this lookup every one of the nine lands within one point of its deck fx_custody score (total |error| 4; the brief's range mapping scored 6 and put Brazil two points off). 0.42 maps to 2 because Indonesia and Thailand (deck 2) and Vietnam (deck 1) all sit on that level; 3 would have cost three more points. Band 3 is reached only by the 0.45-0.69 levels (Philippines and two screened countries), so it is rare but not unused. A country with no usable Chinn-Ito value is **not screened** (nothing is guessed) -- see the next paragraph.
- **market_opportunity**: `null` in the file; filled at runtime.

Every score carries `source_type: "calculated"`.

### Refreshing the datasets

1. Export the two files into `data/public/` (git-ignored, on purpose -- see "Current state" below; see also `data/public/README.md`):
   - `atlantic-council-tracker.csv` -- [Atlantic Council Cryptocurrency Regulation Tracker](https://www.atlanticcouncil.org/programs/geoeconomics-center/cryptoregulationtracker/). Expected: a country name column, an ISO code column if present, a legal-status column (Legal / Partial ban / General ban) and yes/no columns for Tax, AML/CFT, Consumer protection and Licensing rules. Column names are auto-detected and legal-status values are matched case-insensitively ("Partial Ban" and "Partial ban" are the same); a blank yes/no cell is treated as "No" for the clarity count; other columns are ignored.
   - `chinn-ito.csv` -- [Chinn-Ito capital account openness index](https://web.pdx.edu/~ito/Chinn-Ito_website.htm), the Excel file (`kaopen_2023.xls`, 181 countries, 1970-2023) saved as CSV. Header names vary by edition (the 2023 file is `cn, ccode, country_name, year, kaopen, ka_open`, where `ccode` is the ISO3 and `cn` a numeric code), so the script identifies the name, ISO3, year and `ka_open` columns from their contents. The latest year per country and the 0-1 normalised `ka_open` column are used.
2. Run `npx tsx scripts/build-public-screen.ts --tracker-edition "<edition/year>"` (add `--dry-run` to print instead of write). It joins on ISO3 when both files carry one, otherwise on a normalised country name, logs every unmatched or dropped row to stderr, excludes the nine Round 1 markets in `data/markets.json` (they keep their researched scores) and writes `data/public-screen.json`.
3. Commit the generated JSON. It is bundled statically -- there are no new runtime network calls.

**Current state of this repo:** `data/public-screen.json` was generated on 2026-09-25 from the Atlantic Council tracker (Sept 2026 edition, 75 jurisdictions) and Chinn-Ito KAOPEN 2023 (181 countries): **64 countries screened**, the 9 Round 1 markets excluded, 2 kept as tracker-only prefills (Taiwan, Serbia). The two input CSVs are deliberately not committed (`data/public/` is git-ignored): the Atlantic Council tracker is published "all rights reserved", so redistributing the raw export is doubtful, and the generated JSON is what the app needs. To rebuild the screen from a fresh clone, export both datasets again as described above. Do not quote a "how many clear the threshold" figure from this file: market opportunity is filled live per country, so any such count is illustrative at best -- computed with a neutral market-opportunity placeholder, before live World Bank data. One line for the demo: the tracker rates the Philippines and Nigeria "Legal" with all four rule flags -- the same profile as the UK or Germany -- while Round 1 screened both out (licensing moratorium; rules in draft), which is the clearest example of why this is a shortlist signal and not a decision. The pipeline is tested end to end against the fixture pair in `src/test/fixtures/public-screen/` (fixture values are illustrative, not real country data).

## v2.5 — country in, decision out

- **Market finder** (`src/components/MarketFinder.tsx`) is now the first thing in the main column: type a country, see each match with its verdict, Enter to select. Aliases work ("dubai" → Dubai (UAE)). A name not in the list offers "Score X as a new market" and opens the form with the name filled in, which triggers the public-data lookup. This is the brief's literal contract -- candidate country in, decision out -- as the front door rather than a sidebar.
- **Export brief** (`src/export/brief.ts`) downloads the selected market as a one-page Markdown file: decision and reason, entry approach, when, risk score, conditions before launch, product and compliance changes as a checklist, routes and licensing (with "route requires confirmation" flags), risks with mitigations, assumptions and open items, if-delayed. Something a legal or ops team can paste into a ticket.
- +7 tests at the time: finder behaviour through the real Dashboard, brief content, download trigger (155 total then).

## v2.4 — public data behind "Score a new market"

Typing a country name now looks it up (debounced) and pre-fills what public data can answer, so the form starts from evidence rather than from 3s:

- **REST Countries v5** (`src/data-provider/countryProvider.ts`, API key in `VITE_RESTCOUNTRIES_KEY`; the key must allow the site hostname under CORS origins) → currency, official languages, population. Currency is carried onto the market so the FX row works for user-entered markets; "localisation required" is ticked when English is not official.
- **World Bank Indicators API** (`src/data-provider/worldBankProvider.ts`, no key) → population, GDP per capita, internet users %. `marketOpportunity.ts` turns these into a *suggested* market-opportunity score (reach = population × internet %, plus spending power), shown with its formula and tagged `calculated`. Calibrated so all nine Round 1 markets land within one point of their deck scores (tested).
- Both follow the FX pattern: live → validate → static snapshot tagged `fallback` → null. The lookup never overwrites a value the user has set by hand ("use 2.5" restores the suggestion). A country in neither source shows "score it by hand" and the form works as before.
- Provenance (`country_facts`) is stored on the market and appears under Assumptions as "Country data".
- +14 tests at the time: 11 provider/calibration, 3 integration through the real Dashboard with `fetch` routed per host (148 total then).

Note: REST Countries retired v1–v4 in 2026 (`/v3.1` now redirects to a deprecation notice), so the provider uses v5 (`GET https://api.restcountries.com/countries/v5?q=…&response_fields=…`, bearer key). Without a key, or if the key does not allow the page's hostname, lookups fall back to the static snapshot. Check once on the deployed site: type "Kenya" and confirm the status reads `LIVE WB:LIVE`, not `SNAPSHOT`.

## Final pass (pre-submission)

- **Verdicts now discriminate.** Every cleared market used to read "Go, with conditions". The verdict is now stage-based and comes with a one-line reason: **Enter now** (Dubai, #1), **Enter next** (Brazil, #2 -- file while Dubai builds), **Enter later** (Indonesia, #3), **Do not enter now** (screened out). A #1 market whose crypto-derivatives route is still unconfirmed (e.g. any user-entered market) is capped at "Enter next".
- **Deck precision everywhere.** Divergence text and compare view show scores to one decimal (3.9 / 3.8 / 3.6), matching Round 1, and no longer print raw penalty / priority-index arithmetic that could not add up after rounding.
- **Priority index made visual.** A "score, minus the cost of getting in" bar per market under the slopegraph: the screening score on a 0-5 track with the adaptation and execution penalties hatched off the end. Exact figures on hover.
- **Legibility.** All small text stepped up one size (10px labels -> 11px, 11 -> 12, etc.); faint text colour raised from #5E6C7A (3.6:1) to #7C8A98 (5.5:1) to pass WCAG AA on the dark background.
- **FX row earns its place.** It now converts the capital requirement each market cites into dollars (AED 800k, Rp100bn) at the live or fallback rate.
- (134 tests at the time.)

## Source of truth

See `docs/SPEC.md` for architecture, data schema, engine contracts, screen map, team split and milestones. See `docs/round1-source-map.md` for every hardcoded figure traced back to its Round 1 slide/source, plus what still needs verification. The Round 1 deck and the official Round 2 build brief are not committed here, ask Aditya if you need them re-shared.

## Tests

**284 tests across 15 files, all passing** (as of v2.10.7). Run `npm test`. Test counts quoted in the changelog sections above are the counts at the time of that release.

## Stack

React + Vite + TypeScript + Tailwind. No backend: scoring, sequencing and decisions are computed client-side from static data in `data/` (`markets.json`, `risks.json`, `public-screen.json`). The only network calls are browser-side requests to free public APIs (REST Countries v5 with a free-tier key, World Bank, jsDelivr FX), each with a static fallback, so the tool still works offline.

## Team split

| Person | Owns | Tools |
|---|---|---|
| Aditya | Data schema, scoring + sequencing engine, integration contract | Claude Max |
| Devesh | Frontend/UX, all screens | Claude Max |
| Ameya | Feature wiring, testing, integration | Cursor / Lovable / Antigravity |
| Aryan | Regulatory research, verification of flagged assumptions | (no coding) |

## Getting started

Clone this repo, run `npm install` then `npm run dev`. Node 20-24 LTS is what the toolchain is tested on; Node 25+ ships a global `localStorage` that is undefined without `--localstorage-file`, which hides jsdom's -- `src/test/setup.ts` installs an in-memory Storage in that case so `npm test` still runs there. Read `docs/SPEC.md` before writing UI code, it defines the exact function signatures P2/P3 build against so nobody blocks on P1.

## Deploy (Vercel)

`vercel.json` pins the build (`npm ci`, `npm run build`, output `dist`). The build is deterministic for a given code + `VITE_RESTCOUNTRIES_KEY` value: the key is compiled into the bundle, so the file name on Vercel (key set) differs from a local build without it (v2.8.0 without the key: `assets/index-DLaZRiWO.js`). To check a deploy, open the live site, DevTools -> Network, and confirm the `index-*.js` name matches the latest Vercel build log. (`verify-deploy.py` is not in this repo; if you still use it, update the expected hash in it to the one above.)
