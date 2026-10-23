import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Emit a service worker with the real build manifest baked in.
 *
 * Vite 8 runs on rolldown. The conventional PWA plugin is not installed, and
 * adding it would pull in workbox (a dozen transitive packages) to do what the
 * 40 lines below do for this app. The worker's only build-time needs are:
 *
 *   1. the list of files this build actually produced, and
 *   2. a version string that changes whenever that list does.
 *
 * `closeBundle` is the hook that runs after the output is on disk, which is
 * exactly when that list is knowable.
 */
function serviceWorker({ source = 'src/sw.js', outFile = 'sw.js' } = {}) {
  return {
    name: 'precision-service-worker',
    apply: 'build',
    closeBundle() {
      const outDir = join(process.cwd(), 'dist')

      let worker
      try {
        worker = readFileSync(join(process.cwd(), source), 'utf8')
      } catch (err) {
        // No worker source is a valid configuration: the app runs fine online.
        this.warn(`service worker source missing (${source}); skipping`)
        return
      }

      // Everything in dist that a browser might ask for on a cold offline
      // start. DEPLOY.txt is a build artefact for humans, not the app.
      const files = []
      const walk = (dir, prefix = '') => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const rel = prefix ? `${prefix}/${entry.name}` : entry.name
          if (entry.isDirectory()) walk(join(dir, entry.name), rel)
          else if (entry.isFile()) files.push(rel)
        }
      }
      walk(outDir)

      const precache = files
        .filter((f) => f !== outFile)
        .filter((f) => f !== 'DEPLOY.txt')
        .filter((f) => !f.endsWith('.zip'))
        // Host config and the 404 page are never requested by the app itself;
        // precaching them would only bloat the install.
        .filter((f) => f !== '_headers' && f !== '404.html')
        .sort()
        .map((f) => `/${f}`)

      // The shell itself, then the assets.
      const urls = ['/', ...precache]

      // Version = hash of the exact precache list. Any change to any emitted
      // filename (which is what a content change produces) rolls the cache.
      const version = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 12)

      // replaceAll, not replace: the token names also appear in sw.js's header
      // comment, and a string-pattern replace() would substitute the comment
      // and leave the real assignment untouched.
      const rendered = worker
        .replaceAll('__PRECACHE_MANIFEST__', JSON.stringify(urls, null, 2))
        .replaceAll('__CACHE_VERSION__', JSON.stringify(version))

      if (rendered.includes('__PRECACHE_MANIFEST__') || rendered.includes('__CACHE_VERSION__')) {
        // sw.js names these tokens in its own header comment, so a literal hit
        // is expected there. Only a hit in executable code means the
        // substitution genuinely failed.
        const code = rendered.replace(/\/\*[\s\S]*?\*\//g, '')
        if (code.includes('__PRECACHE_MANIFEST__') || code.includes('__CACHE_VERSION__')) {
          this.error('service worker placeholders were not fully substituted')
          return
        }
      }

      writeFileSync(join(outDir, outFile), rendered)
      console.log(`\n  service worker  dist/${outFile}  (${urls.length} precached, v${version})`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // The app ships as plain static files served from the domain root. Keep this
  // absolute so the asset URLs in dist/index.html work on any host or subpath.
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    serviceWorker(),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    // The single JS chunk is ~2.4 MB (docx + jspdf + lucide). Vite 8 uses
    // rolldown, where manualChunks takes a function and must return a chunk
    // name or undefined.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/react|react-dom|scheduler/.test(id)) return 'react-vendor';
          if (/docx|file-saver|html2pdf|jspdf/.test(id)) return 'doc-export';
          return undefined;
        },
      },
    },
  },
})
