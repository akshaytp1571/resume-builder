# DRAFTING TABLE — Phase 0 audit

Branch `design/drafting-table`, based on `40ba759` (v2.7.0).
No source file was modified in this phase. The only additions are this document
and the baseline captures in this folder.

---

## 1. Baseline (frozen before any change)

| Command | Result | Captured in |
|---|---|---|
| `npm ci` | clean install, Node 24.11.0 / npm 11.6.1 | — |
| `npm run lint` | **0 errors**, 92 warnings, 120 files | `baseline-lint.txt` |
| `npm test` | **893 passed / 21 files**, `SMOKE OK`, `INTEGRITY OK` | `baseline-test.txt` |
| `npm run build` | `✓ built in 5.66s`, `dist/sw.js` 20 precached, `v5dbe1e7a4665` | `baseline-build.txt` |
| `dist/` size | **4.57 MB across 22 files** | `baseline-build.txt` |

**The suite is green. There is no pre-existing failure set to freeze.** The
contract is therefore absolute: 893 tests must still pass at the end.

Build chunk sizes at baseline (from `baseline-build.txt`):

```
assets/index-C3DFuzJZ.js        848.7 KB
assets/doc-export-TCyR5Uu9.js  1615.3 KB
assets/pdf.worker.min-*.mjs    1234.7 KB
assets/react-vendor-*.js        238.5 KB
assets/index-QTFc7UUv.css       104.4 KB
```

> `DEPLOY.md` is stale (claims "44 checks", "17 files, 3.14 MB"). Not in scope
> for this redesign; noted for the owner.

---

## 2. Component map and phase allocation

### Phase 1 — foundations (no component work)
| File | Change |
|---|---|
| `src/index.css` | Replace `:root` palette with the DRAFTING TABLE tokens; `@theme` mapping for Tailwind v4; `@font-face` for the three self-hosted families; base layer (body, scrollbar, focus, dot grid, paper, plate); **delete** `.flora-panel`, `.flora-panel-active`, `.canvas-card`, `.glow-rose`, `.glow-sage`, `.box-glow-rose`; keep `.skip-link`, `.resume-paper` and the **entire** `@media print` block functionally intact |
| `index.html` | New title + description; preload the two critical fonts; remove the three Google Fonts links |
| `public/fonts/**` | 8 woff2 files already fetched (93 KB total) |
| `public/canvas-*` | **delete** — 5 files, 597.8 KB |
| `src/components/ui/primitives/**` | NEW — Button, IconButton, Field, Label, Panel, Readout, Chip, Divider, SectionIndex, Keycap, EmptyState |

### Phase 2 — shell
`src/App.jsx` (root wrapper + toast), `Navbar.jsx`, `VariantSwitcher.jsx`,
`RecoveryBanner.jsx`, `SaveStatus.jsx`, `ResumePreview.jsx` (frame only).

### Phase 3 — editor
`EditorSidebar.jsx` + all 11 section editors + `ThemeCustomizer.jsx`.

### Phase 4 — modals
`ModalShell.jsx` first (every modal inherits), then interiors:
`AtsScoreModal`, `AiConfigModal`, `AiRefineModal`, `JobMatchModal`,
`JobCredentialsModal`, `ApplyModal`, `ResumeUploadModal`, `ImageCropModal`,
`ApplicationTracker`, `GoogleDriveModal`, `JsonResumeModal`, `ShortcutHelp`,
`CommandBar`, `ErrorBoundary`.

### Phase 5 — moments + motion
Gauge (AtsScoreModal), export sweep (App + ResumePreview), plate readouts
(ResumePreview), first-load choreography (index.css), reduced-motion.

### Phase 6 — copy + meta
Grep-guarded copy pass, `index.html` title/description, screenshot sweep.

### Phase 7 — verification
Full gate, keyboard pass, reduced-motion pass.

---

## 3. Contracts, restated with the file/line that enforces each

### 3.1 Source-grep (regex over file text — a JSX restructure breaks these silently)

