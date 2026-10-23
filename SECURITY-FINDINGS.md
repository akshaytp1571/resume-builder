# Security & Privacy Findings — v2.5 audit

Scope: how this app stores, moves and exports sensitive data — resumes, photos,
job-board logins, the AI API key. Audit run against the v2.4 tree (`03e67dc`).

**Method.** Every claim below was verified against the running code, not inferred
from a comment. Where a claim was testable, it was tested: the bind address was
measured with a live `listen()`, the API key leak was confirmed by building with
a canary value and grepping the output bundle, and the crash-rescue path was
exercised with a real corrupt store. Anything I could not confirm is marked
**unverified** rather than asserted.

**Bottom line.** Two real defects were found and fixed (both P1). One significant
issue is reported but **not fixed**, because the file is outside this task's
scope. The rest of the audit found the app behaving as documented. There is no
P0. The local-first design holds up: I found no path where resume content, a
photo, a credential or the API key leaves the machine without the user taking an
explicit action.

---

## Findings

### P1-1 — The crash-rescue download silently loses the real resume

**Where:** `src/components/ui/ErrorBoundary.jsx`, `handleDownload`.

**What.** The "Download my data" button read exactly one key,
`precision_resume_store_v2`, and handed its raw value to the user. That is
correct when the store is intact. It is wrong in the one situation the button
exists for.

When `resumeStore.loadStore()` cannot parse the store, it copies the unreadable
value to `precision_resume_store_v2__recovery_<timestamp>` and leaves the main
key alone. The next `saveStore()` then writes a fresh, near-empty store over the
main key. From that point the user's real data exists **only** in the recovery
key, and the rescue button downloads the blank store. The user is told "Saved
your raw resume data", reloads, sees an empty resume, and concludes the data is
gone — while it is still sitting in their own browser under a key the UI never
mentions.

**Verified.** Reproduced end to end: seeded a corrupt store containing a real
email, ran `loadStore()` then `saveStore()`, and confirmed the email was absent
from the main key and present only in the recovery key. Before the fix the
downloaded blob contained the blank store.

**Fix.** `handleDownload` now collects the main key *and* every `__recovery_*`
copy, newest first. One recovery copy or more produces a bundle file
(`resume-data-rescue-<date>.bundle.json`) with the raw values; no recovery copy
produces the original single-file download, byte-identical to before. A lone
recovery copy with no main store is also rescued — it is the only surviving copy.
Raw strings are preserved verbatim, never re-parsed, because re-parsing would
throw on exactly the data being rescued.

**Why this is P1 and not P0.** It is data loss, not disclosure, and it requires a
corrupt store to trigger. But it defeats the mechanism's entire purpose, and the
user is actively misled about having recovered their data.

---

### P1-2 — `maskSecret()` redacted almost nothing

**Where:** `src/utils/jobCredentials.js`, `maskSecret`.

**What.** The helper revealed the first two **and** last two characters of any
secret longer than four characters:

```
"abcde"        -> "ab••••••de"     (4 of 5 characters revealed)
"hunter2"      -> "hu••••••r2"
```

For a short password that is close to publishing it, and the output *looks*
redacted, which is worse than no redaction — it invites the value to be shown in
a UI that assumes it is safe to display. The `Math.max(6, …)` padding also made
the masked string a different length from the secret, so length was not
preserved either.

**Fix.** Reveal nothing below 12 characters; above that reveal at most the last
two, preserving length. Rationale: the leading characters are the identifying
part of a secret, and two trailing characters of a long value are not
individually useful.

**Honest caveat — this is currently latent.** `maskSecret` is exported but has
**no call sites** in `src/`. The credentials modal renders passwords in a
`type="password"` input with an explicit show/hide toggle, which is the correct
behaviour and does not use this helper. So today the bug is a trap for the next
person who reaches for the obvious-looking helper, not a live leak. It is
reported as P1 because it is a security primitive whose contract was wrong, and
it is fixed because the fix is four lines.

---

### P1-3 — The job agent binds to all interfaces (REPORTED, NOT FIXED)

**Where:** `src/agents/api-server.cjs:163` — `app.listen(PORT, …)` with no host
argument, and `app.use(cors())` at line 19.

