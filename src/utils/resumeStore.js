/**
 * Resume variant store.
 *
 * A "variant" is a named, job-targeted copy of a resume (e.g. "QA Lead - Dubai",
 * "Automation Engineer"). Each variant carries its own resume data and theme,
 * so a user can keep several tailored versions side by side.
 *
 * Storage layout (localStorage):
 *   precision_resume_store_v2 = {
 *     activeId: "var-...",
 *     variants: [ { id, name, createdAt, updatedAt, data, theme } ]
 *   }
 *
 * The pre-v2 single-resume keys are migrated on first read so existing users
 * lose nothing.
 */

import { INITIAL_RESUME_DATA, DEFAULT_THEME } from '../data/initialData.js';
import { normalizeCoverLetter } from './coverLetter.js';

const STORE_KEY = 'precision_resume_store_v2';
const LEGACY_DATA_KEY = 'precision_resume_data_v1';
const LEGACY_THEME_KEY = 'precision_theme_data_v1';

/** Stable id without a uuid dependency. */
export function makeVariantId() {
  return `var-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function deepClone(value) {
  // structuredClone is available in every browser this app targets (2022+),
  // and falls back to JSON for safety.
  try {
    return structuredClone(value);
  } catch (e) {
    return JSON.parse(JSON.stringify(value));
  }
}

/** Normalise a theme, filling any gaps from the defaults. */
export function normalizeTheme(theme) {
  const merged = { ...DEFAULT_THEME, ...(theme || {}) };
  if (merged.singlePage === undefined) merged.singlePage = true;
  return merged;
}

/** Coerce anything to a string. */
function asString(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/**
 * Coerce to an array of strings, dropping holes, nulls and objects.
 * Used for bullet lists, which are always string arrays.
 *
 * Numbers are dropped rather than stringified: a bullet list containing `42`
 * is corrupt data, not a bullet, and "42" on a resume reads as a bug.
 */
function asStringList(value) {
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'string' && v.trim().length > 0);
}

/**
 * Coerce to an array of plain objects with a stable id, dropping holes.
 * A non-object element is dropped rather than kept as a crash hazard.
 */
function asObjectList(value, prefix) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item, index) => ({
      ...item,
      id: item.id ? asString(item.id) || `${prefix}-${index}` : `${prefix}-${index}`,
    }));
}

/**
 * Normalise resume data so every collection is a real array of well-shaped
 * items, and every scalar is the type the renderer expects.
 *
 * Validating only that `skills` is an array is not enough: `skills: [null]` or
 * `highlights: "a string"` both pass an Array.isArray check and then crash the
 * ATS scorer and every template. This function is the trust boundary between
 * untrusted input (a hand-edited localStorage value, an imported JSON backup,
 * a partially-parsed resume) and the rest of the app.
 */
export function normalizeResume(data) {
  const base = deepClone(INITIAL_RESUME_DATA);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return base;

  const merged = { ...base };

  // --- scalars ---
  merged.summary = asString(data.summary);

  // --- personalInfo: every field coerced to a string ---
  const rawPersonal =
    data.personalInfo && typeof data.personalInfo === 'object'
      ? data.personalInfo
      : {};
  const personalInfo = { ...base.personalInfo };
  for (const key of Object.keys(base.personalInfo)) {
    if (key in rawPersonal) personalInfo[key] = asString(rawPersonal[key]);
  }
  // Booleans and the photo data URL must survive as their real types.
  personalInfo.showPhoto = Boolean(
    rawPersonal.showPhoto ?? base.personalInfo.showPhoto
  );
  personalInfo.photo = typeof rawPersonal.photo === 'string' ? rawPersonal.photo : '';
  if (typeof rawPersonal.photoStyle === 'string') {
    personalInfo.photoStyle = rawPersonal.photoStyle;
  }
  merged.personalInfo = personalInfo;

  // --- collections of objects ---
  merged.skills = asObjectList(data.skills, 'skill').map((s) => ({
    ...s,
    category: asString(s.category),
    items: asString(s.items),
  }));
  merged.experience = asObjectList(data.experience, 'exp').map((e) => ({
    ...e,
    role: asString(e.role),
    company: asString(e.company),
    period: asString(e.period),
    location: asString(e.location),
    product: asString(e.product),
    highlights: asStringList(e.highlights),
  }));
  merged.education = asObjectList(data.education, 'edu').map((e) => ({
    ...e,
    degree: asString(e.degree),
    school: asString(e.school),
    period: asString(e.period),
    location: asString(e.location),
    // `score` is the field every template, the DOCX exporter and the ATS text
    // view read; `grade` is the alias the JSON Resume mapper uses. They are the
    // same value, so keep both populated from whichever one arrived. Leaving
    // one empty is how an imported grade ends up invisible in every template.
    grade: asString(e.grade) || asString(e.score),
    score: asString(e.score) || asString(e.grade),
  }));
  merged.languages = asObjectList(data.languages, 'lang').map((l) => ({
    ...l,
    name: asString(l.name),
    // Same pair as education: `proficiency` is canonical, `level` is the alias.
    level: asString(l.level) || asString(l.proficiency),
    proficiency: asString(l.proficiency) || asString(l.level),
  }));
  merged.certifications = asObjectList(data.certifications, 'cert').map((c) => ({
    ...c,
    name: asString(c.name),
    issuer: asString(c.issuer),
    year: asString(c.year),
  }));
  merged.projects = asObjectList(data.projects, 'proj').map((p) => ({
    ...p,
    name: asString(p.name),
    role: asString(p.role),
    period: asString(p.period),
    link: asString(p.link),
    highlights: asStringList(p.highlights),
  }));
  merged.customSections = asObjectList(data.customSections, 'custom').map((c) => ({
    ...c,
    title: asString(c.title),
    items: asStringList(c.items),
  }));

  return merged;
}

/** Build a fresh variant. */
export function createVariant({
  name = 'Untitled resume',
  data = null,
  theme = null,
  letter = null,
} = {}) {
  const now = new Date().toISOString();
  return {
    id: makeVariantId(),
    name,
    createdAt: now,
    updatedAt: now,
    data: normalizeResume(data),
    theme: normalizeTheme(theme),
    // Optional: a store written before v2.1 has no letter, and must still load.
    letter: normalizeCoverLetter(letter),
  };
}

/**
 * Read the whole store, migrating legacy single-resume keys when present.
 * Always returns a valid store with at least one variant.
 */
export function loadStore() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch (e) {
    // localStorage can throw outright (private mode, disabled storage).
    console.error('localStorage unavailable:', e);
  }

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.variants) && parsed.variants.length > 0) {
        const variants = parsed.variants
          .filter((v) => v && typeof v === 'object')
          .map((v) => ({
            ...v,
            id: typeof v.id === 'string' && v.id ? v.id : makeVariantId(),
            name: asString(v.name) || 'Untitled resume',
            data: normalizeResume(v.data),
            theme: normalizeTheme(v.theme),
            // A v2.0 store has no letter. Normalising here (rather than
            // defaulting at every call site) means the rest of the app can
            // assume `variant.letter` always exists.
            letter: normalizeCoverLetter(v.letter),
          }));

        if (variants.length > 0) {
          const activeId = variants.some((v) => v.id === parsed.activeId)
            ? parsed.activeId
            : variants[0].id;

          // Trash is normalised like variants and returned as a separate array,
          // so `variants` keeps meaning exactly what it did before soft delete.
          // Purged here rather than on a timer: load is the only moment we are
          // guaranteed to run.
          const trash = purgeExpiredTrash(
            Array.isArray(parsed.trash)
              ? parsed.trash
                  .filter((v) => v && typeof v === 'object')
                  .map((v) => ({
                    ...v,
                    id: typeof v.id === 'string' && v.id ? v.id : makeVariantId(),
                    name: asString(v.name) || 'Untitled resume',
                    data: normalizeResume(v.data),
                    theme: normalizeTheme(v.theme),
                    letter: normalizeCoverLetter(v.letter),
                    deletedAt: asString(v.deletedAt) || new Date().toISOString(),
                  }))
              : []
          );

          return { activeId, variants, trash };
        }
      }
    } catch (e) {
      console.error('Error reading resume store:', e);
    }

    // The store exists but could not be used. Do NOT fall through to creating a
    // fresh sample resume over the top of it — that destroys the user's data
    // silently. Keep a copy of the unreadable value under a recovery key so it
    // can be retrieved by hand.
    quarantineCorruptStore(raw);
  }

  // --- migration from the v1 single-resume keys ---
  let legacyData = null;
  let legacyTheme = null;
  try {
    const d = localStorage.getItem(LEGACY_DATA_KEY);
    if (d) legacyData = JSON.parse(d);
  } catch (e) {
    /* ignore a corrupt legacy value */
  }
  try {
    const t = localStorage.getItem(LEGACY_THEME_KEY);
    if (t) legacyTheme = JSON.parse(t);
  } catch (e) {
    /* ignore */
  }

  const variant = createVariant({
    name: legacyData?.personalInfo?.fullName
      ? `${legacyData.personalInfo.fullName} - Main`
      : 'My resume',
    data: legacyData,
    theme: legacyTheme,
  });

  const store = { activeId: variant.id, variants: [variant] };

  // Only write back once the legacy values have been consumed, so a failed
  // migration does not destroy the user's only copy.
  if (legacyData || legacyTheme) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {
      console.error('Error writing migrated resume store:', e);
    }
  }

  return store;
}

/**
 * Preserve an unreadable store value under a timestamped recovery key before
 * anything overwrites it. Best effort: if storage is full this silently fails,
 * but loadStore never overwrites the original key itself.
 */
function quarantineCorruptStore(raw) {
  try {
    const key = `${STORE_KEY}__recovery_${Date.now()}`;
    localStorage.setItem(key, raw);
    console.error(
      `Resume store was unreadable. A copy was kept at "${key}" for recovery.`
    );
  } catch (e) {
    console.error('Could not quarantine the unreadable resume store:', e);
  }
}

/** True when a recovery copy exists, so the UI can surface a warning. */
export function hasRecoveryCopy() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${STORE_KEY}__recovery_`)) return true;
    }
  } catch (e) {
    /* ignore */
  }
  return false;
}

