# QA Report — resume-builder

**Author:** pdf-dev (QA role, task-9)
**Date:** 2026-10-22
**Scope:** whole application, adversarial. Report only — nothing was fixed by me.
**Method:** every finding below was produced by a script in `qa-probes/` that imports the real modules (Vite SSR for JSX) or drives the real app in Chromium via Playwright. No finding is inferred from reading code alone.

**Caveat on timing:** `src/utils/resumeStore.js` was rewritten by the Lead mid-audit (264 → 428 lines) while I was probing. Findings are marked **[FIXED]** where I re-ran the probe afterwards and it now passes, and **[OPEN]** where it still reproduces against the current tree.

---

## P0 — data loss / corruption

### P0-1 — Corrupt store was silently overwritten with sample data **[FIXED]**
`src/utils/resumeStore.js` (was `loadStore`, now `:190-229` + `quarantineCorruptStore` `:275-285`)

**Reproduction (ran):** seed `precision_resume_store_v2` with a truncated JSON value, boot the app.
**Was:** the unreadable value was replaced by a fresh sample-data store. The user's bytes were gone with no trace.
**Now:** the raw value is copied to `precision_resume_store_v2__recovery_<ts>` before anything overwrites it. Verified in Chromium: recovery keys appear, original bytes preserved.
**Still open, lower severity:** `hasRecoveryCopy()` (`:288`) is exported but **has zero call sites** (verified by grepping all of `src/`). The recovery copy is invisible to the user, who sees sample data and has no idea their resume is recoverable. Suggest a one-time banner: "Your saved resume could not be read. A recovery copy was kept."

### P0-2 — `skills: [null]` and wrong-typed items crashed the ATS scorer and every template **[FIXED]**
`src/utils/atsScorer.js` + all 9 templates; trust boundary now `normalizeResume` (`resumeStore.js:87-167`)

**Reproduction (ran):** `qa-probes/probe-render.mjs` and `probe-chains.mjs`. Import a JSON resume whose `skills` is `[null]`, or whose `experience[].highlights` is a string, and the app crashed.
**Was:** 108 distinct template crashes and 14 ATS crashes were reachable through `importStoreJson` → `normalizeResume` → render. `normalizeResume` only checked `Array.isArray`, so `[null]`, `[{items: 5}]`, `highlights: "str"` and `email: 5` all passed straight through.
**Now:** `normalizeResume` coerces scalars via `asString`, bullets via `asStringList`, object lists via `asObjectList` (drops non-objects, repairs ids). Re-ran all probes: **0 crashes** through the import path, and the app boots in Chromium with every hostile seed.

### P0-3 — Duplicate variant ids crashed delete and could empty the store **[FIXED]**
`src/utils/resumeStore.js` `removeVariant` (`:349-360`)

**Reproduction (ran):** import `{"variants":[{"id":"same",...},{"id":"same",...}]}` then delete.
**Was:** `TypeError: Cannot read properties of undefined (reading 'id')` — `filter()` removed both copies, leaving an empty list, then `variants[0].id` threw. The store was left empty.
**Now:** deletes by index of the first match. Verified: no throw, list never empties.

### P0-4 — Quota-exceeded save was completely silent **[FIXED]**
`src/App.jsx:56-70`

**Reproduction (ran):** `qa-probes/tmp-quota4.mjs` — make `setItem` throw for the store key only, then type in the Identity name field.
**Was:** `saveStore()` returned `false`, App.jsx ignored it. Edits were lost on reload with no warning at all.
**Now:** toast fires once per failure: `COULD NOT SAVE — BROWSER STORAGE IS FULL. EXPORT A BACKUP NOW.` Verified in Chromium.

**Note on the earlier probe result:** my first quota probes reported the toast missing, but that was a probe artifact — filling localStorage until `setItem` throws does not leave the *store write* failing, because deleting the filler frees space. The deterministic `Storage.prototype.setItem` override above is the reliable reproduction and it passes.

### P0-5 — A 50k-character token threw "Regular expression too large" **[FIXED]**
`src/utils/keywordMatcher.js`

