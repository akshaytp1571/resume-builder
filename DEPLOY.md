# Deploying to BotKeep

This project deploys to **BotKeep** ([botkeep.cloud](https://botkeep.cloud)) as a
**static website**. The job-discovery / apply agent is **not** deployed — it
needs a locally installed Google Chrome and holds your job-board credentials,
so it runs on your own machine. See
[Running the job agent locally](#running-the-job-agent-locally).

---

## What gets deployed

| Component | Where it runs | Why |
|---|---|---|
| Resume builder UI (React) | **BotKeep** — static `dist/` | 3.14 MB of files, no runtime needed |
| AI features (summary polish, ATS, cover letters) | **BotKeep** — in the browser | Calls the AI provider directly from the client |
| DOCX / PDF export | **BotKeep** — in the browser | `docx` + `html2pdf.js` run client-side |
| Job discovery + apply agent | **Your machine** | Needs real Chrome; holds job-board passwords |

**The app already handles the agent being offline.** `isApplyAgentOnline()`
returns `false` and the UI shows *"The apply agent service is not running.
Start it with: npm run jobs:api"*. No code change is needed for this split.

---

## Before you start

- A verified [BotKeep account](https://botkeep.cloud/login)
- Node.js 18+ locally
- The repo cloned, with `npm install` already run

### Check your plan

Free includes 1 GB RAM / 1 vCore / 1 GB storage. Founder Free (and your plan)
gives 2 GB RAM / 1.5 vCore / 2 GB storage. This deployment uses a tiny
fraction of that — roughly 40 MB of RAM and 3.14 MB of storage — so it fits
any tier with room to spare.

---

## Step 1 — Build

```bash
npm install          # if you have not already
npm run build:static
```

`build:static` runs the Vite production build and then
`scripts/build-static.mjs`, which:

- copies `404.html` into `dist/` (a real 404 page instead of a blank error)
- copies `_headers` (cache rules for hosts that honour them)
- writes `dist/DEPLOY.txt` — a SHA-256 manifest of every file, so you can prove
  an upload landed intact

Expected output:

```
dist/index.html                 1.28 kB
dist/assets/index-*.css        89.74 kB
dist/assets/react-vendor-*.js 238.32 kB
dist/assets/index-*.js        566.38 kB
dist/assets/doc-export-*.js  1654.09 kB

17 files, 3.14 MB total
manifest written to dist/DEPLOY.txt
```

The JS is split into three chunks so the first paint does not wait on the
DOCX/PDF exporters:

| Chunk | Size | Contents |
|---|---|---|
| `react-vendor` | 238 kB | React + ReactDOM |
| `index` | 566 kB | The app itself |
| `doc-export` | 1.65 MB | `docx`, `html2pdf.js`, `jspdf` — only loaded when you export |

### Sanity checks before uploading

```bash
npm test                 # 44 checks over the parsers, ATS scorer, exporters
npm run lint             # 0 errors
node --check src/agents/api-server.cjs
```

Both `npm test` and `npm run lint` must be clean. If either fails, do not
deploy — fix it first.

---

## Step 2 — Choose a deploy route

BotKeep accepts **GitHub** or **ZIP**. Pick one.

### Route A — GitHub (recommended)

You get traceable revisions and never re-upload 3 MB by hand.

1. Push the repo. Confirm `.gitignore` already excludes the right things:

   ```
   node_modules
   dist
   .scraper-profile     # ← a Chrome profile with job-board cookies
   .env
   .env.local
   *.log
   apply-*.png
   ```

   **Do not commit `.scraper-profile/`.** It contains LinkedIn/Naukri/Indeed
   session cookies and login data. It is already gitignored — verify with
   `git status --ignored` before your first push.

2. In the BotKeep panel, open the **GitHub** tab and connect your account.
   Install the BotKeep GitHub App for the repositories you choose. Private
   repos need an authorised installation; public repos can be selected by URL.

3. Select the repository, then pick the branch to deploy.

4. Set the project root to the directory containing `package.json` — for this
   repo that is the repository root.

5. Set the build settings:

   | Setting | Value |
   |---|---|
   | Build command | `npm run build:static` |
   | Publish / output directory | `dist` |

6. Review the detected runtime and start command before the first build.

7. To ship an update later: push to the branch, open the **GitHub** tab,
   preview the changed files, choose whether to restart, and apply. This
   restarts the server — it is **not** a zero-dowowntime swap.

### Route B — ZIP

Use this for a one-off upload or when you cannot connect GitHub.

1. Build first (Step 1), then package:

   ```bash
   npm run package:zip
   ```

   This writes `dist/resume-builder-static.zip` (~1.5 MB). The archive root
   **is** the site — `index.html` sits at the top level, not inside a `dist/`
   folder. BotKeep's docs are explicit that an extra outer folder breaks
   runtime detection.

2. In the creation wizard, choose **ZIP**, select the archive, and confirm
   the runtime detection.

3. Wait for the upload to finish, then check **Files** and **Console** in the
   panel. An API acknowledgement does not mean the app is live — confirm the
   files are actually there.

4. Every update is a **new revision**: rebuild, repackage, upload again. Keep
   the original project outside BotKeep, and never treat a hosting backup as
   your only copy of the source.

---

## Step 3 — Domain and HTTPS

1. Open the **Domains** tab.
2. A `*.botkeep.cloud` address is assigned automatically.
3. For a custom domain you must:
   - control the domain
   - add the DNS records BotKeep shows you
   - complete DNS verification
4. HTTPS is provisioned once the domain verifies. BotKeep may renew the
   certificate; certificate transparency will publish the domain name.

A BotKeep address is a service identifier, not a domain you own — it can be
restricted or withdrawn for legal, security, abuse or infrastructure reasons.

---

## Step 4 — Verify the deployment

After the deploy completes:

1. Open the assigned URL.
2. Confirm the resume renders with the default template.
3. Open **AI Settings** and enter your provider + API key. The navbar should
   switch from `UNCONFIGURED` to `ONLINE`.
4. Click **Polish with AI** on the Summary tab to confirm the AI call works.
5. Export a **DOCX** and a **PDF** to confirm both exporters work in the
   browser.
6. Open **JOB_MATCH**. It will report the apply agent is offline — that is
   expected, because the agent is on your machine.

If anything is missing, compare the live files against the manifest:

```bash
# after downloading the deployed files
sha256sum -c <(awk 'NF==3 && length($1)==64 {print $1"  "$3}' DEPLOY.txt)
```

---

## Configuration

### AI keys — do not bake them into the build

`src/utils/aiService.js` reads `import.meta.env?.VITE_AI_API_KEY`. Anything
prefixed `VITE_` is **inlined into the public JavaScript bundle at build
time**, so any visitor can read it with View Source.

For a public deployment, **leave it empty** and have each user enter their own
key through the **AI Settings** modal. The key is then stored in that user's
`localStorage` and never leaves their browser except to call the AI provider.

Only set `VITE_AI_API_KEY` if you are deploying to a private, access-controlled
URL and you accept that the key is publicly readable.

### No server-side environment variables are required

The deployed site is entirely static. There is no backend, no database, and no
secret to configure on BotKeep for the resume builder itself.

---

## Running the job agent locally

The agent stays on your machine. It needs the real Google Chrome (Naukri and
Indeed block Playwright's bundled Chromium) and it holds your job-board
passwords.

```bash
# terminal 1 — the agent service, http://localhost:3457
npm run jobs:api

# terminal 2 — the app
npm run dev
```

Then in the app:

1. Click **JOB_MATCH** in the navbar.
2. Click **Logins** to add job-board credentials and the absolute path to the
   resume DOCX you want uploaded.
3. Click **Auto-Discover**, set your filters, and search.

The browser app on BotKeep will detect the local agent automatically, because
both talk to `http://localhost:3457`. If you deploy the frontend to a public
URL, note that **the browser will call `localhost:3457` on the visitor's
machine, not yours** — so the agent UI only works when you run the app locally
against your own agent. The public URL is for building and exporting resumes;
the agent workflow stays on your machine.

### One code change if you ever move the agent to a server

`src/agents/api-server.cjs` binds to localhost only:

```js
app.listen(PORT, () => { ... });   // localhost only
```

BotKeep's docs require HTTP services to listen on `0.0.0.0` and
`SERVER_PORT`. If you host the agent somewhere you control, change it to:

```js
const PORT = process.env.SERVER_PORT || process.env.JOB_DISCOVERY_PORT || 3457;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Job Discovery API running on http://${HOST}:${PORT}`);
});
```

**This change is deliberately not made.** It is only needed if you deploy the
agent, which this guide does not cover — the agent requires a system Chrome
install and stores job-board credentials, which does not belong on shared
hosting.

---

## Files added for deployment

| File | Purpose |
|---|---|
| `scripts/build-static.mjs` | Post-build step: adds `404.html`, `_headers`, and the SHA-256 manifest |
| `scripts/make-deploy-zip.mjs` | Writes `dist/resume-builder-static.zip` with `index.html` at the root |
| `public/404.html` | Real 404 page matching the app's styling |
| `public/_headers` | Cache-Control rules (immutable hashed assets, never-cached `index.html`) |
| `vite.config.js` | `base: '/'` and chunk splitting (changed) |
| `package.json` | Added `build:static`, `package:zip`, `test` scripts |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Blank page, console shows `Failed to fetch dynamically imported module` | Stale `index.html` cached | Hard-refresh; confirm `_headers` was uploaded |
| Styles missing, layout unstyled | `assets/*.css` not uploaded | Re-run `npm run build:static` and re-upload all of `dist/` |
| Images broken | `public/` assets missing from `dist/` | Vite copies `public/` automatically — check you uploaded the full folder |
| BotKeep detects no runtime (ZIP route) | Archive has a wrapping folder | Re-run `npm run package:zip`; `index.html` must be at the archive root |
| AI features report `UNCONFIGURED` | No key set | AI Settings → enter provider, key, model |
| JOB_MATCH says the agent is offline | Expected | Run `npm run jobs:api` locally |
| A deploy "succeeded" but the site is unchanged | Redeploy reapplies config, it does not re-pull GitHub | Use the GitHub tab to pull the new revision |

---

## Backup

BotKeep offers panel backups within your plan, and the docs are clear that a
hosting backup is **not** an archival guarantee. Keep your own copy:

- Source lives in Git — push to GitHub/GitLab, not just BotKeep.
- Resume data lives in each visitor's `localStorage`. Users can export a JSON
  backup from the **Resume Ingestion** modal.
- Keep `dist/` out of Git (it is gitignored) — it is reproducible with
  `npm run build:static`.
