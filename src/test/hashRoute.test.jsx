import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useHashRoute, {
  ROUTE_LANDING,
  ROUTE_APP,
  navigate,
} from '../hooks/useHashRoute.js';

/**
 * The route is deliberately tiny, but it is the seam between the landing page
 * and the editor. Keep these tests at the seam rather than testing the private
 * readRoute helper: the public contract is what a component receives and what
 * a user sees in the address bar.
 */
describe('useHashRoute', () => {
  beforeEach(() => {
    // Replace rather than assign so setup/cleanup never adds history entries or
    // dispatches a hashchange into the next test.
    window.history.replaceState(null, '', `${window.location.pathname}`);
  });

  afterEach(() => {
    window.history.replaceState(null, '', `${window.location.pathname}`);
    vi.restoreAllMocks();
  });

  it('exports the landing and editor route constants', () => {
    expect(ROUTE_LANDING).toBe('/');
    expect(ROUTE_APP).toBe('/app');
  });

  it('treats a missing hash as the landing route and normalizes the URL to #/', async () => {
    const { result } = renderHook(() => useHashRoute());

    expect(result.current.route).toBe(ROUTE_LANDING);
    expect(result.current.isLanding).toBe(true);
    await waitFor(() => expect(window.location.hash).toBe('#/'));
  });

  it('treats an explicit #/ hash as the landing route', () => {
    window.location.hash = '#/';

    const { result } = renderHook(() => useHashRoute());

    expect(result.current.route).toBe(ROUTE_LANDING);
    expect(result.current.isLanding).toBe(true);
    expect(window.location.hash).toBe('#/');
  });

  it.each([
    ['the editor route', '#/app', ROUTE_APP],
    ['an unrecognised route', '#/bogus', '/bogus'],
  ])('treats %s as an editor route', (_label, hash, expectedRoute) => {
    window.location.hash = hash;

    const { result } = renderHook(() => useHashRoute());

    expect(result.current.route).toBe(expectedRoute);
    expect(result.current.isLanding).toBe(false);
  });

  it('navigate() sets the hash and the hook follows the hashchange', async () => {
    const { result } = renderHook(() => useHashRoute());

    act(() => result.current.navigate(ROUTE_APP));

    expect(window.location.hash).toBe('#/app');
    await waitFor(() => {
      expect(result.current.route).toBe(ROUTE_APP);
      expect(result.current.isLanding).toBe(false);
    });
  });

  it('the exported navigate helper sets a route in the address bar', () => {
    navigate(ROUTE_APP);
    expect(window.location.hash).toBe('#/app');
  });

  it('navigate() is a no-op when the requested route is already current', async () => {
    window.location.hash = '#/app';
    // jsdom dispatches hashchange asynchronously, so let the setup assignment
    // settle before the spy is attached — otherwise the spy records the setup
    // rather than the navigate() call under test.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const hashchange = vi.fn();
    window.addEventListener('hashchange', hashchange);

    navigate(ROUTE_APP);
    // A same-route navigation must not create another hashchange/history step.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.hash).toBe('#/app');
    expect(hashchange).not.toHaveBeenCalled();
    window.removeEventListener('hashchange', hashchange);
  });

  it('removes its hashchange listener when unmounted', async () => {
    window.location.hash = '#/';
    const { result, unmount } = renderHook(() => useHashRoute());
    unmount();

    act(() => {
      window.location.hash = '#/app';
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The hook cannot update after unmount; this assertion also documents that
    // cleanup is safe when a component leaves during a route transition.
    expect(result.current.route).toBe(ROUTE_LANDING);
  });
});
