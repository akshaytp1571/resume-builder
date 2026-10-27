/**
 * Self-check for soft delete, restore and expiry.
 *
 * Run: node --experimental-strip-types src/utils/trash.selfcheck.mjs
 * (plain node is fine — nothing here needs TS)
 *
 * The store module touches localStorage at import time only inside functions,
 * so it imports cleanly under node.
 */

import assert from 'node:assert/strict';
import {
  removeVariant,
  restoreVariant,
  purgeVariant,
  emptyTrash,
  getTrash,
  purgeExpiredTrash,
  TRASH_RETENTION_DAYS,
} from './resumeStore.js';

const v = (id) => ({ id, name: id, data: {}, theme: {} });
const base = () => ({ activeId: 'a', variants: [v('a'), v('b'), v('c')] });

// --- 1. delete moves to trash, does not destroy
{
  const s = removeVariant(base(), 'b');
  assert.equal(s.variants.length, 2, 'variant should leave the list');
  assert.ok(!s.variants.some((x) => x.id === 'b'), 'deleted id still in list');
  assert.equal(getTrash(s).length, 1, 'should be in trash');
  assert.equal(getTrash(s)[0].id, 'b');
  assert.ok(getTrash(s)[0].deletedAt, 'deletedAt missing');
}

// --- 2. deleting the active variant reassigns active
{
  const s = removeVariant(base(), 'a');
  assert.notEqual(s.activeId, 'a', 'active should move off a deleted variant');
  assert.ok(s.variants.some((x) => x.id === s.activeId), 'active must exist');
}

// --- 3. deleting a non-active variant leaves active alone
{
  const s = removeVariant(base(), 'c');
  assert.equal(s.activeId, 'a', 'active must not change');
}

// --- 4. refuses to delete the last one
{
  const one = { activeId: 'a', variants: [v('a')], trash: [] };
  assert.equal(removeVariant(one, 'a'), one, 'should return the same store');
}

// --- 5. unknown id is a no-op
{
  const s = base();
  assert.equal(removeVariant(s, 'zzz'), s);
}

// --- 6. trash is newest-first
{
  const s1 = removeVariant(base(), 'a');
  const s2 = removeVariant({ ...s1, activeId: 'b' }, 'b');
  assert.equal(getTrash(s2)[0].id, 'b', 'newest delete should lead the trash');
}

// --- 7. restore returns it with a FRESH id and clears deletedAt
{
  const s = removeVariant(base(), 'b');
  const r = restoreVariant(s, 'b');
  assert.equal(r.variants.length, 3, 'should be back in the list');
  assert.equal(getTrash(r).length, 0, 'should have left the trash');
  const back = r.variants.find((x) => x.name === 'b');
  assert.ok(back, 'restored variant missing');
  assert.notEqual(back.id, 'b', 'id must be regenerated');
  assert.equal(back.deletedAt, undefined, 'deletedAt must be cleared');
  assert.equal(r.activeId, back.id, 'restored variant should become active');
}

// --- 8. two restores of the same-named resumes never share an id
{
  let s = removeVariant(base(), 'b');
  s = removeVariant(s, 'c');
  s = restoreVariant(s, 'b');
  s = restoreVariant(s, 'c');
  const ids = s.variants.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, 'ids must be unique after restore');
}

// --- 9. purge removes one, empty removes all
{
  const s = removeVariant(base(), 'b');
  const p = purgeVariant(s, 'b');
  assert.equal(getTrash(p).length, 0, 'purge should remove it');
  assert.equal(p.variants.length, 2, 'purge must not touch the live list');

  const both = removeVariant(removeVariant(base(), 'a'), 'b');
  const e = emptyTrash(both);
  assert.equal(getTrash(e).length, 0, 'emptyTrash should clear');
  assert.equal(e.variants.length, 1, 'emptyTrash must not touch the live list');
}

// --- 10. expiry: old entries dropped, recent kept, malformed kept
{
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const keep = { id: 'new', deletedAt: new Date(now - day).toISOString() };
  const drop = { id: 'old', deletedAt: new Date(now - (TRASH_RETENTION_DAYS + 1) * day).toISOString() };
  const junk = { id: 'junk', deletedAt: 'not-a-date' };
  const out = purgeExpiredTrash([keep, drop, junk, null, 'nope']);
  assert.deepEqual(out.map((x) => x.id), ['new', 'junk'], 'expiry rules wrong');
  assert.ok(TRASH_RETENTION_DAYS >= 30, 'retention should be at least 30 days');
}

// --- 11. delete writes the store shape the rest of the app expects
{
  const s = removeVariant(base(), 'b');
  assert.ok(Array.isArray(s.variants), 'variants must stay an array');
  assert.ok(Array.isArray(s.trash), 'trash must be an array');
  assert.equal(typeof s.activeId, 'string', 'activeId must stay a string');
}

// --- 12. a store with no trash array still works (upgrade path)
{
  const s = removeVariant({ activeId: 'a', variants: [v('a'), v('b')] }, 'b');
  assert.equal(getTrash(s).length, 1, 'missing trash array should be tolerated');
}

console.log('trash: all checks passed');
