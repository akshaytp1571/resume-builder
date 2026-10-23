import { describe, it, expect } from 'vitest';
import { createHistory, isEditableTarget } from '../utils/history.js';

/**
 * Unit tests for the undo stack.
 *
 * These are deliberately behavioural: they drive the public API the same way
 * App.jsx does, so a refactor of the internals cannot make them pass by
 * accident.
 */

describe('createHistory: push / undo / redo round-trip', () => {
  it('walks back and forward through pushed snapshots', () => {
    const h = createHistory(10);

    h.push({ n: 1 });
    h.push({ n: 2 });
    h.push({ n: 3 });

    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);

    expect(h.undo()).toEqual({ n: 2 });
    expect(h.undo()).toEqual({ n: 1 });
    expect(h.canUndo()).toBe(false);

    expect(h.redo()).toEqual({ n: 2 });
    expect(h.redo()).toEqual({ n: 3 });
    expect(h.canRedo()).toBe(false);
  });

  it('returns the actual snapshot objects, not clones', () => {
    const h = createHistory(5);
    const a = { n: 1 };
    const b = { n: 2 };
    h.push(a);
    h.push(b);
    expect(h.undo()).toBe(a);
    expect(h.redo()).toBe(b);
  });
});

describe('createHistory: redo branch', () => {
  it('is cleared by a new push', () => {
    const h = createHistory(10);
    h.push({ n: 1 });
    h.push({ n: 2 });
    h.undo();
    expect(h.canRedo()).toBe(true);

    h.push({ n: 3 });
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toEqual({ n: 1 });
    expect(h.redo()).toEqual({ n: 3 });
  });
});

describe('createHistory: bounded memory', () => {
  it('keeps only `limit` entries when pushed past the limit', () => {
    const h = createHistory(10);
    for (let i = 0; i < 100; i++) h.push({ n: i });

    expect(h.size()).toBe(10);
    expect(h.limit).toBe(10);

    // The ten newest survive: 90..99.
    const seen = [];
    while (h.canUndo()) seen.push(h.undo().n);
    expect(seen).toEqual([98, 97, 96, 95, 94, 93, 92, 91, 90]);
  });

  it('evicts the oldest, never the newest', () => {
    const h = createHistory(3);
    h.push({ n: 1 });
    h.push({ n: 2 });
    h.push({ n: 3 });
    h.push({ n: 4 });
    expect(h.size()).toBe(3);
    expect(h.undo()).toEqual({ n: 3 });
    expect(h.undo()).toEqual({ n: 2 });
    expect(h.canUndo()).toBe(false);
  });

  it('clamps a nonsense limit instead of throwing', () => {
    expect(createHistory(0).limit).toBe(50);
    expect(createHistory(-5).limit).toBe(50);
    expect(createHistory(undefined).limit).toBe(50);
    expect(createHistory(Number.NaN).limit).toBe(50);
  });
});

describe('createHistory: edges return null, never throw', () => {
  it('undo at the bottom returns null', () => {
    const h = createHistory(5);
    expect(() => h.undo()).not.toThrow();
    expect(h.undo()).toBeNull();

    h.push({ n: 1 });
    expect(h.undo()).toBeNull();
  });

  it('redo at the top returns null', () => {
    const h = createHistory(5);
    expect(() => h.redo()).not.toThrow();
    expect(h.redo()).toBeNull();

    h.push({ n: 1 });
    h.push({ n: 2 });
    expect(h.redo()).toBeNull();
  });
});

describe('createHistory: coalescing', () => {
  it('ignores an identical snapshot pushed twice', () => {
    const h = createHistory(10);
    expect(h.push({ n: 1 })).toBe(true);
    expect(h.push({ n: 1 })).toBe(false);
    expect(h.size()).toBe(1);
  });

  it('ignores the same reference pushed twice', () => {
    const h = createHistory(10);
    const snap = { n: 1 };
    h.push(snap);
    h.push(snap);
    expect(h.size()).toBe(1);
  });

  it('records a genuinely different snapshot', () => {
    const h = createHistory(10);
    h.push({ n: 1 });
    h.push({ n: 2 });
    expect(h.size()).toBe(2);
  });

  it('does not swallow distinct unserialisable snapshots', () => {
    const h = createHistory(10);
    const a = {};
    a.self = a;
    const b = {};
    b.self = b;
    // Neither can be stringified, so they must be treated as always-different
    // rather than silently merged away.
    expect(h.push(a)).toBe(true);
    expect(h.push(b)).toBe(true);
    expect(h.size()).toBe(2);
  });

  it('still coalesces an unserialisable snapshot pushed by reference', () => {
    const h = createHistory(10);
    const cyclic = {};
    cyclic.self = cyclic;
    h.push(cyclic);
    h.push(cyclic);
    expect(h.size()).toBe(1);
  });

  it('a coalesced push does not clear the redo branch', () => {
    const h = createHistory(10);
    h.push({ n: 1 });
    h.push({ n: 2 });
    h.undo();
    h.push({ n: 1 }); // identical to the entry we just undid to
    expect(h.canRedo()).toBe(true);
  });
});

describe('createHistory: reset', () => {
  it('clears both stacks and seeds a new baseline', () => {
    const h = createHistory(10);
    h.push({ n: 1 });
    h.push({ n: 2 });
    h.push({ n: 3 });
    h.undo();
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(true);

    h.reset({ n: 99 });
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.size()).toBe(1);
    expect(h.undo()).toBeNull();
  });

  it('reset with no argument leaves an empty stack', () => {
    const h = createHistory(10);
    h.push({ n: 1 });
    h.reset();
    expect(h.size()).toBe(0);
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
  });

  it('allows pushing after reset', () => {
    const h = createHistory(10);
    h.push({ n: 1 });
    h.reset({ n: 1 });
    // Identical to the reset baseline, so coalesced.
    expect(h.push({ n: 1 })).toBe(false);
    expect(h.push({ n: 2 })).toBe(true);
    expect(h.undo()).toEqual({ n: 1 });
  });
});

describe('isEditableTarget', () => {
  it('treats form fields as editable', () => {
    const make = (tag, extra = {}) => ({ tagName: tag, ...extra });
    expect(isEditableTarget(make('INPUT'))).toBe(true);
    expect(isEditableTarget(make('TEXTAREA'))).toBe(true);
    expect(isEditableTarget(make('SELECT'))).toBe(true);
    expect(isEditableTarget(make('input'))).toBe(true);
  });

  it('treats contenteditable and textbox roles as editable', () => {
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(
      isEditableTarget({ tagName: 'DIV', getAttribute: () => 'textbox' })
    ).toBe(true);
  });

  it('treats buttons and the document body as non-editable', () => {
    expect(isEditableTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isEditableTarget({ tagName: 'BODY' })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined)).toBe(false);
  });
});