/**
 * Recovery keys, newest first.
 *
 * Keys are `${STORE_KEY}__recovery_${Date.now()}`, so the timestamp suffix is
 * the sort key. Ties and unparseable suffixes fall back to string order, which
 * still groups a batch together. Used by the recovery banner in App.jsx.
 */
export function listRecoveryKeys() {
  const prefix = `${STORE_KEY}__recovery_`;
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
  } catch (e) {
    return [];
  }
  const stamp = (key) => {
    const n = Number(key.slice(prefix.length));
    return Number.isFinite(n) ? n : -1;
  };
  return keys.sort((a, b) => stamp(b) - stamp(a) || b.localeCompare(a));
}

/**
 * Everything about a variant that another tab's edit could have changed.
 *
 * `updatedAt` is deliberately excluded: it is stamped on every write, so
 * including it would make two copies of identical content compare unequal and
 * report a collision on every ordinary save.
 */
function variantFingerprint(variant) {
  return JSON.stringify([variant.name, variant.data, variant.theme, variant.letter]);
}

/**
 * Persist the whole store.
 *
 * Returns `{ ok: boolean, merged: store|null, conflicts: array }`.
 *
 * Two tabs of this app share one localStorage key, so a naive whole-store write
 * loses data: tab A holds a stale copy, tab B adds a variant, then tab A's
 * debounced save writes its stale copy over B's and B's variant is gone with no
 * warning.
 *
 * The fix is a merge-before-write. Variants the other tab has that we do not are
 * adopted; variants we have that the other tab deleted are kept (deletion is
 * rarer than creation, and resurrecting one is far less harmful than silently
 * destroying one). On a genuine conflict `merged` is non-null so the caller can
 * tell the user their view was refreshed.
 *
 * `conflicts` covers the case the id-union merge cannot: both tabs hold the
 * SAME variant id and the copy on disk is not the copy we hold. Adopting by id
 * silently drops whichever edit is older, so instead the difference is reported
 * and ours is kept — the tab the user is looking at is the one whose typing must
 * not vanish. The caller turns that into a warning, which is the difference
 * between "I lost an edit" and "another tab has a newer version of this resume".
 *
 * The comparison is on content, not on `updatedAt`. Two saves inside the same
 * millisecond produce identical timestamps, so a timestamp compare silently
 * misses real collisions — and it only ever sees the collision from the losing
 * side. Comparing content catches it from the overwriting side too, which is the
 * side that actually needs the warning.
 */
