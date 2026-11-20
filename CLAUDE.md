# Vagueborders — notes for Claude Code

An animated historical atlas of human polities, kept honest about uncertainty: **as vague as the data, no more, no less.**
It's an informal hobby project, and the owner is using it to **learn to code with Claude Code**.

**Read PLAN.md first.** For measured facts about the dataset, see `notes/data-audit.md`.

## Where things stand (Nov 2026)

- Planning and a data audit are done.
- **Phase 1 done:** dataset cloned to `data/raw/` @ `4b5039e`; `pipeline/years.js` writes `docs/data/years.json` (54 years, −123000…2010; `world_bc1` → −1, i.e. 1 BCE, no year 0); LICENSE (GPL-3.0); d3 v7.9.0 + topojson-client v3.1.0 in `docs/vendor/`.
- `docs/index.html` is still a placeholder so the GitHub Pages URL works straight away.
- `sketch/vagueborders-sketch.html` (if the owner has added it) is the reference for layout, palette and type only. Its blur effect is superseded; see PLAN.md.
- **Next: Phase 2.** Update this section whenever a phase is finished.

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
- Use the palette, type and layout from PLAN.md. Don't invent new styles.

## How to work with the owner

- One phase per session. At the end, stop, show the result and say what to check.
- Owner is learning: briefly explain what you're doing and why, in plain language. Keep code short, readable and commented where it isn't obvious. When a command is worth knowing, show it and suggest the owner run it.
- Keep it light: no tests, CI or abstractions unless they clearly save effort.
- Preview: `python3 -m http.server -d docs 8000` → http://localhost:8000. If Playwright is available, screenshot the test years (bc2000, 1279, 1500, 1920) and look at them yourself before reporting.
- Small commits with plain messages.
- If PLAN.md turns out to be wrong about something, say so, pick the simplest honest fix, and update PLAN.md.
