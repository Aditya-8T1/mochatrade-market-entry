import type { ReactElement } from "react";
import { RotateCcw } from "lucide-react";
import type { DimensionInfo, DimensionKey, RubricWeights, WeightsProvenance } from "../engine/types";
import { DIM_COLOR } from "./ui/dimensionColors";
import SourceTag from "./ui/SourceTag";

const PRESET_LABEL: Record<string, string> = {
  base: "Base",
  regulation_heavy: "Regulation-heavy",
  market_heavy: "Market-heavy",
  capital_tight: "Capital-tight",
};

interface WeightControlsProps {
  presets: Record<string, RubricWeights>;
  weights: RubricWeights;
  provenance: WeightsProvenance;
  dimensions: DimensionInfo[];
  onPreset: (name: string) => void;
  onDrag: (key: DimensionKey, pct: number) => void;
  onReset: () => void;
}

/** What-if console: 4 named presets plus 5 free faders. Dragging a fader renormalizes all 5 weights to sum to 100 -- the ranking and sequence panels recompute live. */
export default function WeightControls({ presets, weights, provenance, dimensions, onPreset, onDrag, onReset }: WeightControlsProps): ReactElement {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {Object.keys(presets).map((name) => {
          const active = provenance.preset === name;
          return (
            <button
              key={name}
              data-testid={`preset-${name}`}
              onClick={() => onPreset(name)}
              className={`press min-h-[44px] rounded-full border-1.5 px-4 text-[15px] font-bold ${
                active
                  ? "border-ink bg-ink text-white"
                  : "border-rule text-ink-2 hover:border-ink hover:text-ink"
              }`}
            >
              {PRESET_LABEL[name] ?? name}
            </button>
          );
        })}
        <button
          onClick={onReset}
          data-testid="reset-weights"
          title="Reset to Round 1 base weights"
          className="press ml-auto flex min-h-[44px] items-center gap-1.5 rounded-full border-1.5 border-rule px-4 text-[15px] font-bold text-muted transition-colors hover:border-ink hover:text-ink"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <p className="mb-3 text-[15px] leading-snug text-muted">Weights always total 100%: moving one slider rescales the other four. The ranking and entry order recompute as you drag.</p>
      <div className="space-y-3.5">
        {dimensions.map((dim) => {
          const pct = Math.round(weights[dim.key] * 100);
          const color = DIM_COLOR[dim.key];
          return (
            <div key={dim.key}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[14px] text-ink-2" title={dim.definition}>
                  {dim.label}
                </span>
                <span className="text-[14px] tabular" style={{ color }}>
                  {pct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={pct}
                data-testid={`slider-${dim.key}`}
                onChange={(e) => onDrag(dim.key, Number(e.target.value))}
                className="h-2 w-full cursor-pointer rounded-full accent-current"
                style={{ color }}
                aria-label={`${dim.label} weight`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-rule pt-3">
        <SourceTag type={provenance.source_type} compact />
        <span className="text-[14px] text-muted">
          {provenance.preset ? `${PRESET_LABEL[provenance.preset] ?? provenance.preset} weights` : "Custom weights"}
        </span>
      </div>
    </div>
  );
}
