/**
 * Bounded undo/redo stack.
 *
 * Framework-free and dependency-free on purpose: the whole thing is a pair of
 * arrays plus a pointer, so it can be unit-tested without a DOM and reasoned
 * about without React in the room.
 *
 * Snapshot shape is the caller's business. This module only compares them, and
 * it does so cheaply: identical references are free, and anything else costs one
 * JSON.stringify.
 */

/**
 * Stable comparison key for a snapshot.
 *
 * JSON.stringify is used rather than a deep-equal walk because snapshots are
 * plain data (resume + theme) and serialising once per push is far cheaper than
 * a recursive compare over every array in a resume. Returns null when the value
 * cannot be serialised (cyclic, BigInt, throwing toJSON); callers treat null as
 * "always different" so an uncomparable snapshot is never silently swallowed.
 */
function snapshotKey(snapshot) {
  try {
    return JSON.stringify(snapshot) ?? null;
  } catch (e) {
    return null;
  }
}

export function createHistory(limit = 50) {
  // A limit below 1 would make undo impossible; clamp rather than throw.
  const max = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : 50;

  let stack = [];
  let index = -1;
  let lastKey = null;

  const canUndo = () => index > 0;
  const canRedo = () => index >= 0 && index < stack.length - 1;

  /**
   * Record a snapshot. Pushing after an undo discards the redo branch, which is
   * the standard behaviour every editor has.
   */
  function push(snapshot) {
    const key = snapshotKey(snapshot);

    // Coalesce: the same state twice is one edit, not two. Reference equality
    // short-circuits the common case (same object pushed twice) before paying
    // for a stringify.
    if (stack[index] === snapshot) return false;
    if (key !== null && key === lastKey) return false;

    // Drop the redo branch, then append.
    if (index < stack.length - 1) stack = stack.slice(0, index + 1);
    stack.push(snapshot);

    // Evict from the front so memory stays bounded at `max`.
    if (stack.length > max) stack = stack.slice(stack.length - max);

    index = stack.length - 1;
    lastKey = key;
    return true;
  }

  /** Step back one entry. Returns the snapshot to restore, or null at the bottom. */
  function undo() {
    if (!canUndo()) return null;
    index -= 1;
    lastKey = snapshotKey(stack[index]);
    return stack[index];
  }

  /** Step forward one entry. Returns the snapshot to restore, or null at the top. */
  function redo() {
    if (!canRedo()) return null;
    index += 1;
    lastKey = snapshotKey(stack[index]);
    return stack[index];
  }

  /**
   * Clear both stacks and start again from `snapshot`.
   *
   * Used when the history belongs to a different document (variant switch,
   * import, tab merge) — carrying entries across documents would let an undo
   * paste one resume's data into another.
   */
  function reset(snapshot) {
    stack = snapshot === undefined ? [] : [snapshot];
    index = stack.length - 1;
    lastKey = snapshot === undefined ? null : snapshotKey(snapshot);
  }

  return {
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    /** Diagnostics for tests and debugging; not used by the app. */
    size: () => stack.length,
    position: () => index,
    limit: max,
  };
}

/**
 * True when the element the user is typing in should keep its native undo.
 *
 * Ctrl+Z inside a text field means "undo my typing", and hijacking it to revert
 * the whole resume is the kind of bug that makes an app feel broken. Covers
 * input, textarea, select and contenteditable — including the rich-text
 * `role="textbox"` case some editors use.
 */
export function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false;
  const tag = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  const role = typeof target.getAttribute === 'function' ? target.getAttribute('role') : null;
  return role === 'textbox' || role === 'searchbox';
}