| # | Contract | Enforced at |
|---|---|---|
| C1 | Each of `AtsScoreModal, AiConfigModal, AiRefineModal, JobMatchModal, JobCredentialsModal, ApplyModal, ResumeUploadModal, ImageCropModal` must match `/ModalShell/` | `test-fixes.cjs:852-858` |
| C2 | None of those files may match `/className="fixed inset-0/` | `test-fixes.cjs:867-869` |
| C3 | Every file in `src/components/templates/` matches `/projects/` and `/customSections/` | `test-fixes.cjs:887-906` |
| C4 | `CreativeTemplate.jsx` matches `/certifications/` | `test-fixes.cjs:909-912` |
| C5 | `DefaultTemplate.jsx` matches `/PhotoFrame/` | `test-fixes.cjs:916-919` |
| C6 | `ProjectsEditor.jsx` / `CustomSectionsEditor.jsx` destructure their prop, call `onChange(`, guard a missing array | `test-fixes.cjs:928+` |
| C7 | `scripts/make-icons.mjs` still contains `192`, `512`, `public` | `src/test/pwa.test.js` |
| C8 | `ModalShell.jsx` contains `role="dialog"`, `aria-modal="true"`, `aria-labelledby={labelledBy}`, `aria-describedby={describedBy}`, `'Escape'`, `'Tab'`, `shiftKey`, `previouslyFocused`, `overflow = 'hidden'` | `test-fixes.cjs:800-836` |

C3–C6 are template/editor contracts I satisfy by **not touching** those files
beyond re-skinning editor markup that already contains the required tokens.

### 3.2 DOM / CSS (asserted by rendering the component)

| # | Contract | Enforced at |
|---|---|---|
| C9 | `header` exists; its `.max-w-7xl` descendant matches `/flex-wrap/` | `a11yNav.test.jsx:131-134` |
| C10 | `header .max-w-7xl` `.children[1].className` matches `/flex-wrap/` → **needs ≥3 children and the centre capsule second** | `a11yNav.test.jsx:142-143` |
| C11 | Spans with exact text `EXPORT_PDF`, `PRINT`, `UPLOAD`, `RESET` exist once each, each with `/hidden (sm\|md\|lg\|xl):inline/` | `a11yNav.test.jsx:107-128` |
| C12 | Exactly one span reads `EXPORT_PDF` | `a11yNav.test.jsx:123` |
| C13 | `ATS:` span and a `/1_PAGE:/` span, both `/hidden sm:inline/` | `a11yNav.test.jsx:152-157` |
| C14 | Every `<button>` has an accessible name | `a11yNav.test.jsx` (+ others) |
| C15 | `a.skip-link` is the first focusable node, `href="#main-content"` | `a11yNav.test.jsx:205-212` |
| C16 | `#main-content` keeps `tabIndex={-1}` and receives focus | `a11yNav.test.jsx:223-252` |
| C17 | `.skip-link` in the print block | `a11yNav.test.jsx:264-273` |

**Current Navbar satisfies C10 with children at L107 (brand), L137 (centre
capsule, has `flex-wrap`), L317 (actions).** Any restructure that changes that
order breaks it.

### 3.3 Accessible names — the real API surface

Asserted by `getByRole(..., { name })`, so these strings are immutable:

```
export resume as vector pdf · ^export resume as pdf$ · vector pdf with selectable text
prepare application · submit application · delete the application to <co> ·
  confirm deleting the application to <co> · open application tracker(, N applications recorded)
generate draft · connect google drive · close keyboard shortcuts · undo last edit ·
  redo last undone edit · download resume as docx
tablist /document/ · /^document$/i · tabs /^CV$/ , /^Letter$/ , /summary/i , /cover letter/i
textbox /body|letter/i · tablist /cv sections/i
```

Asserted by `getByText` (exact or regex), so these visible strings are immutable:

```
Command palette · Undo · Export as DOCX · Import or export JSON Resume ·
  Open application tracker · New resume variant · Keyboard Shortcuts · Google Drive ·
  Save · Set default · Default · Active · Total · Response rate · 0% · All good ·
  QA Lead · Acme · Globex · pin · unpin · Dialog Title · Do it · 3
```

