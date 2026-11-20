// vagueborders: drawing the map. (time.js handles years, the slider and play.)
// The rules come from PLAN.md. In short, each visual channel means one thing:
//   hue            = identity   (hash of the identity id)
//   edge           = precision  (1 → soft, 3 → crisp)
//   fill + texture = kind       (state / people / not classified)

const SIZE = 900;            // the SVG's own coordinate space; CSS scales it to the screen
const BLUR_FRACTION = 0.09;  // soft edge = 9% of a shape's smaller on-screen dimension...
const BLUR_CAP = 2.5;        // ...but never more than this (map units), or big shapes turn to fog...
const BLUR_MIN = 0.8;        // ...and never less, so even small approximate shapes look soft
const CHAR_W = 6.1;          // rough width of one 10px monospace character, for label fitting

const tooltip = d3.select('#tooltip');

// North Pole in the middle, out to 60°S (the UN-emblem look).
const projection = d3.geoAzimuthalEquidistant()
  .rotate([0, -90])
  .clipAngle(150)
  .fitExtent([[6, 6], [SIZE - 6, SIZE - 6]], { type: 'Sphere' });
// One decimal is plenty in a 900-unit space, and keeps the cached path strings small.
const path = d3.geoPath(projection).digits(1);
const SPHERE_D = path({ type: 'Sphere' });
const GRATICULE_D = path(d3.geoGraticule10());

// ---- Shared definitions (hatch, blur filters), in their own invisible <svg> ----
const defs = d3.select('#defs').append('defs');

// One shared diagonal hatch, in ink, for "people".
defs.append('pattern')
  .attr('id', 'hatch').attr('patternUnits', 'userSpaceOnUse')
  .attr('width', 5).attr('height', 5).attr('patternTransform', 'rotate(45)')
  .append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 5)
  .attr('stroke', '#2b2e33').attr('stroke-width', 0.8).attr('stroke-opacity', 0.35);

// The sphere's outline sits on top of everything, outside the fading layers.
d3.select('#frame').attr('viewBox', `0 0 ${SIZE} ${SIZE}`)
  .append('path').attr('class', 'outline').attr('d', SPHERE_D);

// ---- Map layers ----
// There are two identical layers, stacked. A new snapshot is painted into the
// one at the back, which is then brought to the front and faded in (time.js).
// Each layer has an opaque sphere, so the fade blends old and new pixel by
// pixel: whatever is the same in both snapshots (same id → same hue, same
// shape) doesn't flicker; only what changed fades. Fill, hatch mask and
// labels all live inside the layer, so they all fade together.
function makeLayer(selector, name) {
  const svg = d3.select(selector).attr('viewBox', `0 0 ${SIZE} ${SIZE}`);

  // The hatch is one big rectangle, shown only through this mask. The mask
  // holds a white copy of every "people" shape, blurred exactly like the
  // shape itself, so the hatch fades out at a soft edge just as the fill does.
  const mask = svg.append('defs').append('mask').attr('id', `people-mask-${name}`)
    .attr('maskUnits', 'userSpaceOnUse')
    .attr('x', 0).attr('y', 0).attr('width', SIZE).attr('height', SIZE);

  svg.append('path').attr('class', 'sphere').attr('d', SPHERE_D);
  svg.append('path').attr('class', 'graticule').attr('d', GRATICULE_D);
  const polities = svg.append('g').attr('class', 'polities');
  svg.append('rect').attr('width', SIZE).attr('height', SIZE)
    .attr('fill', 'url(#hatch)').attr('mask', `url(#people-mask-${name})`)
    .attr('pointer-events', 'none');
  const labels = svg.append('g').attr('class', 'labels');

  return { el: svg.node(), mask, polities, labels, snap: null };
}

// ---- Helpers ----

// Identity colour: a stable hue from the id (FNV-1a string hash).
function hue(id) {
  let h = 2166136261;
  for (const ch of id) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 360;
}

// Soft edges use a handful of shared blur filters (sizes rounded to 0.5),
// rather than one filter per shape. Returns null for crisp edges.
const madeFilters = new Set();
function softEdge(precision, bounds) {
  if (precision === 3) return null;                     // better documented → crisp
  const [[x0, y0], [x1, y1]] = bounds;
  const sigma = BLUR_FRACTION * Math.min(x1 - x0, y1 - y0);
  const s = Math.round(Math.max(BLUR_MIN, Math.min(sigma, BLUR_CAP)) * 2) / 2;
  const id = 'soft-' + String(s).replace('.', '_');
  if (!madeFilters.has(id)) {
    madeFilters.add(id);
    // The filter region is the whole map, so a blur is never cut off at the
    // shape's box (the browser still only computes it near the shape).
    defs.append('filter').attr('id', id)
      .attr('filterUnits', 'userSpaceOnUse')
      .attr('x', 0).attr('y', 0).attr('width', SIZE).attr('height', SIZE)
      .append('feGaussianBlur').attr('stdDeviation', s);
  }
  return `url(#${id})`;
}

// A MultiPolygon is split into its parts, so each part (an island, an
// exclave) gets a blur sized to itself. Otherwise a big empire's small
// islands would be blurred away to nothing.
function partsOf(geometry, precision) {
  const polys = geometry.type === 'MultiPolygon'
    ? geometry.coordinates.map(c => ({ type: 'Polygon', coordinates: c }))
    : [geometry];
  return polys
    .map(g => {
      const d = path(g);                // null if the part lies beyond 60°S
      if (!d) return null;
      const bounds = path.bounds(g);
      return { d, bounds, area: path.area(g), centroid: path.centroid(g), filter: softEdge(precision, bounds) };
    })
    .filter(Boolean);
}

