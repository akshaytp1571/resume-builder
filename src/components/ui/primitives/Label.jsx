import React from 'react';

/** Mono micro-label. Uppercase, tracked, 11px, tertiary ink. */
export default function Label({ as: Tag = 'span', children, className = '', ...rest }) {
  return (
    <Tag className={`dt-label text-bone-52 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
