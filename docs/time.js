// vagueborders: time. Preloading, the slider, play, keys and the cross-fade.
// Snapshots are point samples: we step from one to the next and never
// interpolate geometry in between (PLAN.md).

const STEP_MS = 1600;   // time per snapshot while playing
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FADE_MS = REDUCED ? 0 : 450;   // reduced motion → instant swaps

// Conventional world-history eras, by start year. They're rough labels for
// orientation, not data. 'Prehistory' covers the sparse early snapshots.
const ERAS = [
  { from: -Infinity, name: 'Prehistory' },
  { from: -3000, name: 'Ancient' },
  { from: -500, name: 'Classical' },
  { from: 500, name: 'Post-classical' },
  { from: 1500, name: 'Early modern' },
  { from: 1800, name: 'Modern' },
  { from: 1945, name: 'Contemporary' },
];
const eraOf = (year) => ERAS.findLast(e => year >= e.from);

const layers = [makeLayer('#layer-a', 'a'), makeLayer('#layer-b', 'b')];
let front = 0;          // which layer is on top
let fade = null;        // the running cross-fade, if any

let years = [];
const loading = [];     // per snapshot: a promise of its TopoJSON
const raw = [];         // per snapshot: the TopoJSON once loaded (dropped after projecting)
const cache = [];       // per snapshot: the projected shapes and labels
let current = -1;       // index of the snapshot on screen
let playing = false, timer = null;

// ---- Loading and projecting ----

function load(i) {
  loading[i] = d3.json(`data/world_${years[i]}.topo.json`).then(t => (raw[i] = t));
}

async function snapshot(i) {
  if (!cache[i]) {
    const topo = raw[i] || await loading[i];
    cache[i] ??= project(topo);   // ??= : another call may have finished it meanwhile
    raw[i] = null;
  }
  return cache[i];
}

// Project the remaining snapshots one per task while the page is idle,
// next-to-be-shown first, so each step while playing finds its snapshot ready.
function warm() {
  if (cache.filter(Boolean).length === years.length) return;   // all done
  if (fade && fade.playState === 'running') return setTimeout(warm, 100);   // don't stutter a fade
  for (let k = 1; k <= years.length; k++) {
    const i = (current + k) % years.length;
    if (!cache[i] && raw[i]) {
      cache[i] = project(raw[i]);
      raw[i] = null;
      return setTimeout(warm, 0);
    }
  }
  setTimeout(warm, 200);   // nothing loaded yet: check again shortly
}

// ---- Showing a snapshot ----

let ticket = 0;
async function show(i) {
  const mine = ++ticket;
  const snap = await snapshot(i);
  if (mine !== ticket) return;   // a newer step was asked for meanwhile
  current = i;

  const year = years[i];
  d3.select('#year').text(formatYear(year));
  d3.select('#era').text(eraOf(year).name);
  d3.select('#slider').property('value', i).attr('aria-valuetext', formatYear(year));
  history.replaceState(null, '', `?year=${year}`);

  crossFade(snap);
  updateInfo();   // the info panel follows its polity into the new snapshot
}

// Paint into the back layer, bring it to the front, and fade it in over the
// old one. The opacity fade runs on the GPU, so it stays smooth.
function crossFade(snap) {
  const from = layers[front], to = layers[1 - front];
  if (fade) fade.cancel();       // stepped mid-fade: the old fade just jumps to its end
  if (to.snap !== snap) paint(to, snap);   // (while playing, prepareNext already did it)
  hideTooltip();

  to.el.style.visibility = 'visible';
  to.el.classList.add('front');
  from.el.classList.remove('front');
  front = 1 - front;

  const done = () => {
    // The old layer is now hidden behind the new one: stop drawing it...
    if (!from.el.classList.contains('front')) from.el.style.visibility = 'hidden';
    // ...unless we're playing, when it gets the next snapshot straight away.
    if (playing) prepareNext();
  };
  if (FADE_MS && from.snap) {
    fade = to.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-in-out' });
    fade.onfinish = done;
  } else {
    fade = null;
    done();
  }
}

