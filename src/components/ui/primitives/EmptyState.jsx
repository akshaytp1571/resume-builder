import React from 'react';

/**
 * Typeset empty state: a serif italic line and a mono hint.
 * No illustration, no emoji — those were the tells.
 */
export default function EmptyState({ title, hint, action, className = '' }) {
  return (
    <div className={`flex flex-col items-start gap-1.5 py-4 ${className}`}>
      {title && <p className="dt-serif text-[15px] text-bone-70">{title}</p>}
      {hint && <p className="dt-data text-bone-32">{hint}</p>}
      {action}
    </div>
  );
}
