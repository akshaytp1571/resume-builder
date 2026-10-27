import { useEffect, useState, useCallback } from 'react';

/**
 * Two routes, no dependency.
 *
 * `#/` is the landing page, anything else is the editor. Hash routing rather
 * than History API on purpose: the app is served from a static host on a
 * subpath (/resume-builder/) with no rewrite rules, so a path-based router
 * would 404 on refresh. Hashes never reach the server.
 *
 * Why a router at all instead of a flag: the landing page has to be linkable,
 * the back button has to work, and "Open the editor" has to be a real
 * navigation a user can bookmark and reload.
 *
 * A missing hash is a first visit, so it resolves to the landing page. That is
 * the one thing an existing user notices: they used to land straight in the
 * editor. The landing's primary CTA is above the fold, so it is one click.
 */

export const ROUTE_LANDING = '/';
export const ROUTE_APP = '/app';

/** Read the current route out of location.hash. */
function readRoute() {
  if (typeof window === 'undefined') return ROUTE_LANDING;
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw || raw === '/' || raw === '') return ROUTE_LANDING;
  return raw; // '/app', and anything unrecognised renders the app
}

/** Navigate. Pushes a history entry so Back returns to the landing page. */
export function navigate(route) {
  if (typeof window === 'undefined') return;
  const next = `#${route}`;
  if (window.location.hash === next) return;
  window.location.hash = route;
}

export default function useHashRoute() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onChange);
    // Normalise a bare URL to an explicit #/ so the route is unambiguous and
    // Back has something to return to.
    if (!window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}#/`);
    }
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const go = useCallback((next) => navigate(next), []);

  return { route, isLanding: route === ROUTE_LANDING, navigate: go };
}
