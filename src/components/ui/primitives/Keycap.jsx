import React from 'react';

/**
 * A keycap: 20px square, 1px border, mono 10px.
 *
 * The shortcut drawer's contract is `dl > dt + kbd[aria-keyshortcuts]`, so this
 * renders a real <kbd>. Do not change the element — a test reads it.
 */
export default function Keycap({ children, className = '', ...rest }) {
  return (
    <kbd
      className={`dt-label inline-flex h-5 min-w-5 items-center justify-center rounded-[2px] border border-rule-2 px-1 text-[10px] leading-none text-bone-70 ${className}`}
      {...rest}
    >
      {children}
    </kbd>
  );
}
