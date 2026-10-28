# Direction E — Pick it up

The résumé is a physical object. Drag it to rotate in 3D, flick it and it keeps
turning, release and it settles. The front is what you wrote. The back is what
the machine reads of the same page.

## Why this is the difficult one

Not the CSS 3D — that is a `rotate3d` on a wrapper with
`transform-style: preserve-3d` and two `backface-visibility: hidden` faces. The
hard part is that the card has to *feel* like it has mass.

- **A spring, not a tween.** A CSS transition snaps to a fixed duration no
  matter how hard you throw. This integrates a spring-damper
  (`stiffness 118`, `damping 19.5`, ζ ≈ 0.78) so the travel and the deceleration
  both scale with the throw. That is the entire illusion.
- **Momentum is real.** Pointer velocity is smoothed (`0.6 prev + 0.4 new`) and
  becomes angular velocity on release, capped at 900°/s so a violent flick
  cannot spin the card for seconds — a physical card would not.
- **Rubber-band limits.** Past either face the drag is damped by `0.34` rather
  than clamped, so the card feels attached rather than stuck.
- **A flick is caught mid-flight.** Pointerdown cancels the running rAF and
  takes over that frame. Nothing is queued, so grabbing a spinning card feels
  immediate.
- **dt is clamped to 32ms.** A backgrounded tab resumes with a huge delta that
  would otherwise explode the integration and fling the card somewhere absurd.
- **Target selection uses lookahead, not proximity.** The card lands on the face
  it is *heading toward* (`ry + velocity * 0.34`), so a hard throw to the back
  does not snap back to the front. Deliberate flips name their target
  explicitly, because an inferred one quietly undid itself.
- **The glare is material.** A specular highlight whose opacity falls as
  `exp(-|sin θ|)` — brightest facing you, dimmest edge-on. It is what makes the
  card read as catching light rather than as a flat rectangle.

## Bugs this build hit, and how they were caught

1. The flip button did nothing. `toggleFlip` set `ry` to the face and *then*
   computed velocity from the distance to the target — always zero.
2. Even fixed, the spring settled back to front: the lookahead window was 0.16s,
   so a 468°/s throw projected only 75°, still "front". Widened to 0.34s.
3. The button had no accessible name. The char-split replaced spaces with
   `&nbsp;`, making the name `"Flip\u00a0it"` — breaks selectors and is wrong
   for assistive tech. Spaces now get their own padded span.

All three were found by scripted assertions, not by looking.

## Verified

`node previews/audit.mjs` — flip front → 180° → front, drag rotates and settles
at 180°, no overflow 320–1920, no JS errors, one `h1`, every control named,
reduced motion resolves (rotation snap instead of inertia), readable with JS off.

## Files

`index.html` · `style.css` · `motion.js` · `shot-1440.png` · `shot-back.png` ·
`shot-mid.png` · `shot-full.png` · `shot-390.png`
