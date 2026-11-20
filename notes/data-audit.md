> Copied from the planning project. Machine-generated audit (Nov 2026).
> Its last section ("Workflow correction for Cowork") no longer applies: the build has moved to Claude Code.
> Its fixes are already folded into PLAN.md; this file is kept for the measured figures.

# Data audit of the vagueborders plan (AI-generated, Nov 2026)

Measured against `aourednik/historical-basemaps` @ commit `4b5039e`. All figures produced by running code against the dataset, not by reading documentation.

## Dataset facts

- 54 year snapshots, −123000 to 2010. 17,783 features total; 134–1,946 features per year.
- 41% of features have a null NAME (islands, unclaimed land, Antarctica).
- 3,001 distinct names; 52% appear in exactly one snapshot; 62+ near-duplicate spellings.
- BORDERPRECISION: 1 → 11,048; 3 → 6,713; **2 → 4**. The three-tier design is effectively binary.
- Reversed exterior rings in **42 of 54 files**, mixed within files. 1500 is not a special canary.
- Processed via `mapshaper -simplify 4% keep-shapes -filter-slivers -o format=topojson precision=0.01`: **4.9 MB total, 1.10 MB gzipped**, only 1492 exceeds 300 KB (624 KB).
- Licence is **GPL-3.0**, not an open-data licence.
- The dataset changes upstream between clones. Pin the commit.

## Blocking issues

1. **Blur spec destroys legibility.** The sketch's stdDeviation 4/8/12 across three layers was approved against a sketch of 8 hand-drawn ellipses. On real polygons the map becomes fog. Fix: blur scaled to ~9% of each feature's smaller screen dimension, applied to a stroked edge over a flat ~42% fill.
2. **Identity model breaks the central pedagogy.** `id = slug(NAME)` splits Rome into 7 slugs (Rome / Roman Republic / Roman Empire / Rome (Constantinus…) / Western + Eastern Roman Empire / Byzantine Empire) and Ming into 2. Needs a canonical-identity table (stage 2b, ~½ day, ~200 entities).
3. **The dataset is an atlas of peoples, not empires.** The ten most persistent entities are all hunter-gatherer / subsistence categories, none a state. The "empires balloon and pop" pitch does not match the data.
4. **Unreviewed Wikidata top-hit matching is a reputational risk**, because most named entities are Indigenous and ethnolinguistic groups, many extant. Require near-exact label matches, label links as machine-matched, prefer showing nothing.
5. **Some sandboxes block Wikimedia and JS CDNs.** Vendor D3 locally; resolve Wikipedia links client-side instead of in the pipeline.

## Simplifications

- No lazy-load / cache / prefetch; preload all 54 snapshots at once.
- Winding fix: per-polygon `d3.geoArea(exterior) > 2π → reverse`, applied after simplification. Blanket rewinding fails.
- Projection: north-pole azimuthal equidistant centres Europe and smears the southern hemisphere; consider a second projection behind a button, or justify it in the about panel.
