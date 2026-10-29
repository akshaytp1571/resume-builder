import { lazy, Suspense, useEffect } from 'react';
import Landing from './components/Landing.jsx';
import useHashRoute from './hooks/useHashRoute.js';

/**
 * Root — the two screens, and the seam between them.
 *
 * This lives outside main.jsx for one reason: main.jsx mounts on import, so
 * anything defined inside it can only be tested by executing the mount. The
 * route decision is the part worth testing, so it gets its own module with no
 * side effects.
 *
 * The editor is code-split. It is a large module graph — the exporters pull in
 * docx, html2pdf and pdf.js — and none of it is needed to read the landing
 * page. A first-time visitor on a phone should not pay 800 KB of parse cost to
 * look at a marketing page. The split is invisible in practice: the worker
 * precaches every chunk at install, and the landing page warms the editor
 * chunk on first intent (see useIntentPreload), so the usual click is instant.
 */

const App = lazy(() => import('./App.jsx'));

/** The editor, empty and unavoidable, while the route swaps. */
function Booth() {
  return (
    <div className="landing-boot" role="status" aria-live="polite">
      <span className="landing-boot__mark font-mono">Resume Studio</span>
      <span className="landing-boot__bar" aria-hidden="true" />
      <span className="landing-boot__label">Loading the editor…</span>
    </div>
  );
}

/**
 * Warm the editor chunk the first time the user reaches for it.
 *
 * Pointer-enter, focus and touch all count as intent, so a keyboard user who
 * tabs to the CTA gets the same head start as a mouse user. Nothing is fetched
 * for someone who only reads the page and leaves.
 */
function useIntentPreload(enabled, selector) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;

    let done = false;
    const warm = () => {
      if (done) return;
      done = true;
      import('./App.jsx').catch(() => {
        // A failed warm-up is not an error the user should ever see: the real
        // import happens on navigation and reports its own failure there.
      });
      detach();
    };

    const targets = [...document.querySelectorAll(selector)];
    for (const el of targets) {
      el.addEventListener('pointerenter', warm, { passive: true });
      el.addEventListener('focusin', warm);
      el.addEventListener('touchstart', warm, { passive: true });
    }

    function detach() {
      for (const el of targets) {
        el.removeEventListener('pointerenter', warm);
        el.removeEventListener('focusin', warm);
        el.removeEventListener('touchstart', warm);
      }
    }

    return detach;
  }, [enabled, selector]);
}

export function Root() {
  const { isLanding, navigate } = useHashRoute();

  // data-editor-cta is the contract the landing's launch buttons carry. It is a
  // data attribute rather than a class so the styling can change freely.
  useIntentPreload(isLanding, '[data-editor-cta]');

  if (isLanding) return <Landing navigate={navigate} />;

  return (
    <Suspense fallback={<Booth />}>
      <App />
    </Suspense>
  );
}

export default Root;
