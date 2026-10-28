/* ===========================================================================
   D — THE READING

   The interaction: drag the beam. Everything it has passed is extracted text;
   everything ahead of it is still designed. One custom property, --scan,
   drives both clip-paths and the beam transform.

   Performance rules that matter here:
     - --scan is written once per frame, in a rAF, never in the pointer handler.
       Pointer events can fire faster than frames; writing layout each time
       would queue work that is thrown away.
     - The stage rect is cached on pointerdown and on resize, not per move.
       Reading getBoundingClientRect inside a move handler forces layout.
     - clip-path and transform only. No width/left animation, no filters.
   =========================================================================== */

(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stage = document.querySelector('[data-stage]');
  const range = document.querySelector('[data-range]');
  const beam = document.querySelector('[data-beam]');
  const pctOut = document.querySelector('[data-pct]');
  const losses = [...document.querySelectorAll('[data-loss]')];

  /* ------------------------------------------------------------------ scan */

  /** Current scan position, 0..100. The single source of truth. */
  let scan = 0;
  let queued = false;

  function paint() {
    queued = false;
    stage.style.setProperty('--scan', scan.toFixed(2));
    if (pctOut) pctOut.textContent = Math.round(scan);

    // A loss note is visible only once the beam has passed the point it
    // annotates, so the notes arrive as the consequences do.
    for (const el of losses) {
      const at = Number(el.dataset.at || 0);
      el.classList.toggle('is-shown', scan >= at);
    }
  }

  function setScan(next) {
    scan = Math.min(100, Math.max(0, next));
    if (queued) return;
    queued = true;
    requestAnimationFrame(paint);
  }

  // Give each loss a threshold derived from its own CSS position, so moving the
  // note in the stylesheet moves its reveal with it.
  for (const el of losses) {
    const left = parseFloat(getComputedStyle(el).left) || 0;
    const parentW = stage?.clientWidth || 1;
    el.dataset.at = String(Math.round((left / parentW) * 100));
  }

  if (range) {
    range.addEventListener('input', () => setScan(Number(range.value)));
  }

  /* --------------------------------------------------------------- pointer */

  let rect = null;
  let dragging = false;
  let pointerId = null;

  function measure() {
    rect = stage ? stage.getBoundingClientRect() : null;
  }

  function fromClientX(clientX) {
    if (!rect || rect.width === 0) return 0;
    return ((clientX - rect.left) / rect.width) * 100;
  }

  function onDown(e) {
    // Let the slider and links do their own thing.
    if (e.target.closest('input, a')) return;
    measure();
    dragging = true;
    pointerId = e.pointerId;
    beam?.classList.add('is-grabbing');
    stage.setPointerCapture?.(e.pointerId);
    setScan(fromClientX(e.clientX));
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging || e.pointerId !== pointerId) return;
    setScan(fromClientX(e.clientX));
  }

  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    beam?.classList.remove('is-grabbing');
    if (pointerId != null) {
      try {
        stage.releasePointerCapture?.(pointerId);
      } catch {
        /* capture may already be gone; nothing to do */
      }
    }
    pointerId = null;
    if (range) range.value = String(Math.round(scan));
  }

  if (stage) {
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    // Keyboard: the stage is a slider in spirit, so make it behave like one.
    stage.setAttribute('role', 'slider');
    stage.setAttribute('tabindex', '0');
    stage.setAttribute('aria-label', 'Parse beam position');
    stage.setAttribute('aria-valuemin', '0');
    stage.setAttribute('aria-valuemax', '100');
    stage.setAttribute('aria-valuenow', '0');
    stage.setAttribute('aria-valuetext', 'Nothing read');

    stage.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 2;
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = scan + step;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = scan - step;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = 100;
      else if (e.key === 'PageUp') next = scan + 20;
      else if (e.key === 'PageDown') next = scan - 20;
      if (next === null) return;
      e.preventDefault();
      setScan(next);
      if (range) range.value = String(Math.round(scan));
    });
  }

  // aria-valuenow has to track the paint, or a screen reader reports stale state.
  const stageObserverTarget = stage;
  if (stageObserverTarget) {
    let lastReported = -1;
    setInterval(() => {
      const now = Math.round(scan);
      if (now === lastReported) return;
      lastReported = now;
      stageObserverTarget.setAttribute('aria-valuenow', String(now));
      stageObserverTarget.setAttribute(
        'aria-valuetext',
        now === 0
          ? 'Nothing read'
          : now >= 100
            ? 'Fully parsed'
            : `${now} percent parsed`
      );
    }, 120);
  }

  new ResizeObserver(measure).observe(document.body);
  window.addEventListener('resize', measure, { passive: true });
  measure();

  /* -------------------------------------------------------------- the demo */

  /* "Run the parse" plays the beam across once. This is the moment the page is
     built around, so it gets real easing: fast out of the gate, slow at the
     end, like a scanner finishing a page. Duration is deliberate — quick
     enough to feel like a machine, slow enough to read the text change. */
  function runParse() {
    if (dragging) return;
    if (reduced) {
      setScan(100);
      if (range) range.value = '100';
      return;
    }
    const from = 0;
    const to = 100;
    const duration = 2600;
    const t0 = performance.now();

    const ease = (t) => 1 - Math.pow(1 - t, 2.2); // ease-out, definite finish

    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      const next = from + (to - from) * ease(t);
      setScan(next);
      if (range) range.value = String(Math.round(scan));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  document.querySelectorAll('[data-run]').forEach((btn) => {
    btn.addEventListener('click', runParse);
  });

  /* ------------------------------------------------------- button char wave */

  /* Split each button label into characters so hover can lift them in
     sequence. Spacing between words is preserved as its own span; the
     accessible name is left intact because the split keeps the text content
     and adds nothing. */
  document.querySelectorAll('[data-split]').forEach((el) => {
    const text = el.textContent || '';
    if (!text.trim()) return;
    el.textContent = '';
    const frag = document.createDocumentFragment();
    let i = 0;
    for (const ch of text) {
      const span = document.createElement('span');
      span.textContent = ch === ' ' ? '\u00a0' : ch;
      span.style.transitionDelay = `${i * 18}ms`;
      frag.appendChild(span);
      i += 1;
    }
    el.appendChild(frag);
  });

  /* ---------------------------------------------------------- scroll reveals */

  const revealTargets = [...document.querySelectorAll('[data-reveal]')];
  const heroCopy = document.querySelector('.hero__copy');
  heroCopy?.classList.add('is-hot');

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
      // Zero inset. A negative bottom margin silently skips anything sitting in
      // the last few percent of the viewport — which is where a mid-page
      // heading lands on first paint, so it never reveals at all.
      { threshold: 0.01, rootMargin: '0px' }
    );
    revealTargets.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------- boot */

  paint();

  /* On first view, run the beam once so the idea explains itself without a
     click. Delayed past the entrance so the two do not collide. */
  if (!reduced) {
    const starter = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) return;
          starter.disconnect();
          setTimeout(() => {
            if (scan === 0) runParse();
          }, 900);
        }
      },
      { threshold: 0.4, rootMargin: '0px' }
    );
    if (stage) starter.observe(stage);
  }
})();
