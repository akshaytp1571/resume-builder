import React from 'react';

/**
 * A flat surface separated by a hairline, not by a shadow.
 * Depth is one soft top highlight. 0px radius — the paper is the only soft thing.
 */
export default function Panel({
  as: Tag = 'div',
  variant = 'base',
  children,
  className = '',
  ...rest
}) {
  const surface = variant === 'raised' ? 'dt-panel-2' : 'dt-panel';
  return (
    <Tag className={`${surface} rounded-none ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