export function saveStore(store) {
  let onDisk = null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) onDisk = JSON.parse(raw);
  } catch (e) {
    // An unreadable value on disk is not ours to reason about; write over it.
    onDisk = null;
  }

  let toWrite = store;
  let merged = null;
  const conflicts = [];

  if (
    onDisk &&
    Array.isArray(onDisk.variants) &&
    Array.isArray(store?.variants) &&
    onDisk.variants.length > 0
  ) {
    const mine = new Map(store.variants.filter(Boolean).map((v) => [v.id, v]));
    const theirs = new Map(onDisk.variants.filter(Boolean).map((v) => [v.id, v]));

    // Keep our order, then append anything only the other tab knows about.
    const combined = [...store.variants.filter(Boolean)];
    let adopted = 0;
    for (const [id, variant] of theirs) {
      if (!mine.has(id)) {
        combined.push(variant);
        adopted++;
      }
    }

    // A shared id whose on-disk copy differs from ours means another tab wrote
    // content we do not have, and this write is about to drop it.
    for (const [id, variant] of mine) {
      const other = theirs.get(id);
      if (!other) continue;
      if (variantFingerprint(variant) !== variantFingerprint(other)) {
        conflicts.push({ id, name: variant.name || 'Untitled resume' });
      }
    }

    if (adopted > 0) {
      // Trash is merged too, or a delete in one tab is silently resurrected by
      // the next save from another. Union by id, newest first, then purge.
      const otherTrash = Array.isArray(onDisk.trash) ? onDisk.trash : [];
      const myTrash = getTrash(store);
      const seen = new Set(myTrash.filter(Boolean).map((t) => t.id));
      const trash = purgeExpiredTrash([
        ...myTrash.filter(Boolean),
        ...otherTrash.filter(Boolean).filter((t) => !seen.has(t.id)),
      ]);

      toWrite = { ...store, variants: combined, trash };
      merged = toWrite;
    }
  }

  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(toWrite));
    return { ok: true, merged, conflicts };
  } catch (e) {
    console.error('Error saving resume store:', e);
    return { ok: false, merged: null, conflicts: [] };
  }
}

