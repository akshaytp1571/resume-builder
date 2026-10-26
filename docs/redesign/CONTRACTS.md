# CONTRACTS

What must not break, where it is enforced, and how to prove you did not break it.

This file exists because the redesign is a pure restyle of a working product.
Every visual decision in `DECISIONS.md` was free to change. Everything in this
file was not. If you are about to edit one of these files, read the relevant
row first.

**The suite is the specification.** 893 tests across 21 files. There was no
pre-existing failure set when this work started, so the bar is absolute: 893
must still pass. No test was edited during the redesign, and none should be.

---

## 0. The four commands

```bash
npm ci        # clean install from the lockfile
npm run lint  # oxlint — must report 0 errors (warnings are pre-existing)
npm test      # test-fixes.cjs && smoke-test.mjs && test-integrity.mjs && vitest run
npm run build # vite build — must emit dist/ and dist/sw.js
node scripts/verify-motion.mjs   # 24 browser invariants (needs dist/)
```

`npm test` is not just vitest. It runs three gate scripts first, and they read
source files as *text*. A refactor that moves a token out of a file passes
vitest and fails `test-fixes.cjs`.

---

## 1. Source-grep contracts

These read the file text with a regex. They cannot see intent, so a purely
cosmetic restructure can break them.

| # | Contract | Enforced in |
|---|---|---|
| 1 | Each of `AtsScoreModal`, `AiConfigModal`, `AiRefineModal`, `JobMatchModal`, `JobCredentialsModal`, `ApplyModal`, `ResumeUploadModal`, `ImageCropModal` must contain the string `ModalShell` | `test-fixes.cjs` |
| 2 | None of those files may contain `className="fixed inset-0` | `test-fixes.cjs` |
| 3 | `ModalShell.jsx` must contain, literally: `role="dialog"`, `aria-modal="true"`, `aria-labelledby={labelledBy}`, `aria-describedby={describedBy}`, `'Escape'`, `'Tab'`, `shiftKey`, `previouslyFocused`, `overflow = 'hidden'` | `test-fixes.cjs` |
| 4 | Every file in `src/components/templates/` contains `projects` and `customSections` | `test-fixes.cjs` |
| 5 | `CreativeTemplate.jsx` contains `certifications`; `DefaultTemplate.jsx` contains `PhotoFrame` | `test-fixes.cjs` |
| 6 | `ProjectsEditor.jsx` destructures `projects`, calls `onChange(`, and guards a missing array. `CustomSectionsEditor.jsx` the same for `customSections` | `test-fixes.cjs` |
| 7 | `scripts/make-icons.mjs` contains `192`, `512`, `public` | `src/test/pwa.test.js` |
| 8 | `index.html` contains `name="theme-color"` and `#140715` | `src/test/pwa.test.js` |

**Why `#140715` survives.** It is browser-chrome metadata — the value the OS
reads for the status bar and task switcher — not the page colour. The rendered
shell is `--void #0C0D0B`. On a phone the status bar is therefore one shade off
the app. That is a deliberate trade: the alternative is editing a test to
restyle an OS surface. Do not "fix" the mismatch by changing the page
background to match.

---

## 2. DOM and CSS contracts

Asserted by rendering the component and querying the result.

| # | Contract | Enforced in |
|---|---|---|
| 9 | `<header>` exists and contains a `.max-w-7xl` whose className matches `/flex-wrap/` | `a11yNav.test.jsx` |
| 10 | `header .max-w-7xl` must have **at least three children**, and `children[1]` must itself match `/flex-wrap/` | `a11yNav.test.jsx` |
| 11 | Spans with exact text `EXPORT_PDF`, `PRINT`, `UPLOAD`, `RESET` exist once each, each carrying `/hidden (sm\|md\|lg\|xl):inline/` | `a11yNav.test.jsx` |
| 12 | Exactly one span reads `EXPORT_PDF` | `a11yNav.test.jsx` |
| 13 | The `ATS:` span and a `/1_PAGE:/` span both carry `/hidden sm:inline/` | `a11yNav.test.jsx` |
| 14 | Every `<button>` has an accessible name | `a11yNav.test.jsx`, `modals.test.jsx` |
| 15 | `a.skip-link` is the first focusable node, `href="#main-content"` | `a11yNav.test.jsx` |
| 16 | `#main-content` keeps `tabIndex={-1}` and receives focus after the skip link | `a11yNav.test.jsx` |
| 17 | `.skip-link` appears inside the `@media print` block | `a11yNav.test.jsx` |

