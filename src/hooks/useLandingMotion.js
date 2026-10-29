import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Animation primitives for the landing page.
 *
 * Every hook here respects prefers-reduced-motion by resolving immediately to
 * the final state, never by running a faster animation. A user who asked for
 * less motion should get the content, not a quicker version of the thing they
 * turned off.
 *
 * Only opacity and transform are ever animated. Both are compositor-only, so a
 * long page of them still runs at 60fps on a mid-range phone.
 *
 * The custom cursor and the magnetic buttons were removed with the redesign:
 * both were agency-portfolio vocabulary, the cursor fought the reduced-motion
 * preference it was supposed to respect, and a landing page has no business
 * replacing the user's pointer.
 */

const QUERY_REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Live-updating matchMedia.
 *
 * Returns false rather than throwing when the API is missing, so it is safe in
 * jsdom and during a static render. `query` is a dependency: a caller that
 * swaps the query gets the new one's value.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(Boolean(e.matches));

    // Safari < 14 and a few embedded webviews expose the old MediaQueryList
    // API only. Supporting both keeps the preference live without making the
    // hook throw in those browsers.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener?.(onChange);
    return () => mq.removeListener?.(onChange);
  }, [query]);

  return matches;
}

/** True when the user has asked for reduced motion. Live-updates if they change it. */
export function usePrefersReducedMotion() {
  return useMediaQuery(QUERY_REDUCED_MOTION);
}

/**
 * Reveal an element once, when it first scrolls into view.
 *
 * Returns a ref and a boolean. The boolean latches: once revealed it never goes
 * back, so scrolling up does not un-reveal content the user already read.
 *
 * `rootMargin` fires slightly before the element is fully visible so the motion
 * finishes as it settles into view rather than starting late.
 */
export function useReveal({ threshold = 0.01, rootMargin = '0px' } = {}) {
  const ref = useRef(null);
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setShown(true);
      return undefined;
    }
    const node = ref.current;
    if (!node) return undefined;

    // No IntersectionObserver (very old browser): show immediately rather than
    // leaving the page blank.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold, rootMargin }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [reduced, threshold, rootMargin]);

  return [ref, shown];
}

/**
 * Count a number up when it enters view.
 *
 * Linear, not eased: an eased counter reads as a slot machine. Real gauges
 * settle. Same reasoning as the ATS gauge in the app.
 */
