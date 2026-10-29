# Changelog

All notable changes to this project. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-10-27

Four features that landed after the v3.0.0 re-skin without a changelog entry.
The re-skin touched no behaviour; these do.

### Added

- **A landing page, behind a hash router.** `#/` is the landing page, `#/app` is
  the editor. A hash router rather than a path router because the app deploys to
  a static host on a subpath with no rewrite rules, so a path route would 404 on
  refresh and a hash never reaches the server. The editor is still imported
  eagerly — it is the product, and a landing page that delays it behind a second
  round-trip would be slower to the thing that matters.
- **US Letter paper size.** `theme.paperSize` is `'a4' | 'letter'`, defaulting to
  A4. The page budget in `ResumePreview`, the `Layout & Fit` category in the ATS
  score, and both PDF export paths all read the same value, so a Letter resume
  is never measured against an A4 page. The DOCX exporter already carried its
  own page geometry and was left alone.
- **Trash with 30-day recovery for resume variants.** `removeVariant` moves a
  variant to a separate `trash` array rather than dropping it, so a delete is
  undoable and nothing downstream has to learn to filter deleted rows. Trash is
  purged on load rather than on a timer, because load is the only moment the app
  is guaranteed to run. Retention is 30 days: long enough that a misclick is a
  shrug, short enough that a stale trash cannot quietly fill `localStorage` — a
  resume is ~8 KB, so 30 days of accidental deletes is still smaller than one
  photo data URL. `restoreVariant` assigns a fresh id, because the old one may
  have been reused by a resume created after the delete.
- **Plain-text ATS projection** (`src/utils/atsTextView.js`). Renders the resume
  as the stream a parser actually extracts: one column, no styling, uppercase
  section headings, dates on the same line as the role. Deliberately the *worst
  plausible* shape — if the projection reads correctly, an ATS can parse the
  export; if a field is missing here it is missing from the PDF, whatever the
  preview shows.

### Fixed

- **`saveStore()` silently dropped a same-variant edit from another tab.** The
  cross-tab merge unions variant *ids*, which cannot see the case where both
  tabs hold the **same** id: nothing is adopted, and the older edit is simply
  overwritten with no warning. `saveStore` now compares the on-disk copy of each
  shared id against ours and returns a `conflicts` array naming the colliding
  variants; `useResumeStore` turns that into an error toast. Ours is the copy
  that gets written — the user is looking at it — so the other tab's newer edit
  is reported rather than silently discarded. The comparison is on content, not
  on `updatedAt`: two saves inside the same millisecond produce identical
  timestamps, so a timestamp compare misses real collisions, and it only ever
  sees them from the losing side. Comparing content catches them from the
  overwriting side too, which is the side that needs the warning.
- **`isUsableResumePath()` accepted `..` traversal** (QA-REPORT P2-6, previously
  OPEN). `C:\a\..\..\b.docx` passed, and the value is handed to the Node apply
  agent as the file to upload. Now refuses any `..` path segment and any null
  byte, on either separator. A substring test for `..` would also have rejected
  the legal `My..Resume.docx`, so each segment is tested individually.
- **`captureConsoleErrors()` swallowed exceptions.** The `return` sat inside the
  `finally` block, so anything the captured function threw was discarded and the
  test passed with an empty log. A render crash inside a captured block was
  invisible. The spy is still restored unconditionally; the throw now propagates.
- **A stray `0x07` control character in the README**, in the middle of
  `aria-keyshortcuts`.

### Removed

- **`et3.mjs`** — a committed Playwright probe with a duplicate `tr_check`
  declaration, a hardcoded `C:/Users/aksha/...` path, and an undeclared `tr2`.
  It was the only `oxlint` error in the tree, so `npm run lint` failed while the
  README claimed it reported 0 errors.
- **Dead code left by the v3.0.0 re-skin.** `triggerCelebration` and its
  `canvas-confetti` import in `AtsScoreModal.jsx` survived the removal of the
  "Celebrate" button; `SaveStatus` was imported twice in `App.jsx` (the real
  render is in `EditorSidebar`); `ROUTE_APP` was imported into `main.jsx` and
  never used.
