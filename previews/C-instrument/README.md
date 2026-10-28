# C-instrument — Resume Studio landing page

A single-page technical-drawing landing page for **Resume Studio**. The visual
language is an engineering blueprint / instrument panel: the product is precise
and private, so the page reads like the documentation for a precision instrument.

Files in this folder only — no source, no `src/`, nothing outside `previews/C-instrument/`.

| File | Purpose |
| ---  | --- |
| `index.html` | Semantic content + all inline SVG line art |
| `style.css` | Layout, tokens, drawing kit, breakpoints, reduced-motion |
| `motion.js` | Line-draw, typewriter, gauge fill, pointer crosshair |
| `README.md` | This file |
| `shot-*.png` | Visual QA captures: hero, schematic, parser, ledger, lower, end, 390 |

## Run / verify

**Serve it; don't open it from `file://`.** Chrome blocks cross-origin font
loads from `file:` URLs, so the self-hosted faces silently fail and the page
falls back to system mono. From the repo root:

```
npx serve -l 4173 .
# then: http://localhost:4173/previews/C-instrument/index.html
```

Screenshots (repo root has `playwright` installed):

```
npx playwright screenshot --viewport-size=1440,900 "http://localhost:4173/previews/C-instrument/index.html" shot-1440.png
npx playwright screenshot --viewport-size=390,844 "http://localhost:4173/previews/C-instrument/index.html" shot-390.png
```

The typewriter runs once on scroll-in and takes ~4 s; wait before capturing or
the readout is caught half-typed.

Fonts are referenced relatively: `../../public/fonts/*` — they are not copied
or duplicated. `prefers-reduced-motion` resolves every animation to its final
state; the page is fully readable with JS and animation off.

## Design system

- **Palette** — three hues only: blueprint navy `#0B1420`, line blue `#2C4A63`,
  paper white `#E8EDF0`, and signal amber `#FFB020` for live state only.
  Everything else is an alpha tint of one of the three.
- **Type** — IBM Plex Mono is the text face (set generously; the smallest size
  is ~9.5px and it is used only for micro-labels). Archivo 600 carries the two
  large statements. Instrument Serif italic appears once.
- **Radius** — 0 everywhere (the `*` poison rule enforces it).
- **Layout count** — the app ships ten templates (src/components/templates/), so the copy says ten, not nine.\n- **Geometry** — dimension lines with arrowheads and real measurement labels
  (`1123 px · 297 mm`, `794 px · 210 mm · A4`), a corner frame with zone
  letters, a title block, a revision cloud (REV C), crosshairs at the page
  corners, a faint graph-paper grid, and an SVG résumé schematic with leader
  lines to the real ATS category weights (25/12/12/22/8/8/13).

## Motion (all `transform` / `opacity` / `stroke-dashoffset`)

1. **Line draw on scroll** — every construction line, dimension, leader and the
   revision cloud sets a real `--len` from `getTotalLength()` and draws on
   enter (staggered per group: construction → callouts → note). `--delay` is
   scoped per group so each path inherits its own offset.
2. **Typewriter readout** — the mono status readout (`● ATS 92/100 · LOCAL`,
   `NETWORK: NONE`, …) types once, newlines breathe at ~200ms, blocks spend
   ~16–36ms. Blinking block cursor (`caret--idle`) starts on completion.
3. **Gauge** — 40 hairline `i` elements; the first 37 fill amber with an 80 +
   20ms stagger on enter. Heights are a sine/cosine profile so the silhouette
   reads as the seven weighted categories, not 40 identical ticks.
4. **Crosshair** — on the schematic only, `(hover:hover) and (pointer:fine)`
   gated so touch never gets it. Readout reports coordinates in **shape units**
   (1200×740), not CSS px, so numbers stay true at any width. Live dot pulses
   at 1.2s with `steps(2, end)`.

## Layout

- 1440 — full drawing (`viewBox 0 0 1200 740`), two-column instruments.
- 1024 → panel and parts collapse to one column.
- 390 → the wide schematic is **hidden and replaced** by a narrower redrawn
  schematic (`360×410`) inside the same markup, so nothing is squeezed into
  illegibility. `overflow-x: clip` on the body and no fixed overhang.

## Intentional choices

- The CTA links to the repository, not to a live deployed app — it is the only
  real destination that exists. The top CTA reads "OPEN THE BUILDER" as a
  straight, loaded link, engineering-drawing style.
- Numbers shown are real, taken from `src/utils/atsScorer.js`: A4 `1123px`,
  the 25/12/12/22/8/8/13 weight table, the category count, and the
  `~/src/utils/*` facts the page states ("npm run jobs:api", "port 3457").
- The "parser view", "no columns · no tables · no glyphs" callout summarises the
  real `atsTextView.js` intent (text-only render, single-column).
