// vagueborders: finding things. A search box (every name in the dataset, plus
// the curated lineage names) and a "random" button. Both jump to a snapshot
// where the polity appears and open its info panel.

const searchBox = d3.select('#search');
const entries = new Map();   // plain(name) → { name, years, id? }

lookups.then(() => {
  // Every dataset name, with the snapshots it appears in (polities.json)...
  for (const [name, ys] of Object.entries(polities)) entries.set(plain(name), { name, years: ys });
  // ...plus lineage names that aren't also a dataset name ("Rome" is both).
  for (const [id, l] of Object.entries(identities)) {
    if (!entries.has(plain(l.name)) && l.years.length) entries.set(plain(l.name), { name: l.name, years: l.years, id });
  }
  const sorted = [...entries.values()].sort((a, b) => d3.ascending(a.name, b.name));
  d3.select('#names').selectAll('option').data(sorted).join('option')
    .attr('value', e => e.name)
    .attr('label', e => e.id ? 'lineage' : null);
});

// 'change' fires when an option is picked or Enter is pressed.
searchBox.on('change', function () {
  if (!this.value.trim()) return;
  const e = entries.get(plain(this.value));
  this.setCustomValidity(e ? '' : 'No polity or people of that name in any snapshot.');
  if (!e) return this.reportValidity();
  // The snapshot nearest to the one on screen, so searching doesn't throw you across time.
  goTo(e, d3.least(e.years, y => Math.abs(years.indexOf(y) - current)));
  this.blur();
});
searchBox.on('input', function () { this.setCustomValidity(''); });

// Random: any named polity or people (each name equally likely, which shows
// how many one-snapshot peoples the dataset has), in one of its snapshots.
d3.select('#random').on('click', () => {
  const names = Object.keys(polities);
  if (!names.length) return;
  const name = names[Math.floor(Math.random() * names.length)];
  const ys = polities[name];
  goTo({ name, years: ys }, ys[Math.floor(Math.random() * ys.length)]);
});

// Show that snapshot, then select the polity in it (its largest shape).
async function goTo(entry, year) {
  setPlaying(false);
  const i = years.indexOf(year);
  await show(i);
  if (current !== i) return;   // something else was asked for meanwhile
  const match = entry.id ? (s => s.id === entry.id) : (s => s.name === entry.name);
  const d = d3.greatest(cache[i].shapes.filter(match), s => s.area);
  if (d) selectPolity(d);   // (a couple of tiny shapes were lost in simplification)
}
