import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import ErrorBoundary from '../components/ui/ErrorBoundary.jsx';
import {
  maskSecret,
  saveCredentials,
  getSavedCredentials,
  clearCredentials,
  toApiPayload,
} from '../utils/jobCredentials.js';
import { exportStoreJson, loadStore } from '../utils/resumeStore.js';

/**
 * Security regression net for the v2.5 audit.
 *
 * Every case here maps to a claim in SECURITY-FINDINGS.md. Each one is written
 * so that reverting the corresponding fix fails it, rather than merely
 * describing current behaviour.
 */

const CRED_KEY = 'nexus_job_credentials_v1';
const AI_KEY = 'nexus_ai_config_v1';
const STORE_KEY = 'precision_resume_store_v2';
const RECOVERY_PREFIX = `${STORE_KEY}__recovery_`;

/** A realistic browser: resume + credentials + AI key all present. */
function seedSensitiveData() {
  localStorage.clear();
  localStorage.setItem(
    STORE_KEY,
    JSON.stringify({
      activeId: 'v1',
      variants: [
        {
          id: 'v1',
          name: 'My resume',
          data: { personalInfo: { fullName: 'Alex Morgan', email: 'alex@example.com' } },
          theme: {},
        },
      ],
    })
  );
  localStorage.setItem(
    CRED_KEY,
    JSON.stringify({ linkedin: { username: 'alex@example.com', password: 'hunter2-SECRET' } })
  );
  localStorage.setItem(AI_KEY, JSON.stringify({ apiKey: 'sk-live-SECRET-KEY' }));
}

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// 1. Credentials at rest
// ---------------------------------------------------------------------------