**Reproduction (ran):** `matchKeywords(resume, 'react ' + 'a'.repeat(50000))` → `Invalid regular expression: ... Regular expression too large`.
**Now:** `MAX_TERM_LENGTH` / `MAX_TOKEN_LENGTH` cap the regex body. Re-ran at 1k / 5k / 10k / 20k / 40k / 60k — all pass, no throw.

### P0-6 — Two-tab race silently loses an entire variant **[OPEN]** ⚠️ highest-value remaining bug
`src/App.jsx:55-72` (debounced autosave), `src/utils/resumeStore.js` (whole-store write)

**Reproduction (ran, real browser, two tabs, `qa-probes/probe-browser4.mjs`):**
1. Tab A loads the app.
2. Tab B loads the app, creates a variant → store on disk now has 2 variants.
3. Tab A (still holding the stale 1-variant store in React state) types one character.
4. After the 400 ms debounce, Tab A writes its stale copy over Tab B's.

**Actual:** disk holds 1 variant. The variant created in tab B is gone, permanently, with no warning.
**Expected:** either a merge, or a conflict warning, or a refusal to overwrite a store that changed underneath.
**Cause:** `saveStore()` does an unconditional whole-store `setItem`, and nothing in `src/` listens for the `storage` event (verified by grep — zero matches).
**Suggested fix (cheapest that works):** before writing, re-read the raw value and compare a monotonic `revision` counter (or `updatedAt` of the store). On mismatch, keep the newer and toast "This resume was changed in another tab." A `storage`-event listener that reloads the store when it is not the writer is the smaller version, but it loses in-flight edits in the current tab.

### P0-7 — A JSON resume with object-valued fields white-screens the whole app **[OPEN]** ⚠️
`src/components/ui/ResumeUploadModal.jsx:316` (`parsedPreview.personalInfo?.fullName`), `:334-338` (`parsedPreview.summary`)

**Reproduction (ran, real browser, `qa-probes/probe-browser4.mjs`):**
1. Open the Upload modal.
2. Upload `resume.json` = `{"personalInfo":{"fullName":{"first":"Jane","last":"Doe"},"title":"QA"},"summary":{"text":"hello"},"skills":[]}`.
3. Click **Parse Resume**.

**Actual:** `pageerror: Objects are not valid as a React child (found: object with keys {first, last})`. `#root` innerHTML length = **0**. The modal, the editor and the resume preview are all unmounted. The app is a blank page until reload; the uploaded file is re-parsed on the next attempt and it crashes again.
**Expected:** a readable error inside the modal ("That resume file has an unexpected shape").
**Cause:** the modal renders `parsedPreview` **raw**. `normalizeResume()` is applied only in `App.jsx:442`, i.e. after the user clicks *Load into Builder* — the preview path is unguarded. There is also **no error boundary anywhere in the app** (grep for `componentDidCatch` / `ErrorBoundary`: zero matches), so any render throw blanks everything.
**Suggested fix:** `parsedPreview = normalizeResume(directJsonData)` in `handleParse` before `setParsedPreview`, plus one `<ErrorBoundary>` around `<App />` in `main.jsx` as a backstop.

---

## P1 — crashes (not currently reachable)

`src/utils/atsScorer.js` is **not defensive on its own**. It throws on `null`, `undefined`, `skills: "x"`, `skills: [null]`, `[{items: 5}]`, `experience: [null]`, `highlights: "str"`, `highlights: [null]`, `education: [null]`, `customSections: [{items: "x"}]`, `email: 5`, `fullName: {}`, `summary: 5`.

This is now **[MITIGATED, not fixed]** — every caller passes data through `normalizeResume` first, and I confirmed all 8 hostile shapes now survive `normalizeResume` → `calculateAtsScore`. But the module has no guard of its own, so a future caller that forgets will reintroduce P0-2. Same for the templates: `ResumePreview` does `theme.templateId` unguarded, so `theme = null` throws for all 9 templates (verified with `probe-templates.mjs`). `normalizeTheme(null)` protects the current call path.

**Suggested fix:** one line at the top of `calculateAtsScore` — `resumeData = resumeData || {}` — plus optional chaining on `theme?.templateId`. Cheap insurance, not urgent.

---

## P2 — logic errors

### P2-1 — ATS action verbs match as substrings **[OPEN]** (Lead explicitly asked me to flag this)
`src/utils/atsScorer.js:112` and `:168` — `ACTION_VERBS.some(v => lower.includes(v))`

