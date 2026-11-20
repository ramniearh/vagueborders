// Phase 2 pipeline: turns each raw snapshot into a small TopoJSON file for the map.
// Usage (from the repo root, after `npm install`):  npm run build   (or: node pipeline/build.js)
//
// For every year in docs/data/years.json it:
//   1. normalises each feature's properties to {name, precision, subject_to, type_raw}
//   2. simplifies with mapshaper and outputs TopoJSON
//   3. fixes ring winding AFTER simplifying, polygon by polygon (see fixWinding below)
//   4. checks that no feature floods the globe, and writes docs/data/world_{year}.topo.json
// Then it writes docs/data/polities.json: each name -> the years it appears in.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mapshaper = require('mapshaper');
// The same d3 + topojson-client files the browser uses, so the checks match what gets drawn.
const d3 = require('../docs/vendor/d3.v7.min.js');
const topojson = require('../docs/vendor/topojson-client.v3.min.js');

const root = path.join(__dirname, '..');
const rawDir = path.join(root, 'data/raw/geojson');
const outDir = path.join(root, 'docs/data');
const years = JSON.parse(fs.readFileSync(path.join(outDir, 'years.json'), 'utf8'));

// No -filter-slivers: it deletes whole small features (Venice in 1279, the Minoans
// in 2000 BCE, 135 named peoples in 1492). keep-shapes stops -simplify doing the same.
const MAPSHAPER = '-i polities.json -simplify 4% keep-shapes ' +
                  '-o out.json format=topojson precision=0.01';

// -2000 -> world_bc2000.geojson, 1279 -> world_1279.geojson
const rawFile = year => path.join(rawDir, `world_${year < 0 ? 'bc' + -year : year}.geojson`);

// Blank strings count as missing.
const clean = v => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

// Step 1: keep only the four properties the site needs.
function normalise(p) {
  const name = clean(p.NAME);
  let subject_to = clean(p.SUBJECTO);
  // SUBJECTO usually just repeats the feature's own name or abbreviation;
  // that is not "under X", so drop it. Unnamed features get no overlord either.
  const self = [name, clean(p.ABBREVN)].filter(Boolean).map(s => s.toLowerCase());
  if (!name || (subject_to && self.includes(subject_to.toLowerCase()))) subject_to = null;
  return {
    name,
    precision: p.BORDERPRECISION === 3 ? 3 : 1, // 2 is treated as 1: round toward "uncertain"
    subject_to,
    type_raw: clean(p.TYPE) ?? clean(p.type), // kept as-is; mapped to a kind in Phase 2b
  };
}

// Step 3: d3 treats a ring as enclosing the *smaller* side only if it is wound the
// right way round; wound backwards, it encloses everything else (area > half the
// sphere, 2π steradians) and floods the globe. The dataset mixes both, so check each
// ring on its own: an outer ring should be small, a hole (wound opposite) should be huge.
// In TopoJSON a ring is a list of arc indices; reversing it = reverse the list and
// flip each index (~i means "arc i, walked backwards").
function fixWinding(topo) {
  let fixed = 0;
  const ringArea = ring => d3.geoArea(topojson.feature(topo, { type: 'Polygon', arcs: [ring] }));
  const fixPolygon = rings => rings.map((ring, i) => {
    const big = ringArea(ring) > 2 * Math.PI;
    const wrong = i === 0 ? big : !big; // outer ring must be small, holes must be "big"
    if (!wrong) return ring;
    fixed++;
    return ring.slice().reverse().map(a => ~a);
  });
  for (const g of Object.values(topo.objects)[0].geometries) {
    if (g.type === 'Polygon') g.arcs = fixPolygon(g.arcs);
    if (g.type === 'MultiPolygon') g.arcs = g.arcs.map(fixPolygon);
  }
  return fixed;
}

async function buildYear(year) {
  const raw = JSON.parse(fs.readFileSync(rawFile(year), 'utf8'));
  raw.features.forEach(f => { f.properties = normalise(f.properties); });

  // Step 2: mapshaper runs in memory; file names here are just labels.
  const out = await mapshaper.applyCommands(MAPSHAPER, { 'polities.json': raw });
  const topo = JSON.parse(out['out.json']);

  // Drop features whose geometry vanished entirely (e.g. removed as slivers).
  const layer = Object.values(topo.objects)[0];
  const before = layer.geometries.length;
  layer.geometries = layer.geometries.filter(g => g.type);
  const dropped = before - layer.geometries.length;

  const fixed = fixWinding(topo);

  // Step 4: the flood check. Every feature must cover less than half the globe.
  const features = topojson.feature(topo, layer).features;
  const floods = features.filter(f => d3.geoArea(f) > 2 * Math.PI);
  const biggest = Math.max(...features.map(f => d3.geoArea(f))) / (4 * Math.PI);

  const text = JSON.stringify(topo);
  fs.writeFileSync(path.join(outDir, `world_${year}.topo.json`), text);

  return {
    year, features, fixed, dropped, floods,
    rawCount: raw.features.length,
    bytes: Buffer.byteLength(text),
    gzBytes: zlib.gzipSync(text).length,
    biggest,
  };
}

async function main() {
  const polities = {}; // name -> [years]
  let total = 0, totalGz = 0, totalFixed = 0, totalDropped = 0, badFiles = 0;

  for (const year of years) {
    const r = await buildYear(year);
    total += r.bytes; totalGz += r.gzBytes; totalFixed += r.fixed; totalDropped += r.dropped;
    for (const f of r.features) {
      const name = f.properties.name;
      if (!name) continue;
      polities[name] ??= [];
      if (!polities[name].includes(year)) polities[name].push(year);
    }
    if (r.floods.length) badFiles++;
    console.log(
      `${String(year).padStart(7)}  ${String(r.features.length).padStart(4)} features` +
      `  ${(r.bytes / 1024).toFixed(0).padStart(4)} KB` +
      `  rings fixed ${String(r.fixed).padStart(4)}` +
      (r.dropped ? `  dropped ${r.dropped}` : '') +
      `  largest ${(r.biggest * 100).toFixed(1)}% of globe` +
      (r.floods.length ? `  FLOODS: ${r.floods.map(f => f.properties.name ?? '(unnamed)').join(', ')}` : '')
    );
  }

  // Sorted keys keep the file stable between runs, so git diffs stay readable.
  const sorted = Object.fromEntries(Object.keys(polities).sort().map(k => [k, polities[k]]));
  fs.writeFileSync(path.join(outDir, 'polities.json'), JSON.stringify(sorted) + '\n');

  console.log(`\n${years.length} files, ${(total / 1e6).toFixed(2)} MB total, ` +
              `${(totalGz / 1e6).toFixed(2)} MB gzipped`);
  console.log(`${totalFixed} rings rewound, ${totalDropped} empty features dropped, ` +
              `${Object.keys(sorted).length} distinct names in polities.json`);
  if (badFiles) {
    console.error(`FAILED: ${badFiles} file(s) still have a feature flooding the globe`);
    process.exit(1);
  }
  console.log('Flood check passed: no feature covers half the globe in any of the files.');
}

main().catch(err => { console.error(err); process.exit(1); });
