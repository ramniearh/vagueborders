// vagueborders: the "How vague is this?" panel. The text is in index.html;
// this opens and closes it, and counts what the snapshot on screen holds.

const about = document.getElementById('about');

function openAbout() {
  setPlaying(false);
  describeSnapshot();
  about.showModal();   // a native modal dialog: focus moves in, Esc closes it
}
d3.selectAll('#about-open, #about-open-2').on('click', openAbout);
d3.select('#about-close').on('click', () => about.close());
// A click on the dark backdrop (outside the dialog's box) closes it too.
about.addEventListener('click', e => { if (e.target === about) about.close(); });

// "1279 CE: 247 shapes. 61% named. Of the named: 100% approximate borders, ..."
function describeSnapshot() {
  const snap = cache[current];
  if (!snap) return;
  const all = snap.shapes, named = all.filter(s => s.name);
  const pct = (n, of) => `${Math.round((100 * n) / of.length)}%`;
  const count = (f) => named.filter(f).length;
  d3.select('#about-now').text(
    `${formatYear(years[current])}: ${all.length} shapes, ${pct(named.length, all)} of them named. ` +
    `Of the named ones: ${pct(count(s => s.precision !== 3), named)} have approximate borders; ` +
    `${pct(count(s => s.kind === 'state'), named)} are states, ` +
    `${pct(count(s => s.kind === 'people'), named)} peoples, ` +
    `and ${pct(count(s => s.kind === 'none'), named)} not classified.`);
}
