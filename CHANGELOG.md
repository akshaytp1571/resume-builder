# Changelog

All notable changes to this project. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
