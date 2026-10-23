# Architecture

How Precision Resume Studio actually works, as of v2.4.0. Every claim here was
checked against the source; if the code and this document disagree, the code
wins and this file is the bug.

---

## 1. Shape of the thing

A React 19 single-page app built by Vite 8 (rolldown), plus an optional Node
agent that runs only on your own machine.

```
┌───────────────────────────── browser ─────────────────────────────┐
│                                                                   │
│  src/main.jsx ── ErrorBoundary ── App.jsx                         │
│                                     │                             │
│        ┌────────────────────────────┼──────────────────────┐      │
│        │                            │                      │      │
│   EditorSidebar              ResumePreview            Navbar     │
│   (forms, templates)         (9 templates, zoom)      (modals)   │
│        │                            │                      │      │
│        └──────────────► hooks/ ◄────┴──────────────────────┘      │
│                          │                                        │
│                    utils/*.js  ── localStorage                    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                              │
              optional, explicit, user-triggered only
                              ▼
        ┌───────────────────────────┐      ┌──────────────────────┐
        │ AI provider (user's own   │      │ localhost:3457       │
        │ endpoint + key)           │      │ job discovery agent  │
        └───────────────────────────┘      └──────────────────────┘
```

There is no backend. `dist/` is static files, and the app is fully functional
with the network off once the service worker has cached the shell.

---

## 2. Data model

### The variant store

One `localStorage` key, `precision_resume_store_v2`, holding every resume the
user has:

```js
{
  activeId: "var-m1x2-ab12cd",
  variants: [
    {
      id: "var-m1x2-ab12cd",
      name: "QA Lead - Dubai",
      createdAt: "2026-03-01T09:12:00.000Z",
      updatedAt: "2026-03-04T18:40:11.000Z",
      data: { /* resume: personalInfo, summary, skills, experience, ... */ },
      theme: { /* templateId, primaryColor, secondaryColor, fontFamily, ... */ },
      letter: { /* cover letter: subject, body, ... */ } | null
    }
  ]
}
```

A **variant** is a named, job-targeted copy. Each carries its own `data`,
`theme` and `letter`, so tailoring one resume for a role never touches another.

- `letter` is optional. Stores written before v2.1 have no such field;
  `normalizeCoverLetter()` fills a blank one on read, so no caller has to
  assume it exists.
- `createdAt` / `updatedAt` are ISO strings. `updateVariant()` stamps
  `updatedAt` on every write.
- IDs are `var-<base36 timestamp>-<random>`, built without a UUID dependency.

The pre-v2 single-resume keys (`precision_resume_data_v1`,
`precision_theme_data_v1`) are migrated into a first variant on load. They are
left in place rather than deleted, so a downgrade does not lose the user's work.

### The applications key

`precision_applications_v1` is **separate on purpose**. Applications outlive
resumes: a user can delete a variant, but "applied to Acme in March" is still
true and still worth keeping. Keeping the two in one blob would mean any store
rewrite could take application history with it.

The same reasoning applies to `nexus_job_credentials_v1`,
`nexus_ai_config_v1` and `nexus_resume_path_v1` — each is its own key so a
failure in one cannot corrupt another.

### Where the store lives in React

`src/hooks/useResumeStore.js` owns it. `App.jsx` holds no resume state of its
own; it consumes `{ store, resumeData, theme, setResumeData, setTheme, ... }`.

Writes are **debounced 400 ms** and flushed on `beforeunload`, so closing a tab
mid-edit does not lose the last keystroke. `saveStore()` returns
`{ ok, merged }`:

- `ok: false` → quota exceeded; the user is told once, not once per keystroke.
- `merged` → another tab added a variant while this one was open; it is adopted
  rather than dropped, with a one-per-5s notice.

`saveStore()` also merges rather than overwrites, which is what makes two tabs
usable at once.

---

## 3. The trust boundary

Three functions stand between untrusted data and the render tree. They exist
because the hostile-data matrix reproducibly crashed every template.

```
 untrusted input                    trust boundary              render tree
 ─────────────────                  ──────────────              ───────────
 imported JSON backup ─┐
 hand-edited localStorage ─┼──▶ normalizeResume() ──▶ variant.data ──▶ safeResume() ──▶ template
 parsed DOCX/PDF text ─┤            (resumeStore.js)                (templateData.js)
 AI response ─┘

 any theme ─────────────────────▶ normalizeTheme() ──▶ variant.theme ──▶ safeTheme() ──▶ preview
                                  (resumeStore.js)                     (templateData.js)
```

### `normalizeResume(data)` — the real boundary

In `src/utils/resumeStore.js`. Merges the input over a deep clone of
`INITIAL_RESUME_DATA` and coerces every field to the type the renderer expects:

- Scalars → strings (`asString`)
- Bullet lists → arrays of non-empty strings (`asStringList`); numbers are
  **dropped**, not stringified, because `42` in a bullet list is corrupt data
- Collections → arrays of objects with stable ids (`asObjectList`); non-object
  elements are dropped