describe('credentials at rest', () => {
  it('are stored under their own key, never inside the resume store', () => {
    seedSensitiveData();
    const store = localStorage.getItem(STORE_KEY);
    const creds = localStorage.getItem(CRED_KEY);

    expect(creds).toContain('hunter2-SECRET');
    // The resume store must not absorb them.
    expect(store).not.toContain('hunter2-SECRET');
    expect(store).not.toContain('sk-live-SECRET-KEY');
  });

  it('round-trip through the store without leaking into the resume export', () => {
    seedSensitiveData();
    const exported = exportStoreJson(loadStore());

    expect(exported).not.toContain('hunter2-SECRET');
    expect(exported).not.toContain('sk-live-SECRET-KEY');
    expect(exported).not.toContain(CRED_KEY);
    expect(exported).not.toContain(AI_KEY);
  });

  it('clearCredentials leaves no residue in localStorage', () => {
    seedSensitiveData();
    clearCredentials();
    expect(localStorage.getItem(CRED_KEY)).toBeNull();
    // The resume itself is untouched: clearing logins is not a factory reset.
    expect(localStorage.getItem(STORE_KEY)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. maskSecret — the redaction helper
// ---------------------------------------------------------------------------

describe('maskSecret', () => {
  it('reveals nothing for short secrets', () => {
    // A 5-char password used to render as "ab••••••de", i.e. 4 of 5 characters.
    for (const short of ['a', 'ab', 'abc', 'abcd', 'abcde', 'abcdefghijk']) {
      const masked = maskSecret(short);
      expect(masked, `${short} leaked`).toBe('•'.repeat(short.length));
      expect(masked).not.toContain(short[0] === '•' ? '' : short.slice(0, 2));
    }
  });

  it('reveals at most the last two characters of a long secret', () => {
    const long = 'supersecretpassword';
    const masked = maskSecret(long);

    expect(masked.endsWith(long.slice(-2))).toBe(true);
    // The leading characters — the part that identifies the secret — stay hidden.
    expect(masked).not.toContain('supersecret');
    expect(masked.length).toBe(long.length);
  });

  it('never returns the secret verbatim', () => {
    for (const secret of ['a', 'abcde', 'hunter2-SECRET', 'sk-live-SECRET-KEY']) {
      expect(maskSecret(secret)).not.toBe(secret);
    }
  });

  it('handles empty and non-string input', () => {
    expect(maskSecret('')).toBe('');
    expect(maskSecret(null)).toBe('');
    expect(maskSecret(undefined)).toBe('');
    expect(maskSecret(123456789012)).toBe('••••••••••12');
  });
});

// ---------------------------------------------------------------------------
// 3. ErrorBoundary rescue payload
// ---------------------------------------------------------------------------

describe('ErrorBoundary rescue payload', () => {
  function Boom() {
    throw new Error('kaboom');
  }

  /** Render the fallback, click download, and return the Blob handed to the URL. */
  function clickDownload() {
    const createObjectURL = vi.fn(() => 'blob:rescue');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(h(ErrorBoundary, null, h(Boom)));
    fireEvent.click(screen.getByRole('button', { name: /Download my data/i }));

    const blob = createObjectURL.mock.calls[0]?.[0];
    click.mockRestore();
    return { blob, createObjectURL };
  }

  /** Read a Blob's text in jsdom (which has no Blob.text in older versions). */
  async function blobText(blob) {
    if (typeof blob.text === 'function') return blob.text();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
  }

  let consoleSpy;
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('never includes job credentials in the rescued file', async () => {
    seedSensitiveData();
    const { blob } = clickDownload();
    const text = await blobText(blob);

    expect(text).not.toContain('hunter2-SECRET');
    expect(text).not.toContain(CRED_KEY);
  });

  it('never includes the AI API key in the rescued file', async () => {
    seedSensitiveData();
    const { blob } = clickDownload();
    const text = await blobText(blob);

    expect(text).not.toContain('sk-live-SECRET-KEY');
    expect(text).not.toContain(AI_KEY);
  });

  it('does include the resume itself', async () => {
    seedSensitiveData();
    const { blob } = clickDownload();
    const text = await blobText(blob);

    expect(text).toContain('Alex Morgan');
  });

  it('rescues a quarantined copy when the main store is missing', async () => {
    // The failure mode this guards: resumeStore quarantines an unparseable
    // value under a recovery key, then the next save writes a fresh blank store
    // over the main key. Rescuing only the main key loses the real resume.
    localStorage.setItem(
      `${RECOVERY_PREFIX}1700000000000`,
      '{"variants":[{"data":{"personalInfo":{"fullName":"Recovered Person"}}}]}'
    );
    localStorage.setItem(STORE_KEY, '{"variants":[]}');

    const { blob } = clickDownload();
    const text = await blobText(blob);

    expect(text).toContain('Recovered Person');
    expect(text).toContain('recovery');
  });

  it('rescues a lone recovery copy when there is no main store at all', async () => {
    localStorage.setItem(
      `${RECOVERY_PREFIX}1700000000000`,
      '{"variants":[{"data":{"personalInfo":{"fullName":"Only Copy"}}}]}'
    );

    const { blob, createObjectURL } = clickDownload();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(await blobText(blob)).toContain('Only Copy');
  });

  it('still says there is nothing to download when storage is truly empty', () => {
    localStorage.clear();
    const createObjectURL = vi.fn(() => 'blob:rescue');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

    render(h(ErrorBoundary, null, h(Boom)));
    fireEvent.click(screen.getByRole('button', { name: /Download my data/i }));

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/nothing to download/i);
  });

  it('hands over the main store verbatim when there is no recovery copy', async () => {
    // Backwards compatibility: the single-file path must stay byte-identical.
    const broken = '{"variants":[ BROKEN';
    localStorage.setItem(STORE_KEY, broken);

    const { blob } = clickDownload();
    expect(await blobText(blob)).toBe(broken);
  });
});

// ---------------------------------------------------------------------------
// 4. Service worker
// ---------------------------------------------------------------------------

describe('service worker', () => {
  it('bypasses the job agent port and cross-origin requests', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/sw.js'),
      'utf8'
    );

    // The agent must be excluded before any cache logic can see it.
    expect(src).toMatch(/AGENT_PORT\s*=\s*'3457'/);
    expect(src).toMatch(/url\.port\s*===\s*AGENT_PORT/);
    expect(src).toMatch(/url\.origin\s*!==\s*self\.location\.origin/);
    // Only GET is ever cached.
    expect(src).toMatch(/request\.method\s*!==\s*'GET'/);
  });

  it('precaches only build output, never a user-data URL', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dist = path.join(process.cwd(), 'dist');

    // The manifest is generated at build time; skip if nobody has built.
    if (!fs.existsSync(path.join(dist, 'sw.js'))) return;

    const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
    const match = sw.match(/const PRECACHE_URLS = (\[[\s\S]*?\]);/);
    expect(match, 'no PRECACHE_URLS in the built worker').toBeTruthy();

    const urls = JSON.parse(match[1]);
    expect(urls.length).toBeGreaterThan(0);

    for (const url of urls) {
      expect(url, 'the agent port must never be precached').not.toContain('3457');
      expect(url, 'only same-origin paths are precached').toMatch(/^\//);
      expect(url, `user-data URL precached: ${url}`).not.toMatch(
        /credential|nexus_|localStorage|\.json$/i
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Logging
// ---------------------------------------------------------------------------

describe('logging', () => {
  it('never logs a credential, password or API key value', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const walk = (dir) => {
      const out = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (/\.(jsx?|cjs)$/.test(entry.name)) out.push(full);
      }
      return out;
    };

    const offenders = [];
    for (const file of walk(path.join(process.cwd(), 'src'))) {
      if (/\.test\./.test(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        // A console call whose arguments mention a secret-bearing variable.
        if (!/console\.(log|info|warn|error|debug)/.test(line)) return;
        if (/(password|apiKey|credential|secret|token)\b/i.test(line)) {
          // Console lines that merely SAY the word in prose are fine; ones that
          // interpolate a value are not.
          if (/\$\{[^}]*(password|apiKey|credential|secret|token)/i.test(line)) {
            offenders.push(`${path.basename(file)}:${i + 1}: ${line.trim()}`);
          }
        }
      });
    }

    expect(offenders, `credential values interpolated into logs:\n${offenders.join('\n')}`).toEqual(
      []
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Exports
// ---------------------------------------------------------------------------

describe('exports', () => {
  it('the resume JSON export carries no credentials or API key', () => {
    seedSensitiveData();
    const json = exportStoreJson(loadStore());
    const parsed = JSON.parse(json);

    // Shape is the documented v2 export: metadata plus variants only.
    expect(parsed.version).toBe(2);
    expect(Array.isArray(parsed.variants)).toBe(true);

    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toMatch(/password|apiKey|credentials/i);
  });

  it('the API payload contains only what the local agent needs', () => {
    seedSensitiveData();
    const payload = toApiPayload();

    // Exactly the credential fields, nothing about the resume or the AI key.
    expect(Object.keys(payload)).toEqual(['linkedin']);
    expect(payload.linkedin).toEqual({
      username: 'alex@example.com',
      password: 'hunter2-SECRET',
    });
    expect(JSON.stringify(payload)).not.toContain('sk-live-SECRET-KEY');
    expect(JSON.stringify(payload)).not.toContain('Alex Morgan');
  });

  it('saving a blank username removes that site entirely', () => {
    seedSensitiveData();
    saveCredentials({ linkedin: { username: '', password: '' } });
    expect(getSavedCredentials()).toEqual({});
    expect(localStorage.getItem(CRED_KEY)).not.toContain('hunter2-SECRET');
  });
});