- **A `catch (err) { throw err }` wrapper in `src/sw.js`** that read like it did
  something while doing nothing. The comment above it was the whole explanation,
  and is kept.

### Documentation

- README's test count was stale in three places (783 → 893).
- README now documents the four v3.1 features and the hash-route split.
- README's Node requirement explains *why* 22.12 is the floor (Vite allows
  20.19+, Vitest does not), instead of asserting it.
- `docs/ARCHITECTURE.md` notes the `conflicts` return value on `saveStore`.

## [3.0.0] - 2026-10-25

**DRAFTING TABLE** — a complete visual re-skin. No behaviour, data or contract
change; the entire 893-test suite passed untouched before, during and after.

### Changed
- **Every surface.** The neon-magenta / plum / glassmorphism language is gone,
  replaced by a warm-black instrument housing: `--void #0C0D0B`, bone text on
  hairlines, 0–2px radii, and one lime signal colour reserved for interactive
  and positive state. A single sheet of paper is the only soft object on screen,
  which is why every panel around it has a 0px radius.
- **Typography.** Archivo (display/UI), IBM Plex Mono (labels, metadata,
  numerals — all tabular), Instrument Serif italic for exactly two jobs: the
  wordmark's second word and section numerals. All three **self-hosted**; the
  app is an offline PWA and was blocking first paint on fonts.googleapis.com.
- **The navbar is an instrument bar.** The scrolling "BOTANICAL CANVAS STUDIO //
  TEXTURED EDITION" ticker, the build stamp and the blinking status dot are
  gone. In their place, three readouts that carry measured state: AI provider
  with a static LED, the live ATS number, one-page on/off.
- **The editor rail is a numbered column**, not a 3×5 grid of icon tiles. A grid
  of nine equal boxes says "nine unrelated things"; a numbered column says "one
  document, nine parts, in order".
- **Template picker** is a 3×3 grid of pure-CSS miniatures — each a small
  bar-layout approximating that template, with no image dependency to keep in
  sync. Palette swatches show their hex as mono data.

### Added
- **The plate.** Crop marks 12px out from the sheet corners, `Plate 01 · A4
  210×297` bottom-left, live `Fit {zoom}%` bottom-right. All `no-print`.
- **The ATS gauge.** 40 hairline ticks (every fifth tall), the numeral counting
  up linearly over 320ms, ticks revealing on a 40ms stagger, and `role="meter"`
  with `aria-valuenow` so a screen reader is not read the animation. A ring is a
  decoration that happens to encode a number; a calibrated scale is readable
  without the numeral.
- **The export sweep.** One 1px lime hairline crossing the bench on export, so
  the click has a visible answer. Gated on a counter rather than the busy flag —
  the vector export path resolves in a single tick, so a busy-flag gate meant
  React never painted a frame with the line present and the animation was never
  seen at all.
- **`scripts/verify-motion.mjs`** — 24 browser-checked invariants that a unit
  test cannot see: no `backdrop-filter` anywhere, no filter on the sheet or its
  wrapper, exactly one background image on the bench, gauge fill matching its
  value, the sweep not containing the sheet, reduced motion collapsing every
  transition to ≤1ms and disabling the entrance outright, and print hiding every
  chrome surface with zero text leakage.
- **`docs/redesign/{AUDIT,DECISIONS,CONTRACTS}.md`** — the contract inventory
  with the file and line that enforces each, every decision with its reasoning,
  and the verification commands per class of change.
- **11 primitives** in `src/components/ui/primitives/` so the same twenty
  Tailwind classes are not hand-written in forty files.

### Removed
- 597 KB of canvas textures (`canvas-painting.jpg`, `canvas-thread-texture.png`).
  The bench is now a 24px CSS dot grid at 2.5% — visible when you look for it,
  invisible when you don't.
