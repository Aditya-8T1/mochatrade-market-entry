/**
 * Builds data/public-screen.json from two public datasets:
 *
 *   data/public/atlantic-council-tracker.csv  -- Atlantic Council Cryptocurrency Regulation Tracker export
 *   data/public/chinn-ito.csv                 -- Chinn-Ito KAOPEN (ccode, cn, year, kaopen, ka_open)
 *
 *   npx tsx scripts/build-public-screen.ts [--tracker data/public/atlantic-council-tracker.csv]
 *        [--chinn-ito data/public/chinn-ito.csv] [--out data/public-screen.json]
 *        [--tracker-edition "2025 export"] [--dry-run]
 *
 * All the logic is in src/data-provider/publicScreenBuild.ts (pure, tested);
 * this file only reads the inputs, prints the log to stderr and writes the
 * JSON. Commit the generated JSON; the CSVs are inputs (git-ignored).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildPublicScreen } from "../src/data-provider/publicScreenBuild";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trackerPath = resolve(root, arg("tracker", "data/public/atlantic-council-tracker.csv"));
const chinnPath = resolve(root, arg("chinn-ito", "data/public/chinn-ito.csv"));
const outPath = resolve(root, arg("out", "data/public-screen.json"));
const dryRun = process.argv.includes("--dry-run");

const missing = [trackerPath, chinnPath].filter((p) => !existsSync(p));
if (missing.length) {
  console.error(`Missing input file(s):\n  ${missing.join("\n  ")}\nDrop the CSV exports into data/public/ (see README "Public-data screen") and re-run.`);
  process.exit(1);
}
const markets = JSON.parse(readFileSync(resolve(root, "data/markets.json"), "utf8")) as { markets: Array<{ name: string }> };
const report = buildPublicScreen({
  trackerCsv: readFileSync(trackerPath, "utf8"),
  chinnItoCsv: readFileSync(chinnPath, "utf8"),
  excludeMarketNames: markets.markets.map((m) => m.name),
  trackerEdition: process.argv.includes("--tracker-edition") ? arg("tracker-edition", "") : undefined,
  log: (l) => console.error(l),
});
console.error(`tracker rows: ${report.trackerRows}; chinn-ito countries: ${report.chinnItoCountries}; screened: ${report.matched}`);
console.error(`excluded (${report.excluded.length}): ${report.excluded.join(", ") || "-"}`);
console.error(`unmatched (${report.unmatched.length}): ${report.unmatched.join(", ") || "-"}`);
console.error(`unreadable status (${report.invalid.length}): ${report.invalid.join(", ") || "-"}`);
if (dryRun) {
  console.log(JSON.stringify(report.data, null, 2));
} else {
  writeFileSync(outPath, JSON.stringify(report.data, null, 2) + "\n");
  console.error(`wrote ${outPath} (${report.matched} countries)`);
}