export function useCountUp(target, { duration = 900, start = 0 } = {}) {
  const reduced = usePrefersReducedMotion();
  const [ref, shown] = useReveal({ threshold: 0.01, rootMargin: '0px' });
  const [value, setValue] = useState(reduced ? target : start);

  useEffect(() => {
    if (!shown) return undefined;
    if (reduced) {
      setValue(target);
      return undefined;
    }
    let frame = null;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      setValue(Math.round(start + (target - start) * t));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [shown, target, duration, start, reduced]);

  return [ref, value];
}

/**
 * Scroll progress through the whole document, 0..1.
 *
 * Reads layout in a rAF callback rather than directly in the scroll handler, so
 * a fast scroll cannot queue a layout read per event.
 */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let queued = false;

    const read = () => {
      queued = false;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return progress;
}

/**
 * The tone of the section currently under the mast: 'dark' or 'paper'.
 *
 * Measured, not guessed — probe just below the mast's own bottom edge, not at
 * a fixed 24px (a fixed offset sits inside the ~60px mast and always reports
 * the page background, so the inversion never fires). The paper sections are
 * the ones carrying `dt-section--paper`.
 */
export function useMastTone() {
  const [tone, setTone] = useState('dark');

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let queued = false;

    const read = () => {
      queued = false;
      const mast = document.querySelector('.dt-mast');
      // The mast only takes a background once scrolled; at rest it is open.
      mast?.classList.toggle('is-stuck', window.scrollY > 20);
      const y = mast ? mast.getBoundingClientRect().height + 2 : 64;
      let next = 'dark';
      for (const s of document.querySelectorAll('.dt-section--paper')) {
        const r = s.getBoundingClientRect();
        if (r.top <= y && r.bottom > y) {
          next = 'paper';
          break;
        }
      }
      setTone((t) => (t === next ? t : next));
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return tone;
}

/**
 * Reveal every section that owns a masked headline (.ln__i lines).
 *
 * One observer for all of them — never one nested inside another. A parent at
 * opacity 0 reports as non-intersecting, so a child observer behind a reveal
 * wrapper never fires; this one watches the sections themselves and adds a
 * class the CSS can address at higher specificity than the hidden state
 * (see the .ln__i note in index.css).
 */
export function useMaskedHeadlines() {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const sections = [...document.querySelectorAll('.landing section')].filter(
      (s) => s.querySelector('.ln__i')
    );
    if (!sections.length) return undefined;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      sections.forEach((s) => s.classList.add('is-hot'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-hot');
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.01, rootMargin: '0px' }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [reduced]);

  return undefined;
}

/**
 * The draggable hero specimen: a spring-damper tilt in 3D.
 *
 * TMAX 13° target, rubber-banded to 1.7× at the hard limit. A firm release
 * (throw speed over 55°/s or angle over 55% of TMAX) HOLDS its tilt — the card
 * obeys the throw instead of pinging flat, which is the physical judgement —
 * then a small nudge returns it home and the spring settles it.
 *
 * Returns aria props for the group, plus the readout and hint strings.
 */
export function useSheetDrag(ref) {
  const [readout, setReadout] = useState('0° / 0°');
  const [hint, setHint] = useState('Drag me');
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const sheet = ref?.current;
    if (!sheet || reduced) return undefined;

    const TMAX = 13;
    let tx = 0, ty = 0;          // current deg
    let vx = 0, vy = 0;          // deg/sec
    let ttx = 0, tty = 0;        // pointer target deg
    let held = false;
    let lastX = 0, lastY = 0, lastT = 0;
    let pvx = 0, pvy = 0;
    let dirty = true;
    let frameT = null;
    let frame = null;

    const glare = sheet.querySelector('.dt-sheet__glare');

    const paint = () => {
      sheet.style.transform = `rotateX(${ty.toFixed(2)}deg) rotateY(${tx.toFixed(2)}deg)`;
      if (glare) glare.style.transform = `translate(${(tx * 2.2).toFixed(1)}px, ${(ty * -2.2).toFixed(1)}px) translateZ(1px)`;
      const next = `${Math.abs(tx).toFixed(0)}° / ${Math.abs(ty).toFixed(0)}°`;
      setReadout((r) => (r === next ? r : next));
    };

    const clampV = (v) => Math.max(-TMAX * 1.7, Math.min(TMAX * 1.7, v));

    const loop = (now) => {
      const dt = frameT == null ? 1 / 60 : Math.min(0.032, (now - frameT) / 1000);
      frameT = now;

      if (!held) {
        // spring toward the pointer target, then to home
        vx += (-60 * (tx - ttx) - 11 * vx) * dt;
        vy += (-60 * (ty - tty) - 11 * vy) * dt;
        if (Math.abs(tx - ttx) < 0.02 && Math.abs(vx) < 0.05) { tx = ttx; vx = 0; }
        if (Math.abs(ty - tty) < 0.05 && Math.abs(vy) < 0.05) { ty = tty; vy = 0; }
        tx += vx * dt;
        ty += vy * dt;
      }
      if (dirty || Math.abs(vx) > 0.02 || Math.abs(vy) > 0.02) {
        paint();
        dirty = false;
      }
      frame = requestAnimationFrame(loop);
    };

    const onDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      if (e.target instanceof Element && e.target.closest('a, button')) return;
      held = true;
      lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
      pvx = 0; pvy = 0;
      sheet.setPointerCapture(e.pointerId);
      sheet.parentElement?.classList.add('is-held');
      setHint((h) => (h === 'Nice grip' ? h : 'Nice grip'));
    };

    const onMove = (e) => {
      if (!held) return;
      const now = performance.now();
      const dt = Math.max(0.008, (now - lastT) / 1000);
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      // horizontal drag tilts around Y; vertical (inverted) around X
      const rvx = (dx / Math.max(80, sheet.getBoundingClientRect().width)) * 190;
      const rvy = (-dy / Math.max(80, sheet.getBoundingClientRect().height)) * 120;
      pvx = rvx / dt; pvy = rvy / dt;  // throw velocity, deg/sec
      ttx = clampV(ttx + rvx);
      tty = clampV(tty + rvy);
      tx = ttx; ty = tty;             // hard follow while held
      dirty = true;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
    };

    const onUp = () => {
      if (!held) return;
      held = false;
      sheet.parentElement?.classList.remove('is-held');
      const firm = Math.abs(pvx) > 55 || Math.abs(pvy) > 55 || Math.abs(ttx) > TMAX * 0.55 || Math.abs(tty) > TMAX * 0.55;
      if (firm) {
        // keep the thrown angle, with a capped residual velocity so it
        // overshoots a hair and settles rather than freezing on the spot
        vx = Math.max(-220, Math.min(220, pvx * 0.18));
        vy = Math.max(-160, Math.min(160, pvy * 0.18));
      } else {
        ttx = 0; tty = 0;            // go home
      }
      setHint((h) => (h === 'Firm throw' && firm ? h : 'Firm throw'));
    };

    const onKey = (e) => {
      const k = e.key;
      if (k === 'ArrowLeft') ttx = clampV(ttx - 4);
      else if (k === 'ArrowRight') ttx = clampV(ttx + 4);
      else if (k === 'ArrowUp') tty = clampV(tty + 3);
      else if (k === 'ArrowDown') tty = clampV(tty - 3);
      else if (k === 'Home') { ttx = 0; tty = 0; }
      else return;
      e.preventDefault();
      dirty = true;
    };

    sheet.addEventListener('pointerdown', onDown);
    sheet.addEventListener('pointermove', onMove);
    sheet.addEventListener('pointerup', onUp);
    sheet.addEventListener('pointercancel', onUp);
    sheet.addEventListener('keydown', onKey);
    frame = requestAnimationFrame(loop);
    return () => {
      sheet.removeEventListener('pointerdown', onDown);
      sheet.removeEventListener('pointermove', onMove);
      sheet.removeEventListener('pointerup', onUp);
      sheet.removeEventListener('pointercancel', onUp);
      sheet.removeEventListener('keydown', onKey);
      if (frame) cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, ref]);

  return { readout, hint, aria: { 'data-ry': readout, 'data-hint': hint } };
}