**On #10 and #11.** These are invisible. The header must keep this shape:

```
<header>
  └─ .max-w-7xl  (flex-wrap)
       ├─ [0] brand
       ├─ [1] centre capsule  ← must itself be flex-wrap
       └─ [2] action cluster
```

The centre capsule wraps because at 320px its controls cannot shrink further
without losing meaning; without wrapping the header pushes ~48px past the
viewport. And the label spans must be **exactly** these strings with the
responsive utility **adjacent and in this order**. Both of these bit during the
redesign: `hidden text-bone-52 sm:inline` fails, because the regex wants
`hidden sm:inline` contiguous.

---

## 3. Accessible names

These are the real API surface. Queried with `getByRole(..., { name })`, so the
strings are immutable. If a label looks wrong typographically, fix the *type*,
not the string.

```
export resume as PDF · export resume as vector PDF with selectable text
download resume as DOCX · open the print dialog · upload resume file
reset resume to original document data · undo last edit · redo last undone edit
open ATS score breakdown, current score N percent · single-page auto-fit
open job matcher · open application tracker(, N applications recorded)
show keyboard shortcuts · mute/unmute interface sounds
connect google drive · back up to google drive · generate draft
close ATS score dialog · close keyboard shortcuts · close AI settings dialog
close AI refinement dialog · close job matcher dialog · close job board logins dialog
close apply agent dialog · close resume upload dialog · close photo framing dialog
close google drive dialog
delete the application to <company> · confirm deleting the application to <company>
prepare application · submit application · download my data · reload
```

Role-and-name pairs also asserted:

- `role="tablist"` named `/document/i` with tabs named exactly `CV` and `Letter`
  — **the button's only text child may be the label.** A decorative serif
  separator inside the button changes the accessible name to `CV ·` and fails
  three tests. This happened.
- `role="tablist"` named `/cv sections/i` (vertical, after the redesign).
- `role="dialog"` + `aria-modal="true"`; `aria-labelledby` resolves to real text.
- Toast: `role="status"` + `aria-live="polite"`.
- Command palette: contains the visible text `Command palette`; empty state is
  `role="status"` matching `/no commands match/i`.
- Shortcut drawer: `dl > dt` plus `kbd[aria-keyshortcuts]`, **one pair per**
  `SHORTCUTS` entry, and each `aria-keyshortcuts` equals what
  `ariaKeyshortcuts(id)` returns.

---

## 4. Print and export

The print output is the product. Everything else is the workshop.

| # | Contract |
|---|---|
| 18 | `#resume-preview`, `#resume-print-wrapper` and `.resume-paper` (210mm × 297mm) keep their roles |
| 19 | The `@media print` block stays functionally intact: `@page` A4 with `margin: 0mm`, the html/body reset, the hide list, the `*` colour-adjust, the `main` reset, the `#resume-print-wrapper` scale reset, the `.resume-paper` A4 override, the break rules |
| 20 | Every chrome element carries `no-print` |
| 21 | No persistent `transform`, `scale`, `filter` or `backdrop-filter` on `.resume-paper` or `#resume-print-wrapper` |
| 22 | `src/components/templates/**` is not restyled — those files are the exported artifact and the ATS scorer measures them |
| 23 | The sheet stays near-white on screen (`#FCFBF8`) and pure white in print |

**The hide list** covers `.no-print`, `.skip-link`, `header`, `nav`, `aside`,
`footer`, `button`, `[role='dialog']`, `[aria-modal='true']`, plus the
redesign's furniture: `.dt-crop`, `.dt-bench-furniture`, `.dt-sweep`.

A bare `<div>` for a new chrome element is **not** caught by the tag selectors.
If you add one, give it `no-print` or it will print onto the résumé.

