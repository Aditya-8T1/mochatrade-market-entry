// Minimal wiring so the app runs and the engine contract is proven end to
// end -- real scoring/sequencing, no hardcoded values. This is NOT the
// product UI -- P2 owns the real screens in src/screens/ and
// src/components/. Replace this file's contents once Dashboard.tsx is
// built; keep the import pattern (everything through useEngine()/`engine`,
// nothing importing scoring.ts/sequencing.ts directly).

import { useState } from "react";
import { useEngine } from "./hooks/useEngine";

export default function App() {
  const engine = useEngine();
  const weights = engine.getWeightPresets().base;
  const markets = engine.getAllMarkets();
  const ranking = engine.rankMarkets(weights);
  const sequence = engine.recommendedSequence(weights);

  const [selectedId, setSelectedId] = useState(sequence[0]?.market.id ?? markets[0].id);
  const selected = engine.getMarketRecommendation(selectedId, weights);

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

      <section className="mt-10">
        <h2 className="font-semibold mb-2">Selected market</h2>
        <select
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 mb-4"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {selected && (
          <div className="space-y-1 text-sm">
            <p>
              Weighted score: <strong>{selected.score.weightedScore.toFixed(2)} / 5</strong>
            </p>
            <p>
              Raw rank: <strong>#{selected.rawRank}</strong> of {markets.length}
            </p>
            <p>
              Strategic sequence position:{" "}
              <strong>{selected.sequencePosition ? `#${selected.sequencePosition}` : "not sequenced"}</strong>
            </p>
            <ul className="mt-2 list-disc list-inside">
              {selected.breakdown.map((d) => (
                <li key={d.key}>
                  {d.label}: {d.raw}/5 (weight {(d.weight * 100).toFixed(0)}%, contributes {d.contribution.toFixed(2)})
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="mt-8 text-sm text-amber-400">
        Both lists come from the real P1 engine (src/engine) -- nothing here is
        hardcoded. This is a wiring shell, not the product UI.
      </p>
    </div>
  );
}