/**
 * The peel: proof/read panels split by a real drag slider.
 *
 * The demo value drives a CSS custom property; the panels clip themselves via
 * inset(). The button toggles between 0 and 100 with the same property, so
 * dragging and clicking agree on one state.
 *
 * KEYBOARD. The drag surface is a plain <div>, so a keydown listener attached
 * to it could never fire — nothing focuses a div. The handler is therefore
 * exposed as `controlProps.onKeyDown` for the caller to spread on a focusable
 * element, and `controlProps` carries the whole `role="slider"` contract
 * (tabIndex, aria-valuemin/max/now/valuetext, aria-label) so the control is
 * announced as a slider rather than as an unlabelled group.
 *
 * Spread it on the element that owns `ref` for the standard pattern:
 *
 *   <div className="dt-peel" ref={peel.ref} style={{'--peel': peel.v}} {...peel.controlProps}>
 *
 * The native listener is deliberately NOT also attached to `ref`: a listener on
 * the box would run before React's delegated handler and every arrow key would
 * step twice. One path, one step.
 *
 * Returns (all optional except the first three, which are unchanged):
 *   ref, v, toggle      — as before
 *   controlProps        — spread on the focusable slider element
 *   aria                — the aria-* attributes alone, for attaching the
 *                         semantics to a node other than the handler's
 *   onKeyDown           — the handler alone, same reason
 */
export function usePeel({
  step = 10,
  label = 'Peel between the designed sheet and the extracted text',
} = {}) {
  const [v, setV] = useState(0);
  const ref = useRef(null);
  const vRef = useRef(0);

  /**
   * The single writer for both the state and the ref.
   *
   * `toggle` used to call setV directly and leave `vRef` stale, so one full
   * cycle desynchronised them: click Peel (v becomes 100, vRef stays 0), press
   * ArrowRight, and the value jumped from 100 back down to 10 because the key
   * handler read the ref only the drag path maintained.
   */
  const apply = useCallback((next) => {
    const clamped = Math.max(0, Math.min(100, Math.round(next)));
    vRef.current = clamped;
    setV(clamped);
  }, []);

  useEffect(() => {
    const box = ref?.current;
    if (!box) return undefined;
    let held = false;

    const onDown = (e) => {
      // The handle is its own button; its click must not become a drag.
      if (e.target instanceof Element && e.target.closest('.dt-peel__handle')) return;
      held = true;
      box.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (!held) return;
      const r = box.getBoundingClientRect();
      // A zero-width box (display:none, or mid-layout) would divide by zero and
      // write NaN into the custom property, which silently kills the clip.
      if (!r.width) return;
      apply(((e.clientX - r.left) / r.width) * 100);
    };
    const onUp = () => {
      held = false;
    };

    box.addEventListener('pointerdown', onDown);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerup', onUp);
    box.addEventListener('pointercancel', onUp);

    return () => {
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerup', onUp);
      box.removeEventListener('pointercancel', onUp);
    };
  }, [apply]);

  const onKeyDown = useCallback(
    (e) => {
      // React can invoke a handler twice in some StrictMode/legacy paths, and a
      // caller may attach this to a child of an element that also carries it.
      if (e.defaultPrevented) return;
      let next = null;
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = vRef.current - step;
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          next = vRef.current + step;
          break;
        case 'PageDown':
          next = vRef.current - step * 2;
          break;
        case 'PageUp':
          next = vRef.current + step * 2;
          break;
        // Home/End are part of the expected slider keyboard contract; without
        // them a keyboard user cannot jump to either end, only crawl there.
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = 100;
          break;
        default:
          return;
      }
      e.preventDefault();
      apply(next);
    },
    [apply, step]
  );

  const toggle = useCallback(() => {
    apply(vRef.current >= 50 ? 0 : 100);
  }, [apply]);

  const aria = {
    'aria-label': label,
    'aria-valuemin': 0,
    'aria-valuemax': 100,
    'aria-valuenow': Math.round(v),
    'aria-valuetext': `${Math.round(v)}% extracted`,
  };

  const controlProps = {
    role: 'slider',
    tabIndex: 0,
    'aria-orientation': 'horizontal',
    ...aria,
    onKeyDown,
  };

  return { ref, v, toggle, controlProps, aria, onKeyDown };
}