/** The variant that should currently be open. */
export function getActiveVariant(store) {
  if (!store || !Array.isArray(store.variants) || store.variants.length === 0) {
    return null;
  }
  return store.variants.find((v) => v.id === store.activeId) || store.variants[0];
}

/**
 * Immutably update one variant and stamp `updatedAt`.
 * Returns a new store object.
 */
export function updateVariant(store, variantId, patch) {
  const variants = store.variants.map((v) =>
    v.id === variantId
      ? { ...v, ...patch, updatedAt: new Date().toISOString() }
      : v
  );
  return { ...store, variants };
}

/** Add a variant and make it active. */
export function addVariant(store, variant) {
  return { activeId: variant.id, variants: [...store.variants, variant] };
}

/** Duplicate a variant under a new name and make the copy active. */
export function duplicateVariant(store, variantId, nameSuffix = 'copy') {
  const source = store.variants.find((v) => v.id === variantId);
  if (!source) return store;
  const copy = createVariant({
    name: `${source.name} (${nameSuffix})`,
    data: source.data,
    theme: source.theme,
  });
  return addVariant(store, copy);
}

/**
 * How long a deleted resume stays recoverable.
 *
 * 30 days. Long enough that a misclick on a phone is a shrug, short enough that
 * a stale trash cannot quietly fill localStorage — a resume is ~8 KB, so 30 days
 * of accidental deletes is still smaller than one photo data URL.
 */
export const TRASH_RETENTION_DAYS = 30;

const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** Drop trash entries past retention. Malformed dates are kept, not dropped. */
export function purgeExpiredTrash(trash) {
  if (!Array.isArray(trash)) return [];
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  return trash.filter((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const at = new Date(entry.deletedAt).getTime();
    if (!Number.isFinite(at)) return true;
    return at > cutoff;
  });
}

/** The trash array, always an array. */
export function getTrash(store) {
  return Array.isArray(store?.trash) ? store.trash : [];
}

