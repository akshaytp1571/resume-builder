/**
 * Job Board Credentials Store
 *
 * Persists LinkedIn / Naukri / Indeed logins in localStorage so the user
 * does not retype them on every discovery run.
 *
 * The values are only ever sent to the LOCAL discovery API on
 * http://localhost:3457 - they are never shipped anywhere else. They are
 * still stored in plaintext in localStorage, so this is only appropriate on
 * a personal machine.
 */

const STORAGE_KEY = 'nexus_job_credentials_v1';

export const CREDENTIAL_FIELDS = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    usernameLabel: 'Email or phone',
    passwordLabel: 'Password',
    required: false,
    hint: 'Unlocks your personalised feed, applied-filter views and profile-based matching.',
  },
  {
    id: 'naukari',
    label: 'Naukri.com',
    usernameLabel: 'Username (email)',
    passwordLabel: 'Password',
    required: false,
    hint: 'Enables location and salary filters, plus roles hidden from the public index.',
  },
  {
    id: 'indeed',
    label: 'Indeed',
    usernameLabel: 'Email',
    passwordLabel: 'Password',
    required: false,
    hint: 'Optional - Indeed is scraped publicly. A login can surface more listings.',
  },
];

/** Fields that must never be rendered back to the screen in full. */
export function maskSecret(value) {
  if (!value) return '';
  const str = String(value);
  if (str.length <= 4) return '•'.repeat(str.length);
  return `${str.slice(0, 2)}${'•'.repeat(Math.max(6, str.length - 4))}${str.slice(-2)}`;
}

export function getSavedCredentials() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    const out = {};
    for (const field of CREDENTIAL_FIELDS) {
      const entry = parsed[field.id];
      if (entry && entry.username) {
        out[field.id] = {
          username: entry.username,
          password: entry.password || '',
        };
      }
    }
    return out;
  } catch (e) {
    console.error('Error reading job credentials:', e);
    return {};
  }
}

/**
 * Merge new values into the stored set.
 * Passing an empty string for a username removes that site's credentials.
 */
export function saveCredentials(next) {
  try {
    const current = getSavedCredentials();
    const merged = { ...current };

    for (const field of CREDENTIAL_FIELDS) {
      const incoming = next[field.id];
      if (!incoming) continue;
      const username = (incoming.username || '').trim();
      if (!username) {
        delete merged[field.id];
        continue;
      }
      merged[field.id] = {
        username,
        password: incoming.password || '',
      };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.error('Error saving job credentials:', e);
    return getSavedCredentials();
  }
}

export function clearCredentials() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing job credentials:', e);
  }
  return {};
}

/** Which sites currently have credentials stored. */
export function getConfiguredSites(credentials = getSavedCredentials()) {
  return CREDENTIAL_FIELDS.filter((f) => credentials[f.id]?.username).map((f) => f.id);
}

/** Strip blanks so the API never receives an empty credential object. */
export function toApiPayload(credentials = getSavedCredentials()) {
  const payload = {};
  for (const [site, cred] of Object.entries(credentials)) {
    if (cred?.username) {
      payload[site] = { username: cred.username, password: cred.password || '' };
    }
  }
  return payload;
}
