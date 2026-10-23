# Security Policy

Precision Resume Studio stores personal documents — resumes, photographs, and
optionally job-board logins — in your browser. This document says exactly what
that means, what the app protects and what it does not.

**Short version: your data is stored in `localStorage` in plaintext. It is not
encrypted. Anyone with access to your browser profile can read it. Back it up
by exporting it.**

If you find a problem with any of that, please report it privately — see
[Reporting a vulnerability](#reporting-a-vulnerability).

---

## Supported versions

| Version | Supported |
|---|---|
| 2.x | ✅ Yes |
| 1.x | ❌ No — please upgrade |

Security fixes land on the latest 2.x tag only. There is no long-term support
branch.

---

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** A public issue is
indexed within minutes and tells everyone about the flaw before there is a fix.

Use GitHub's private reporting instead:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability** (private security advisory).
3. Describe the issue, the impact, and the steps to reproduce.

That channel is private between you and the maintainer until an advisory is
published.

> **Maintainer note — fill this in before relying on it.**
> GitHub private advisories must be enabled on the repository for the flow
> above to work. There is deliberately **no email address** in this file: a
> fabricated or dead contact is worse than none. If you want an email fallback,
> add it here and enable "Private vulnerability reporting" in
> *Settings → Code security*.

Please include, where you can:

- The version or commit you tested
- Browser and OS
- What an attacker gains, and what they need to start
- Whether the issue also affects a plain `npm run build` deploy

### What to expect

This is a single-maintainer project. Realistic expectations:

- **Acknowledgement** within about 7 days.
- **An assessment** (confirmed / not-a-bug / needs-more-info) after triage.
- **A fix** for confirmed high-impact issues as soon as practical, with credit
  in the advisory unless you ask otherwise.

Please give a reasonable window to ship a fix before public disclosure. If a
fix is not forthcoming and the issue is serious, disclose — that is a fair
outcome and this policy will not pretend otherwise.

---

## Threat model

### What this app is

A **local-first, single-user, client-side** application. There is no account, no
server of ours, and no database. The static files are the whole application.

```
   your browser                         anything else
┌──────────────────────────┐
│  localStorage            │
│   • resume variants      │──── only if you explicitly configure it ────▶
│   • photos (base64)      │                                            AI provider
│   • cover letters        │                                            (you chose)
│   • job-board logins     │
│   • AI API key           │──── only when you run the agent ────▶ localhost:3457
└──────────────────────────┘
```

### What it does protect against

- **A compromised or unavailable server.** There is no server holding your
  resume. A static host breach exposes the app's code, never your data.
- **Network interception in transit for your resume.** The core builder makes
  no network requests at all. Your resume is not uploaded anywhere unless you
  press an AI button or use the job agent.
- **A malicious resume file you import.** `normalizeResume()` and the template
  `safeResume()` guard are a trust boundary: imported JSON, DOCX text and
  hand-edited `localStorage` are coerced to well-shaped values before rendering.
  HTML in a field is rendered as text, not executed.
- **Silent data loss on a corrupt store.** An unreadable store is quarantined
  under a recovery key and the app surfaces a banner rather than overwriting it.

### What it does **not** protect against

Be clear-eyed about these. They are design consequences, not bugs.

| Risk | Reality |
|---|---|
| **XSS on this origin** | Any script running on the page origin can read every key in `localStorage`. That includes your resume, your photo, your job-board passwords and your AI key. |
| **Someone with your device or browser profile** | `localStorage` is not encrypted and not behind an OS keychain. A shared computer, a synced browser profile, or a stolen unlocked laptop exposes everything. |
| **Malicious browser extension** | An extension with page access can read the same data. The app cannot defend against this. |
| **Disk forensics** | The values persist in the browser's on-disk store. Deleting a variant does not securely erase it from disk. |
| **Backups and sync** | If your browser profile syncs or is backed up, that copy carries the data too. |
| **Physical loss of the device** | Without an exported backup, the data is gone. There is no cloud copy to restore from. |

**The mitigation is export.** The app can export every variant as JSON
(`VariantSwitcher → Export all`) and export the resume itself as PDF or DOCX.
Export before you clear site data, and treat that export file as sensitive — it
is plaintext too.

### Deleting your data

Clearing site data for the origin removes the store. Because there is no
server, there is no other copy to delete. Individual secrets can be cleared in
the app: job credentials via **Job Match → Logins → Clear**, and the AI key via
**AI Settings**.

---

## What is stored, and where

All keys are `localStorage`, all plaintext.

| Key | Contents | Sensitivity |
|---|---|---|
| `precision_resume_store_v2` | All resume variants: name, contact details, photo (base64), work history, cover letters | **High** — a full personal profile |
| `precision_resume_store_v2__recovery_*` | A quarantined copy of a store that failed to parse, kept verbatim for rescue | **High** — same data, unvalidated |
| `precision_applications_v1` | Application history: employer, role, date, outcome | Medium |
| `nexus_ai_config_v1` | AI provider, base URL, model, **API key** | **High** — a billable secret |
| `nexus_job_credentials_v1` | LinkedIn / Naukri / Indeed **username and password** | **Critical** |
| `nexus_resume_path_v1` | Absolute local path to your exported DOCX, for the apply agent | Low, but reveals your filesystem layout |
| `nexus_ui_sound_enabled` | A UI preference | None |
| `precision_resume_banner_dismissed` | A UI flag | None |

The recovery keys are the one place data is deliberately duplicated. They exist
so a user whose store was corrupted can still get their resume back, and they
are the reason `SECURITY.md` cannot claim "only one copy is stored".

---

## AI integration

**It is off unless you configure it.** With no key set, the AI buttons do
nothing beyond prompting you to configure a provider.

When you do use it, these leave your browser and go to **the endpoint you
chose**:

- The text you are refining (a summary, a bullet, a skills list)
- For job matching: your resume's searchable text and the pasted job description
- For cover letters: resume facts and the job details
- Your API key, in an `Authorization` header

Nothing else is sent. There is no telemetry, no analytics, and no call home.
What that third party does with the text is governed by *their* policy, not
this project's — the app cannot make any promise about it. If you use a hosted
provider, you are choosing to send your resume content to them.

**Prefer a local model for maximum privacy.** Ollama is a built-in preset and
keeps everything on your machine.

### ⚠️ `VITE_AI_API_KEY` must never be used for a public deploy

`src/utils/aiService.js` reads `import.meta.env.VITE_AI_API_KEY` as a default.
Any `VITE_`-prefixed variable is **inlined into the JavaScript bundle at build
time**. It is not a secret at runtime — it is published source. Anyone who
loads the site can read it, and the key will be scraped and abused.

**The build now refuses to run if this variable is set.** `vite.config.js`
contains a `forbidInlineAiKey` plugin that throws during `buildStart`:

```
Error: VITE_AI_API_KEY is set and would be inlined into the public bundle.
```

This was verified by building with a canary value and grepping `dist/`. If you
genuinely need a private build with a baked-in key, pass
`ALLOW_INLINE_AI_KEY=1` — and do not deploy that artifact.

For anything public, leave it unset and let users enter their own key in
**AI Settings**, which stores it in *their* browser.

### The job agent listens on loopback only

`src/agents/api-server.cjs` binds `127.0.0.1`, not `::`. This matters because
**no route on that server is authenticated**. Binding to all interfaces would
expose `/api/discover-jobs` and `/api/apply` to every device on the network.

The risk is not credential theft — credentials flow *to* the agent and nothing
serves them back. It is a confused-deputy: a LAN client could drive your browser
automation and make your machine POST your resume to an arbitrary URL.

Verified by starting the server and inspecting the listening socket
(`127.0.0.1:3457`). CORS is likewise an allowlist of the app's own dev and
preview origins rather than a bare `cors()`.

If you deliberately need LAN access, set `HOST=0.0.0.0` — and understand that
you are removing the only access control the agent has.

---

## Job-board credentials

The **Job Match → Logins** feature stores LinkedIn, Naukri and Indeed usernames
and passwords so discovery runs do not require retyping them.

- Stored in `localStorage`, **plaintext**, under `nexus_job_credentials_v1`.
- Sent **only** to the local agent at `http://localhost:3457`, which runs on
  your own machine. They are never sent to this project's origin or to any
  third party by the app.
- The agent drives a real Chrome profile (`.scraper-profile/`, gitignored) that
  holds live session cookies.

**Appropriate only on a personal machine.** On a shared or managed device, do
not save credentials — enter them per run, or skip the discovery feature. If
the device is compromised, the passwords in that key are compromised; change
them at the provider.

The service worker explicitly never caches `:3457` or any cross-origin request,
so these values are not written into a second storage layer.

---

## Deploying safely

If you deploy this app yourself:

- **Never** set `VITE_AI_API_KEY` in the deploy environment.
- Serve over **HTTPS**. The service worker requires a secure context, and
  without one the app cannot install.
- The service worker caches the app shell and hashed assets only. It does not
  cache API responses and does not cache cross-origin requests.
- Do not add third-party scripts to `index.html` — anything you add runs with
  full access to the `localStorage` keys listed above.
- Consider a restrictive `Content-Security-Policy`. The app loads fonts from
  `fonts.googleapis.com` and `fonts.gstatic.com`; AI calls go to the endpoint
  the user configures.

---

## Scope

**In scope** — report these:

- Anything that lets one origin, page, or site read another user's data
- A path where resume content, a photo, a credential or an API key is sent
  somewhere other than the endpoint the user chose
- XSS reachable from imported resume data, a filename, a job posting, or an AI
  response
- `normalizeResume()` / `safeResume()` bypasses that reach a render crash or
  inject markup
- The service worker serving stale or cross-origin content
- The agent's form filler answering a protected-characteristic question,
  submitting without confirmation, or leaking credentials outside `:3457`

**Out of scope** — these are documented design limits, not vulnerabilities:

- Reading `localStorage` with physical or profile access to the browser
- An XSS in *your own* injected code or a browser extension
- The absence of encryption at rest
- Data loss from clearing site data without an export
- Anything requiring the user to paste their own API key into a phishing site
- Job-board rate limiting or bot detection affecting the optional agent

---

## Acknowledgements

Thanks to everyone who reports responsibly. Confirmed reports are credited in
the advisory unless you prefer to stay anonymous.
