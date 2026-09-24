// Minimal wiring so the app runs and the engine contract is proven end to
// end. This is NOT the product UI -- P2 owns the real screens in
// src/screens/ and src/components/. Replace this file's contents once
// Dashboard.tsx exists; keep the import pattern (everything through
// `engine`, nothing importing scoring.ts/sequencing.ts directly).

import { engine } from "./engine";

export default function App() {
  const weights = engine.getWeightPresets().base;
  const ranking = engine.rankMarkets(weights);
  const sequence = engine.recommendedSequence(weights);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans">
      <h1 className="text-2xl font-bold mb-1">MochaTrade Market Entry Readiness</h1>
      <p className="text-neutral-400 mb-6">
        Wiring check only -- P2, replace this with src/screens/Dashboard.tsx.
      </p>

      <div className="grid grid-cols-2 gap-8">
        <section>
          <h2 className="font-semibold mb-2">Raw ranking (by screening score)</h2>
          <ol className="list-decimal list-inside space-y-1">
            {ranking.map((r) => (
              <li key={r.market.id}>
                {r.market.name} -- {r.screening.weightedScore.toFixed(1)} / 5
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="font-semibold mb-2">Recommended sequence</h2>
          <ol className="list-decimal list-inside space-y-1">
            {sequence.map((s) => (
              <li key={s.market.id}>
                {s.market.name} -- {s.market.sequence?.window}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <p className="mt-8 text-sm text-amber-400">
        Both lists are currently STUB data (engine/index.ts echoes the deck's
        printed values). Once P1 implements real scoring/sequencing, this
        wiring keeps working with no changes here.
      </p>
    </div>
  );
}
