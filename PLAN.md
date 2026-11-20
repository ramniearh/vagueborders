# vagueborders — plan

*all borders approximate. some borders imaginary.*

## What this is

A one-stop, animated view of how human polities spread, merged and disappeared, from the dataset's earliest snapshot to 2010. It's for the public and for me, and it's an informal project. It is also how I'm teaching myself to build things with Claude Code.

## The principle: as vague as the data, no more, no less

Here "precise" means being precise about how uncertain things are.

- **Don't add vagueness the data doesn't have.** No decorative blur on borders the dataset marks as better documented. Simplify geometry only as far as it doesn't change what a reader would conclude.
- **Don't hide vagueness the data does have.** Borders flagged as approximate look visibly softer. Snapshots are point samples, not continuous history. Unnamed areas stay unnamed. An uncertain Wikipedia link is left out, not guessed.
- **Where the data says nothing about its own uncertainty, say so in words.** That covers how exact the snapshot dates are and who drew a border. Put it in the About and info panels rather than inventing a visual signal for it.
- **Show what kind of entity something is only where that's known.** Kind (state / people) gets a visual look only when the dataset's `TYPE` field or the curated identity table says so. Everything else looks visibly "not classified", never guessed into one of the two.
- **Never interpolate between snapshots.** A jump between two snapshots is the honest picture.

## Data facts (measured: see `notes/data-audit.md`)

- `aourednik/historical-basemaps`, **pinned at commit `4b5039e`**. The dataset changes upstream, so always use the pinned commit.
- 54 snapshots from −123000 to 2010, with 17,783 features in total.
- 41% of features have no name (islands, unclaimed land, Antarctica). 3,001 distinct names, and 52% of them appear in only one snapshot.
- `BORDERPRECISION` is effectively binary: 1 → 11,048 features, 3 → 6,713, 2 → 4. Treat 2 as 1, since rounding toward "uncertain" is the honest choice.
- 42 of 54 files have reversed outer rings, mixed within files.
- Licence: **GPL-3.0**.
- **It's mostly an atlas of peoples, not empires.** The most persistent entities are hunter-gatherer and subsistence categories. The map shows "who was where, roughly", states included. Don't pitch it as "watch empires rise and fall", and label what kind of entity something is wherever that's known.
- **The dataset rarely says what kind of entity a feature is.** About 1,600 of 17,783 features (~9%) have a `TYPE` or `type` field, mostly in the earliest snapshots (e.g. "hunter-gatherers", "pastoral nomads", "kingdom", "state society"). Nothing distinguishes an empire from any other state, so the category is "state", not "empire".

## Decisions

| | |
|---|---|
| Geometry | historical-basemaps @ `4b5039e` |
| Licence | GPL-3.0 for the repo, matching the dataset |
| Projection | `d3.geoAzimuthalEquidistant`, North Pole centred, clipAngle ~150 (UN-emblem look). It centres Europe and stretches the south; the About panel says so. A second projection is a "later, maybe". |
| Time | 54 discrete snapshots; the slider moves through them one by one, ignoring the uneven year gaps; no interpolation |
| Identity | A hand-curated identity table for ~200 major entities, so lineages keep one colour (e.g. Roman Republic → Empire → Byzantium). Everything else is identified by a slug of its name. The colour follows the lineage; the label always shows the dataset's own name for that snapshot. |
| Kind | Three looks: **state**, **people**, **not classified**. The curated `kind` wins; otherwise the dataset's `TYPE`/`type` is mapped (below); otherwise not classified. No "empire" category, because the data can't support one. |
| Links | Curated Wikipedia title from the identity table. Otherwise a near-exact title match done in the browser and labelled "machine-matched". Otherwise nothing. |
| Stack | Vanilla JS + D3 v7 + topojson-client, copied into `docs/vendor/`; no build step. Offline Node pipeline using mapshaper. |
| Hosting | GitHub Pages serving `/docs`; processed data committed in `docs/data/` |

## Phases

One phase per Claude Code session. Stop at the end of each one and check the result.

**1 — Scaffold & data.** Fetch the pinned commit into `data/raw/` (git-ignored). Write `docs/data/years.json` (sorted integers, BCE as negatives). Add a GPL-3.0 `LICENSE`. Record the credits in the README. Copy D3 and topojson-client into `docs/vendor/`.
*Done when:* years.json has 54 entries from −123000 to 2010.