**Nothing that contains the sheet may be `no-print`.** The bench's dot grid, its
padding and its scroll container must be flattened in print, not hidden —
hiding them hides the résumé.

---

## 5. Data, behaviour and PWA

| # | Contract |
|---|---|
| 24 | No change to localStorage keys, migrations, recovery keys, `normalizeResume`, the JSON Resume shape, `TEMPLATES_CONFIG` ids, or variant fields |
| 25 | No change to undo/redo, autosave, save-status logic, shortcut bindings, `aria-keyshortcuts` values, command ids or titles, sound calls, Drive, upload/parse, or the apply agent |
| 26 | The manifest keeps `Precision Resume Studio`, `Resume Studio`, `/`, `standalone`, and `#140715` twice |
| 27 | `index.html` keeps the manifest link, the `#140715` theme-color, and `apple-touch-icon` → `/icons/icon-192.png` |
| 28 | Icons stay PNG 192/512 with a maskable entry, exact declared sizes, under 64 KB each |

The storage keys are namespaced `precision_resume_*` and `nexus_*`. **The `nexus_`
prefix is a data contract, not a design decision** — renaming it would orphan
every existing user's saved résumé. It appears in `aiService.js`,
`jobCredentials.js`, `resumePath.js` and `soundEffects.js`, all of which are
out of scope.

---

## 6. Scope fence

Forbidden during the redesign, and still forbidden for a follow-up restyle:

```
src/test/**  test-fixes.cjs  test-integrity.mjs  smoke-test.mjs
vitest.config.js  vite.config.js  public/manifest.webmanifest
src/components/templates/**  src/utils/**  src/hooks/**  src/agents/**  scripts/**
```

No new npm dependencies. Verify with:

```bash
git diff --name-only origin/main...HEAD | grep -E '^(src/test/|src/utils/|src/hooks/|src/agents/|src/components/templates/|scripts/|test-|vitest.config|vite.config|public/manifest)' 
# must print nothing
```

---

## 7. How to verify a change

```bash
npx vitest run src/test/a11yNav.test.jsx     # after ANY Navbar edit
node test-fixes.cjs                          # after ANY modal edit
npx vitest run src/test/cvLetterSections.test.jsx   # after ANY EditorSidebar edit
npm test                                     # before every commit
node scripts/verify-motion.mjs               # after ANY css/motion/print edit
```

`verify-motion.mjs` is the only thing that checks the properties a unit test
cannot see:

- no `backdrop-filter` anywhere on the page
- no `filter` on the sheet or the print wrapper
- the bench has exactly one background image (the dot grid)
- the gauge has `role="meter"`, 40 ticks, and its fill matches its value
- the export sweep renders, is signal-coloured, animates, and **does not contain
  the sheet**
- under `prefers-reduced-motion`, every transition collapses to ≤1ms, the sheet
  entrance is disabled outright, and the gauge shows its final value with no
  counting
- in print, the header / rail / crop marks / furniture are hidden, the sheet and
  page are white, the zoom transform is gone, and no chrome text leaks

---

## 8. The three signature moments

Each is load-bearing to the design, and each has a specific failure mode.

**The plate.** Crop marks 12px out from the sheet corners, `Plate 01 · A4
210×297` bottom-left, `Fit {zoom}%` bottom-right. All `no-print` and
`aria-hidden`. Fails if the readout hardcodes a zoom value instead of reading
state — a readout that lies is worse than none.

**The gauge.** 40 hairline ticks, every fifth tall, numeral counting up linearly
over 320ms, ticks revealing on a 40ms stagger, `role="meter"` carrying
`aria-valuenow` so a screen reader is not read the animation. Fails if the fill
is computed from the animated value instead of the final one, or if the numeral
is not `aria-hidden`.

**The sweep.** One 1px lime hairline crossing the bench, 320ms, on export. Gated
on `sweepCount`, **not** `isExporting` — the vector export resolves in one tick,
so a busy-flag gate meant React never painted a frame with the line present and
the animation was never seen. Fails if the sheet is ever placed inside the
animated node, or if a persistent transform is used instead of an animation.
