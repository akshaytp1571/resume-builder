# Changelog

All notable changes to this project. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
