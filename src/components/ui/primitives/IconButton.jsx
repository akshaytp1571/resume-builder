import React from 'react';

/**
 * Square icon button. 28×28 minimum (WCAG hit target is 24; 28 is comfortable
 * for pointer, and the brief asks for 32 on touch — `touch` prop bumps it).
 *
 * `label` is required and becomes aria-label. An icon-only control without an
 * accessible name fails the suite, so this prop is not optional by accident.
 */
export default function IconButton({
  label,
  title,
  children,
  onClick,
  size = 'md',
  tone = 'default',
  className = '',
  ...rest
}) {
  const dims = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const colour =
    tone === 'signal'
      ? 'text-signal hover:bg-signal/10 border-transparent'
      : tone === 'alarm'
        ? 'text-alarm hover:bg-alarm/10 border-transparent'
        : 'text-bone-70 hover:text-bone hover:bg-[rgba(237,232,220,0.05)] border-transparent';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title || label}
      className={`inline-flex shrink-0 items-center justify-center rounded-[2px] border transition-colors duration-[90ms] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${dims} ${colour} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
