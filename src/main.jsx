import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ErrorBoundary from './components/ui/ErrorBoundary.jsx'
import Root from './Root.jsx'

export { Root }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
)

/**
 * Register the service worker, production only.
 *
 * In dev the worker would sit in front of Vite's module graph and serve stale
 * chunks over HMR, so this is hard-gated on import.meta.env.PROD. `import.meta`
 * .env is statically replaced at build time, so the dev branch and the whole
 * body below are dropped from the dev bundle.
 *
 * Offline support is a bonus, never a requirement. Everything here is wrapped
 * so that a missing sw.js (a static host that does not serve it), an
 * unsupported browser, or a failed registration leaves the app untouched.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // Expected on hosts that do not serve /sw.js. Not worth alarming a user
      // over: the app works fine online without it.
      console.info('[pwa] service worker not registered:', err?.message || err)
    })
  })
}