- The floating "Atelier Dock", which duplicated the navbar's PDF and DOCX
  buttons and sat over the sheet.
- The "Celebrate" confetti button in the ATS modal.
- The Google Fonts CDN links, the `#030712` body class, and the
  `NEXUS RESUME PROTOCOL // Quantum Cyber-Studio` page title.

### Fixed
- **Two `<input type="color">` swatches had no accessible name.** The `<span>`
  beside each was a sibling, not a label, so the control announced as an
  unlabelled colour picker. Found by a keyboard sweep of the built app.
- **A horizontal overflow at 375px** introduced while fixing the variant
  buttons: `inline-flex` in a shared base class outranked a later `hidden`, so
  the buttons never hid. Now uses `max-sm:hidden`.

### Notes
- `#140715` remains in `<meta theme-color>` and the manifest while the shell
  renders `#0C0D0B`. Browser chrome is not page colour, and `pwa.test.js` pins
  the value; a mobile status bar stays one plum shade off by design.
- `src/components/templates/**` was deliberately not restyled. Those files are
  the exported artifact and the ATS scorer measures them.
## [2.5.0] - 2026-10-23

Open-source hygiene, and a security audit that found a real hole.

### Added
- **`SECURITY.md`** — an honest threat model. It leads with the uncomfortable
  truth: resume data and job board credentials live in plaintext `localStorage`,
  are not encrypted, and are readable by any script on the origin or anyone with
  the browser profile. Includes a full key inventory with sensitivity ratings and
  an explicit "does not protect against" table.
- **`docs/ARCHITECTURE.md`** — the data model, the trust boundary, the six hooks
  and the ref handshake, the four-suite test strategy, the three export paths,
  and where the AI boundary sits.
- **`CONTRIBUTING.md`**, **`CODE_OF_CONDUCT.md`** (Contributor Covenant 2.1), and
  GitHub issue/PR templates. The bug-report form warns against pasting real
  resume data into a public issue.
- **`SECURITY-FINDINGS.md`** — the audit report, with severities and an explicit
  "accepted risks" section.

### Fixed
- **The job agent bound to every network interface.** `app.listen(PORT)` with no
  host makes Node listen on `::` — the unauthenticated API, including
  `/api/apply`, was reachable from any device on the same network. Verified: the
  socket was `{"address":"::"}`. It now binds `127.0.0.1` explicitly, and a LAN
  client is refused. CORS was also a bare `cors()` reflecting any origin; it is
  now an allowlist of the app's own dev and preview origins.
- **Crash rescue silently handed back a blank resume.** `ErrorBoundary` read only
  the main store key. When `resumeStore` cannot parse the store it quarantines
  the unreadable value to a `__recovery_<ts>` key and leaves the main key alone —
  but the next save writes a fresh blank store over it. From then on the real
  data exists *only* in the recovery key, and "Download my data" gave the user the
  blank store while saying "Saved your raw resume data". Now collects the main key
  plus all recovery copies.
- **`maskSecret` revealed 4 of 5 characters** — `"abcde"` became `"ab••••••de"`.
  Nothing is revealed below 12 characters now, and the masked length matches the
  secret. It had no call sites, so this was a latent trap rather than a live leak.
- **`VITE_AI_API_KEY` could be inlined into the public bundle with no warning.**
  Vite inlines `VITE_`-prefixed vars into shipped JavaScript; a build-time key
  ends up as plain text in `dist/assets/index-*.js`. Proved with a canary build.
  `vite.config.js` now fails the build if the variable is set, unless
  `ALLOW_INLINE_AI_KEY=1` is passed for a genuinely private build.

### Documentation corrections found during the audit
- **README claimed Node 18+.** Vite 8 requires `^20.19.0 || >=22.12.0` and Vitest
  5 requires `^22.12.0` — `npm test`, the project's own gate, could not run on
  Node 18. Now says 22.12+.
- **README's test count was stale in three places** (597 → 783).
- **This changelog had no v2.4.0 entry** despite `package.json` reading 2.4.0.

