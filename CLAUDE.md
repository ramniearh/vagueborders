# Vagueborders — notes for Claude Code

An animated historical atlas of human polities, kept honest about uncertainty: **as vague as the data, no more, no less.**
It's an informal hobby project, and the owner is using it to **learn to code with Claude Code**.

**Read PLAN.md first.** For measured facts about the dataset, see `notes/data-audit.md`.

## Where things stand (Nov 2026)

- Planning and a data audit are done.
- **Phase 1 done:** dataset cloned to `data/raw/` @ `4b5039e`; `pipeline/years.js` writes `docs/data/years.json` (54 years, −123000…2010; `world_bc1` → −1, i.e. 1 BCE, no year 0); LICENSE (GPL-3.0); d3 v7.9.0 + topojson-client v3.1.0 in `docs/vendor/`.
- **Phase 2 done:** `npm install` then `npm run build` (`pipeline/build.js`, mapshaper as a dev dependency) writes `docs/data/world_{year}.topo.json` (year as in years.json, e.g. `world_-2000`) + `polities.json`. Each TopoJSON has one object, `polities`, with properties `{name, precision (1|3), subject_to, type_raw}`. 4.90 MB / 1.19 MB gzipped; flood check passes for all 54. No `-filter-slivers` (it deleted Venice etc.); see PLAN.md.
- **Phase 2b done:** `data/identities.csv` (284 rows; `Name@from..to` year ranges allowed in dataset_names) is read by `pipeline/identities.js`. Features now also carry `id`, `kind` (state/people), `kind_source` (curated/dataset); null properties are omitted (missing = null). `docs/data/identities.json` maps id → `{name, wiki}`. Wiki titles verified against the Wikipedia API. Rows are Claude's draft: the owner is reviewing them.
- **Phase 3 done:** `docs/index.html` + `style.css` + `map.js` draw one snapshot (pick it with the temporary `<select>` or `?year=1279`). Real polygons; precision 1 → per-part Gaussian blur (σ = 9% of the smaller dimension, floor 0.8, cap 2.5), precision 3 → crisp. Kind looks, labels, tooltip and legend are in. See PLAN.md's Phase 3 result.
- `sketch/vagueborders-sketch.html` (if the owner has added it) is the reference for layout, palette and type only. Its blur effect is superseded; see PLAN.md.
- `.claude/launch.json` has a `docs` preview server (port 8000), plus `docs-alt` (8010) and `docs-3` (8020) for when those are taken by another chat.
- **Phase 4 done:** `docs/time.js` preloads all 54 snapshots and projects each once (cached). It drives the slider (one step per snapshot, era bands, ticks), the year + era readout, ▶ play (1.6 s per step, 450 ms fades), ←/→ and space, and `?year=`. The cross-fade uses two stacked `<svg>` layers faded on the GPU (each carries its own `people-mask-a`/`-b` and labels). While playing, the next snapshot is pre-painted into the hidden back layer. Reduced motion → no autoplay, instant swaps. See PLAN.md's Phase 4 result.
- **Phase 5 done:** `docs/panel.js`: click a polity → name, lineage, "under X", kind + source, border in words, a clickable per-snapshot strip, a Wikipedia summary (curated link, or exact-title "machine-matched", else none), and a prefilled "Wrong? Open an issue" link. The selection follows its id across snapshots. `identities.json` entries now also carry `years`. See PLAN.md's Phase 5 result.
- **Phase 6 done:** `docs/about.js` (the "How vague is this?" `<dialog>`, text in index.html, plus live per-snapshot numbers) and `docs/find.js` (search over all names + lineage names via `<datalist>`, jumping to the nearest snapshot; a random-polity button). Credits footer, favicon, `docs/.nojekyll`. Precision switches from 1 to 3 at **1650**, not 1920 (PLAN.md corrected). Pages serves `main` `/docs`. `.claude/launch.json` also has `docs-4` (8030). See PLAN.md's Phase 6 result.
- **Layout fit done (Nov 2026):** the globe is sized to fit the window (header, globe and slider on one screen), the header is one row, the year and legend sit inside the circle (upper-left Pacific, placed in `cqw`), the panel sits beside the globe, and a ring + leader line points from the selected polity to the panel. See PLAN.md's "Layout fit".
- **Next:** all planned phases are done; see PLAN.md's "Later, maybe". Update this section whenever a phase is finished.

## Layout

```
docs/            live site (GitHub Pages serves this folder)
docs/data/       pipeline output — never hand-edit
docs/vendor/     local copies of d3 + topojson-client
pipeline/        Node scripts that write docs/data/
data/raw/        git-ignored dataset clone (pinned commit)
data/identities.csv   hand-curated identity table (Phase 2b)
notes/           data audit and other notes
sketch/          design mockup (reference only)
```

## Hard rules

- Static site, vanilla JS, D3 v7, no framework, no build step.
- Dataset pinned at `aourednik/historical-basemaps@4b5039e`. Repo licence GPL-3.0.
- Vagueness must reflect the data: BORDERPRECISION 1 (or 2) → soft edge; 3 → crisp edge. No blur for decoration.
- Never interpolate geometries between snapshots.
- Fix winding **after** simplification, polygon by polygon (`d3.geoArea(outer ring) > 2π` → reverse). Check all 54 files.
- Colour = `hsl(hash(identity id), 45%, 50%)`. Labels always show the dataset's own name for that snapshot.
- Wikipedia: use the curated title from the identity table if there is one; otherwise use a near-exact match labelled "machine-matched"; otherwise show nothing. Never guess.
- Unnamed features stay unnamed: faint grey, no label.
- Kind has three looks: state / people / not classified. Use the curated `kind`, else the mapped dataset `TYPE`, else "not classified". Never guess a kind, and never use an "empire" category. Kind changes only fill strength and texture, never hue or edge.
- Use the palette, type and layout from PLAN.md. Don't invent new styles.

## How to work with the owner

- One phase per session. At the end, stop, show the result and say what to check.
- Owner is learning: briefly explain what you're doing and why, in plain language. Keep code short, readable and commented where it isn't obvious. When a command is worth knowing, show it and suggest the owner run it.
- Keep it light: no tests, CI or abstractions unless they clearly save effort.
- Preview: `python3 -m http.server -d docs 8000` → http://localhost:8000. If Playwright is available, screenshot the test years (bc2000, 1279, 1500, 1920) and look at them yourself before reporting.
- Small commits with plain messages.
- If PLAN.md turns out to be wrong about something, say so, pick the simplest honest fix, and update PLAN.md.
