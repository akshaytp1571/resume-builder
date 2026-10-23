# Contributing

Thanks for taking the time. This is a small, opinionated project — the notes
below are what actually gets a pull request merged, not ceremony.

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Quick start

```bash
git clone https://github.com/akshaytp1571/resume-builder.git
cd resume-builder
npm install
npm run dev            # http://localhost:5173
```

**Node 22.12+ is required.** The README says 18+; that is out of date — Vitest
declares `^22.12.0 || ^24 || >=26`, and Vite needs `^20.19 || >=22.12`. Node 24
LTS is what the suites are run against.

The optional job agent needs a **real Google Chrome install** and runs
separately:

```bash
npm run jobs:api       # terminal 1 — agent on :3457
npm run dev            # terminal 2 — the app
```

---

## The gate

```bash
npm test               # all four suites, chained with &&
npm run lint           # must report 0 errors
```

**`npm test` is not optional and not advisory.** It chains four suites with
`&&`, so any failure stops the run and exits non-zero. A PR that does not pass
it will not be merged.

| Suite | Catches |
|---|---|
| `test-fixes.cjs` | Source-level conventions: registries, prompts, selectors |
| `smoke-test.mjs` | Real runtime behaviour of the pure modules |
| `test-integrity.mjs` | Data integrity: hostile input, corrupt store, quota, merge |
| `vitest` | **Render crashes** — mounts templates and dialogs for real |

The component suite exists for one reason: the other three either grep source
text or import plain modules, so none of them can catch a component that throws
while rendering. Every P0 the adversarial QA pass found was a render crash or a
data bug.

Run the suite you are touching while you work:

```bash
npm run test:unit      # vitest only
npm run test:watch     # vitest in watch mode
npm run test:coverage  # coverage summary
```

If you add behaviour, add a test that would fail without your change. Prove it:
break your own assertion, watch the suite go red, put it back. A test that
passes against the old code is not testing your change.

---

## Conventions

These are the ones that come up in review.

### Don't add a dependency for what a few lines can do

This project has a strong bias against new packages. Precedents in the tree:

- The ZIP writer is ~40 lines of hand-written central-directory records instead
  of an archiver dependency.
- The PNG icon generator writes chunks and deflates them with `node:zlib`
  instead of an image library.
- The service worker is emitted by a ~40-line inline Vite plugin instead of
  `vite-plugin-pwa` + workbox.
- The ATS keyword matcher is a pure module with zero imports rather than an API
  call.

If you genuinely need a package, say so explicitly in the PR and justify it —
what it does, why a few lines cannot, and what it costs. One dependency per PR
at most.

### `ponytail:` marks a deliberate simplification

When you knowingly choose the simple thing over the general thing, mark it:

```js
// ponytail: single slot, no stacking. Add a queue when a second concurrent
// toast becomes reachable.
const [toast, setToast] = useState(null);
```

The comment names **the ceiling** and **the upgrade path**. It is not an excuse
— it is a note to the next reader that the limitation is understood, not
missed. An unmarked simplification reads as a bug.

### Tests assert behaviour, not call counts

```js
// Prefer
expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');

// Over
expect(renderSpy).toHaveBeenCalledTimes(1);
```

A test that pins an implementation detail breaks on a harmless refactor and
passes on a real regression. Assert what the user or the caller observes.

### Comments explain why

The code says what it does. Comments in this repo explain the reason — usually
a bug that was hit, or a constraint that is not obvious from the code. If a
comment could be replaced by reading the next three lines, delete it.

### Everything untrusted goes through the boundary

Resume data from an import, a parsed DOCX, or hand-edited `localStorage` must
pass through `normalizeResume()` before it reaches a component. Templates read
through `safeResume()`. See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md#3-the-trust-boundary).

A component that can throw on bad input takes down the whole preview pane.

---

## Adding a template

See **[Adding a template](./README.md#adding-a-template)** in the README. It
lists the four places a new template must be registered — the component,
`TEMPLATES_CONFIG`, `TEMPLATE_CAPABILITIES` and the `ResumePreview` switch.

The capability registry is not optional: `npm test` fails if a configured
template has no declared capabilities, because a template that silently hides a
filled-in section is data loss from the user's point of view.

---

## Commit and PR expectations

**Commits**

- Imperative subject, under ~72 characters: `Fix ATS verb matching on substrings`
- Explain the *why* in the body when it is not obvious. A bug fix should say
  what the bug was.
- One logical change per commit. Do not mix a refactor with a fix.

**Pull requests**

- Describe what changed and **why**. Link the issue if there is one.
- Say how you verified it. "`npm test` passes" is the floor; "reproduced the
  crash first, then confirmed the test fails without the fix" is better.
- Note any behaviour change, especially to export output, storage keys or the
  store shape.
- Screenshots or a short clip for anything visual.
- Keep the diff focused. Unrelated cleanups in a bug-fix PR make it harder to
  review and will be asked for separately.

If your change touches the store shape, storage keys, or an exported file
format, say so loudly — those are the changes most likely to lose a user's
data.

---

## Reporting bugs and security issues

- **Bugs and features** — open an issue using the templates. Please **do not
  paste real resume data** (names, phone numbers, addresses, photos) into a
  public issue. Reproduce with the fictional sample data instead.
- **Security** — do **not** open a public issue. Follow
  [SECURITY.md](./SECURITY.md).

---

## Scope

The app, the templates, the exporters and the agent's correctness and safety
model are all in scope.

Please do not open issues asking for help evading bot detection on specific
sites, and do not contribute changes whose purpose is to defeat a site's
anti-automation measures. See the responsible-use section of the README.

---

## License

By contributing you agree your work is licensed under the project's
[MIT license](./LICENSE).
