import React from 'react';

/**
 * A numbered section header: `01 · IDENTITY` on a hairline, with the index in
 * the signal colour. No icon per section — the number is the mark.
 *
 * The index is the only place the serif appears inside the editor (it is the
 * human hand in the machine), so it is rendered in serif italic.
 */
export default function SectionIndex({ index, title, action, className = '' }) {
  const n = String(index).padStart(2, '0');
  return (
    <div className={`mb-3 flex items-baseline justify-between gap-3 ${className}`}>
      <h3 className="flex items-baseline gap-2">
        <span className="dt-serif text-[13px] text-signal">{n}</span>
        <span className="dt-label text-bone-70">{title}</span>
      </h3>
      {action}
    </div>
  );
}
