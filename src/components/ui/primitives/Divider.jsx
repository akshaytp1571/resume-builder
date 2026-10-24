import React from 'react';

/** A 1px hairline. Every divider in the app separates something. */
export default function Divider({ vertical = false, className = '' }) {
  if (vertical) {
    return (
      <span
        aria-hidden="true"
        className={`inline-block w-px self-stretch bg-[var(--rule)] ${className}`}
      />
    );
  }
  return (
    <hr aria-hidden="true" className={`m-0 h-px w-full border-0 bg-[var(--rule)] ${className}`} />
  );
}
