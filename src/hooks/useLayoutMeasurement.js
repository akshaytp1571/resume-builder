import { useCallback, useState } from 'react';

/**
 * Page measurement reported by ResumePreview.
 *
 * `null` until the first measurement, which keeps the ATS score on its legacy
 * path until then.
 */
export default function useLayoutMeasurement() {
  const [layout, setLayout] = useState(null);

  // Stable identity so ResumePreview's observer effect is not rebuilt on every
  // render, and so an identical measurement cannot re-trigger a state update
  // (which would loop: score -> render -> measure -> score).
  const handleLayoutMeasured = useCallback((measurement) => {
    // A malformed report must not replace a good measurement with garbage.
    if (!measurement || typeof measurement !== 'object') return;
    setLayout((previous) => {
      if (
        previous &&
        previous.pageHeightPx === measurement.pageHeightPx &&
        previous.pageBudgetPx === measurement.pageBudgetPx
      ) {
        return previous;
      }
      return measurement;
    });
  }, []);

  const resetLayout = useCallback(() => setLayout(null), []);

  return { layout, setLayout, handleLayoutMeasured, resetLayout };
}
