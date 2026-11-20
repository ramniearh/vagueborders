// Writes docs/data/years.json: the list of snapshot years, sorted, BCE as negatives.
// Usage (from the repo root):  node pipeline/years.js
//
// The years come from the snapshot filenames in data/raw/geojson/
// (world_bc2000.geojson -> -2000, world_1279.geojson -> 1279).
// The dataset's own index.json is only used as a cross-check.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const geojsonDir = path.join(root, 'data/raw/geojson');
const outFile = path.join(root, 'docs/data/years.json');

// Only exact snapshot files count: this skips places.geojson and the .qmd style file.
const pattern = /^world_(bc)?(\d+)\.geojson$/;

const years = fs.readdirSync(geojsonDir)
  .map(name => name.match(pattern))
  .filter(Boolean)
  .map(([, bc, digits]) => (bc ? -1 : 1) * Number(digits))
  .sort((a, b) => a - b);

// Cross-check against the dataset's index.json; stop if they disagree.
const index = JSON.parse(fs.readFileSync(path.join(root, 'data/raw/index.json'), 'utf8'));
const indexYears = index.years.map(y => y.year).sort((a, b) => a - b);
if (JSON.stringify(indexYears) !== JSON.stringify(years)) {
  console.error('Filenames and index.json disagree:');
  console.error('  only in files:', years.filter(y => !indexYears.includes(y)));
  console.error('  only in index:', indexYears.filter(y => !years.includes(y)));
  process.exit(1);
}

fs.writeFileSync(outFile, JSON.stringify(years) + '\n');
console.log(`Wrote ${years.length} years (${years[0]} to ${years[years.length - 1]}) to docs/data/years.json`);
