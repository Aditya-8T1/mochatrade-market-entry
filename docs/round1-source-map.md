# Round 1 source map

Every hardcoded figure in `data/markets.json` and `data/risks.json` traced back to its slide in The Wealth Architects' Round 1 deck, plus what's flagged as needing verification before it's presented as settled fact on demo day.

## Where each data block comes from

| Data | Deck slide |
|---|---|
| 9-market screen, rubric dimensions + weights, all scores | Slide 4 (03 / MARKET, 9-MARKET SCREEN) |
| UAE / Brazil / Indonesia deep dives (routes, product changes, capital, adoption) | Slide 5 (04 / DEEP DIVE) |
| 18-month sequencing, go-gates, "score != sequence" | Slide 6 (05 / ENTRY APPROACH) |
| 4 strategic risks + mitigations | Slide 7 (06 / RISK) |
| One-screen recommendation summary, "if delayed" fallbacks | Slide 8 (07 / RECOMMENDATION) |
| Fact / calculated / assumption / route-requires-confirmation taxonomy, primary sources | Slide 9 (08 / SOURCES) |

## Flagged in the deck itself as not yet settled ("route requires confirmation")

These are the deck's own words, not something this repo invented:

- UAE: US-equities route is "outside VARA's remit -- separate securities-brokerage licence (SCA or DFSA/DIFC). Route requires confirmation."
- Brazil: US-equities route -- "CVM-regulated; local introducing-broker model has precedent. MochaTrade's route requires confirmation."
- Indonesia: crypto route -- "Partner with a licensed physical crypto trader (Pedagang / PAKD)... Partner terms require confirmation." US-equities route also flagged as requiring confirmation.

**P4's highest-value use of remaining time is chasing these three down**, since they're the parts of the pitch most likely to get a follow-up question from judges who read the Round 1 deck closely.

## Things this repo added for Round 2 that are NOT in the Round 1 deck

Tagged `engine_reconstruction` in the data files. Flagging them here too so nobody mistakes them for verbatim Round 1 output:

1. **Weight presets for "regulation-heavy," "market-heavy," "capital-tight."** Slide 4's footnote says the top 3 markets were "held under regulation-heavy, market-heavy and capital-tight weightings" as a stress test, but the deck does not print the actual weight numbers used. The values in `data/markets.json` under `rubric.weight_presets` are a reasonable reconstruction, not the team's real Round 1 numbers. **If anyone kept working notes with the actual stress-test weights, replace these before the demo.**
2. **`adaptation_cost` and `execution_dependency`** are no longer typed-in numbers. They are derived from `entry_facts` -- countable yes/no facts read directly from the deck's deep-dive text (does the product need a rebuild? is the rail only reachable via a partner? how many licensed partners? localisation? partner-fronted onboarding?) -- with the formula printed in `data/markets.json` under `sequencing_derivation` and in `src/engine/sequencing.ts`. With the deck's facts this gives Dubai 1/1, Brazil 3/2, Indonesia 4/5. If a judge asks "how did you turn 'highest execution dependency' into a number", the answer is now "two partners + new language + partner-fronted onboarding = 4, plus 1 = 5", and every input is on the slide. Tagged `calculated`. The lambdas (0.35 / 0.35) remain a reconstruction.
3. **The exact sequencing formula** (`priorityIndex = weightedScore - lambda1*adaptation_cost - lambda2*execution_dependency`) is this repo's construction to operationalize "score != sequence," not a formula from the deck. The deck's own reasoning is qualitative; this repo made it quantitative so the tool can compute rather than just narrate it.

## Also worth a gut-check

- The 6 screened-out markets (Philippines, Nigeria, Pakistan, Thailand, South Africa, Vietnam) are marked "limited evidence, scored conservatively" (†) on slide 4 itself -- the tool should probably surface that caveat rather than presenting their scores with the same confidence as the top 3.
