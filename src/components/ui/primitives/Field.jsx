import React, { useId } from 'react';

/**
 * A ledger field: mono label above, 1px bottom rule only, no box, no fill.
 *
 * 16px text is deliberate — anything smaller makes iOS Safari zoom the viewport
 * on focus, which would look like a layout bug.
 *
 * `label` is always rendered as a real <label for>, so every field has an
 * accessible name without the caller having to remember.
 */
export default function Field({
  label,
  value,
  onChange,
  type = 'text',
  multiline = false,
  rows = 3,
  hint,
  error,
  placeholder,
  id: idProp,
  className = '',
  inputClassName = '',
  ...rest
}) {
  const autoId = useId();
  const id = idProp || `f-${autoId}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const shared = {
    id,
    value: value ?? '',
    onChange,
    placeholder,
    'aria-describedby': describedBy,
    'aria-invalid': error ? 'true' : undefined,
    // The rule thickens to lime on focus via the global :focus-visible style;
    // this class carries the resting state.
    className: `w-full resize-none border-0 border-b bg-transparent px-0 py-2 text-[16px] leading-[1.45] text-bone placeholder:text-bone-32 focus:outline-none focus-visible:outline-none ${inputClassName}`,
    style: {
      borderBottomColor: error ? 'var(--alarm)' : 'var(--rule-2)',
    },
    ...rest,
  };

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="dt-label mb-1 block text-bone-52">
          {label}
        </label>
      )}

      {multiline ? (
        <textarea rows={rows} {...shared} />
      ) : (
        <input type={type} {...shared} />
      )}

      {hint && (
        <p id={hintId} className="dt-data mt-1 text-bone-32">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="dt-data mt-1 text-alarm">
          {error}
        </p>
      )}
    </div>
  );
}
