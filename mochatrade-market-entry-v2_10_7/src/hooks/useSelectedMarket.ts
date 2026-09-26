// P3 integration hook: owns which market is selected. Takes a fallback id
// (the engine's current #1 sequenced market) so the dashboard always has a
// sensible default before the user has clicked anything, without baking
// that default into component state that would go stale when weights change.
import { useState } from "react";

export interface UseSelectedMarketResult {
  selectedId: string;
  setSelectedId: (id: string) => void;
}

export function useSelectedMarket(fallbackId: string): UseSelectedMarketResult {
  const [explicitId, setExplicitId] = useState<string | null>(null);
  return {
    selectedId: explicitId ?? fallbackId,
    setSelectedId: setExplicitId,
  };
}
