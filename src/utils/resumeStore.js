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
    grade: asString(e.grade),
  }));
  merged.languages = asObjectList(data.languages, 'lang').map((l) => ({
    ...l,
    name: asString(l.name),
    level: asString(l.level),
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
} = {}) {
  const now = new Date().toISOString();
  return {
    id: makeVariantId(),
    name,
    createdAt: now,
    updatedAt: now,
    data: normalizeResume(data),
    theme: normalizeTheme(theme),
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
          }));

        if (variants.length > 0) {
          const activeId = variants.some((v) => v.id === parsed.activeId)
            ? parsed.activeId
            : variants[0].id;
          return { activeId, variants };
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
 * Persist the whole store.
 *
 * Returns `{ ok: boolean, merged: store|null }`.
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

    if (adopted > 0) {
      toWrite = { ...store, variants: combined };
      merged = toWrite;
    }
  }

  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(toWrite));
    return { ok: true, merged };
  } catch (e) {
    console.error('Error saving resume store:', e);
    return { ok: false, merged: null };
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
 * Remove a variant. Refuses to remove the last one so the app always has
 * something to edit. Returns the new store, or the original if refused.
 *
 * An imported backup can contain duplicate ids. Filtering by id would then
 * remove every copy, leaving an empty list and crashing the next read, so
 * removal is by index of the first match.
 */
export function removeVariant(store, variantId) {
  if (!Array.isArray(store.variants) || store.variants.length <= 1) return store;

  const index = store.variants.findIndex((v) => v && v.id === variantId);
  if (index === -1) return store;

  const variants = store.variants.filter((_, i) => i !== index);
  // Defensive: filter above can only shrink by one, but never hand back an
  // empty list to the rest of the app.
  if (variants.length === 0) return store;

  const activeStillExists = variants.some((v) => v && v.id === store.activeId);
  const activeId = activeStillExists ? store.activeId : variants[0].id;
  return { activeId, variants };
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
