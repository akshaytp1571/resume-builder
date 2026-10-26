# Next features — an analysis

Written 2026-10-25, against `master` @ `cc2f4b2` (v3.0.0).

Two inputs: what this codebase actually contains, and what Reactive Resume v6
and Rezi ship today. Everything below is grounded in a file I read or a page I
fetched. Where I am extrapolating, I say so.

**Web search was unavailable during this analysis** (API key rejected), so the
competitor picture comes from fetching `rxresu.me`, the Reactive Resume README,
`rezi.ai` and Rezi's AI-agent page directly. I did not survey Teal, Kickresume,
Enhancv or Zety — treat their absence as a gap, not a judgement.

---

## 1. What we actually have

Not a wish list — an inventory, so we don't propose building what exists.

| Area | Reality |
|---|---|
| Templates | **9**, hand-built JSX. `templateCapabilities.js` declares per-template feature support. |
| ATS score | 7 weighted categories: Layout&Fit, Contact&Header (25), Summary (15), Skills&Keywords (15), Experience (25), Education (10), Projects (10). Layout is scaled dynamically from measured page height. |
| Keyword match | `keywordMatcher.js`, **576 lines** — local, offline, weighted, section-aware. No AI. |
| Cover letter | Own editor, own DOCX export, `suggestCoverLetter()` assembles a draft from your own data. No AI needed. |
| Applications | 6 statuses (applied → screening → interview → offer / rejected / withdrawn), response rate, notes. |
| Variants | Named résumés, duplicate/rename/delete, one pinned as default. |
| AI | Pluggable provider (Vyce, DeepSeek, OpenAI, Groq, Ollama). Refines summary and bullets. Key in `localStorage`, never inlined at build. |
| Export | DOCX (771-line `docxExporter`), raster PDF (html2pdf), **vector PDF** (window.print), JSON Resume, JSON backup. |
| Apply agent | **Real.** `form-filler.js` (349 lines) + Playwright scrapers for LinkedIn/Indeed/Naukri. Local only. |
| PWA | Service worker, 28 precached, manifest, installable. |
| Craft | Command palette, full keyboard shortcuts, undo/redo, autosave + visible save state, Google Drive backup (inert), crash recovery with data rescue. |

That is a **broad** product. The gap is not breadth.

---

## 2. Where competitors are ahead

### Reactive Resume v6 (open source, our closest peer)

| They have | We have | Gap severity |
|---|---|---|
| 18 templates, filterable by one-column / two-column / ATS-safe | 9, no filter | **Medium** — filtering matters more than count |
| Rich text in bullets (bold/italic), drag-drop section ordering | Plain text, fixed order | **High** — users ask for bold metrics |
| 200 undo steps | Present, depth unverified | Low |
| **Named + automatic versions, preview and restore** | Variants only (a different concept) | **High** |
| **Trash with 30-day recovery** | Delete is immediate | **High** — data-loss risk |
| **Public share link** | None | **Medium** |
| Markdown export | None | Low |
| Custom CSS with an on-page element picker | Palette + 3 fonts + density | Medium |
| **A4 *and* US Letter** | A4 only | **High** — US users can't use this |
| Left/right sidebar toggle | Fixed left | Low |
| Readability checks pinned to the offending line | Score only, no line anchoring | **High** |
| **"The text hiring software reads"** — plain-text ATS view | None | **High, and cheap** |
| Checks on the *exported PDF* | Checks the live DOM | Medium |
| Public ATS checker, no account | None | Medium — great funnel |
| Library with tags, sorting, grid/list | Flat variant dropdown | Medium |
| Standalone letters with version history | Letter per variant, no history | Medium |
| Applications: List / **Board / Insights / Calendar** | List only | Medium |
| Save a job from a URL; search via Firecrawl/Tavily/Exa | Scrapers need localhost | Medium |
| i18n (Crowdin), SSO, self-host docs | English only | Low for us |

### Rezi (commercial, 4.5M users)

| They have | We have |
|---|---|
| **Conversational agent** — "make my summary sharper" and it edits | Modal-based refine, one field at a time |
| AI Interview practice | None |
| Chrome extension (score any posting in-page) | None |
| **MCP server** — Claude/ChatGPT/Codex drive the résumé | None |
| Mobile apps | PWA only |
| Resignation letter generator | None |
| Enterprise | None |

---

## 3. Where we are uniquely ahead

Worth stating, because it should drive what we build next.

1. **No account, no server, no upload.** Reactive Resume needs a Postgres + S3
   deployment to self-host. We are a folder of static files. Rezi needs an
   account. Our live site ships with sample data and stores nothing remotely.