## [2.4.0] - 2026-10-23

Installable, offline-capable, and keyboard-complete.

### Added
- **PWA support.** A web app manifest with generated icons (a document glyph in
  the app palette, produced by a reproducible script), and a service worker with
  a deliberate caching strategy:
  - HTML shell: **network-first with a cache fallback** — a deploy lands on the
    next load, and an offline load still works
  - `/assets/*`: **cache-first** — hashed filenames are immutable
  - The job agent on `:3457` and all cross-origin requests are never cached; the
    agent is dynamic and stale job results would be worse than none
  - Versioned cache name (SHA-256 of the precache list), old caches deleted on
    activate
  - Registered behind `import.meta.env.PROD` only, so it never fights HMR
  - A missing or broken worker degrades gracefully — the app still loads
- **Keyboard shortcuts, announced and discoverable.** There were zero
  `aria-keyshortcuts` in the codebase. Now: undo `Ctrl+Z`, redo `Ctrl+Shift+Z`,
  export DOCX `Ctrl+S`, export PDF `Ctrl+Shift+S`, shortcut help `?`, with Mac
  `⌘` equivalents.
- **A shortcut help panel.** One `SHORTCUTS` array drives both the keydown
  dispatcher and the panel, so the help can never document a key that does
  nothing.

### Notes
- **Ctrl+P is deliberately not intercepted.** The browser owns it for print, and
  the Print button already uses the browser's vector print path. Hijacking a
  browser shortcut surprises users more than not having the shortcut at all.
- Every shortcut respects the `isEditableTarget` guard: typing in a field is never
  intercepted, and `Ctrl+Z` still performs native text undo.
- No new dependency. `vite-plugin-pwa` and workbox are absent; the worker needs
  only the file list and a version string, so a ~40-line inline plugin covers it.

## [2.3.0] - 2026-10-23

Maintainability and accessibility. `App.jsx` split from 907 to 477 lines, a skip
link, and a vector PDF export that is finally reachable.

### Changed
- **`App.jsx` split into five hooks** plus a presentational `RecoveryBanner`
  component. It had grown to hold the variant store, undo/redo, debounced save
  with two-tab merge, recovery banner, layout measurement, applications, cover
  letter, toasts and eleven modal flags.
  - `useToasts`, `useResumeStore`, `useUndoRedo`, `useApplications`,
    `useLayoutMeasurement`
  - The circular dependency between the store (needs `resetHistory` on variant
    switch) and history (needs `setStore`) is broken with a ref handshake, so the
    import graph stays one-way and no hook imports another.
  - **Proven, not asserted:** pre- and post-refactor builds were both rendered and
    their `document.body.innerHTML` compared with ids and timestamps normalised —
    byte-for-byte identical, 69,875 characters, 609 elements.

### Added
- **Skip-to-content link** — the first focusable element in the DOM, hidden by
  clip until focused (not `display: none`, which would drop it from the tab
  order), excluded from print. A keyboard user previously tabbed through 12
  navbar buttons on every load before reaching the editor.
- **Vector PDF export is reachable.** `exportToVectorPdf()` existed since v1.1
  with no caller. A split button adds a caret segment; the toast says "PRINT
  DIALOG OPENED — SAVE AS PDF" rather than claiming a download, because it opens
  a dialog.

### Fixed
- **The navbar overflowed at 320px** — the centre capsule measured 436px in a
  320px viewport. Pre-existing. `flex-wrap` on the capsule plus collapsing the
  `ATS:` and `1_PAGE` labels below `sm`. Measured in real Chrome: 320/320 and
  1440/1440.
- **The Print button's aria-label was ambiguous** — it mentioned "vector PDF",
  so screen-reader users would have heard two buttons say it. Renamed to "Open
  the print dialog".

## [2.2.1] - 2026-10-23

