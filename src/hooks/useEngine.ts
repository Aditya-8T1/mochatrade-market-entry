// TODO(P1/P3): memoize engine access + expose weights/selection state.
// Keep this the ONLY place components import `engine` from, so P1 can
// change internals freely.
import { engine } from "../engine";

export function useEngine() {
  return engine;
}