- Booleans and the photo data URL keep their real types

It never throws. `null`, `undefined`, a string, or an array all return the
sample data. Every write path calls it: `setResumeData()`, import, undo/redo
restore, and the reset action.

### `safeResume(data)` / `safeTheme(theme)` — the second line

In `src/components/templates/templateData.js`. Every one of the nine templates
destructures through `safeResume()`, and `ResumePreview` reads
`safeTheme(theme).templateId`.

Why both layers: `normalizeResume()` protects the current call path, but a
future caller that forgets to normalise would reintroduce the crash. A throwing
template takes down the whole preview pane, so the template itself must not be
able to throw. `safeResume()` guarantees `data` may be `null`, `undefined`, a
string or an array without throwing, and that every list is a real array and
every scalar a string.

`safeTheme()` guarantees a non-null object with a real `templateId` — before it
existed, `ResumePreview` read `theme.templateId` unchecked and crashed on a
null theme.

---

## 4. Hooks, and the ref handshake

Six hooks in `src/hooks/`:

| Hook | Owns |
|---|---|
| `useResumeStore` | The variant store: state, debounced persistence, cross-tab merge, every variant action |
| `useUndoRedo` | Bounded history over the active variant's `data` + `theme`; Ctrl/Cmd+Z / Shift+Z / Y |
| `useKeyboardShortcuts` | The app-level shortcut table and its help panel |
| `useApplications` | Application-tracker state and the unread count |
| `useToasts` | The single-slot toast queue |
| `useLayoutMeasurement` | Page height reported by `ResumePreview`, fed into the ATS score |

### The circular dependency, and how a ref breaks it

`useResumeStore` needs to reset undo history when the user switches variants.
`useUndoRedo` needs the store and its setter. Passing each other as plain
arguments is a cycle:

```
useResumeStore ──needs──▶ resetHistory ──from──▶ useUndoRedo
useUndoRedo    ──needs──▶ store, setStore ──from──▶ useResumeStore
```

The fix is a ref whose `.current` is filled in by `useUndoRedo` on the same
render, passed down into `useResumeStore`:

```js
// App.jsx — order matters, and this is the whole point
const resetHistoryRef = useRef(null);
const storeApi = useResumeStore({ showToast, resetHistoryRef });
const undoApi  = useUndoRedo({ store: storeApi.store, setStore: storeApi.setStore, showToast });
resetHistoryRef.current = undoApi.resetHistory;   // filled in after both exist
```

`useResumeStore` reads `resetHistoryRef.current` **at call time**, long after
mount, so the value is always the latest one and no import cycle exists. The
dependency runs one way: store → history.

The same pattern solves the toast problem: `showToastRef.current = showToast`
lets the debounced save effect report a quota failure without taking
`showToast` as a dependency, which would restart the 400 ms debounce every time
the toast changed.

### Two listeners, disjoint domains

`useUndoRedo` and `useKeyboardShortcuts` both attach `keydown` listeners.
Rather than merge them, their domains are strictly disjoint:
`useKeyboardShortcuts` returns early on any `z`/`y` press, so only one listener
ever acts on a given key, and only one calls `preventDefault`.

`useKeyboardShortcuts` exports a `SHORTCUTS` table that drives **both** the
handler and the help panel, so the panel cannot drift from reality.

---

## 5. Export paths

Three, each for a different purpose.

### 1. Raster PDF — `exportToPdf(el, data, { mode: 'raster' })`

`src/utils/pdfExporter.js`. html2pdf (html2canvas → jsPDF) rasterises the page
to JPEG at 2×, then wraps it in an A4 PDF.

- Text is **not** selectable and the file is larger.
- This is the **default** for the 2-argument call, because that is the
  long-standing public signature and existing callers must keep behaving
  identically.
- The preview is CSS-scaled for zoom, so the wrapper's transform is
  neutralised before capture and restored in a `finally`; `onclone` repeats the
  reset on html2canvas's clone.

### 2. Vector PDF — `exportToVectorPdf(el, data)` / `mode: 'print'`

The browser's own print-to-PDF via `window.print()`. Real vector text:
selectable, small, and parseable by ATS systems. Opt-in through
`exportToPdf(el, data, { mode: 'print' })`.

Print has no clone step, so the **live** node is neutralised — inline in
`withPrintLayout()` and again in the `@media print` block of `src/index.css`,
which resets `transform`, `scale` and `zoom` on `#resume-print-wrapper` and
`.resume-paper`. Either alone would be a single point of failure.

`triggerPrint()` shares the same `withPrintLayout()` helper.

### 3. DOCX — `exportToDocx(resumeData, theme)`

`src/utils/docxExporter.js`, using the `docx` library. Emits a real OpenXML
document with an embedded photo (aspect ratio preserved), coloured headings
built by `createSectionHeading()`, and proper bullet lists. Every section is
guarded with `Array.isArray`, and an empty document still produces a valid
file.

The jobs agent consumes the DOCX rather than the PDF: form uploads expect a
document, and it is the format the user controls.

---

## 6. Where the AI boundary is

