// vagueborders: the info panel (Phase 5). Click a polity to see what the data
// says about it, and how sure the data is. The panel stays open while the
// years change and follows the same identity (same id, same colour).

const ISSUES = 'https://github.com/ramniearh/vagueborders/issues/new';
const info = d3.select('#info');

// Lineage names, Wikipedia titles and years (curated ids), and name → years.
let identities = {}, polities = {};
Promise.all([d3.json('data/identities.json'), d3.json('data/polities.json')])
  .then(([i, p]) => { identities = i; polities = p; updateInfo(); });

let selected = null;   // { id, name } of the polity open in the panel

function isSelected(d) { return !!selected && d.id === selected.id; }

function selectPolity(d) {
  selected = { id: d.id, name: d.name };
  markSelected();
  updateInfo();
  // On a phone the panel sits below the map: bring it into view.
  if (matchMedia('(max-width: 700px)').matches) {
    info.node().scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
  }
}

function closeInfo() {
  if (!selected) return;
  selected = null;
  markSelected();
  info.attr('hidden', true);
}

// Clicking the map outside any polity closes the panel.
d3.selectAll('.layer').on('click', closeInfo);

// Outline the selected polity in both map layers.
function markSelected() {
  for (const l of layers) l.polities.selectAll('g.polity').classed('selected', isSelected);
}

// ---- Filling the panel ----

let infoTicket = 0;   // so a slow Wikipedia answer never lands in a newer panel

function updateInfo() {
  if (!selected || !cache[current]) return;
  const mine = ++infoTicket;
  const year = years[current];

  // The same identity in this snapshot: the same name if it's there, else its largest feature.
  const matches = cache[current].shapes.filter(s => s.id === selected.id);
  const d = matches.find(s => s.name === selected.name) || d3.greatest(matches, s => s.area);
  if (d) selected.name = d.name;
  const lineage = identities[selected.id];   // only for curated identities
  const hueOf = `hsl(${hue(selected.id)}, 45%, 50%)`;

  info.attr('hidden', null).html('');
  info.append('button').attr('class', 'close').attr('aria-label', 'Close')
    .text('×').on('click', closeInfo);

  // Name in this snapshot, then the lineage it belongs to (if curated).
  const head = info.append('div').attr('class', 'head');
  head.append('span').attr('class', 'chip').style('background', hueOf);
  head.append('h2').text(d ? d.name : selected.name);
  const sub = info.append('div').attr('class', 'sub');
  sub.append('span').text(d ? `in ${formatYear(year)}` : `not in the ${formatYear(year)} snapshot`);
  if (d && d.subjectTo) sub.append('span').text(` · under ${d.subjectTo}`);
  if (lineage && (!d || lineage.name !== d.name)) {
    info.append('div').attr('class', 'sub').text(`lineage: ${lineage.name}`);
  }

  const dl = info.append('dl');
  const row = (label) => { dl.append('dt').text(label); return dl.append('dd'); };

  if (d) {
    row('kind').call(describeKind, d);
    row('border').call(describeBorder, d);
  }
  row('snapshots').call(describeYears, selected.name, lineage, hueOf);
  const wiki = row('wikipedia');
  describeWiki(wiki, selected.name, lineage, mine);

  info.append('a').attr('class', 'issue').attr('target', '_blank').attr('rel', 'noopener')
    .attr('href', issueLink(selected, d, year))
    .text('Wrong? Open an issue');
}

// Kind, and where that comes from. "Not classified" is an answer too.
function describeKind(dd, d) {
  if (d.kind === 'state' || d.kind === 'people') {
    dd.append('b').text(d.kind);
    dd.append('span').attr('class', 'muted').text(d.kindSource === 'curated'
      ? ' · from the curated identity table'
      : ` · from the dataset (type “${d.typeRaw}”)`);
  } else {
    dd.append('b').text('not classified');
    dd.append('span').attr('class', 'muted').text(d.typeRaw
      ? ` · the dataset says “${d.typeRaw}”, which is neither state nor people`
      : ' · nothing in the data says what kind of entity this is');
  }
}

function describeBorder(dd, d) {
  if (d.precision === 3) {
    dd.append('b').text('better-documented border');
    dd.append('span').attr('class', 'muted').text(' · flagged so in the dataset; drawn crisp');
  } else {
    dd.append('b').text('approximate border');
    dd.append('span').attr('class', 'muted').text(' · flagged so in the dataset; drawn soft');
  }
}