/**
 * Remove a variant — but only from `variants`. It moves to `trash` so the
 * removal is undoable, and `trash` is a separate array precisely so nothing
 * downstream has to learn to filter deleted rows.
 *
 * Still refuses to remove the last variant so the app always has something to
 * edit. Returns the new store, or the original if refused.
 *
 * An imported backup can contain duplicate ids. Filtering by id would then
 * remove every copy, leaving an empty list and crashing the next read, so
 * removal is by index of the first match.
 */
export function removeVariant(store, variantId) {
  if (!Array.isArray(store.variants) || store.variants.length <= 1) return store;

  const index = store.variants.findIndex((v) => v && v.id === variantId);
  if (index === -1) return store;

  const removed = store.variants[index];
  const variants = store.variants.filter((_, i) => i !== index);
  // Defensive: filter above can only shrink by one, but never hand back an
  // empty list to the rest of the app.
  if (variants.length === 0) return store;

  const activeStillExists = variants.some((v) => v && v.id === store.activeId);
  const activeId = activeStillExists ? store.activeId : variants[0].id;

  const trash = [
    { ...removed, deletedAt: new Date().toISOString() },
    ...getTrash(store),
  ];

  return { ...store, activeId, variants, trash: purgeExpiredTrash(trash) };
}

/**
 * Put a trashed variant back. Assigns a fresh id: the id may have been reused
 * by a new resume created after the delete, and two variants sharing an id
 * breaks every by-id lookup in the app.
 */
export function restoreVariant(store, variantId) {
  const trash = getTrash(store);
  const index = trash.findIndex((v) => v && v.id === variantId);
  if (index === -1) return store;

  const entry = trash[index];
  const restored = {
    ...entry,
    id: makeVariantId(),
    updatedAt: new Date().toISOString(),
  };
  delete restored.deletedAt;

  return {
    ...store,
    activeId: restored.id,
    variants: [...store.variants, restored],
    trash: trash.filter((_, i) => i !== index),
  };
}

/** Destroy one trashed variant for good. */
export function purgeVariant(store, variantId) {
  const trash = getTrash(store);
  const next = trash.filter((v) => v && v.id !== variantId);
  if (next.length === trash.length) return store;
  return { ...store, trash: next };
}

/** Destroy everything in the trash. */
export function emptyTrash(store) {
  if (getTrash(store).length === 0) return store;
  return { ...store, trash: [] };
}

/** Switch the active variant. */
export function setActiveVariant(store, variantId) {
  if (!store.variants.some((v) => v.id === variantId)) return store;
  return { ...store, activeId: variantId };
}

/** Export every variant as one JSON document (backup / transfer). */
export function exportStoreJson(store) {
  return JSON.stringify(
    { version: 2, exportedAt: new Date().toISOString(), ...store },
    null,
    2
  );
}

/**
 * Import a previously exported document. Accepts either a v2 store export or a
 * bare v1 resume object, so old backups still restore.
 * Returns a new store, or throws with a readable message.
 */
export function importStoreJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('That file is not valid JSON.');
  }

  if (parsed && Array.isArray(parsed.variants) && parsed.variants.length > 0) {
    const variants = parsed.variants.map((v) => ({
      id: v.id || makeVariantId(),
      name: v.name || 'Imported resume',
      createdAt: v.createdAt || new Date().toISOString(),
      updatedAt: v.updatedAt || new Date().toISOString(),
      data: normalizeResume(v.data),
      theme: normalizeTheme(v.theme),
      // Backups from before v2.1 carry no letter; they import as a blank one.
      letter: normalizeCoverLetter(v.letter),
    }));
    const activeId = variants.some((v) => v.id === parsed.activeId)
      ? parsed.activeId
      : variants[0].id;
    return { activeId, variants };
  }

  // A bare resume object (the old single-resume backup format).
  if (parsed && typeof parsed === 'object' && parsed.personalInfo) {
    const variant = createVariant({
      name: parsed.personalInfo.fullName
        ? `${parsed.personalInfo.fullName} - Imported`
        : 'Imported resume',
      data: parsed,
    });
    return { activeId: variant.id, variants: [variant] };
  }

  throw new Error('That JSON does not look like a resume or a resume backup.');
}