**Reproduction (ran, `qa-probes/probe-chains.mjs` §3):** three bullets containing **no** action verb:
- "Responsible for the **enabled** feature set and **scheduled** jobs" → matches `led`
- "Controlled the **balanced** ledger and **handled** cancelled tickets" → matches `led`, `handled`, `cancelled`
- "Managed upkeep of the **saddled** equipment and **bundled** cables" → matches `managed`, `saddled`, `bundled`

**Actual:** Experience category scores **18/25** (10 base + 8 for "≥3 action verbs") on verb-less bullets.
**Expected:** word-boundary matching, so only the literal verb counts.
**Suggested fix:** replace `.includes(v)` with a `\b<verb>\b` regex, or tokenise the bullet and use `Set.has` on the first token. Two-line change, and it makes the score honest — which matters because the app tells users their ATS score.

### P2-2 — A 10-word summary scores 0/15, but 11 words scores 9/15 **[OPEN]**
`src/utils/atsScorer.js:43-53`

**Reproduction (ran, `probe-chains.mjs` §4):** measured `0w=0, 1w=0, 10w=0, 11w=9, 29w=9, 30w=15, 120w=15, 121w=10, 200w=10`.
**Actual:** exactly 10 words falls through every branch — not `>10`, not `>=30`, not `>120` — so it scores 0 while a *shorter* 11-word summary scores 9. A user who trims to 10 words loses 9 points.
**Suggested fix:** `wordCount >= 10` instead of `> 10` in the middle branch.

### P2-3 — ATS is not monotonic above 120 words
Same block: 120 words = 15/15, 121 words = 10/15, 200 words = 10/15. Deliberate (the code warns "keep it punchy"), but worth knowing the score *drops* for adding content. Not a bug, documented as behaviour.