**What.** `app.listen()` with no host binds `::` (all interfaces), not
`127.0.0.1`. Measured, not assumed:

```
app.listen(PORT) with no host binds to: {"address":"::","family":"IPv6",...}
=> ALL INTERFACES (LAN-reachable)
```

Combined with a bare `cors()`, which sends `Access-Control-Allow-Origin: *`, any
device on the same network can reach the agent's HTTP API at
`http://<your-lan-ip>:3457`.

**What an attacker gains.** The API accepts unauthenticated POSTs to
`/api/discover-jobs` and `/api/apply`. Concretely: drive the user's browser
automation on demand, submit job applications through it (guarded by
`submit && confirmSubmit`, so not trivially), and — the sharp edge — use
`/api/apply` to make the user's machine POST a resume to an arbitrary
`job.applyUrl`. It is a confused-deputy problem, not a credential-theft problem:
credentials travel *to* the agent, not out of it, and nothing on the agent serves
stored credentials back.

**Why it is not fixed here.** `src/agents/api-server.cjs` is not in this task's
file list, and it is shared with the scraper work. The fix is one line:

```js
app.listen(PORT, '127.0.0.1', () => { … });
```

plus tightening CORS to the app's own origins. That is a behaviour change to a
service another feature owns, so it belongs in a change that can test the agent
end to end. **Recommendation: apply it in the next agent-touching change, and
treat the current state as "the agent must only be run on a trusted network".**
`SECURITY.md` should say that until it is fixed.

---

### P2-1 — `VITE_AI_API_KEY` inlines into the public bundle with no guard

**Where:** `src/utils/aiService.js:78`.

**What.** `import.meta.env?.VITE_AI_API_KEY` is substituted at build time.
Verified by building with a canary value:

```
VITE_AI_API_KEY=sk-canary-DO-NOT-SHIP-12345  npx vite build
=> LEAKED in dist/assets/index-*.js
```

Nothing prevents a deploy with it set, and nothing warns. The only mention of it
anywhere is a code comment. `.env` and `.env.*.local` are gitignored, and
`SECURITY.md` already tells deployers never to set it — but that relies on the
deployer reading the doc.

**Severity P2, not P1**, because it requires the operator to actively set a
variable whose name starts with `VITE_`, and the documented path (enter the key
in AI Settings) does not touch the bundle. The key is stored in `localStorage`
either way, so the marginal exposure is "key in a file served to every visitor"
rather than "key compromised" — bad, but a deployment mistake, not a code defect.

**Not fixed**, deliberately. The correct fix is a build-time guard in
`vite.config.js` that fails the build when the variable is set, and that file is
not mine. Recommendation: add it, or remove the env fallback entirely — the app
works fine without it, and its only effect is to make a dangerous deploy
convenient.

---

### P2-2 — The credentials modal's privacy claim over-promises

**Where:** `src/components/ui/JobCredentialsModal.jsx:103-108`.

**What.** The modal tells the user their logins are "Never sent to the AI
provider or any third party". That is true of the app's own code — verified: the
only `fetch` calls that carry credentials target `http://localhost:3457`
(`jobDiscoveryService.js:110`), and the AI calls (`aiService.js`) send only the
prompt and key. But in the current build the claim is narrower than it reads,
because the agent on `:3457` is LAN-reachable (P1-3) and drives a real browser
profile. The promise is about the app, and the user will read it as a promise
about their machine.

**Recommendation, not a code fix:** once P1-3 is fixed, the sentence becomes
accurate as written. Until then it should say "sent only to your local agent on
`localhost:3457`", without the absolute "never".

---

## Accepted risks (by design — not defects)

These are consequences of local-first, and the audit confirms they behave as
`SECURITY.md` documents.

