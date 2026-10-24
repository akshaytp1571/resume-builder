import React, { useEffect, useRef } from 'react';

/**
 * Accessible modal shell.
 *
 * Wraps every dialog in this app so they all behave the same way:
 *   - role="dialog" + aria-modal so screen readers announce it correctly
 *   - focus moves into the dialog on open and returns to the trigger on close
 *   - Tab / Shift+Tab cycle inside the dialog (focus trap)
 *   - Escape closes
 *   - background scroll is locked while open
 *
 * Usage:
 *   <ModalShell isOpen={isOpen} onClose={onClose} labelledBy="my-title">
 *     <h2 id="my-title">Title</h2>
 *     ...
 *   </ModalShell>
 *
 * `isOpen` is handled by the caller as usual (the existing modals return null
 * when closed); this component assumes it is only mounted when open.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function ModalShell({
  onClose,
  labelledBy,
  describedBy,
  children,
  className = '',
  zIndex = 'z-50',
  closeOnBackdrop = true,
}) {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Move focus in on mount, restore on unmount.
  useEffect(() => {
    previouslyFocused.current =
      typeof document !== 'undefined' ? document.activeElement : null;

    const node = dialogRef.current;
    if (node) {
      const first = node.querySelector(FOCUSABLE);
      // Prefer the first real control; fall back to the dialog itself so the
      // screen reader still announces the dialog even if it has no controls.
      if (first) {
        first.focus();
      } else {
        node.focus();
      }
    }

    return () => {
      const prev = previouslyFocused.current;
      if (prev && typeof prev.focus === 'function') {
        prev.focus();
      }
    };
  }, []);

  // Escape to close, Tab to cycle.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const node = dialogRef.current;
      if (!node) return;

      const focusable = Array.from(node.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  // Lock background scroll while the dialog is open.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const handleBackdropClick = (event) => {
    if (!closeOnBackdrop) return;
    // Only close when the click started on the backdrop itself, not when a
    // drag inside the dialog happened to end on the backdrop.
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  return (
    // Backdrop: a flat 72% void scrim with a 1px inset frame. No blur — a
    // backdrop-filter on a full-screen overlay is the most expensive thing on
    // the page and it was one of the tells.
    <div
      className={`fixed inset-0 ${zIndex} flex items-start justify-center overflow-y-auto bg-[rgba(12,13,11,0.72)] p-4 pt-[8vh] font-sans select-none dt-enter-rail`}
      onMouseDown={handleBackdropClick}
      style={{ boxShadow: 'inset 0 0 0 1px var(--rule)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        // 0px radius, hairline border, housing-2 fill. A modal is a sheet of
        // paper on the same bench, not a floating card on a card.
        className={`relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-none border border-rule-2 bg-housing-2 shadow-[0_20px_60px_rgba(0,0,0,0.7)] outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