### Fixed
- **Every tracked application recorded an empty variant.** The `ApplyModal` call
  was missing `activeVariantId`, `activeVariantName` and `onApplicationRecorded`,
  so the tracker showed "Resume: unknown" — defeating the point of the feature.
- **`ResumePreview` read `theme.templateId` without a guard**, so a null theme
  threw for all nine templates. QA reported this in the v1.1 audit as
  "mitigated, not fixed"; the templates were hardened in v2.0 but this wrapper
  layer above them was not. It now uses `safeTheme()`, which had been dead code
  since v2.0 — the fix was to finally call it.

## [2.2.0] - 2026-10-23

The application tracker.

### Added
- **Application tracker** — every submission through the apply agent is recorded
  with company, title, URL, date, status and the resume variant used. A Navbar
  badge opens a panel with inline status editing across six states, a stats strip
  (total, active, response rate), a status filter, and delete with confirmation.
- Stored under its own key, deliberately outside the variant store: applications
  outlive the resume that was sent.
- **`pruneOrphanedVariants()`** marks applications whose resume variant was
  deleted rather than deleting them. The application still happened.

### Notes
- `responseRate` returns `0` with no applications, never `NaN`.
- The record is written at the exact point the agent **confirms** submission.
  A failed or skipped application is never recorded — five tests cover each path.

## [2.1.0] - 2026-10-23

### Added
- **Layout & Fit in the ATS score.** `calculateAtsScore(data, layout)` takes an
  optional measurement from the preview. A one-page resume scores 92; the same
  content spilling to 200% scores 81. Layout gets 13 of the 100 points — the
  largest non-Contact allocation, because a second page filters more candidates
  than a weak Education section. With no layout argument the legacy
  `25/15/15/25/10/10` table is returned verbatim, so the one-argument contract is
  exact rather than approximate.
- **Cover letter builder** — a matching letter per variant with a draft
  generator that writes real prose from your own summary, skills and most recent
  role. No AI call, no network, no `[Company]` placeholders. Exports to DOCX as a
  business letter, not a resume.

### Fixed
- **A blank resume scored 16 with a layout** (was 4) — "fits one page" paid 13
  points on an empty page. Fit is now withheld below a content score of 25.
- **Merely measuring a page could lower the score** — rescaling rounded 4/15 down
  to 3/12. Now uses `Math.ceil`; measuring never costs points the content earned.
- **Three prose bugs in the draft generator** — a naive comma split broke
  parenthetical skill lists, acronyms were lowercased mid-sentence, and the
  opening clause assembled into "a QA Lead , where I am currently QA Lead at…".

## [2.0.0] - 2026-10-23

A component test suite, undo/redo, and photo upload guards. The test suite is
the headline: it is the first thing in this project that can catch a render
crash, and it immediately found three real bugs that three previous audit
passes had missed.

### Added

- **Component test suite** — Vitest + React Testing Library, 518 tests across
  6 files, running in jsdom. Every one of the nine templates is mounted against
  a 14-case hostile-data matrix and a 6-case hostile-theme matrix; every modal
  is mounted and checked for dialog semantics, Escape handling and accessible
  names; `ModalShell` is tested directly for focus-trap wrapping in both
  directions, focus restore, and scroll lock. HTML-injection containment is
  verified with 5 payloads across 9 templates, and the assertions were proven
  non-vacuous by running them against a component that genuinely injects.
- **`npm test` is now a hard gate** — chains `test-fixes`, `smoke`,
  `test-integrity` and `vitest run` with `&&`. Verified to exit non-zero on
  failure by deliberately breaking an assertion.
- **Undo/redo.** Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y), plus Navbar
  buttons. Bounded 50-snapshot history, coalesced so a pause in typing is the
  boundary rather than every keystroke. Restores both resume data and theme.
  Deliberately does **not** fire while focus is in a field, so the browser's
  native text undo keeps working.
- **Photo upload guards.** `validateImageFile()` rejects non-images, empty files
  and anything over 10 MB *before* the file is decoded, with the actual size in
  the message. `downscaleImage()` shrinks the source to 1024 px before the crop
  modal sees it, and returns the original untouched when it is already small
  enough. A 12 MP phone photo previously base64-decoded in full and could freeze
  the tab.