### P2-4 — ATS ceiling is reachable, but only with a specific shape **[VERIFIED OK, corrected]**
My first probe reported "max reachable is 82". That was a bad fixture — I gave it one experience bullet, and the category needs ≥3 action-verb bullets and ≥2 numeric bullets. With a properly-filled resume the score is **100/100** and the breakdown maxes sum to 100. `Math.min(100, ...)` at `:191` holds; no negative or NaN path found across 21 hostile inputs (the ones that don't throw).

### P2-5 — Export filenames degrade badly for non-Latin names **[OPEN, cosmetic]**
`src/utils/docxExporter.js:702-705`, `src/utils/pdfExporter.js:21-25`

**Reproduction (ran, `qa-probes/probe-export.mjs`):**
| Name | DOCX filename |
|---|---|
| `日本語` | `_Resume.docx` (leading underscore) |
| `🚀🎯` | `_Resume.docx` |
| `أحمد` | `_Resume.docx` |
| `Ñoño Muñoz` | `oo_Muoz_Resume.docx` |
| `   ` (spaces) | `__Resume.docx` |

**Expected:** a fallback such as `Resume.docx` when the sanitised stem is empty. **Actual:** an empty stem produces a filename starting with `_`.
**Not a security issue:** path separators, `..`, null bytes and Windows reserved names (`CON`) are all stripped correctly — verified. No traversal is possible.
**Suggested fix:** `const stem = cleanName || 'Resume';`

### P2-6 — `isUsableResumePath` accepts `..` traversal **[OPEN, low]**
`src/utils/resumePath.js:36-41`

**Reproduction (ran):** `isUsableResumePath('C:\\a\\..\\..\\b.docx')` → `true`. The value is passed to the Node apply agent as the file to upload. A user can only hurt themselves (it is their own machine and their own path), so this is low severity — but if that path ever crosses a trust boundary, normalise it first.

---

## P3 — accessibility

**Verified good** (real Chromium, `probe-browser2.mjs`): every modal is wrapped in `ModalShell`; `role="dialog"` + `aria-modal` + `aria-labelledby` resolve to real heading text ("Resume Document Ingestion"); focus moves inside on open; the focus trap holds after 30 Tabs; Escape closes; focus returns to the exact trigger (`aria-label="Upload resume file"`) on close; the navbar's 12 icon buttons all carry `aria-label`s. This is better than most production apps.

**Not verified:** colour contrast (the pink-on-dark palette has many `text-pink-300/70` and `text-pink-300/60` combinations that are plausibly below 4.5:1), and screen-reader announcements for the toast (it does have `role="status" aria-live="polite"` — good).

---

## What `test-fixes.cjs` and `smoke-test.mjs` miss

Both suites pass while every P0 above was live. Concretely:
- `smoke-test.mjs` only exercises `INITIAL_RESUME_DATA` and hand-built valid stores. It never feeds a **hostile** value through `normalizeResume`, `calculateAtsScore` or `importStoreJson`.
- It never mounts a component, so no template or modal render is tested.
- It never tests `saveStore` failure, `localStorage` throwing, or the two-tab path.
- `test-fixes.cjs` is largely source-text grepping, so it cannot catch behavioural bugs at all.
- The Lead has since added `test-integrity.mjs` covering P0-1…P0-5 as permanent regressions. **P0-6 (two-tab), P0-7 (upload preview) and P2-1/P2-2 are not covered** — they need a real browser or a component render, which the Node harness cannot do.

---

## Verified good — things I tried hard to break and could not

- **Store round-trip and normalisation.** `loadStore` survives: truncated JSON, non-JSON, `null`, `"a string"`, `42`, `{}`, `variants: []`, `data: null`, `theme: null`, `variants: [null, 7]`, a throwing `localStorage`, and a missing `activeId`. Always returns a usable store, never throws.
- **Legacy v1 → v2 migration.** Corrupt legacy keys, non-object legacy values, and `null` are all handled; legacy data is recovered even when the v2 store is corrupt. Migration writes back only after the legacy values are consumed.
- **`importStoreJson` hostile input.** `null`, `[1,2,3]`, `42`, `{}`, `variants: []` all throw a readable message. A `__proto__` payload does **not** pollute `Object.prototype` (verified).
- **Unicode / emoji / 5k-char / HTML variant names.** Round-trip through the store intact. All rendering is React-escaped — `<script>`, `<img onerror=>` and `<svg onload=>` never survive as markup in any of the 9 templates (asserted in `probe-render.mjs`).
- **Keyword matcher.** Never throws on: empty/null/undefined JD, whitespace, punctuation-only, numbers-only, emoji-only, CJK-only, HTML, single letters, regex metacharacters (`c++ c# .net (api) [test] a*b+c? $100 |pipe| \backslash`), null bytes, a 10k-word JD (40 ms), 10k repeated words, and a 60k-char single token. `matchScore` is a 0-100 integer over 200 runs, `coverage` never NaN, empty JD returns a zeroed result with a readable `error` instead of throwing. Word-boundary matching is correct: `java` does not match `javascript`, `react` does not match `reactor`. Deterministic across runs.
- **Variant ops.** `removeVariant` protects the last variant (returns the identical object); `updateVariant` / `setActiveVariant` on a missing id are safe no-ops; `duplicateVariant` on a missing id returns the store unchanged.
- **PDF import.** A non-PDF file renamed to `.pdf` produces a readable in-modal error and **zero page errors** — no crash. The file input advertises `.pdf,.docx,.json,.txt,.md`.
- **The 9 templates with realistic data.** All render, all honour every theme variant (empty theme, missing colours, invalid colours, `fontFamily: undefined`, unknown `templateId` → falls back to Default). 60-char names, 5000-char summaries, 200 skills, RTL+emoji and HTML injection all render safely **once the data has passed through `normalizeResume`**.

---

## Reproduction

```
node qa-probes/probe-store.mjs      # store failure modes
node qa-probes/probe-loss.mjs       # autosave / corruption chains
node qa-probes/probe-ats.mjs        # ATS bounds + keyword matcher
node qa-probes/probe-chains.mjs     # reachable crash chains, P2-1 / P2-2
node qa-probes/probe-export.mjs     # filename sanitisation
node qa-probes/probe-edge.mjs       # storage disabled, regex ceiling
node qa-probes/probe-render.mjs     # 9 templates x hostile data (Vite SSR)
node qa-probes/probe-browser4.mjs   # real Chromium: two-tab, quota, upload crash
```
Browser probes need `npx vite --port 5199`. Raw outputs are in `qa-probes/out-*.txt`.