Plus structural: toast `role="status"` + `aria-live="polite"`; modals
`role="dialog"` + `aria-modal="true"`; `aria-pressed` on existing toggles;
shortcut list `dl > dt` + `kbd[aria-keyshortcuts]`, one pair per `SHORTCUTS` entry;
command palette `role="dialog"` containing `Command palette` and a
`role="status"` empty state matching `/no commands match/i`.

> **Rule I will follow:** if a label looks ugly, it is a typographic problem.
> Solve it with font, tracking, casing of *non-tested* text, and layout. Never
> change the string.

### 3.4 Print and export invariants

| # | Contract | Where |
|---|---|---|
| C18 | `#resume-preview`, `#resume-print-wrapper`, `.resume-paper` (210mm × 297mm) keep their roles | `ResumePreview.jsx`, `index.css:148` |
| C19 | The `@media print` block stays functionally intact: `@page` A4, html/body reset, the hide list (`.no-print, .skip-link, header, nav, aside, footer, button, [role=dialog], [aria-modal=true]`), `*` colour-adjust, `main` reset, `#resume-print-wrapper` scale reset, `.resume-paper` A4 override, break rules | `index.css:160-275` |
| C20 | Every new chrome element carries `no-print` | by construction |
| C21 | No persistent `transform`/`scale`/`filter`/`backdrop-filter` on `.resume-paper` or `#resume-print-wrapper`; a one-shot entrance is allowed because print forces `transform: none !important` | `index.css:221-234` |
| C22 | Templates in `src/components/templates/**` are **not restyled** | scope |
| C23 | The sheet stays white/near-white on screen (`#FCFBF8` max) | `index.css:151` (currently pure `#ffffff`) |

### 3.5 Data / behaviour / PWA

| # | Contract | Where |
|---|---|---|
| C24 | No change to localStorage keys, migrations, recovery keys, `normalizeResume`, JSON Resume shape, `TEMPLATES_CONFIG` ids, variant fields | `src/utils/**` (untouched) |
| C25 | No change to undo/redo, autosave, save status logic, shortcut bindings, `aria-keyshortcuts` values, command ids/titles, sound calls, Drive, upload/parse, agent | `src/hooks/**`, `src/utils/**`, `src/agents/**` (untouched) |
| C26 | Manifest keeps `Precision Resume Studio`, `Resume Studio`, `/`, `standalone`, `#140715` ×2 | `pwa.test.js:41-46` |
| C27 | `index.html` keeps `#140715` theme-color, the manifest link, `apple-touch-icon` → `/icons/icon-192.png` | `pwa.test.js:82+` |
| C28 | Icons stay PNG 192/512 with a maskable entry, exact declared sizes, <64 KB | `pwa.test.js:50-70` |

**Consequence of C26/C27:** `#140715` is browser-chrome metadata only. The
rendered shell uses `--void #0C0D0B`. A mobile status bar stays one shade off
plum; that is invisible in normal use and is **not** worth editing a test.

### 3.6 Scope fence

Forbidden: `src/test/**`, `test-fixes.cjs`, `test-integrity.mjs`,
`smoke-test.mjs`, `vitest.config.js`, `vite.config.js`,
`public/manifest.webmanifest`, `src/components/templates/**`, `src/utils/**`,
`src/hooks/**`, `src/agents/**`, `scripts/**`. No new npm dependencies.

---

## 4. Blacklist quantified (what actually has to die)

Measured over `src/**/*.{jsx,js,css}`:

| Tell | Hits | Where it lives |
|---|---|---|
| Gradient / gradient-text | **51** | Navbar brand, PDF/DOCX buttons, dock, panels, scrollbar |
| Glow shadows / `glow-rose` / `box-glow-rose` | **25** | `index.css`, buttons, badges |
| Emoji / `✦` in UI | **22** | Navbar ticker, sidebar header, dock, section headers |
| `backdrop-blur` (glassmorphism) | **18** | header, aside, dock, modals, toast |
| `NEXUS` / `PROTOCOL` / `QUANTUM` | **11** | nav ticker, sidebar sub-header, modal headings |
| Canvas textures | 5 files, **597.8 KB** | `public/canvas-*`, `index.css`, `ResumePreview` |
| `animate-ping` | 2 | Navbar LED, dock dot |
| Orbitron | **0** | already gone (fonts are Inter + JetBrains Mono via CDN) |