- **`safeResume()` / `safeTheme()`** in `src/components/templates/templateData.js`
  — a shared guard so no template can throw on bad input.

### Fixed

- **All nine templates crashed on null or undefined data** — `const {
  personalInfo } = data` throws, and `highlights: "one string"` throws on
  `.map`. Found by the new suite, not by any of the three earlier audits.
- **`MinimalTemplate` rendered no photo at all** and painted from a hardcoded
  palette, so colour customisation silently did nothing.
- **`NordicTemplate` (Executive) ignored theme colours entirely** and accepted
  only a font family containing "Merriweather", silently discarding every other
  choice.
- **Redo was impossible after a single undo** — the restore retriggered the save
  debounce, which pushed the restored state and wiped the redo branch.
- **Variant switching left stale history**, so undo could paste one resume's
  content into another.
- **The test harness's canvas stub was dead code.** jsdom *defines*
  `getContext` (it returns `null`), so an `if (!getContext)` guard never fires.

### Changed

- Test count went from 87 source checks + smoke + integrity to **518 component
  tests** on top of those. The debt-ledger mechanism (`it.fails` for known-broken
  combinations) started at 30 entries and is now empty — each template fix
  flipped its entry red and forced the deletion.

## [1.2.0] - 2026-10-22

Closes the four gaps left open after v1.1.0: recovery is now visible to the user,
the keyword matcher handles word inflections, muted text meets WCAG AA, and the
README has real screenshots.

### Added

- **Recovery banner.** When a saved resume cannot be read, `loadStore()` already
  quarantined it under a recovery key — but nothing told the user, so they saw
  sample data and never learned their own resume was recoverable. A one-time
  banner now explains what happened and offers a download of the original bytes.
  Dismissing it sets a flag so it does not nag; the recovery copy is kept either
  way. `listRecoveryKeys()` returns the keys newest-first.
- **Light stemming in the keyword matcher.** `test` and `testing` were distinct
  terms, so a job description asking for "test automation" did not match a
  resume saying "automation testing" — the single largest source of false
  negatives. A deliberately small suffix-stripper (`-ies`, `-es`, `-ing`, `-ed`,
  `-s`) now normalises both sides for comparison only. Display terms keep their
  surface form, multi-word phrases are never stemmed, and acronyms survive
  intact. On the shipped sample resume against a real QA job description the
  match score rose 62% → 69% with no regressions.
- **Screenshots in the README.** Editor, ATS breakdown, job-description matcher
  and template picker, at 1440×900 and under 150 KB each.

### Changed

- **Contrast raised to WCAG AA across the whole palette.** Every muted text
  token was measured, not guessed: `text-pink-300/60` (4.30:1) and `/50`
  (3.37:1) went to `/70` (5.38:1); `text-pink-400/60` (3.12:1) and `/50`
  (2.57:1) went to `/85` (5.03:1); `slate-500` (3.76:1) became `slate-400`
  (6.82:1); placeholders went from `/30` (1.92:1) to `/50` (3.41:1); UI borders
  from `pink-400/50` (2.57:1) to `/70` (3.82:1). Hue was never touched — only
  opacity — so the muted aesthetic is unchanged.
- **Corrected colour reference.** The palette is Tailwind 4, which ships oklch
  values, not the v3 hex codes. `pink-400` is `#fb64b6`, not `#f472b6` —
  materially more saturated, and auditing against the v3 value would have
  understated contrast and caused over-correction.

### Notes

- `text-pink-300/70` already passed AA at 5.38:1 and was left alone across its
  44 uses. Measuring beat assuming.
- The only remaining sub-4.5:1 text is a disabled control at 3.12:1, which
  WCAG 1.4.3 explicitly exempts.

## [1.1.0] - 2026-10-22

