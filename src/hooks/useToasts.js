import { useCallback, useEffect, useState } from 'react';

/** How long a toast stays on screen. */
export const TOAST_DURATION_MS = 4000;

/**
 * Toast queue of one.
 *
 * A new toast replaces the current one rather than stacking: this app only ever
 * shows a single bottom-right notification, and replacing keeps the auto-dismiss
 * timer tied to whatever is actually on screen.
 */
export default function useToasts() {
  const [toast, setToast] = useState(null);

  // Auto-dismiss. Re-armed whenever the toast changes, so a second toast gets a
  // full duration rather than inheriting the remainder of the first.
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  return { toast, setToast, showToast, clearToast };
}