AI is **opt-in and off by default**. With no key configured, the AI buttons
prompt for configuration and make no request.

```
src/utils/aiService.js
  ├── getSavedAiConfig()   reads nexus_ai_config_v1 from localStorage
  ├── DEFAULT_AI_CONFIG    falls back to import.meta.env.VITE_AI_API_KEY
  └── every call: fetch(<user's baseUrl>, { Authorization: <user's key> })
```

What crosses the boundary, and only when the user presses a button:

| Action | Leaves the browser |
|---|---|
| Refine a summary / bullet | That text, plus a prompt |
| Suggest skills | The target role and resume context |
| Match / tailor | Resume searchable text + pasted job description |
| Cover letter | Resume facts + job details |
| Model discovery | A `GET` to the provider's model list |

Nothing else. No telemetry, no analytics, no call to this project's origin.

Two things worth knowing:

- The endpoint is **whatever the user configures**. Any OpenAI-compatible base
  URL works, including a local Ollama. The app cannot make a privacy promise
  about a third party the user chose.
- `VITE_AI_API_KEY` is inlined into the bundle at build time. It is published
  source, not a runtime secret. See [SECURITY.md](../SECURITY.md).

The keyword matcher (`src/utils/keywordMatcher.js`) is deliberately **not** AI:
it is a pure module with zero imports, so JD matching works offline and sends
nothing anywhere.

---

## 7. Test strategy — four suites, four blind spots

`npm test` chains all four with `&&`. Each catches something the others
structurally cannot.

| Suite | Kind | Catches | Cannot catch |
|---|---|---|---|
| `test-fixes.cjs` | Source grep | Conventions that are visible in the text: a template missing from a registry, a prompt that dropped the resume context, an unsafe selector | Anything that is only true at runtime |
| `smoke-test.mjs` | Module import | Real behaviour of pure modules with real sample data: parsers, ATS scoring, store round-trips | Anything that renders |
| `test-integrity.mjs` | Behavioural | Data-integrity regressions: hostile input, corrupt store, quota, two-tab merge, stemming traps, contrast tokens, ATS layout | A render crash |
| `vitest` (jsdom) | Component | **Render crashes.** Mounts all 9 templates and all 8 dialogs (plus `ErrorBoundary`) against the hostile-data matrix; focus traps, Escape, accessible names, HTML-injection containment | Layout, print output, real network |

The component suite exists because the first three cannot catch a render crash
— they either grep source text or import plain modules. Every P0 the adversarial
QA pass found was a render crash or a data bug, and only mounting the component
finds the first kind.

`npm test` is a **gate, not a report**: it exits non-zero if any suite fails.
That was proven by breaking an assertion deliberately and confirming a non-zero
exit, because a gate that exits 0 on failure is theatre.

---

## 8. Offline and installability

- `public/manifest.webmanifest` + generated icons → installable.
- `src/sw.js` is a **source file**, not imported by the app. A ~40-line inline
  plugin in `vite.config.js` reads it at `closeBundle`, substitutes the real
  precache list and a content-derived version, and writes `dist/sw.js`.
- Registration in `src/main.jsx` is hard-gated on `import.meta.env.PROD` so it
  never interferes with HMR, and the whole thing is wrapped so a missing
  `sw.js` cannot break the app.
- Strategy: **network-first** for the HTML shell (a deploy is picked up on the
  next load, offline still opens), **cache-first** for hashed assets.
- The job agent (`:3457`) and all cross-origin requests are explicitly never
  intercepted or cached.

---

## 9. Build and deploy

```
npm run build          vite build → dist/ + sw.js
npm run build:static   build, copy 404.html/_headers, verify PWA artifacts,
                       write DEPLOY.txt (SHA-256 inventory)
npm run package:zip    dist/ → resume-builder-static.zip (archive root = site root)
```

The agent harness is **not** deployed: it needs a real Chrome install and holds
job-board credentials. It runs locally. See [DEPLOY.md](../DEPLOY.md).

`manualChunks` splits React and the document-export libraries into separate
chunks; Vite 8's rolldown requires it to be a function returning a name or
`undefined`.

---

## 10. Things that look wrong but are deliberate

- **`ErrorBoundary` duplicates `STORE_KEY`** instead of importing it. It has to
  keep working when `resumeStore.js` is the thing that broke.
- **`triggerPrint()` keeps a 1500 ms timer** after `window.print()` returns.
  The browser derives the PDF filename from `document.title`, and `print()` may
  return before the engine has read it.
- **Undo restores only `data` and `theme`**, never `id`, `name` or `letter` —
  undoing an edit must not rename the resume or revert the cover letter.
- **`useKeyboardShortcuts` refuses Ctrl+P.** The browser owns it, and the app's
  Print button already uses the browser's vector path; hijacking it would mean
  a user asking to print silently gets a file export.
- **`asStringList()` drops numbers** rather than stringifying them. `"42"` on a
  resume reads as a bug.
- **Applications live in their own key** so a store rewrite cannot take
  application history with it.
