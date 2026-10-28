# Direction A — Printed matter

A letterpress broadsheet. The argument: a résumé is printed matter, so the page
that sells the résumé is printed matter too.

## The idea

Paper `#F4F0E6`, ink `#12100C`, and exactly one spot ink — a vermilion
`#B33A1E` that appears four times on the whole page. Instrument Serif at
broadsheet display size, Archivo for UI, IBM Plex Mono for folios and
captions. A masthead with rules above and below, a folio line, multi-column
body type with a drop cap, hairline column rules, and a colophon footer.

The single best thing on the page is the **"as set / as parsed"** spread: the
same résumé shown twice — as designed on the left, as an applicant tracking
system flattens it on the right — with the losses annotated in vermilion
("two-column skills table dropped, 6 entries lost"; "heading 'Education' not
found"). That is the product's differentiator made visible instead of claimed.

## Motion

1. Ink bleed on load — masthead rules draw from the centre, headline words fade
   up with a blur-to-sharp stagger.
2. The printing press — a shutter passes across a specimen sheet once, on
   scroll into view, like a sheet going under the roller.
3. Drop cap swell, section rules settle, colophon rules draw in sequence.
4. Nav marks the section you are reading via `aria-current`.

All on transform/opacity. `prefers-reduced-motion` resolves every element to
its final state and adds no motion at all.

## Not-generic, specifically

No gradient, no glass, no glow, no centred blob. No icon cards. One typeface
per job. Misregistration — the spot ink offset from the ink — because a cheap
press prints that way. Real letterspacing on the small caps. The paper grain is
a hard-stop gradient, not a soft blend.

## Run

```
npx serve previews/A-letterpress
```

Or open `index.html` directly — fonts are self-hosted and referenced
relatively, so it works from `file://` as well.

## Files

- `index.html` — markup, one `h1`, inline SVG only
- `style.css` — tokens, broadsheet grid, motion
- `motion.js` — reveal observer, masthead, press, colophon, scroll spy
- `shot-1440.png`, `shot-mid.png`, `shot-full.png`, `shot-390.png`