Fonts today: 5 families from the Google Fonts CDN, blocking first paint on a
third-party request — for an app that claims to work offline.

Additional dead class names to remove with the CSS:
`.flora-panel`, `.flora-panel-active`, `.canvas-card`, `.glow-rose`,
`.glow-sage`, `.box-glow-rose`.

---

## 5. Token sheet (exactly as I will implement it)

### Colour
```
--void      #0C0D0B    page base, warm black
--housing   #12140F    instrument bar, rail
--housing-2 #191B15    raised controls, popovers, modal panel
--bone      #EDE8DC    primary ink
--bone-70   rgba(237,232,220,.64)   secondary ink
--bone-52   rgba(237,232,220,.52)   tertiary ink / mono labels
--rule      rgba(237,232,220,.12)   pure separation, never load-bearing
--rule-2    rgba(237,232,220,.38)   visible hairlines, control borders
--paper     #FCFBF8
--signal    #D8FF3E    interactive + positive only
--alarm     #FF5A1F    destructive, ≤2 per screen
```
`#140715` survives **only** in `<meta theme-color>` and the manifest.

**Contrast measured with a WCAG calculator against the real token values — not
estimated:**

| Pair | Ratio | Verdict |
|---|---|---|
| `--bone` on `--void` | **15.93:1** | AA text |
| `--bone` on `--housing` | **15.16:1** | AA text |
| `--bone` on `--housing-2` | **14.21:1** | AA text |
| `--bone-70` on `--housing` | **6.73:1** | AA text |
| `--bone-52` on `--housing` | **4.82:1** | AA text |
| `--rule-2` (.38) on `--housing` | **3.15:1** | AA non-text ✓ |
| `--rule-2` (.38) on `--void` | **3.10:1** | AA non-text ✓ |
| `--signal` on `--void` | **16.97:1** | AA text |
| `--void` on `--signal` | **16.97:1** | AA text (signal buttons) |
| `--alarm` on `--void` | **6.25:1** | AA text |
| `--paper` on `--void` | **18.82:1** | — |

**Two values in the brief's draft palette fail the brief's own contrast rule.
Measured, then corrected:**

| Brief value | Measured | Problem | Correction |
|---|---|---|---|
| `--bone-45` = `rgba(237,232,220,.40)` | 3.36:1 on `--housing` | Mono labels are 11px — that is *body* text, not large text, so 4.5:1 applies and it fails | `--bone-52` = **4.82:1** ✓ |
| `--rule-2` = `rgba(237,232,220,.24)` | **1.98:1** on `--housing` | The brief requires UI hairlines ≥ 3:1. At .24 a control border is nearly invisible — the exact "dark theme with invisible borders" failure | `--rule-2` = `.38` → **3.15:1** ✓ |

`--rule` at `.12` measures **1.34:1** and is therefore reserved for pure
separation between already-distinguishable blocks — a divider inside a panel,
never a control boundary, input underline, or anything a user must perceive to
operate the UI. Those use `--rule-2` or `--signal`.

The hairline gains 0.14 alpha over the brief's value. That is the difference
between a drafting table and a black rectangle with a faint suggestion of grid.

### Type
| Role | Face | Size (desktop → mobile) | Tracking |
|---|---|---|---|
| display | Archivo 600 | 3.5 → 2.5 rem | −0.03em |
| h1 | Archivo 600 | 2.25 → 1.75 rem | −0.02em |
| h2 | Archivo 600 | 1.25 → 1.125 rem | −0.01em |
| body | Archivo 400 | 0.9375 rem | −0.005em |
| small | Archivo 400 | 0.8125 rem | 0 |
| mono-label | IBM Plex Mono 500 | 0.6875 rem, uppercase | +0.08em |
| mono-data | IBM Plex Mono 400 | 0.75 rem, `tabular-nums` | 0 |
| serif accent | Instrument Serif italic | inherits | 0 |