// Which snapshots this name (and its lineage) appears in: a strip with one
// cell per snapshot, plus the same in words. Clicking a cell goes there.
function describeYears(dd, name, lineage, colour) {
  const named = new Set(polities[name] || []);
  const inLineage = new Set(lineage ? lineage.years : []);

  const strip = dd.append('div').attr('class', 'strip');
  strip.selectAll('button').data(years).join('button')
    .attr('class', y => named.has(y) ? 'on' : inLineage.has(y) ? 'kin' : null)
    .classed('now', (y, i) => i === current)
    .style('--c', colour)
    .attr('title', y => formatYear(y) + (named.has(y) ? '' : inLineage.has(y) ? ` (as ${lineage.name})` : ''))
    .attr('aria-label', y => formatYear(y))
    .on('click', (e, y) => { setPlaying(false); show(years.indexOf(y)); });

  dd.append('div').text(`“${name}”: ${spans(named)}`);
  if (lineage && inLineage.size > named.size) {
    dd.append('div').text(`lineage ${lineage.name}: ${spans(inLineage)}`);
  }
  dd.append('div').attr('class', 'muted small')
    .text('Snapshots are samples, not continuous history.');
}

// "1279–1400, 1600 (5 of 54 snapshots)": runs of consecutive snapshots.
function spans(set) {
  if (!set.size) return 'none';
  const runs = [];
  years.forEach((y, i) => {
    if (!set.has(y)) return;
    const last = runs.at(-1);
    if (last && last.to === i - 1) last.to = i; else runs.push({ from: i, to: i });
  });
  const text = runs.map(r => r.from === r.to ? formatYear(years[r.from])
    : `${formatYear(years[r.from])} – ${formatYear(years[r.to])}`).join(', ');
  return `${text} (${set.size} of ${years.length} snapshots)`;
}

// ---- Wikipedia ----
// The rule (PLAN.md): the curated title if there is one; otherwise an article
// whose title matches the name almost exactly, labelled "machine-matched";
// otherwise nothing. Never a guess.

const wikiCache = new Map();
function wikiSummary(title) {
  if (!wikiCache.has(title)) {
    const url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' +
      encodeURIComponent(title.replace(/ /g, '_'));
    wikiCache.set(title, fetch(url).then(r => r.ok ? r.json() : null).catch(() => null));
  }
  return wikiCache.get(title);
}

// "Đại Việt" and "Dai Viet" count as the same title; "Mughal" and "Mughal Empire" don't.
const plain = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function describeWiki(dd, name, lineage, mine) {
  const curated = lineage && lineage.wiki;
  dd.append('span').attr('class', 'muted').text('looking…');

  let page = await wikiSummary(curated || name);
  // A machine match must be an ordinary article whose title is the name itself
  // (after following redirects), not a disambiguation page or a near miss.
  if (!curated && !(page && page.type === 'standard' && plain(page.title) === plain(name))) page = null;
  if (mine !== infoTicket) return;   // the panel has moved on

  dd.html('');
  if (!page || !page.extract) {
    dd.append('span').attr('class', 'muted').text(curated
      ? 'Wikipedia could not be reached.'
      : 'No link: no curated article, and no article titled exactly this name.');
    return;
  }
  dd.append('p').attr('class', 'extract').text(page.extract);
  const foot = dd.append('div').attr('class', 'small');
  foot.append('a').attr('href', page.content_urls.desktop.page)
    .attr('target', '_blank').attr('rel', 'noopener').text(`${page.title} on Wikipedia`);
  foot.append('span').attr('class', curated ? 'muted' : 'tag')
    .text(curated ? ' · curated link' : ' · machine-matched');
  if (!curated) dd.append('div').attr('class', 'muted small')
    .text('Same title, but it may be about something else of that name.');
}

// A prefilled GitHub issue, so a correction says exactly what it is about.
function issueLink(sel, d, year) {
  const title = `Wrong: ${sel.name} in ${formatYear(year)}`;
  const body = [
    `Snapshot: ${year}`,
    `Name in the dataset: ${sel.name}`,
    `Identity id: ${sel.id}`,
    d ? `Kind shown: ${d.kind === 'none' ? 'not classified' : d.kind}` : '',
    '',
    'What looks wrong:',
    '',
    '',
    '(If it is the border itself, it may belong upstream at aourednik/historical-basemaps.)',
  ].join('\n');
  return `${ISSUES}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
