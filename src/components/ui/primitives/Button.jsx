import React from 'react';

/**
 * One button primitive, three variants.
 *
 * `signal` is the lime fill and must appear at most once per view — it is the
 * primary action of whatever surface it sits on. Everything else is `quiet`
 * (hairline) or `ghost` (text only).
 *
 * The accessible name always comes from the caller's children or aria-label;
 * this component never injects text.
 */

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-[2px] border font-mono uppercase tracking-[0.08em] transition-colors duration-[90ms] select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

const VARIANTS = {
  quiet:
    'border-rule-2 bg-transparent text-bone hover:bg-[rgba(237,232,220,0.05)] hover:border-rule-2',
  signal:
    'border-signal bg-signal text-void hover:bg-[#c8ef2e] hover:border-[#c8ef2e] font-medium',
  ghost:
    'border-transparent bg-transparent text-bone-70 hover:text-bone hover:underline underline-offset-4 decoration-1',
  danger:
    'border-alarm/60 bg-transparent text-alarm hover:bg-alarm/10 hover:border-alarm',
};

const SIZES = {
  sm: 'h-7 px-[10px] text-[10px]',
  md: 'h-8 px-[14px] text-[11px]',
  lg: 'h-9 px-[14px] text-[11px]',
};

export default function Button({
  variant = 'quiet',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={`${BASE} ${VARIANTS[variant] || VARIANTS.quiet} ${SIZES[size] || SIZES.md} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
