import { useEffect, useRef, useState } from 'react';

/**
 * Animation primitives for the landing page.
 *
 * All three respect prefers-reduced-motion by resolving immediately to the
 * final state, never by running a faster animation. A user who asked for less
 * motion should get the content, not a quicker version of the thing they
 * turned off.
 *
 * Only opacity and transform are ever animated. Both are compositor-only, so a
 * long page of them still runs at 60fps on a mid-range phone.
 */

/** True when the user has asked for reduced motion. Live-updates if they change it. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
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
 * A live clock string for the mast readout. One interval per twenty seconds;
 * there is nothing to clean up beyond the interval itself.
 */
export function useClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    }, 20000);
    return () => clearInterval(id);
  }, []);

  return time;
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
 * The custom cursor: a dot on the pointer and a ring lagging on a lerp.
 *
 * Position and scale live on SEPARATE nodes — an earlier version put both on
 * the ring's own transform, so the 1.7x hover scale fought the translate and
 * the ring drifted. The outer node translates; the inner <i> scales.
 *
 * The whole thing stays at opacity 0 until the first pointermove, because
 * before that we do not know where the pointer is — a ring parked at 0,0
 * reads as a rendering artefact. Fine pointers only.
 */
export function useCursor() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!window.matchMedia) return undefined;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduced.matches) return undefined;

    const cur = document.querySelector('.dt-cursor');
    const dot = cur?.querySelector('.dt-cursor__dot');
    const ring = cur?.querySelector('.dt-cursor__ring');
    if (!cur || !dot || !ring) return undefined;

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let last = null;
    let frame = null;

    const onMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      cur.classList.add('is-live');
      const t = e.target;
      const hot = t instanceof Element && t.closest('a, button, .dt-sheet, [role=slider]');
      cur.classList.toggle('is-hot', Boolean(hot));
    };
    const onDown = () => cur.classList.add('is-down');
    const onUp = () => cur.classList.remove('is-down');

    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      const k = `${rx.toFixed(1)},${ry.toFixed(1)}`;
      if (k !== last) {
        last = k;
        ring.style.transform = `translate(${rx.toFixed(1)}px, ${ry.toFixed(1)}px)`;
      }
      frame = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    frame = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return undefined;
}

/**
 * A magnetic wrapper: any element carrying `dt-magnetic` leans a few pixels
 * toward the pointer and springs back on leave. Capped, so it cannot wander.
 */
export function useMagnetic() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!window.matchMedia) return undefined;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduced.matches) return undefined;

    const MAG = 7;

    const move = (e) => {
      const el = e.target instanceof Element ? e.target.closest('.dt-magnetic') : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      el.style.setProperty('--mx', `${(dx * MAG).toFixed(2)}px`);
      el.style.setProperty('--my', `${(dy * MAG).toFixed(2)}px`);
    };
    const leave = (e) => {
      const el = e.target instanceof Element ? e.target.closest('.dt-magnetic') : null;
      if (!el) return;
      el.style.setProperty('--mx', '0px');
      el.style.setProperty('--my', '0px');
    };

    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerout', leave, { passive: true });
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', leave);
    };
  }, []);

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

  const stateRef = useRef(null);

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
    const readoutEl = sheet.parentElement?.querySelector('[data-ry], .dt-specimen__hint span:last-child');

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
 */
export function usePeel() {
  const [v, setV] = useState(0);
  const ref = useRef(null);
  const vRef = useRef(0);

  useEffect(() => {
    const box = ref?.current;
    if (!box) return undefined;
    let held = false;

    const apply = (next) => {
      vRef.current = next;
      setV(next);
    };

    const onDown = (e) => {
      // The handle is its own button; its click must not become a drag.
      if (e.target instanceof Element && e.target.closest('.dt-peel__handle')) return;
      held = true;
      box.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (!held) return;
      const r = box.getBoundingClientRect();
      const next = Math.round(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
      if (next !== vRef.current) apply(next);
    };
    const onUp = () => {
      held = false;
    };
    const onKey = (e) => {
      const k = e.key;
      if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
      e.preventDefault();
      const next = Math.max(0, Math.min(100, vRef.current + (k === 'ArrowRight' ? 10 : -10)));
      apply(next);
    };

    box.addEventListener('pointerdown', onDown);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerup', onUp);
    box.addEventListener('pointercancel', onUp);
    box.addEventListener('keydown', onKey);
    return () => {
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerup', onUp);
      box.removeEventListener('pointercancel', onUp);
      box.removeEventListener('keydown', onKey);
    };
  }, []);

  const toggle = () => setV((x) => (x >= 50 ? 0 : 100));

  return { ref, v, toggle };
}
