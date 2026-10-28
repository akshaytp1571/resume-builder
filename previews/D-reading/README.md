# Direction D — The reading

The page performs an ATS parse. A beam sweeps the résumé; to its left is the
text a machine extracted, to its right is the design a human made. You drag the
beam yourself.

## Why this is the difficult one

The lens is not a video, a sprite, or a scroll-scrubbed timeline. It is two
identical layers stacked in one grid cell, each clipped to the complement of the
other, both driven from a single custom property `--scan`. One rAF write moves
the beam *and* both clip paths, so the layer boundary is pixel-locked to the
beam at any speed.

The parts that take real engineering:

- **One property, three consumers.** `--scan` feeds `clip-path` on the designed
  sheet, `clip-path` on the parsed twin, and `translateX` on the beam. They
  cannot drift apart because there is only one number.
- **No layout in the pointer path.** The stage rect is measured on grab and on
  resize, never per move. `getBoundingClientRect` inside a pointermove forces
  layout and would cap the drag at whatever the last frame could afford.
- **Frame-coalesced writes.** Pointer events can fire faster than frames; the
  write is queued and executed once per rAF, so a high-polling-rate mouse does
  not thrash.
- **Loss annotations are derived, not hand-placed.** Each note reads its own
  `left` from CSS and converts it to a scan threshold, so moving a note in the
  stylesheet moves its reveal with it.
- **It is also a slider.** The stage carries `role="slider"`,
  `aria-valuenow`/`aria-valuetext`, and full arrow/Home/End/PageUp support. A
  screen reader gets the parse position as state, not a mystery.
- **Autoplay on first view.** The beam runs itself once when the lens enters the
  viewport, so the idea explains itself without a click — then hands control
  over permanently.

## Motion

- The beam travel uses a `1 - (1-t)^2.2` ease: fast out of the gate, slow at the
  end, like a scanner finishing a page. 2.6s, long enough to read the text change.
- Headline lines mask up on load. Button labels split per character and lift in
  a staggered wave on hover; the split preserves real spaces so the accessible
  name stays `"Flip it"` and not `"Flip\u00a0it"`.
- Reduced motion: no autoplay, no wave, no bloom. The lens still works, because
  the lens is the content — but dragging snaps instead of gliding.

## Verified

`node previews/audit.mjs` — no overflow 320–1920, no JS errors, one `h1`, every
control named, reduced motion resolves fully, readable with JS disabled.

## Files

`index.html` · `style.css` · `motion.js` · `shot-1440.png` · `shot-mid.png` ·
`shot-full.png` · `shot-390.png`
