import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Root, { Root as NamedRoot } from '../Root.jsx';
import { ROUTE_APP } from '../hooks/useHashRoute.js';

/**
 * Root is the seam between the landing page and the editor.
 *
 * It lives in its own module precisely so this can be tested: main.jsx mounts
 * on import, so anything defined inside it can only be exercised by executing
 * the mount. These tests cover the route decision and the handoff, not the
 * two screens themselves — Landing and App have their own suites.
 *
 * The editor is code-split behind lazy(), so the editor branch is asserted
 * with findBy/waitFor rather than a synchronous query. That is the contract:
 * a Suspense fallback first, then the real screen.
 */

const LANDING_HEADING = 'Make a résumé the machine can read.';
const EDITOR_SKIP_LINK = 'Skip to resume editor';

/** Reset the hash without adding history entries or firing a hashchange. */
function setHash(hash) {
  window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
}

describe('Root exports', () => {
  it('exports the same component as both a named and the default export', () => {
    expect(NamedRoot).toBe(Root);
    expect(typeof Root).toBe('function');
  });
});

describe('Root route branch', () => {
  beforeEach(() => {
    setHash('#/');
  });

  afterEach(() => {
    setHash('');
    cleanup();
  });

  it('renders the landing screen on #/', async () => {
    setHash('#/');
    render(<Root />);

    expect(
      await screen.findByRole('heading', { level: 1, name: LANDING_HEADING })
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: EDITOR_SKIP_LINK })).toBeNull();
  });

  it('renders the landing screen on a first visit with no hash at all', async () => {
    setHash('');
    render(<Root />);

    expect(
      await screen.findByRole('heading', { level: 1, name: LANDING_HEADING })
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: EDITOR_SKIP_LINK })).toBeNull();
  });

  it('renders the editor on #/app', async () => {
    setHash('#/app');
    render(<Root />);

    expect(
      await screen.findByRole('link', { name: EDITOR_SKIP_LINK })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: LANDING_HEADING })
    ).toBeNull();
  });

  it('renders the editor for an unrecognised hash rather than a blank screen', async () => {
    setHash('#/bogus');
    render(<Root />);

    expect(
      await screen.findByRole('link', { name: EDITOR_SKIP_LINK })
    ).toBeInTheDocument();
  });

  it('renders the loading booth on a cold start, before the editor chunk lands', async () => {
    // The fallback only exists while the lazy() promise is unresolved. By the
    // time another test in this file has rendered the editor, the module cache
    // holds the chunk and React resolves inside the first render — so this test
    // resets the registry to get a genuinely cold graph, which is exactly what
    // a first-time visitor has.
    vi.resetModules();
    const { default: ColdRoot } = await import('../Root.jsx');

    setHash('#/app');
    const { container } = render(<ColdRoot />);

    expect(container.querySelector('.landing-boot')).not.toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Loading the editor');

    // And it must give way to the real editor, not stay forever.
    expect(
      await screen.findByRole('link', { name: EDITOR_SKIP_LINK })
    ).toBeInTheDocument();
  });

  it('resolves the lazy editor branch to the editor screen', async () => {
    setHash('#/app');
    const { container } = render(<Root />);

    expect(
      await screen.findByRole('link', { name: EDITOR_SKIP_LINK })
    ).toBeInTheDocument();
    expect(container.querySelector('.landing-boot')).toBeNull();
  });

  it('does not show the loading booth on the landing route', async () => {
    setHash('#/');
    const { container } = render(<Root />);

    await screen.findByRole('heading', { level: 1, name: LANDING_HEADING });
    expect(container.querySelector('.landing-boot')).toBeNull();
  });
});

describe('Root route handoff', () => {
  beforeEach(() => {
    setHash('#/');
  });

  afterEach(() => {
    setHash('');
    cleanup();
  });

  it('switches from the landing screen to the editor when a CTA is used', async () => {
    const user = userEvent.setup();
    render(<Root />);

    await screen.findByRole('heading', { level: 1, name: LANDING_HEADING });

    // The landing carries several launch buttons; any of them must navigate.
    const ctas = screen.getAllByRole('button', { name: /Open the studio/i });
    expect(ctas.length).toBeGreaterThan(0);
    await user.click(ctas[0]);

    expect(window.location.hash).toBe('#/app');
    expect(
      await screen.findByRole('link', { name: EDITOR_SKIP_LINK })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: LANDING_HEADING })
    ).toBeNull();
  });

  it('follows an external hashchange while mounted', async () => {
    render(<Root />);
    await screen.findByRole('heading', { level: 1, name: LANDING_HEADING });

    // A back-button press or a pasted link, not a click inside the app.
    window.location.hash = ROUTE_APP;

    expect(
      await screen.findByRole('link', { name: EDITOR_SKIP_LINK })
    ).toBeInTheDocument();
  });

  it('unmounts cleanly mid-transition without warning', async () => {
    render(<Root />);
    await screen.findByRole('heading', { level: 1, name: LANDING_HEADING });

    window.location.hash = ROUTE_APP;
    // Tear down before the editor chunk resolves.
    cleanup();

    await waitFor(() => expect(window.location.hash).toBe('#/app'));
  });
});
