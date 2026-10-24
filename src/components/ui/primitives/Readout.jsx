import React from 'react';

/**
 * A mono data readout with an optional square LED.
 *
 * The LED does not glow and does not ping — it is a 2px solid block whose colour
 * carries the state. Motion was the tell; a static block reads as an indicator
 * on a real instrument.
 */
const LED_TONE = {
  ok: 'bg-signal',
  warn: 'bg-[#f5b544]',
  bad: 'bg-alarm',
  idle: 'bg-bone-32',
};

export default function Readout({
  label,
  value,
  led,
  className = '',
  title,
}) {
  return (
    <span
      className={`dt-data inline-flex items-center gap-1.5 whitespace-nowrap text-bone-70 ${className}`}
      title={title}
    >
      {led && (
        <span
          aria-hidden="true"
          className={`inline-block h-[5px] w-[5px] shrink-0 ${LED_TONE[led] || LED_TONE.idle}`}
        />
      )}
      {label && <span className="text-bone-52">{label}</span>}
      {value !== undefined && value !== null && (
        <span className="text-bone">{value}</span>
      )}
    </span>
  );
}
