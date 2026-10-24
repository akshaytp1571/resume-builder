import React, { useEffect, useRef, useState } from 'react';

/**
 * The ATS gauge: a calibrated strip, not a donut.
 *
 * 40 hairline ticks over 0–100, a filled block up to the score, the score as a
 * large mono tabular numeral, and a verdict word. On open the numeral counts up
 * over 320ms and the ticks fill left-to-right with a 40ms stagger.
 *
 * Why a strip rather than a ring: a ring is a decoration that happens to encode
 * a number. A calibrated scale is an instrument — it has graduations, so you can
 * read the value off it even without the numeral, and it makes the increments
 * legible. It is also honest about the fact that the score is a bounded quantity
 * with a meaning at every point, not a dial.
 *
 * prefers-reduced-motion: no counting, no stagger, the value appears at once.
 * The reduced-motion check is duplicated here in JS because a CSS query alone
 * cannot stop a setInterval-driven numeral.
 */

const TICKS = 40;
const DURATION_MS = 320;
const STAGGER_MS = 40;

function verdictFor(score) {
  if (score >= 85) return 'Strong';
  if (score >= 70) return 'Solid';
  if (score >= 50) return 'Thin';
  return 'Weak';
}

export default function AtsGauge({ score = 0, className = '' }) {
  const target = Math.max(0, Math.min(100, Math.round(score)));
  const [display, setDisplay] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const frame = useRef(null);
  const timers = useRef([]);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      // One paint, final values. No counting, no stagger.
      setDisplay(target);
      setRevealed(TICKS);
      return undefined;
    }

    setDisplay(0);
    setRevealed(0);

    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      // Linear on purpose: an eased numeral reads as a slot machine. A gauge
      // needle settles; it does not overshoot.
      setDisplay(Math.round(t * target));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);

    // Ticks reveal in a left-to-right cascade.
    for (let i = 0; i < TICKS; i += 1) {
      timers.current.push(
        setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), i * STAGGER_MS)
      );
    }

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [target]);

  const filledTicks = Math.round((target / 100) * TICKS);
  const verdict = verdictFor(target);

  return (
    <div className={className}>
      {/* numeral + verdict */}
      <div className="flex items-baseline gap-3">
        <span
          className="font-mono text-[44px] leading-none tabular-nums text-bone"
          // The gauge carries an accessible value; the numeral is decorative
          // once that exists, so it is not read twice.
          aria-hidden="true"
        >
          {display}
        </span>
        <span className="dt-label text-bone-32">/ 100</span>
        <span className="dt-label ml-auto text-signal">{verdict}</span>
      </div>

      {/* the calibrated strip */}
      <div
        className="relative mt-3 flex items-end gap-[2px]"
        role="meter"
        aria-valuenow={target}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`ATS score ${target} out of 100, ${verdict.toLowerCase()}`}
      >
        {Array.from({ length: TICKS }).map((_, i) => {
          const isFilled = i < filledTicks;
          const isRevealed = i < revealed;
          // Every 5th tick is tall — the graduations that make it readable.
          const tall = i % 5 === 0;
          return (
            <span
              key={i}
              aria-hidden="true"
              className={`flex-1 transition-opacity duration-[90ms] ${isFilled ? 'bg-signal' : 'bg-bone-32'}`}
              style={{
                height: tall ? 12 : 6,
                opacity: isRevealed ? (isFilled ? 1 : 0.45) : 0,
              }}
            />
          );
        })}
      </div>

      {/* scale labels */}
      <div className="mt-1 flex justify-between font-mono text-[9px] tabular-nums text-bone-32">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
    </div>
  );
}
