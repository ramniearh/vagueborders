# vagueborders

*all borders approximate. some borders imaginary.*

An animated atlas of human polities and peoples from the earliest snapshots to 2010. It aims to be as vague as the underlying data and no more: borders the data marks as approximate look approximate, and nothing is interpolated between snapshots. It's a tool for building intuition, not a reference work.

**Live:** https://ramniearh.github.io/vagueborders/

Click a shape for what the data says about it; "how vague is this?" explains what the map can and can't tell you. Plans and decisions are in `PLAN.md`.

## Run locally

```
python3 -m http.server -d docs 8000
```

Then open http://localhost:8000.

## Deploy

GitHub Pages serves the `docs/` folder of `main` (Settings → Pages → Deploy from a branch → `main` / `/docs`). There's no build step: push, and the site updates a minute later. `docs/.nojekyll` tells Pages to serve the files as they are.

## Rebuild the data

The dataset is cloned (git-ignored) into `data/raw/` at the pinned commit:

```
git clone --filter=blob:none --no-checkout https://github.com/aourednik/historical-basemaps.git data/raw
git -C data/raw checkout 4b5039e
npm install
npm run years
npm run build
```

`npm run build` simplifies every snapshot with [mapshaper](https://github.com/mbloch/mapshaper) and writes `docs/data/world_{year}.topo.json` plus `docs/data/polities.json`. It fails loudly if any polygon would flood the globe.

## Credits & licence

- Historical borders: [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) @ `4b5039e`, GPL-3.0
- Summaries and links: Wikipedia
- Rendering: [D3](https://d3js.org) v7.9.0 and [topojson-client](https://github.com/topojson/topojson-client) v3.1.0 (ISC licence), copied into `docs/vendor/`

This repo is GPL-3.0, matching the dataset.
