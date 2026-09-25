// Weight vectors: validation, normalisation, preset matching.
// Internal to the engine -- P2/P3 reach these through src/engine/index.ts.

import type { DimensionKey, RubricWeights, SourceType, WeightValidationResult, WeightsProvenance } from "./types";

export const DIMENSION_KEYS: readonly DimensionKey[] = [
  "market_opportunity",
  "legality",
  "licence",
  "fx_custody",
  "clarity",
];

export const WEIGHT_SUM_TOLERANCE = 1e-6;

export class InvalidWeightsError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(`Invalid rubric weights: ${errors.join("; ")}`);
    this.name = "InvalidWeightsError";
    this.errors = errors;
  }
}

/**
 * One-decimal display with half-up rounding. `(2.05).toFixed(1)` is "2.0" in
 * JavaScript (binary floating point), which made South Africa show 2.0 against
 * the deck's 2.1. Every screening score shown to the user goes through this.
 */
export function formatScore(value: number): string {
  return (Math.round((value + 1e-9) * 10) / 10).toFixed(1);
}

export function round(value: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function validateWeights(weights: unknown): WeightValidationResult {
  const errors: string[] = [];
  if (weights === null || typeof weights !== "object" || Array.isArray(weights)) {
    return { valid: false, errors: ["weights must be an object"], sum: NaN };
  }
  const w = weights as Record<string, unknown>;
  let sum = 0;
  for (const key of DIMENSION_KEYS) {
    const v = w[key];
    if (v === undefined) {
      errors.push(`missing weight for "${key}"`);
    } else if (typeof v !== "number" || !Number.isFinite(v)) {
      errors.push(`weight for "${key}" must be a finite number`);
    } else if (v < 0) {
      errors.push(`weight for "${key}" must not be negative`);
    } else {
      sum += v;
    }
  }
  for (const key of Object.keys(w)) {
    if (!(DIMENSION_KEYS as readonly string[]).includes(key)) errors.push(`unknown weight key "${key}"`);
  }
  if (errors.length === 0 && Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
    errors.push(`weights must sum to 1 (got ${round(sum, 6)})`);
  }
  return { valid: errors.length === 0, errors, sum: round(sum, 6) };
}

export function assertValidWeights(weights: unknown): asserts weights is RubricWeights {
  const result = validateWeights(weights);
  if (!result.valid) throw new InvalidWeightsError(result.errors);
}

export function normalizeWeights(weights: Partial<RubricWeights>): RubricWeights {
  const errors: string[] = [];
  let sum = 0;
  for (const key of DIMENSION_KEYS) {
    const v = weights[key] ?? 0;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) errors.push(`weight for "${key}" must be a finite, non-negative number`);
    else sum += v;
  }
  if (errors.length === 0 && sum === 0) errors.push("at least one weight must be greater than 0");
  if (errors.length > 0) throw new InvalidWeightsError(errors);
  const out = {} as RubricWeights;
  for (const key of DIMENSION_KEYS) out[key] = (weights[key] ?? 0) / sum;
  return out;
}

/** Keeps only the 5 dimension keys (data presets also carry source_type / note). */
export function pickWeights(source: Record<string, unknown>): RubricWeights {
  const out = {} as RubricWeights;
  for (const key of DIMENSION_KEYS) out[key] = source[key] as number;
  return out;
}

export function weightsEqual(a: RubricWeights, b: RubricWeights): boolean {
  return DIMENSION_KEYS.every((k) => Math.abs(a[k] - b[k]) <= WEIGHT_SUM_TOLERANCE);
}

export function describeWeights(
  weights: RubricWeights,
  presets: Record<string, { weights: RubricWeights; source_type: SourceType; note: string }>,
): WeightsProvenance {
  for (const [name, preset] of Object.entries(presets)) {
    if (weightsEqual(weights, preset.weights)) return { preset: name, source_type: preset.source_type, note: preset.note };
  }
  return {
    preset: null,
    source_type: "assumption",
    note: "Custom weights set in the tool -- a what-if scenario, not a Round 1 weighting.",
  };
}