2. **The apply agent is real and nobody else has it.** Rezi and Reactive Resume
   both stop at "here's your résumé, go apply." We fill the form. It is the only
   feature here that saves hours rather than minutes, and it is currently
   locked behind `localhost:3457`.
3. **Vector PDF export.** Selectable text, ATS-parseable, no server round-trip.
   Most builders rasterise.
4. **The craft.** The drafting table is a real design position, not a theme.

**Strategic read:** do not chase Reactive Resume's 18 templates or Rezi's chat
agent. We lose both races. Win on *privacy + real automation + craft*, and close
only the gaps that make the product feel unfinished.

---

## 4. Tier 1 — close the credibility gaps

These are not features. They are reasons someone bounces.

### 1.1 US Letter paper — **do this first**

A4-only is a hard blocker for every US user. `@page { size: A4 }` is in
`index.css`; `.resume-paper` is `210mm × 297mm`; the templates assume it.

- Add `paperSize: 'a4' | 'letter'` to theme, a token pair for the two
  dimensions, and a `@page` rule per size (CSS can't be conditional, so the
  print rule needs `:root[data-paper="letter"] @page` — which needs the
  attribute on `<html>`, set in `App.jsx`).
- Templates measure in `mm` and `pt`, so they reflow. The 1-page auto-fit already
  measures real height, so it adapts.
- **Risk: medium.** Touches `index.css` and every template's assumption. The
  contract says templates are out of scope — this would be the first legitimate
  reason to touch them, and only their page dimensions, not their design.

### 1.2 Trash with recovery

Right now `handleDeleteVariant` is permanent. One misclick on a phone and a
résumé is gone. Reactive Resume gives 30 days.

- Soft-delete: add `deletedAt` to the variant, filter it out of the list, add a
  "Trash" section with Restore and Delete-forever.
- Purge on load if older than N days.
- **Cheap and high-value.** `resumeStore.js` already migrates and normalises.

### 1.3 Version history (distinct from variants)

Variants are *different résumés*. Users also want *yesterday's version of this
résumé*. Reactive Resume has named + automatic versions with preview/restore.

- Snapshot on every save, keep last N (say 20), let the user name one.
- Storage is the constraint: a résumé is ~8 KB of JSON, so 20 snapshots is
  160 KB per variant — fine for `localStorage` at ~5 MB, but cap total bytes and
  evict oldest.
- **This is the single most-requested feature in every builder.** Medium effort,
  high perceived value.

### 1.4 The plain-text ATS view — cheapest high-impact item here

Reactive Resume shows "the text hiring software reads." We have the whole
scorer and `#resume-preview`, so this is a `textContent` walk plus a modal.

- New modal: render the résumé as the plain text an ATS extracts — section
  headings, bullets, no columns, no styling.
- Show it *next to* the score, so the score has a visible cause.
- **Low effort, high credibility.** It also debugs our own templates: if the
  plain text looks wrong, the PDF is wrong.

### 1.5 Findings anchored to lines

Our ATS breakdown says "Experience & Action Impact 16/22". That tells you a
number, not what to fix. Reactive Resume pins each finding to the offending line.

- `atsScorer` already computes per-category deductions. Extend each to return
  `{ category, score, max, findings: [{ message, field, index }] }`.
- Clicking a finding scrolls the rail to that field and focuses it.
- **Medium effort, transforms the score from a verdict into a to-do list.**

---

## 5. Tier 2 — differentiate

### 2.1 Ship the apply agent properly

This is our only genuinely unique capability and it is currently unusable by
anyone who isn't running Node locally.

Options, cheapest first:

- **A. Package it as a local CLI.** `npx resume-studio-agent`. Keeps the
  "nothing leaves your machine" promise intact. Lowest risk, no hosting.
- **B. Make it a documented Docker image.** One `docker run`. Same promise,
  friendlier for non-Node users.
- **C. Host it.** Turns a local tool into a service that stores job-board
  credentials. That contradicts our entire positioning and the SECURITY.md
  threat model. **Don't.**

**Recommendation: A, then B.** It also makes the feature demoable, which it
currently is not.

### 2.2 Chrome extension — score any posting in place

Rezi's extension is their best funnel. For us it's a natural fit because the
keyword matcher is already client-side and offline.

- Content script reads the job posting, opens our app with the description
  pre-filled, shows the match score in a popup.
- No new backend. Reuses `keywordMatcher.js` verbatim.
- **Medium effort, high leverage** — it is the only distribution channel
  available to a static app.

### 2.3 Board + calendar views for applications

