# Public dataset inputs (not committed)

Drop the two CSV exports here, then run `npx tsx scripts/build-public-screen.ts`:

- `atlantic-council-tracker.csv` — Atlantic Council Cryptocurrency Regulation Tracker export
  (https://www.atlanticcouncil.org/programs/geoeconomics-center/cryptoregulationtracker/)
- `chinn-ito.csv` — Chinn-Ito KAOPEN index, the Excel file saved as CSV (columns are auto-detected; the 2023 edition is `cn, ccode, country_name, year, kaopen, ka_open`)
  (https://web.pdx.edu/~ito/Chinn-Ito_website.htm)

See README.md "Public-data screen" for what the script does with them. The generated
`data/public-screen.json` is committed; these inputs are ignored by git.
