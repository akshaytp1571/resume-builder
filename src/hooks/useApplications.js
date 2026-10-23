import { useCallback, useState } from 'react';
import { loadApplications, countApplications } from '../utils/applicationTracker.js';

/**
 * Application tracker state.
 *
 * The count is read from storage rather than derived from the variant store:
 * applications outlive the resume that was sent, and ApplyModal writes to that
 * key directly when the agent confirms a submission. So the count is a cached
 * read, refreshed explicitly after any write.
 */
export default function useApplications() {
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [applications, setApplications] = useState(() => loadApplications());
  const [applicationCount, setApplicationCount] = useState(() => countApplications());

  const refreshApplicationCount = useCallback(() => {
    setApplicationCount(countApplications());
  }, []);

  const openTracker = useCallback(() => setIsTrackerOpen(true), []);
  const closeTracker = useCallback(() => setIsTrackerOpen(false), []);

  /** Replace the list and re-read the count in one step. */
  const updateApplications = useCallback(
    (next) => {
      setApplications(next);
      setApplicationCount(countApplications());
    },
    []
  );

  return {
    applications,
    setApplications,
    isTrackerOpen,
    setIsTrackerOpen,
    applicationCount,
    refreshApplicationCount,
    updateApplications,
    openTracker,
    closeTracker,
  };
}
