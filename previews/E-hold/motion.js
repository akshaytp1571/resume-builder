/* ===========================================================================
   E — PICK IT UP

   The card is a physical object with angular momentum — and, when you hover
   it, curiosity. Rest your pointer on it and it leans toward the cursor and
   lifts off the table; grab it and the lean hands over to the drag mid-frame.

   Model: two values drive everything.
     ry      — rotation about Y (the flip/drag). Integrated by a spring-damper
               on release so throws carry real momentum.
     lean    — a small (max 7°) pitch/yaw pair that tracks the pointer while
               hovering, lerped, plus a lift in px. Disabled while held, on
               touch, and under reduced motion.

   One master rAF loop owns ALL of it. The earlier version let the spring loop
   and the pointer handler both write `transform`, which is two writers on one
   property — they raced, and a grab during the settle animation visibly
   snapped. Now there is a single writer: the loop integrates, lerps, and
   paints once per frame, and skips the style write entirely when nothing
   changed, so an idle page costs nothing.

   Everything is transform/opacity. The card is never re-laid-out.
   =========================================================================== */

(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const card = document.querySelector('[data-card]');
  const glare = card?.querySelector('.card__glare');
  const statusXy = document.querySelector('[data-xy]');
  const statusSide = document.querySelector('[data-side]');

  if (!card) return;

  /* ------------------------------------------------------------- the state */

  const FRONT = 0;
  const BACK = 180;

  // rotation
  let ry = FRONT;
  let velocity = 0;
  let settling = false;
  let settleTarget = FRONT;

  // hover lean + lift
  const LEAN_MAX = 7;      // degrees
  const LIFT_HOVER = -7;   // px
  let leanX = 0, leanY = 0;          // current, degrees
  let leanTX = 0, leanTY = 0;        // targets
  let lift = 0, liftT = 0;           // current/target, px
  let hovering = false;

  let held = false;
  let raf = null;
  let dirty = true;        // something changed; paint on next frame

  let pointerId = null;
  let lastX = 0;
  let lastT = 0;
  let pointerVel = 0;

  /* Degrees of rotation per pixel dragged. 0.62 means a full 180° turn needs
     about 290px of travel — one comfortable sweep on a phone. */
  const DEG_PER_PX = 0.62;

  /* Spring used to settle. Tuned so the card arrives with a small overshoot
     and no wobble: zeta ≈ 0.78. */
  const STIFFNESS = 118;
  const DAMPING = 19.5;

  /* Beyond this the drag rubber-bands, so the card feels attached. */
  const HARD_LIMIT = 208;
  const RUBBER = 0.34;

  function clampWithRubber(value) {
    const lo = FRONT - HARD_LIMIT;
    const hi = BACK + HARD_LIMIT;
    if (value < lo) return lo + (value - lo) * RUBBER;
    if (value > hi) return hi + (value - hi) * RUBBER;
    return value;
  }

  /* ---------------------------------------------------------------- paint */

  function paint() {
    /* Composition order matters: the lift is applied before the rotations so
       the card rises straight up off the table, and the lean is applied around
       X before the flip around Y so a leaning card still flips about its own
       spine. */
    card.style.transform =
      `translateY(${lift.toFixed(2)}px) ` +
      `rotateX(${leanY.toFixed(2)}deg) ` +
      `rotate3d(0, 1, 0, ${ry.toFixed(2)}deg) ` +
      `rotateY(${leanX.toFixed(2)}deg)`;

    // The glare recedes as the card turns away. exp(-|sin|) is the cheap form
    // of "brightest facing you, dimmest edge-on".
    const away = Math.abs(Math.sin((ry * Math.PI) / 180));
    card.style.setProperty('--tilt', away.toFixed(3));

    if (statusXy) statusXy.textContent = `ry ${Math.round(ry)}°`;
  }

  /** Which face is showing, by normalised angle. */
  function sideFor(angle) {
    const n = ((angle % 360) + 360) % 360;
    return n > 90 && n < 270 ? 'back' : 'front';
  }

  function setStatus() {
    const side = sideFor(ry);
    if (statusSide) statusSide.textContent = side;
    card.setAttribute(
      'aria-label',
      `Interactive résumé, ${Math.round(ry)} degrees, showing the ${side}. Drag to rotate.`
    );
  }

  /* -------------------------------------------------------- the master loop */

  function tick() {
    raf = requestAnimationFrame(tick);
    let active = false;

    // --- spring integration
    if (settling) {
      const now = performance.now();
      if (tick.last == null) tick.last = now;
      const dt = Math.min(0.032, (now - tick.last) / 1000);
      tick.last = now;

      const displacement = ry - settleTarget;
      const accel = -STIFFNESS * displacement - DAMPING * velocity;
      velocity += accel * dt;
      ry += velocity * dt;
      active = true;
      dirty = true;

      if (Math.abs(displacement) < 0.35 && Math.abs(velocity) < 6) {
        ry = settleTarget;
        velocity = 0;
        settling = false;
        tick.last = null;
        setStatus();
      }
    } else {
      tick.last = null;
    }

    // --- hover lean (lerp toward targets; never while held)
    if (!held && !reduced) {
      const dx = leanTX - leanX;
      const dy = leanTY - leanY;
      const dl = liftT - lift;
      if (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02 || Math.abs(dl) > 0.05) {
        leanX += dx * 0.11;
        leanY += dy * 0.11;
        lift += dl * 0.11;
        active = true;
        dirty = true;
      }
    }

    if (dirty) {
      paint();
      dirty = false;
    }
    void active;
  }

  /* Request a settle toward a face. A deliberate flip names its target: the
     inferred one used to quietly undo itself because the lookahead window was
     too short to project past halfway. */
  function settle(target = null) {
    if (target == null) {
      const projected = ry + velocity * 0.34;
      const normalised = ((projected % 360) + 360) % 360;
      target = normalised > 90 && normalised < 270 ? BACK : FRONT;
    }
    settleTarget = target;
    settling = true;
    tick.last = null;
  }

  /* --------------------------------------------------------------- pointer */

  function onDown(e) {
    if (e.button != null && e.button !== 0) return;
    held = true;
    pointerId = e.pointerId;
    lastX = e.clientX;
    lastT = performance.now();
    pointerVel = 0;
    velocity = 0;
    settling = false;
    // The lean hands over to the drag: current lean decays through the loop
    // while held is false — but it is NOT false right now, so freeze it by
    // zeroing the targets; the lerp will glide the lean back to zero under
    // the pointer, which is exactly what a grabbed card does.
    leanTX = 0;
    leanTY = 0;
    liftT = 0;
    card.classList.add('is-held');
    card.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  function onMove(e) {
    if (!held || e.pointerId !== pointerId) return;

    const now = performance.now();
    const dx = e.clientX - lastX;
    const dt = Math.max(1, now - lastT) / 1000;

    const delta = dx * DEG_PER_PX;
    ry = clampWithRubber(ry + delta);

    // Smoothed, so a single jittery event cannot define the whole fling.
    pointerVel = pointerVel * 0.6 + (delta / dt) * 0.4;

    lastX = e.clientX;
    lastT = now;
    dirty = true;
  }

  function onUp(e) {
    if (!held) return;
    held = false;
    card.classList.remove('is-held');
    if (pointerId != null) {
      try {
        card.releasePointerCapture?.(pointerId);
      } catch {
        /* already released */
      }
    }
    pointerId = null;

    // Hand the throw to the spring, capped so a violent flick cannot spin the
    // card for seconds — a physical card would not do that either.
    velocity = Math.max(-900, Math.min(900, pointerVel));
    settle();
  }

  card.addEventListener('pointerdown', onDown);
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerup', onUp);
  card.addEventListener('pointercancel', onUp);
  // A pointer that leaves the window mid-drag still releases the card.
  window.addEventListener('blur', () => {
    if (held) onUp({ pointerId });
  });

  /* ------------------------------------------------------------- the hover */

  /* The lean. Rest the pointer on the card and it tilts toward you — up to
     LEAN_MAX degrees — and lifts a few pixels off the table. The glare slides
     with the pointer, so the light source appears to be where you are.

     Only on real pointers: (hover: hover) excludes touch, where there is no
     resting hover and the gesture would fight scrolling. */
  if (canHover && !reduced) {
    card.addEventListener('pointerenter', () => {
      hovering = true;
      liftT = LIFT_HOVER;
    });

    card.addEventListener('pointermove', (e) => {
      if (!hovering || held) return;
      const r = card.getBoundingClientRect();
      // -0.5..0.5 from the centre
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      leanTX = px * 2 * LEAN_MAX;
      leanTY = -py * 2 * LEAN_MAX;

      // The glare is a soft-light overlay; sliding it keeps the highlight
      // under the pointer. Translate only — compositor work, no repaint.
      if (glare) {
        glare.style.transform = `translateX(${(px * 44).toFixed(1)}px) translateZ(1px)`;
      }
    });

    card.addEventListener('pointerleave', () => {
      hovering = false;
      leanTX = 0;
      leanTY = 0;
      liftT = 0;
      if (glare) glare.style.transform = 'translateZ(1px)';
    });
  }

  /* -------------------------------------------------------------- keyboard */

  card.addEventListener('keydown', (e) => {
    let next = null;
    if (e.key === 'ArrowRight') next = ry + 15;
    else if (e.key === 'ArrowLeft') next = ry - 15;
    else if (e.key === 'Home') next = FRONT;
    else if (e.key === 'End') next = BACK;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleFlip();
      return;
    }
    if (next === null) return;
    e.preventDefault();
    velocity = 0;
    ry = clampWithRubber(next);
    dirty = true;
    setStatus();
    settle();
  });

  /* ------------------------------------------------------------------ flip */

  function goTo(target) {
    velocity = (target - ry) * 2.6;
    settle(target);
  }

  function toggleFlip() {
    goTo(sideFor(ry) === 'front' ? BACK : FRONT);
  }

  document.querySelectorAll('[data-flip]').forEach((btn) => {
    btn.addEventListener('click', toggleFlip);
  });

  /* -------------------------------------------------------------- entrance */

  /* The card arrives slightly turned, then settles to front — a hand placing
     it on the table. Skipped entirely under reduced motion. */
  if (!reduced && typeof IntersectionObserver !== 'undefined') {
    ry = -26;
    velocity = 26;
    dirty = true;
    paint();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) return;
          io.disconnect();
          velocity = 34;
          settle();
        }
      },
      { threshold: 0.35, rootMargin: '0px' }
    );
    io.observe(card);
  } else {
    dirty = true;
  }

  /* ---------------------------------------------------------- scroll reveals */

  const revealTargets = [...document.querySelectorAll('[data-reveal]')];
  document.querySelector('.hero__copy')?.classList.add('is-hot');

  if (reduced || typeof IntersectionObserver === 'undefined') {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      },
      // Zero inset: a negative bottom margin silently skips elements sitting
      // in the last few percent of the viewport, so they never reveal.
      { threshold: 0.01, rootMargin: '0px' }
    );
    revealTargets.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------- button char wave */

  /* Split each label into characters so hover can lift them in sequence.
     A real space stays a real space. The char spans are inline-block, so a
     bare space between them would collapse to nothing visually — but replacing
     it with &nbsp; changes the accessible name ("Flip\u00a0it"), which breaks
     selectors and is wrong for assistive tech. The space gets its own .sp span
     with width instead: correct name, visible gap. */
  document.querySelectorAll('[data-split]').forEach((el) => {
    const text = el.textContent || '';
    if (!text.trim()) return;
    el.textContent = '';
    const frag = document.createDocumentFragment();
    let i = 0;
    for (const ch of text) {
      const span = document.createElement('span');
      if (ch === ' ') {
        span.className = 'sp';
        span.textContent = ' ';
      } else {
        span.textContent = ch;
      }
      span.style.transitionDelay = `${i * 16}ms`;
      frag.appendChild(span);
      i += 1;
    }
    el.appendChild(frag);
  });

  /* ------------------------------------------------------------------ boot */

  paint();
  setStatus();
  raf = requestAnimationFrame(tick);
})();
