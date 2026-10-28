# Direction B — Kinetic poster

A Swiss typographic poster that moves. Near-black `#0A0A0A`, paper white
`#F2F2ED`, and one acid yellow `#E8FF3B`. That is the whole palette.

## The idea

Müller-Brockmann discipline brought to life: a visible 12-column grid, numerals
at 200px, asymmetry inside order, crop marks at the page edge. Archivo at
extreme weight and size (`letter-spacing: -0.06em`, `line-height: 0.82`) with
IBM Plex Mono for all meta, and Instrument Serif italic used exactly once as a
counterpoint word.

The copy does real work. The closing statement is **"Open it. Close the tab.
Lose nothing."** — which is the entire privacy argument in seven words, and is
better than any feature list could be.

## Motion

1. Counter-scroll type — the hero word translates against the scroll direction.
2. Mask-wipe reveal — headlines clip open per line, not a plain fade.
3. Angled ticker at `-2deg`, duplicated for a seamless loop, pauses on hover.
4. Magnetic CTA — the label tracks the cursor a few pixels and snaps back.
5. Numeral count-up on scroll.
6. Cursor-follow accent dot on desktop only.

rAF-throttled throughout; nothing animates but transform/opacity/clip-path.
`prefers-reduced-motion` resolves everything, and the cursor dot plus magnetic
effect are disabled on `(hover: none)`.

## Not-generic, specifically

No gradient of any kind. One accent colour used sparingly enough that it still
carries meaning. Numerals as graphics — `04` half-bleeding off the right edge
at 26vw, at 4% opacity, so it reads as a watermark rather than a heading. The
grid is visible, which is a risk most pages avoid and this one leans into.

## Run

```
npx serve previews/B-kinetic
```

## Files

- `index.html` — markup, one `h1`, line-mask structure for the wipes
- `style.css` — 12-column grid, ticker, magnetic CTA, breakpoints
- `motion.js` — counter-scroll, mask wipes, ticker, magnetic, cursor dot
- `shot-1440.png`, `shot-mid.png`, `shot-full.png`, `shot-390.png`
