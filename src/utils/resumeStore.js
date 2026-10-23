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

/** Normalise resume data so every collection is a real array. */
export function normalizeResume(data) {
  const base = deepClone(INITIAL_RESUME_DATA);
  if (!data || typeof data !== 'object') return base;
  const merged = { ...base, ...data };
  merged.personalInfo = { ...base.personalInfo, ...(data.personalInfo || {}) };
  for (const key of [
    'skills',
    'experience',
    'education',
    'languages',
    'certifications',
    'projects',
    'customSections',
  ]) {
    merged[key] = Array.isArray(data[key]) ? data[key] : [];
  }
  merged.summary = typeof data.summary === 'string' ? data.summary : '';
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
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.variants) && parsed.variants.length > 0) {
        const variants = parsed.variants.map((v) => ({
          ...v,
          data: normalizeResume(v.data),
          theme: normalizeTheme(v.theme),
        }));
        const activeId = variants.some((v) => v.id === parsed.activeId)
          ? parsed.activeId
          : variants[0].id;
        return { activeId, variants };
      }
    }
  } catch (e) {
    console.error('Error reading resume store:', e);
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

/** Persist the whole store. Returns false if storage is unavailable. */
export function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    return true;
  } catch (e) {
    console.error('Error saving resume store:', e);
    return false;
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
 */
export function removeVariant(store, variantId) {
  if (store.variants.length <= 1) return store;
  const variants = store.variants.filter((v) => v.id !== variantId);
  const activeId =
    store.activeId === variantId ? variants[0].id : store.activeId;
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