Nine templates, PDF import, offline job-description matching, vector PDF export,
and a full adversarial QA pass that found and fixed six data-integrity defects.

### Added

- **Three new templates** — Developer Console (monospace two-column with a skill
  rail), Academic CV (serif, numbered sections, publication-friendly), and
  Startup One-Pager (bold header band, pill skills). Nine templates total.
- **PDF resume import.** `pdfjs-dist` extracts text, reconstructing lines from
  the baseline of each text item. Handles password-protected PDFs and
  image-only scans with readable errors, and caps at 30 pages so a huge file
  cannot freeze the modal. The worker is bundled as a Vite asset.
- **Offline job-description matcher.** Paste a JD and see weighted keyword
  coverage against your resume — no AI call, no network. Detects 50 multi-word
  technical phrases, weights terms mentioned repeatedly or inside a
  requirements block, and reports matched and missing keywords by category.
  Lives in the ATS modal behind a collapsible panel.
- **Vector PDF export.** `exportToVectorPdf()` hands the page to the browser's
  own print-to-PDF so the text is selectable and ATS-readable rather than a
  JPEG. The raster path remains the default for `exportToPdf(el, data)` so
  existing behaviour is unchanged; pass `{ mode: 'print' }` to opt in.
- **`ErrorBoundary`** wrapping the app. A render throw now shows a readable
  recovery screen with a "Download my data" button that serialises the raw
  `localStorage` value, instead of a blank page.
- **`test-integrity.mjs`** (`npm run test:integrity`) — behavioural regression
  tests for every defect found in the QA audit. Unlike `test-fixes.cjs`, which
  greps source text, these import the real modules and assert real outcomes.
- **`QA-REPORT.md`** — the full adversarial audit, including what held up.

### Changed

- **ATS weighting** gained a Projects category (10 points); Summary and Skills
  reduced to 15 each. Maximums still sum to exactly 100.
- **`saveStore()` now returns `{ ok, merged }`** instead of a boolean, and
  merges before writing. Two open tabs no longer destroy each other's variants:
  variants the other tab created are adopted rather than overwritten, and the
  caller is told a merge happened so it can notify the user.
- **`normalizeResume()` is now a real trust boundary.** It validates item
  shapes, not just that each collection is an array, and coerces scalars.
  Numbers in bullet lists are dropped rather than stringified.
- **Print CSS** resets every form of scaling on the preview, forces
  `print-color-adjust: exact` so photos and accents survive, and keeps a job
  title with its bullets across a page break.

### Fixed

- **CreativeTemplate silently dropped certifications** — it was the only
  template that did.
- **A corrupt resume store was silently overwritten with sample data.** The
  unreadable value is now quarantined under `…__recovery_<timestamp>` first.
- **`skills: [null]` and other wrong-typed items crashed the ATS scorer and
  every template** — reachable through a JSON resume import. 108 template
  crashes and 14 scorer crashes were reproducible; all now pass.
- **Duplicate variant ids crashed delete** and could empty the store.
- **A quota-exceeded save was completely silent.** It now warns the user once:
  "COULD NOT SAVE — BROWSER STORAGE IS FULL. EXPORT A BACKUP NOW."
- **A JSON resume with object-valued fields white-screened the entire app.**
  The upload preview rendered raw parsed data; it now normalises first.
- **A 50,000-character token threw "Regular expression too large"** from inside
  the keyword matcher.
- **Action verbs matched as substrings.** Bullets containing no verb scored
  18/25 because "led" hides inside "enabled", "saddled" and "cancelled". Word
  boundaries fix it; no legitimate resume loses a point.
- **A 10-word summary scored 0/15** while 11 words scored 9/15.
- **`ImageCropModal` panning froze** when the cursor left the panel.
- **Non-Latin names produced `_Resume.docx`** instead of falling back to
  `Resume.docx`.
- **`calculateAtsScore` no longer throws on any input**, including `null`.

### Upgrade notes

No migration is required. The store key is unchanged and `saveStore`'s new
return shape only affects callers, both of which are in this repository.