**2 — Pipeline.** For each year:
- normalise each feature to `{name | null, precision (1|3), subject_to, type_raw | null}`, where `type_raw` is the dataset's `TYPE` or `type` value, kept as-is;
- simplify with `mapshaper -simplify 4% keep-shapes -filter-slivers`, then output TopoJSON with `precision=0.01`;
- **after** simplifying, fix winding polygon by polygon: if `d3.geoArea(outer ring) > 2π`, reverse it (rewinding the whole file blindly doesn't work);
- write `docs/data/world_{year}.topo.json`.

Also write `polities.json` (each name → the snapshots it appears in).
*Done when:* output is about 5 MB in total (about 1.1 MB gzipped), and **no file out of the 54** has a polygon that floods the whole globe. Check all of them, not just the test years.

**2b — Identities.** Create `data/identities.csv` with the columns `id, display_name, dataset_names (|-separated), kind (state / people / other / unknown), wiki_title`. Fill in about 200 rows covering the most persistent or prominent entities; Claude drafts them and I review. The pipeline attaches the identity id, and unmatched names keep their slug.

The pipeline also attaches `kind` (`state` / `people` / `null`) and `kind_source` (`curated` / `dataset` / `null`):
1. the curated `kind`, if the name is in the table (`other` and `unknown` → `null`);
2. otherwise `type_raw`, mapped: "kingdom", "kingdoms", "state society" → `state`; hunter-gatherer, forager, farming, pastoral, nomad, culture and chiefdom values → `people`; anything else (e.g. "civilization") → `null`;
3. otherwise `null`, meaning "not classified".

*Done when:* Rome keeps one colour from Republic to Byzantium, Ming is a single entity, the label still shows each snapshot's own name, and the pipeline prints how many named features got each kind and from which source.

**3 — The map.** Draw a sphere and a faint graticule. Each polity gets a flat fill at about 42% opacity plus an edge stroke:
- precision 3 → a thin, crisp edge;
- precision 1 → the edge blurred by about 9% of the feature's smaller on-screen dimension (with a cap).

Unnamed areas are a very faint grey with no label. Colour = `hsl(hash(id), 45%, 50%)`. The tooltip shows the name, plus "under X" when there's a `subject_to`.

Kind changes the fill strength and texture only, never the hue (identity) or the edge (precision):
- **state** → fill at about 55% opacity; label in small caps;
- **people** → fill at about 25% opacity plus one shared diagonal hatch in ink at low opacity;
- **not classified** → the plain ~42% fill.

A small legend shows the three kinds and the two edge types.
*Done when:* the test years bc2000 / 1279 / 1500 / 1920 are legible, you can tell approximate borders from better-documented ones at a glance, and you can tell states, peoples and not-classified areas apart without the legend getting in the way.

**4 — Time.** Preload all snapshots, since the whole set is small. Then:
- a slider over the snapshots with a big year label (BCE/CE);
- era bands, with a "Prehistory" band for the sparse early snapshots;
- ▶ play with about 1.6 s per snapshot and ~450 ms cross-fades keyed by id;
- ←/→ steps and space toggles play;
- with `prefers-reduced-motion`: no autoplay and instant swaps.

*Done when:* playing from the earliest snapshot to 2010 is smooth.

**5 — Info panel.** Clicking a polity shows:
- the name in this snapshot and the lineage name;
- its kind and where that comes from ("curated", "from the dataset"), or "not classified";
- the snapshots it appears in;
- the border in words: "approximate border" or "better-documented border";
- a Wikipedia summary, following the link rule above;
- a "Wrong? Open an issue" link.

**6 — Honesty panel & ship.** A "How vague is this?" About panel covering:
- the source (crowd-drawn, GPL, pinned commit);
- what a snapshot is;
- that the precision flag is binary;
- that the data is mostly peoples, not just states, and that most areas aren't classified by kind at all;
- the projection's distortion;
- what is *not* shown.

Plus search, a random button, an attribution footer, a mobile check and deployment.

## Later, maybe

Shareable URLs (`?year=-500&id=achaemenid`), a second projection, a lifespan strip for the selected entity, side-by-side comparison of two years.

## Design spec (from the approved sketch; rendering rule revised)

- **Palette:** paper `#f7f6f1`, map fill `#fffdf8`, ink `#2b2e33`, graticule `#93a6b2` / faint `#c9d3da`, muted text `#6c7480`. Polity colour = `hsl(hash(id), 45%, 50%)`, never a categorical palette.
- **Type:** Georgia/serif body. Wordmark "**vague**borders" in small caps with wide letter-spacing. Year readout and labels in system monospace; the year is large (≥40px on desktop) with the era name beneath in letterspaced uppercase.
- **Rendering:** as in Phase 3, including the three kind looks (state: stronger fill + small-caps label; people: lighter fill + ink hatch; not classified: plain fill). The sketch's three-layer heavy blur was approved against hand-drawn ellipses and turns real polygons into fog, so it is **superseded**.
- **Layout:** map full-width (max ~760–900px), year box top-left over the map, info panel top-right (collapses on mobile). Controls row below: play (solid ink), random (outline), era-banded slider. Italic footer with the tagline.
- **Motion:** 400–500ms opacity cross-fades keyed by id; ~1.6s per snapshot when playing; respect reduced motion.

## Checking the work

Test years: bc2000, 1279, 1500, 1920. Also scan all 54 snapshots for a globe flooded with one colour. Where possible, Claude screenshots the page itself (e.g. with Playwright); I look too.
