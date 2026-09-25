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

**213 tests across 13 files, all passing** (as of v2.7.0). Run `npm test`. Test counts quoted in the changelog sections above are the counts at the time of that release.

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

`vercel.json` pins the build (`npm ci`, `npm run build`, output `dist`). The build is deterministic: as of v2.7.0 a correct deploy serves `assets/index-CiQLhcJC.js`. Check it by opening the live site, DevTools -> Network, and confirming that file name. Any code change produces a new name, so after editing, run `npm run build` and update this line with the `index-*.js` name it prints. (`verify-deploy.py` is not in this repo; if you still use it, update the expected hash in it to the one above.)