// While playing, paint the next snapshot into the back layer early, during
// the quiet part of the step. It's fully hidden behind the front layer's
// opaque sphere, but the browser draws it now, so when the step comes the
// fade only has to change opacity. (Drawing ~2,000 blurred shapes takes a
// noticeable moment; this moves it to where nothing is moving.)
function prepareNext() {
  const i = current + 1, back = layers[1 - front];
  if (i >= years.length || !cache[i] || back.snap === cache[i]) return;
  paint(back, cache[i]);
  back.el.style.visibility = 'visible';
}

// ---- Play, step, keys ----

function setPlaying(on) {
  playing = on;
  clearTimeout(timer);
  d3.select('#play').text(on ? '❚❚' : '▶︎')   // ︎: draw ▶ as text, not an emoji
    .attr('aria-label', on ? 'Pause' : 'Play');
  if (on) {
    if (current === years.length - 1) show(0);   // at the end: start again
    else if (!fade) prepareNext();
    timer = setTimeout(tick, STEP_MS);
  }
}

function tick() {
  if (!playing) return;
  if (current >= years.length - 1) return setPlaying(false);
  show(current + 1);
  timer = setTimeout(tick, STEP_MS);
}

function step(delta) {
  setPlaying(false);
  const i = Math.max(0, Math.min(years.length - 1, current + delta));
  if (i !== current) show(i);
}

document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();          // also stops the slider moving a second time on its own
    step(e.key === 'ArrowLeft' ? -1 : 1);
  } else if (e.key === 'Escape') {
    closeInfo();
  } else if (e.key === ' ') {
    e.preventDefault();          // no page scroll
    setPlaying(!playing);
  }
});
// A focused button "clicks" on space key-up; we already handled space above.
document.addEventListener('keyup', e => { if (e.key === ' ') e.preventDefault(); });

// ---- The slider: one step per snapshot, with era bands and a tick per snapshot ----

function buildSlider() {
  const last = years.length - 1;
  const pct = (i) => `${(Math.max(0, Math.min(last, i)) / last) * 100}%`;

  d3.select('#slider').attr('max', last)
    .on('input', e => { setPlaying(false); show(+e.target.value); });

  // Group consecutive snapshots by era. A band reaches halfway to its neighbours.
  const bands = d3.groups(years.map((y, i) => ({ i, era: eraOf(y).name })), d => d.era)
    .map(([name, items]) => ({ name, first: items[0].i, last: items.at(-1).i }));
  d3.select('#bands').selectAll('div').data(bands).join('div')
    .attr('class', 'band')
    .style('left', b => pct(b.first - 0.5))
    .style('width', b => `calc(${pct(b.last + 0.5)} - ${pct(b.first - 0.5)})`)
    .attr('title', b => b.name)
    .text(b => b.name);
  // A band too narrow for its name (e.g. on a phone) shows no name rather than
  // a cut-off one; the era is still written under the year.
  const fitBands = () => d3.selectAll('.band')
    .classed('tight', function () { return this.scrollWidth > this.clientWidth; });
  fitBands();
  addEventListener('resize', fitBands);

  d3.select('#ticks').selectAll('i').data(years).join('i')
    .style('left', (y, i) => pct(i));
}

d3.select('#play').on('click', () => setPlaying(!playing));

// ---- Start ----

(async function start() {
  years = await d3.json('data/years.json');
  drawLegend();
  buildSlider();

  // ?year= picks the snapshot; otherwise start at the beginning and play.
  const asked = new URLSearchParams(location.search).get('year');
  const askedIndex = asked === null ? -1 : years.indexOf(+asked);
  const first = Math.max(0, askedIndex);

  // Ask for the first snapshot before the others, so it isn't queued behind them.
  load(first);
  years.forEach((y, i) => { if (i !== first) load(i); });

  await show(first);
  setTimeout(warm, 0);
  setPlaying(askedIndex < 0 && !REDUCED);   // no autoplay with reduced motion
})();