Line heights: 1.05 display, 1.45 body. All numerals `font-variant-numeric: tabular-nums`.

### Space / radius / motion
8px baseline. Radii: **0** panels, **2px** inputs/buttons/chips, nothing a pill.
```
--t-90 90ms · --t-140 140ms · --t-220 220ms · --t-320 320ms
--e-out cubic-bezier(.2,.8,.2,1)   entrances
--e-io  cubic-bezier(.6,0,.3,1)    moves, slides, sweeps
```
Animate only `opacity`, `transform`, `background-color`, `border-color`.

### Paper
```
0 24px 60px -12px rgba(0,0,0,.7), 0 1px 0 rgba(0,0,0,.4)
```
No coloured glow. `#FCFBF8` on screen, `#fff` forced in print.

---

## 6. Risk register — the five likeliest breakages

| # | Risk | Why it is likely | How I verify |
|---|---|---|---|
| R1 | **Restyling Navbar breaks C10/C11/C13** | The row's child order and five exact spans are invisible constraints; any "tidy up" reorders them | Run `npx vitest run src/test/a11yNav.test.jsx` after **every** Navbar edit. Structurally keep: `<header>` → `.max-w-7xl` (3 children: brand, centre `flex-wrap`, actions), five label spans with `hidden {bp}:inline`, `hidden sm:inline` on `ATS:`/`1_PAGE:` |
| R2 | **A new chrome element prints onto the résumé** | The print hide list covers `header, nav, aside, footer, button, [role=dialog], .no-print` — a bare `<div>` for crop marks or the plate readout would **not** be hidden | Add `no-print` to every new wrapper; verify with `page.emulateMedia({ media: 'print' })` and assert `document.body.innerText` contains no chrome text |
| R3 | **`backdrop-filter` or a transform leaks onto the paper** | Glass is pervasive (18 sites) and the sweep/entrance animations want to animate the paper | Grep the final CSS for `backdrop-filter` (expect 0 on scrolling surfaces). Assert `.resume-paper` and `#resume-print-wrapper` computed `transform === 'none'` in print emulation, and that the entrance animation is `animation`, not a persistent `transform` |
| R4 | **ModalShell restyle breaks C8 or a modal's tested name** | It is the single inheritance point for 8 modals and 7 source-grep tokens | Keep every required token literally in the file (`role="dialog"`, `aria-modal="true"`, `aria-labelledby={labelledBy}`, `aria-describedby={describedBy}`, `'Escape'`, `'Tab'`, `shiftKey`, `previouslyFocused`, `overflow = 'hidden'`). Run `node test-fixes.cjs` + `npx vitest run src/test/modalShell.test.jsx src/test/modals.test.jsx` |
| R5 | **Deleted textures/CSS classes are still referenced** | `.flora-panel` etc. are used across many components; deleting the CSS first leaves elements unstyled and can change layout at 320 px | Delete references **first** (component edits), then the CSS, then the image files. After each: `grep -r canvas- src/` must be empty and `npm run build` must not warn about missing assets |

Secondary risks tracked but lower: the ATS gauge replacing a donut could break
`atsScorer.test`'s DOM assumptions (it does not assert presentation — verified by
reading the file); and self-hosted fonts shifting layout (mitigated with
`size-adjust` fallback metrics).

---

## 7. What I am deliberately leaving alone

- `src/components/templates/**` — the exported artifact. Restyling it would
  change the PDF the user sends to a recruiter.
- All of `src/utils/**`, `src/hooks/**`, `src/agents/**` — behaviour.
- `public/manifest.webmanifest` and the icons — PWA contract, and `#140715` is
  browser chrome, not page colour.
- `DEPLOY.md` being stale — real, but not this brief.
- The `pdf.worker.min-*.mjs` 1.2 MB chunk — a build-config concern
  (`vite.config.js` is forbidden), not a visual one.

---

## 8. Ready to proceed

Phase 0 is complete. Baseline is green and recorded; contracts are enumerated
with their enforcing line numbers; the token sheet is fixed; the risk register
names the verification for each. Phase 1 begins with `src/index.css` and the
font wiring.
