import type { ReactElement } from "react";
import type { RobustnessReport } from "../engine/types";

const PRESET_LABEL: Record<string, string> = {
  base: "Base",
  regulation_heavy: "Regulation-heavy",
  market_heavy: "Market-heavy",
  capital_tight: "Capital-tight",
};

/** Does the recommended order survive the four weighting scenarios? A stable order is a stronger recommendation than any single score. */
export default function RobustnessStrip({ report }: { report: RobustnessReport }): ReactElement {
  return (
    <div data-testid="robustness" className="text-[17px]">
      <p className={`leading-snug ${report.stable ? "text-now" : "text-later"}`}>
        {report.stable
          ? `The entry order is the same under all ${report.presets.length} weighting scenarios tested (three are reconstructions; see Assumptions).`
          : "The entry order changes under at least one weighting scenario — see which positions move below."}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="text-muted">
              <th className="py-1 pr-3 text-left font-normal">Market</th>
              {report.presets.map((p) => (
                <th key={p.name} className="px-2 py-1 text-center font-normal">
                  {PRESET_LABEL[p.name] ?? p.name}
                </th>
              ))}
              <th className="pl-2 py-1 text-right font-normal">Holds</th>
            </tr>
          </thead>
          <tbody>
            {report.perMarket.map((m) => (
              <tr key={m.marketId} className="border-t border-rule">
                <td className="py-1.5 pr-3 font-display text-[17px] text-ink">{m.marketName}</td>
                {report.presets.map((p) => {
                  const pos = m.positions[p.name];
                  const moved = pos !== m.basePosition;
                  return (
                    <td key={p.name} className={`px-2 py-1.5 text-center tabular ${moved ? "text-later" : "text-ink-2"}`}>
                      #{pos}
                    </td>
                  );
                })}
                <td className={`pl-2 py-1.5 text-right tabular ${m.stablePresets === m.totalPresets ? "text-now" : "text-later"}`}>
                  {m.stablePresets}/{m.totalPresets}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
