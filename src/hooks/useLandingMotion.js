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
