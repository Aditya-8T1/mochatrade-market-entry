// One provider for everything that must survive moving between pages:
// weights, user-added and public-screen markets, and the compare selection.
// It wraps the existing useMarketEntry() (which itself owns useWeights and
// useCustomMarkets), so every value is still a direct engine call and every
// localStorage key is unchanged. Pages read it with useAppState().
import { createContext, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import { useMarketEntry } from "../hooks/useEngine";
import type { UseMarketEntryResult } from "../hooks/useEngine";

export type AppState = UseMarketEntryResult;

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }): ReactElement {
  const entry = useMarketEntry();
  return <Ctx.Provider value={entry}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState() must be used inside <AppStateProvider>");
  return v;
}