## [1.0.0] - 2026-10-22

First release with a complete feature set. Adds multiple resume variants,
Projects and Custom Sections, and a full accessibility pass.

### Added

- **Multiple resume variants.** Keep a named, job-targeted copy of a resume per
  application and switch between them instantly. Each variant carries its own
  resume data and theme.
  - `src/utils/resumeStore.js` — variant store with automatic migration from
    the previous single-resume `localStorage` keys
  - `src/components/ui/VariantSwitcher.jsx` — create, rename, duplicate, delete,
    export-all and import
  - Deleting the last remaining variant is refused, so the app always has
    something to edit
  - Export/import round-trips the whole set as one JSON document; bare
    single-resume backups still import
- **Projects section.** Name, role, period, link and bullet highlights, with
  an editor and rendering in all six templates.
- **Custom Sections.** Free-form titled sections (publications, awards,
  volunteering) for content that does not fit the fixed schema.
- **Template capability registry.** `src/data/templateCapabilities.js` declares
  which sections each template renders. The template picker now warns before
  switching to one that would hide content you have filled in.
- **Accessibility.** All eight dialogs migrated to a shared
  `src/components/ui/ModalShell.jsx`:
  - `role="dialog"`, `aria-modal`, labelled headings
  - focus moves in on open and returns to the trigger on close
  - Tab / Shift+Tab focus trap, Escape to close, background scroll lock
  - `aria-label` on every icon-only control, `aria-pressed` on toggles,
    visible focus rings
  - 38 aria/role attributes added where there were previously none
- **`smoke-test.mjs`** — imports the real modules and asserts runtime behaviour
  (variant round-trip, object independence after import, last-variant
  protection, legacy key migration, ATS totals).
- **`PhotoFrame.jsx`** — one shared photo component replacing five copy-pasted
  implementations across the templates.
- **`ExtraSections.jsx`** — shared Projects / Custom Sections renderer with a
  `renderHeading` callback so each template keeps its own heading style.

### Changed

- **ATS weighting rebalanced** to make room for projects. Summary 20 → 15,
  Skills 20 → 15, new Projects & Portfolio 10. Category maximums still sum to
  exactly 100.
- `normalizeResume()` fills every collection with a real array, so a partially
  parsed or hand-edited resume cannot crash a render.
- `EditorSidebar` tabs are now a real `tablist` with `aria-selected` and
  `aria-controls`, and gained Projects and Custom tabs.
- The reset action now resets only the **active** variant, leaving the others
  untouched.
- `loadEsm()` in the test harness resolves relative imports recursively and
  caches every export per module. Previously it stripped imports, so any module
  importing a local constant crashed the suite.

### Fixed

- **`CreativeTemplate` silently dropped certifications.** Every other template
  rendered them; choosing "Emerald Horizon" lost the section with no warning.
  It now renders a certification card grid.
- **`ImageCropModal` photo panning froze** when the cursor left the panel. The
  old backdrop owned `onMouseMove`/`onMouseUp`; after the `ModalShell` migration
  drag tracking moved to window listeners gated on `isDragging`.
- Duplicating a variant now deep-copies its data. Previously the copy could
  share object references with the original, so editing one changed the other.

### Removed

- The `precision_resume_data_v1` / `precision_theme_data_v1` write path. Those
  keys are still **read once** for migration, then superseded by
  `precision_resume_store_v2`.

### Upgrade notes

Existing users lose nothing: on first load the app reads the old
`precision_resume_data_v1` and `precision_theme_data_v1` keys and wraps them in
a variant named after the resume holder. The migration only writes the new store
after successfully reading the old values.

## [0.9.0] - 2026-10-22

Baseline open-source release: six templates, DOCX/PDF export, live ATS scoring,
resume ingestion, multi-provider AI assistance, and the optional Playwright job
discovery / apply agent.

[1.0.0]: https://github.com/akshaytp1571/resume-builder/compare/v0.9.0...v1.0.0
