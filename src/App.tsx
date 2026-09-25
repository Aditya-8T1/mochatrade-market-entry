// P2's real product UI. Everything renders through Dashboard, which reads
// exclusively from useEngine()/`engine` -- nothing here is hardcoded, and
// nothing imports src/engine/scoring.ts or sequencing.ts directly.
import type { ReactElement } from "react";
import Dashboard from "./screens/Dashboard";

export default function App(): ReactElement {
  return <Dashboard />;
}
