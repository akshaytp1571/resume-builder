/**
 * Application tracker.
 *
 * Pure module: no React, no DOM beyond localStorage. Keeps a record of every
 * application that actually went out, which resume variant was used, and what
 * happened afterwards.
 *
 * Storage is deliberately a SEPARATE key from the variant store. Applications
 * outlive resumes: a user can delete a variant, but the fact that they applied
 * to Acme in March is still true and still worth keeping. Keeping the two in
 * one blob would mean a store rewrite could take application history with it.
 */

const STORAGE_KEY = 'precision_applications_v1';

export const STATUSES = [
  'applied',
  'screening',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
];

/** Statuses that count as "the employer responded". */
const RESPONSE_STATUSES = ['screening', 'interview', 'offer'];

/** Statuses that are no longer in play. Everything else is "active". */
const CLOSED_STATUSES = ['rejected', 'withdrawn'];

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) {
    /* fall through to the timestamp form */
  }
  return `app-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function asString(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function asStatus(value) {
  return STATUSES.includes(value) ? value : 'applied';
}

/**
 * Coerce one stored entry into the full record shape.
 *
 * Records arrive from localStorage, which the user can hand-edit, and from
 * older versions of this module. Every field gets a safe default so the UI
 * never has to defend itself.
 */
function normalizeRecord(raw, index = 0) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const appliedAt = asString(raw.appliedAt) || asString(raw.lastUpdatedAt) || '';

  return {
    id: asString(raw.id) || `app-recovered-${index}`,
    company: asString(raw.company),
    title: asString(raw.title),
    url: asString(raw.url),
    appliedAt,
    status: asStatus(raw.status),
    variantId: asString(raw.variantId),
    variantName: asString(raw.variantName),
    notes: asString(raw.notes),
    lastUpdatedAt: asString(raw.lastUpdatedAt) || appliedAt,
    // Set by pruneOrphanedVariants. Never a reason to drop the record.
    variantOrphaned: Boolean(raw.variantOrphaned),
  };
}

/** Newest first. Records with no usable date sort last. */
function sortNewestFirst(list) {
  return [...list].sort((a, b) => {
    const ta = a.appliedAt ? Date.parse(a.appliedAt) : NaN;
    const tb = b.appliedAt ? Date.parse(b.appliedAt) : NaN;
    const va = Number.isFinite(ta) ? ta : -Infinity;
    const vb = Number.isFinite(tb) ? tb : -Infinity;
    if (va !== vb) return vb - va;
    return 0;
  });
}

/**
 * Read every stored application.
 *
 * Never throws: corrupt JSON, a non-array, or a missing key all yield [].
 * A tracker that crashes on bad data would be worse than no tracker, because
 * it would take the rest of the app down with it.
 */
export function loadApplications() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.error('Application tracker: localStorage unavailable:', e);
    return [];
  }

  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error('Application tracker: stored data is not valid JSON:', e);
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.error('Application tracker: stored data is not an array.');
    return [];
  }

  const records = parsed
    .map((item, i) => normalizeRecord(item, i))
    .filter(Boolean);

  return sortNewestFirst(records);
}

/**
 * Persist the whole list.
 *
 * Mirrors saveStore's `{ ok }` shape so the caller can warn the user instead of
 * silently losing the write. Quota is the realistic failure here.
 */
export function saveApplications(list) {
  if (!Array.isArray(list)) {
    return { ok: false, error: 'Applications must be an array.' };
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return { ok: true };
  } catch (e) {
    console.error('Application tracker: save failed:', e);
    return { ok: false, error: e?.message || 'Could not save applications.' };
  }
}

/**
 * Append one application and persist.
 *
 * Returns the stored record (with its generated id) so the caller can use it
 * immediately. If the write fails, the record is still returned — the caller
 * can detect the failure by re-reading, and losing the return value would not
 * make the write succeed.
 */
export function addApplication(record = {}) {
  const appliedAt = asString(record.appliedAt) || nowIso();

  const stored = normalizeRecord({
    ...record,
    id: asString(record.id) || makeId(),
    appliedAt,
    lastUpdatedAt: nowIso(),
  });

  const list = [stored, ...loadApplications()];
  const result = saveApplications(list);
  if (!result.ok) {
    console.error('Application tracker: could not persist the new application.');
  }

  return stored;
}

/**
 * Patch one application. Returns the updated record, or null if no record has
 * that id (the caller may be looking at a stale list).
 */
export function updateApplication(id, patch = {}) {
  const list = loadApplications();
  const index = list.findIndex((a) => a.id === id);
  if (index === -1) return null;

  const merged = normalizeRecord({
    ...list[index],
    ...patch,
    // Identity and creation time are not patchable.
    id: list[index].id,
    appliedAt: list[index].appliedAt,
    lastUpdatedAt: nowIso(),
  });

  const next = [...list];
  next[index] = merged;

  const result = saveApplications(next);
  if (!result.ok) {
    console.error('Application tracker: could not persist the update.');
  }

  return merged;
}

/**
 * Remove one application. Returns the remaining list.
 *
 * Only ever called from an explicit, confirmed delete in the UI — this is the
 * one path that destroys history.
 */
export function removeApplication(id) {
  const next = loadApplications().filter((a) => a.id !== id);
  const result = saveApplications(next);
  if (!result.ok) {
    console.error('Application tracker: could not persist the delete.');
  }
  return next;
}

/**
 * Aggregate stats for the header strip.
 *
 * `responseRate` is the share of applications that got any employer response.
 * It is 0 when there is nothing to divide by — never NaN, never Infinity.
 */
export function computeStats(list) {
  const records = Array.isArray(list) ? list.filter(Boolean) : [];

  const byStatus = {};
  for (const status of STATUSES) byStatus[status] = 0;

  for (const record of records) {
    const status = asStatus(record.status);
    byStatus[status] += 1;
  }

  const total = records.length;

  const responded = RESPONSE_STATUSES.reduce((sum, s) => sum + byStatus[s], 0);
  // Guard the divide. total === 0 would otherwise give NaN, which renders as
  // "NaN%" and is the single most common bug in trackers like this one.
  const responseRate = total === 0 ? 0 : Math.round((responded / total) * 10000) / 10000;

  const closed = CLOSED_STATUSES.reduce((sum, s) => sum + byStatus[s], 0);
  const activeCount = total - closed;

  return { total, byStatus, responseRate, activeCount };
}

/**
 * Flag applications whose resume variant no longer exists.
 *
 * MARK, never delete. The application really happened; the resume it used is
 * simply gone. Deleting the history because the resume was deleted would
 * destroy the user's only record of having applied.
 *
 * Pure: returns a new list. The caller decides whether to persist it.
 *
 * `store` is the variant store from resumeStore (`{ variants: [...] }`). A
 * missing or malformed store is treated as "no variants known", which would
 * mark everything — so in that case the list is returned untouched instead.
 */
export function pruneOrphanedVariants(list, store) {
  const records = Array.isArray(list) ? list.filter(Boolean) : [];

  const variants = Array.isArray(store?.variants) ? store.variants.filter(Boolean) : null;
  if (!variants) return records;

  const known = new Set(variants.map((v) => v?.id).filter(Boolean));

  return records.map((record) => {
    // A record with no variantId was never tied to a resume (or predates
    // variants entirely) - that is not an orphan.
    if (!record.variantId) return { ...record, variantOrphaned: false };
    return { ...record, variantOrphaned: !known.has(record.variantId) };
  });
}

/** Count only, for the Navbar badge. */
export function countApplications() {
  return loadApplications().length;
}