We have a list. Reactive Resume has List / Board / Insights / Calendar. The data
already exists (`STATUSES`, `updatedAt`).

- Board: one column per status, drag to change.
- Calendar: applications by date.
- Insights: response rate is already computed; add time-to-response and a
  per-status funnel.
- **Low-medium effort**, pure UI over existing data. Good use of the new
  primitives.

### 2.4 Rich text in bullets

Bold is how people make a metric scannable ("cut runtime **6h → 45m**"). Plain
text forces all-or-nothing emphasis.

- This is the one place I'd consider a dependency (TipTap / Lexical) — and
  **resist it**. A minimal `contentEditable` with a toolbar of three commands
  (bold, italic, link) storing a small subset of Markdown is ~200 lines and
  keeps DOCX/PDF export simple, because both exporters already handle text runs.
- **High value, medium risk** — it touches the data model and both exporters.

### 2.5 Public share link

Static hosting makes this awkward: no server to mint a URL. Options:

- **Hash-encoded** (`#/r/<lz-compressed-json>`). No backend, works today, but
  URLs get long and the data is visible — which is fine for a résumé, and
  arguably honest.
- **GitHub Gist** via OAuth. Persistent, revocable, no server.
- **Skip it.** A résumé is an attachment; most users PDF it.

**Recommendation: hash-encoded, opt-in, with an explicit warning that the link
contains the résumé.** Cheapest version that doesn't lie about privacy.

---

## 6. Tier 3 — ambitious, only if the above lands

- **Conversational editing.** "Make bullet 2 of my last role sound more
  senior." We already have the AI provider, the diff modal, and per-field
  accept/reject. This is mostly intent-routing, not new capability.
- **AI interview practice.** Generates questions from the résumé + a posting.
  Natural adjacency, but a whole product.
- **MCP server.** Let Claude or ChatGPT read and edit the résumé. Rezi shipped
  this; for a local-first app it is a genuinely good fit — the résumé never
  leaves the machine, the model talks to a local process.
- **i18n.** Reactive Resume has Crowdin. Our strings are hardcoded and partly
  test-pinned, so this is expensive. Low priority.
- **More templates.** Diminishing returns. 9 good ones beats 18 mediocre.
  If anything, add a *filter* (ATS-safe / two-column / creative), not more files.

---

## 7. What not to build

- **Accounts and cloud sync.** Destroys the only thing we do better than
  everyone. Google Drive backup already covers the real need.
- **Hosting the apply agent.** See 2.1 — it would mean storing job-board
  credentials server-side.
- **A paywall.** Reactive Resume is free and MIT. We are too.
- **More templates before 1.1–1.5.** Polish the product people already have.

---

## 8. Recommended sequence

Ordered by (value × cheapness) ÷ risk, not by excitement.

| # | Item | Effort | Risk | Why now |
|---|---|---|---|---|
| 1 | **Plain-text ATS view** | S | Low | Cheapest credibility win; also validates our own exports |
| 2 | **Trash + recovery** | S | Low | Prevents data loss. Unforgivable to lack |
| 3 | **US Letter** | M | Med | Unlocks an entire market |
| 4 | **Anchored findings** | M | Low | Turns the score into a to-do list |
| 5 | **Version history** | M | Med | Most-requested feature in the category |
| 6 | **Board + calendar** | M | Low | Pure UI over existing data; exercises the new primitives |
| 7 | **Apply agent as `npx`** | M | Low | Makes our unique feature usable |
| 8 | **Chrome extension** | M | Med | Only distribution channel a static app has |
| 9 | **Rich text bullets** | L | High | Highest-value data-model change; do it last of these |
| 10 | **Share link (hash)** | S | Low | Cheap, honest, opt-in |

**If you only do three: 1, 2, 3.** Plain-text view, trash, US Letter. Together
they are maybe a week and they remove the three things most likely to make a
new user leave.

---

## 9. Honest caveats

- **I did not survey Teal, Kickresume, Enhancv, Zety or Novoresume.** My
  competitor picture is two products, chosen because one is our open-source peer
  and one is the commercial leader. A wider survey could change the ranking.
- **Effort estimates are judgement, not measurement.** I read the files; I did
  not prototype.
- **US Letter is the only item here that requires touching
  `src/components/templates/**`**, which every contract in
  `docs/redesign/CONTRACTS.md` currently forbids. It should be treated as a
  deliberate, reviewed exception — page dimensions only, never design.
- **Rich text bullets would touch the data model**, and therefore
  `jsonResume.js`, `docxExporter.js` and `pdfExporter.js`. It is the highest-risk
  item on the list and I would not start it before 1–6 ship.
