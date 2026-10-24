import React from 'react';

/**
 * A keyword/status chip. 2px radius, 1px hairline, mono uppercase.
 * Never a pill — rounded-full was one of the tells.
 */
const TONE = {
  neutral: 'border-rule-2 text-bone-70',
  present: 'border-signal/50 text-signal',
  missing: 'border-alarm/50 text-alarm',
};

export default function Chip({ tone = 'neutral', children, className = '', ...rest }) {
  return (
    <span
      className={`dt-label inline-flex items-center rounded-[2px] border px-1.5 py-0.5 text-[9px] ${TONE[tone] || TONE.neutral} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