function formatYear(y) {
  return y < 0 ? `${(-y).toLocaleString('en')} BCE` : `${y} CE`;
}

// ---- Projecting a snapshot ----
// This is the slow part (≈ a quarter second for 1492), so time.js does it
// once per snapshot and keeps the result: plain shapes and label positions.

function project(topo) {
  const shapes = topojson.feature(topo, topo.objects.polities).features.map(f => {
    const p = f.properties;  // {name, precision, subject_to, id, kind, ...}; missing key = null
    const parts = partsOf(f.geometry, p.precision);
    return {
      id: p.id || null,
      name: p.name || null,
      subjectTo: p.subject_to || null,
      // Unnamed areas get their own faint look; otherwise the kind, or "none" (not classified).
      kind: p.name ? (p.kind || 'none') : 'unnamed',
      kindSource: p.kind_source || null,   // 'curated' / 'dataset' (for the info panel)
      typeRaw: p.type_raw || null,         // the dataset's own TYPE, as written
      precision: p.precision,
      area: d3.sum(parts, q => q.area),
      parts,
    };
  }).filter(s => s.parts.length);
  return { shapes, labels: placeLabels(shapes) };
}

// Labels: the dataset's own name, placed on the feature's largest part.
// Biggest first; a label is skipped if it doesn't fit or would overlap another.
function placeLabels(shapes) {
  const candidates = shapes
    .filter(s => s.name)
    .map(s => {
      const part = d3.greatest(s.parts, p => p.area);
      return { text: s.name, kind: s.kind, part };
    })
    .sort((a, b) => b.part.area - a.part.area);

  const placed = [];
  for (const c of candidates) {
    const [[x0, y0], [x1, y1]] = c.part.bounds;
    const w = c.text.length * CHAR_W, h = 11;
    if (w > (x1 - x0) * 1.1 || h > (y1 - y0)) continue;   // doesn't fit its shape
    const [x, y] = c.part.centroid;
    const box = { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 };
    if (placed.some(b => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) continue;
    placed.push(Object.assign(box, { text: c.text, kind: c.kind, x, y }));
  }
  return placed;
}

// ---- Painting a projected snapshot into a layer ----

function paint(layer, snap) {
  const { shapes, labels } = snap;

  // Polities: one group per feature (colour set here), one path per part (edge set here).
  layer.polities.selectAll('g.polity')
    .data(shapes)
    .join('g')
      .attr('class', d => `polity kind-${d.kind}`)
      .attr('fill', d => d.id ? `hsl(${hue(d.id)}, 45%, 50%)` : null)
      .attr('stroke', d => d.id ? `hsl(${hue(d.id)}, 45%, 32%)` : null)
      .classed('selected', isSelected)        // the polity open in the info panel
      .on('pointermove', showTooltip)
      .on('pointerleave', hideTooltip)
      .on('click', (event, d) => { event.stopPropagation(); selectPolity(d); })
    .selectAll('path')
    .data(d => d.parts)
    .join('path')
      .attr('d', p => p.d)
      .attr('filter', p => p.filter);

  // White, equally blurred copies of the "people" shapes, for the hatch mask.
  layer.mask.selectAll('path')
    .data(shapes.filter(s => s.kind === 'people').flatMap(s => s.parts))
    .join('path')
      .attr('fill', 'white')
      .attr('d', p => p.d)
      .attr('filter', p => p.filter);

  layer.labels.selectAll('text')
    .data(labels)
    .join('text')
      .attr('class', d => `kind-${d.kind}`)
      .attr('x', d => d.x).attr('y', d => d.y)
      .text(d => d.text);

  layer.snap = snap;   // remember what this layer shows
}

function showTooltip(event, d) {
  const [x, y] = d3.pointer(event, document.querySelector('.stage'));
  tooltip.attr('hidden', null)
    .style('left', `${x + 12}px`).style('top', `${y + 12}px`)
    .html('');
  tooltip.append('span').text(d.name);
  if (d.subjectTo) tooltip.append('span').attr('class', 'under').text(` · under ${d.subjectTo}`);
}
function hideTooltip() { tooltip.attr('hidden', true); }

// ---- Legend: the three kinds and the two edge types, side by side ----

function drawLegend() {
  const legend = d3.select('#legend');
  const grey = '#7d8792';
  let group;   // the column being filled
  const swatch = (draw, label) => {
    draw(group.append('svg').attr('width', 26).attr('height', 14));
    group.append('span').text(label);
  };
  const rect = (s) => s.append('rect').attr('x', 4).attr('y', 3).attr('width', 18).attr('height', 8);

  group = legend.append('div').attr('class', 'group');
  group.append('div').attr('class', 'head').text('kind');
  swatch(s => rect(s).attr('fill', grey).attr('fill-opacity', 0.55), 'state');
  swatch(s => { rect(s).attr('fill', grey).attr('fill-opacity', 0.25); rect(s).attr('fill', 'url(#hatch)'); }, 'people');
  swatch(s => rect(s).attr('fill', grey).attr('fill-opacity', 0.42), 'not classified');

  group = legend.append('div').attr('class', 'group');
  group.append('div').attr('class', 'head').text('border');
  swatch(s => rect(s).attr('fill', grey).attr('fill-opacity', 0.42).attr('stroke', '#3d434a').attr('stroke-width', 0.8),
    'better documented');
  swatch(s => rect(s).attr('fill', grey).attr('fill-opacity', 0.42).attr('stroke', '#3d434a').attr('stroke-width', 0.8)
    .attr('filter', softEdge(1, [[0, 0], [20, 20]])), 'approximate');
}
