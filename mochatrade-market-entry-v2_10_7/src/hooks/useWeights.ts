// P3 integration hook: owns the weight/preset UI state and turns raw slider
// input into a valid, normalized RubricWeights via the engine. No scoring
// math lives here -- every number comes from engine.normalizeWeights /
// engine.describeWeights / engine.getWeightPresets.
import { useCallback, useMemo, useState } from "react";
import { useEngine } from "./useEngine";
import type { DimensionKey, RubricWeights } from "../engine/types";

export interface UseWeightsResult {
  weights: RubricWeights;
  dimensions: ReturnType<import("../engine/types").MarketEntryEngine["getDimensions"]>;
  presets: Record<string, RubricWeights>;
  provenance: ReturnType<import("../engine/types").MarketEntryEngine["describeWeights"]>;
  /** Apply a named preset (base / regulation_heavy / market_heavy / capital_tight). No-op on an unknown name. */
  setPreset: (name: string) => void;
  /** Drag a single dimension's fader to `pct` (0-100); every weight is renormalized to sum to 1. */
  setDimensionWeight: (key: DimensionKey, pct: number) => void;
  /** Back to the Round 1 base weights (25/25/20/15/15). */
  reset: () => void;
}

export function useWeights(): UseWeightsResult {
  const engine = useEngine();

  const dimensions = useMemo(() => engine.getDimensions(), [engine]);
  const presets = useMemo(() => engine.getWeightPresets(), [engine]);
  const defaultWeights = useMemo(() => engine.getDefaultWeights(), [engine]);

  const [weights, setWeights] = useState<RubricWeights>(defaultWeights);
  const provenance = useMemo(() => engine.describeWeights(weights), [engine, weights]);

  const setPreset = useCallback(
    (name: string) => {
      const preset = presets[name];
      if (preset) setWeights(preset);
    },
    [presets],
  );

  const setDimensionWeight = useCallback(
    (key: DimensionKey, pct: number) => {
      setWeights((prev) => engine.normalizeWeights({ ...prev, [key]: pct / 100 }));
    },
    [engine],
  );

  const reset = useCallback(() => setWeights(defaultWeights), [defaultWeights]);

  return { weights, dimensions, presets, provenance, setPreset, setDimensionWeight, reset };
}
