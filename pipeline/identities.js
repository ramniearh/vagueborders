// Identity and kind for each feature (Phase 2b). Used by build.js.
//
// data/identities.csv columns: id, display_name, dataset_names, kind, wiki_title
//   dataset_names: the dataset's names for this identity, separated by |
//     A name may carry a year range when the same name means different polities
//     in different eras:  "Ghana@..1300" (up to 1300), "Ghana@1900.." (from 1900),
//     "Persia@400..700" (both ends). Years are inclusive, BCE negative.
//   kind: state / people / other / unknown

const fs = require('fs');
const path = require('path');

const CSV = path.join(__dirname, '../data/identities.csv');
const KINDS = ['state', 'people', 'other', 'unknown'];

// Minimal CSV reader: handles "quoted, fields" and "" escapes, which is all the table uses.
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cell = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted && c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = !quoted;
      else if (c === ',' && !quoted) { cells.push(cell); cell = ''; }
      else cell += c;
    }
    cells.push(cell);
    rows.push(cells.map(s => s.trim()));
  }
  const [header, ...body] = rows;
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// "Ghana@..1300" -> { name: 'Ghana', from: -Infinity, to: 1300 }
function parseName(entry) {
  const m = entry.match(/^(.*?)@(-?\d*)\.\.(-?\d*)$/);
  if (!m) return { name: entry, from: -Infinity, to: Infinity };
  return { name: m[1], from: m[2] ? Number(m[2]) : -Infinity, to: m[3] ? Number(m[3]) : Infinity };
}

// A URL-friendly id for names that aren't in the table: "Đại Việt" -> "dai-viet".
function slug(name) {
  const s = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (s) return s;
  // Names in scripts with no Latin letters: fall back to a short stable hash.
  let h = 0;
  for (const c of name) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return 'name-' + h.toString(36);
}

// The dataset's own TYPE/type, mapped as PLAN.md says. Anything else -> null.
function kindFromType(typeRaw) {
  if (!typeRaw) return null;
  const t = typeRaw.toLowerCase();
  if (['kingdom', 'kingdoms', 'state society'].includes(t)) return 'state';
  if (/hunter|forag|farm|pastoral|nomad|cultur|chiefdom/.test(t)) return 'people';
  return null; // e.g. "civilization", "La Almagra"
}

function loadIdentities() {
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  const byName = new Map(); // dataset name -> [{ id, from, to }]
  const identities = {};    // id -> row, for docs/data/identities.json
  for (const row of rows) {
    if (identities[row.id]) throw new Error(`identities.csv: duplicate id "${row.id}"`);
    if (!KINDS.includes(row.kind)) throw new Error(`identities.csv: "${row.id}" has kind "${row.kind}"`);
    identities[row.id] = row;
    for (const entry of row.dataset_names.split('|')) {
      const n = parseName(entry.trim());
      if (!byName.has(n.name)) byName.set(n.name, []);
      byName.get(n.name).push({ id: row.id, from: n.from, to: n.to, entry });
    }
  }
  const curatedIds = new Set(Object.keys(identities));
  const used = new Set(); // which table entries matched at least one feature

  // Identity of a named feature in a given year.
  function identify(name, year) {
    const hits = (byName.get(name) || []).filter(h => year >= h.from && year <= h.to);
    if (hits.length > 1) throw new Error(`identities.csv: "${name}" in ${year} matches ${hits.map(h => h.id)}`);
    if (hits.length) {
      used.add(hits[0].entry + ' ' + hits[0].id);
      return { id: hits[0].id, row: identities[hits[0].id] };
    }
    // Not curated: the slug. If it clashes with a curated id (e.g. "Italy" in 300 BCE
    // vs the curated "italy" from 1800), mark it so the two don't share a colour.
    const s = slug(name);
    return { id: curatedIds.has(s) ? s + '-uncurated' : s, row: null };
  }

  // kind + kind_source for a feature, in PLAN.md's order: curated, then dataset TYPE.
  // Curated "unknown" means the curator has no opinion, so the dataset's TYPE still
  // counts; curated "other" (e.g. Antarctica) is a firm "not classified".
  function kindOf(row, typeRaw) {
    if (row && row.kind !== 'unknown') {
      const kind = row.kind === 'state' || row.kind === 'people' ? row.kind : null;
      return { kind, kind_source: kind ? 'curated' : null };
    }
    const kind = kindFromType(typeRaw);
    return { kind, kind_source: kind ? 'dataset' : null };
  }

  // Table entries that never matched anything: usually a typo in the CSV.
  function unused() {
    const out = [];
    for (const [name, hits] of byName) {
      for (const h of hits) if (!used.has(h.entry + ' ' + h.id)) out.push(`${h.id}: "${h.entry}"`);
    }
    return out;
  }

  return { identities, identify, kindOf, unused };
}

module.exports = { loadIdentities, slug };