| Risk | Status |
|---|---|
| **`localStorage` is plaintext** — no encryption at rest. Resumes, photos, credentials and the API key are readable by anyone with the browser profile. | Accepted. `SECURITY.md` states it plainly, in bold, at the top. Encrypting client-side with a key the app must also hold is theatre, and a passphrase would break the "no setup" property. |
| **XSS on this origin reads everything.** | Accepted and correctly documented. The render boundary is a real defence: templates escape, and `normalizeResume` coerces hostile shapes. Verified in the existing suite (`rendering.test.jsx` asserts script payloads stay inert on all 9 templates). |
| **The AI provider sees the resume text you send it.** | Accepted. It is the user's own configured endpoint and an explicit button press. |
| **Resume content is POSTed to the local agent on `:3457` for the apply flow.** | Accepted. Verified: `applyService.js` sends `{ job, resumeData, resumePath, dryRun, coverLetter }` to `http://localhost:3457`. It never leaves the machine, but it is a second copy of PII in a process that writes screenshots to disk. Those are gitignored (`apply-*.png`, `ui-*.png`). |
| **No credential at rest is ever returned by the agent.** | Verified: the agent reads credentials from the request body and hands them to Playwright; no endpoint serves them back. |
| **Service worker caches.** | Verified clean — see below. |
| **No CSP header shipped.** | Accepted for a static deploy; `SECURITY.md` recommends one and documents the required origins. |

---

## Verified-clean checklist

Each item was checked against the code and, where possible, executed.

**Credentials at rest.** Live in `localStorage` under `nexus_job_credentials_v1`,
a separate key from the resume store. The modal warns the user in-UI that they
are browser-only and that a shared machine should be cleared after use. The
resume store never absorbs them — asserted by test.

**Credentials in transit.** Only to `http://localhost:3457`, never to the AI
provider, never cross-origin. The agent port is plaintext HTTP, which is correct
for loopback and would not be if P1-3's bind is left as-is.

**The API key is never logged.** Grepped every `console.*` in `src/` and in the
agent: no call interpolates a key, password or credential value. The
`console.error('Error reading job credentials:', e)` family passes an `Error`,
and a `JSON.parse` `SyntaxError` message contains a character offset, not the
input — verified by test, so a corrupt credentials blob cannot leak its contents
into the console.

**ErrorBoundary's download excludes credentials and the API key.** After the
P1-1 fix it reads only the resume store and its recovery copies. A test asserts
the emitted blob contains neither the password nor the key. This is a deliberate
decision: someone recovering from a crash wants their resume, not a plaintext
file of their passwords. Anyone who wants the logins backed up has the explicit
credentials modal.

**The service worker caches no user data.** The built `dist/sw.js` precaches
exactly 20 URLs — `/`, `/index.html`, the hashed JS/CSS/pdf-worker bundles,
icons, the manifest, and the canvas textures. No URL contains `3457`, `.json`,
`nexus_`, or any user-data path. The agent port is excluded before any cache
logic runs (`url.port === AGENT_PORT`), as is every cross-origin request and
every non-GET.

**Exports carry no unexpected data.** `exportStoreJson` serialises the variant
store only: `{ version, exportedAt, activeId, variants }`. No credentials key, no
AI key. DOCX and PDF exporters read `resumeData` only and mention no
secret-bearing identifier. Internal variant IDs (`var-…`) are included, which is
necessary for a working re-import and is not sensitive.

**Logging.** `console.*` output in `src/` and the agent covers errors, counts and
state transitions. The one thing logged that is arguably PII is
`ErrorBoundary.componentDidCatch`, which prints the error and component stack —
no resume fields. Acceptable.

---

## What I did not do

- Did not add encryption. It cannot protect against the threat it appears to
  address (a script on the origin, or a stolen profile) without a passphrase,
  which would break the app's core promise of opening instantly with no setup.
- Did not add a backend or move storage server-side.
- Did not fix P1-3 or P2-1: both live in files outside this task's scope. Both
  are one-line fixes and both are described above precisely enough to apply
  without re-deriving them.
- Did not invent findings to look thorough. The P1-1 and P1-2 defects were found
  by probing my own files, not by reading the task list and assuming.

---

## Verification

```
npx vite build            -> ✓ built
npm test                  -> exit 0
  test-fixes.cjs          -> 87 passed, 0 failed
  smoke-test.mjs          -> SMOKE OK
  test-integrity.mjs      -> INTEGRITY OK
  vitest                  -> 15 files, 783 passed
```

`src/test/security.test.js` adds 20 tests. Each maps to a claim above, and the
two fixes were confirmed load-bearing by reverting them: 4 tests fail, then pass
again when restored.
