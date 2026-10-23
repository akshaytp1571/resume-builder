import React from 'react';

/**
 * Shared photo frame used by every resume template.
 *
 * Before this existed, five templates each carried their own copy of the same
 * border/radius/object-fit logic. Keeping it in one place means a new template
 * gets consistent photo handling for free, and the frame styles cannot drift.
 *
 * Props:
 *   personalInfo  the resume's personalInfo object
 *   size          square edge length in px
 *   shape         override for the frame shape ('square' | 'rounded' | 'circle')
 *   className     extra classes for the outer element
 *   borderColor   CSS colour for the frame border
 *   borderWidth   CSS width for the frame border
 *   shadow        CSS box-shadow, or '' for none
 */

const SHAPE_CLASS = {
  square: 'rounded-sm',
  'square-frame': 'rounded-sm',
  rounded: 'rounded-xl',
  circle: 'rounded-full',
};

export function getShapeClass(style) {
  return SHAPE_CLASS[style] || SHAPE_CLASS.square;
}

export default function PhotoFrame({
  personalInfo,
  size = 100,
  shape,
  className = '',
  borderColor = '#ffffff',
  borderWidth = '3px',
  shadow = '0 4px 12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.08)',
  imgClassName = 'w-full h-full object-cover',
}) {
  if (!personalInfo?.showPhoto || !personalInfo?.photo) return null;

  const shapeClass = getShapeClass(shape || personalInfo.photoStyle);
  const style = {
    width: typeof size === 'number' ? `${size}px` : size,
    height: typeof size === 'number' ? `${size}px` : size,
  };
  if (borderWidth) style.border = `${borderWidth} solid ${borderColor}`;
  if (shadow) style.boxShadow = shadow;

  return (
    <div
      className={`overflow-hidden bg-white shrink-0 ${shapeClass} ${className}`}
      style={style}
    >
      <img
        src={personalInfo.photo}
        alt={personalInfo.fullName ? `${personalInfo.fullName} - profile photo` : 'Profile photo'}
        className={imgClassName}
      />
    </div>
  );
}
