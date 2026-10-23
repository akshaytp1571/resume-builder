import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useToasts, { TOAST_DURATION_MS } from '../hooks/useToasts.js';
import useResumeStore from '../hooks/useResumeStore.js';
import useUndoRedo, { snapshotOfStore } from '../hooks/useUndoRedo.js';
import useApplications from '../hooks/useApplications.js';
import useLayoutMeasurement from '../hooks/useLayoutMeasurement.js';
import { addApplication, loadApplications, countApplications } from '../utils/applicationTracker.js';
import { getActiveVariant, updateVariant } from '../utils/resumeStore.js';

/**
 * Tests for the App.jsx hook extraction.
 *
 * These are the guards that used to live inline in a 900-line component. Each
 * one pins behaviour that a future refactor could quietly break: the toast
 * timer, the restore guard that keeps redo alive, and the merge notice that
 * must not reset history.
 */

describe('useToasts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts with no toast', () => {
    const { result } = renderHook(() => useToasts());
    expect(result.current.toast).toBeNull();
  });

  it('shows a toast and auto-dismisses after the timeout', () => {
    const { result } = renderHook(() => useToasts());

    act(() => result.current.showToast('success', 'Saved'));
    expect(result.current.toast).toEqual({ type: 'success', message: 'Saved' });

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(result.current.toast).not.toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toast).toBeNull();
  });

  it('re-arms the timer when a second toast replaces the first', () => {
    const { result } = renderHook(() => useToasts());

    act(() => result.current.showToast('info', 'One'));
    act(() => vi.advanceTimersByTime(3000));

    act(() => result.current.showToast('error', 'Two'));
    act(() => vi.advanceTimersByTime(3000));
    // Would have expired on the first toast's schedule; the second is fresh.
    expect(result.current.toast).toEqual({ type: 'error', message: 'Two' });

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS));
    expect(result.current.toast).toBeNull();
  });

  it('clears the timer on unmount so it cannot set state afterwards', () => {
    const { result, unmount } = renderHook(() => useToasts());
    act(() => result.current.showToast('info', 'Bye'));
    unmount();
    // Advancing past the timeout must not throw a "setState on unmounted" warning.
    expect(() => act(() => vi.advanceTimersByTime(TOAST_DURATION_MS * 2))).not.toThrow();
  });

  it('clears immediately on demand', () => {
    const { result } = renderHook(() => useToasts());
    act(() => result.current.showToast('info', 'Hi'));
    act(() => result.current.clearToast());
    expect(result.current.toast).toBeNull();
  });
});

describe('useResumeStore', () => {
  it('loads a store with one active variant', () => {
    const { result } = renderHook(() => useResumeStore({ showToast: vi.fn() }));
    expect(result.current.store.variants.length).toBe(1);
    expect(result.current.activeVariant).toBeTruthy();
    expect(result.current.resumeData).toBeTruthy();
    expect(result.current.theme).toBeTruthy();
  });

  it('setResumeData updates the active variant only', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useResumeStore({ showToast }));

    // Add a second variant so "only the active one" is a meaningful assertion.
    act(() => result.current.handleCreateVariant());
    expect(result.current.store.variants.length).toBe(2);

    const activeId = result.current.store.activeId;
    const otherId = result.current.store.variants.find((v) => v.id !== activeId).id;
    const otherBefore = result.current.store.variants.find((v) => v.id === otherId).data.summary;

    act(() => result.current.setResumeData((prev) => ({ ...prev, summary: 'CHANGED' })));

    const after = result.current.store;
    expect(after.variants.find((v) => v.id === activeId).data.summary).toBe('CHANGED');
    expect(after.variants.find((v) => v.id === otherId).data.summary).toBe(otherBefore);
  });

  it('setLetter writes to the active variant without touching its data', () => {
    const { result } = renderHook(() => useResumeStore({ showToast: vi.fn() }));
    const before = result.current.resumeData.summary;
    act(() => result.current.setLetter((prev) => ({ ...prev, body: 'Dear team,' })));
    expect(result.current.activeVariant.letter.body).toBe('Dear team,');
    expect(result.current.resumeData.summary).toBe(before);
  });

  it('refuses to delete the last variant and warns', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useResumeStore({ showToast }));
    act(() => result.current.handleDeleteVariant(result.current.store.activeId));
    expect(result.current.store.variants.length).toBe(1);
    expect(showToast).toHaveBeenCalledWith('error', expect.stringContaining('ONLY REMAINING'));
  });

  it('calls resetHistory on every variant switch', () => {
    const resetHistoryRef = { current: vi.fn() };
    const { result } = renderHook(() => useResumeStore({ showToast: vi.fn(), resetHistoryRef }));

    act(() => result.current.handleCreateVariant());
    expect(resetHistoryRef.current).toHaveBeenCalled();

    resetHistoryRef.current.mockClear();
    const otherId = result.current.store.variants.find(
      (v) => v.id !== result.current.store.activeId
    ).id;
    act(() => result.current.handleSelectVariant(otherId));
    expect(resetHistoryRef.current).toHaveBeenCalledTimes(1);
  });

  it('does not call resetHistory when renaming (name is not part of history)', () => {
    const resetHistoryRef = { current: vi.fn() };
    const { result } = renderHook(() => useResumeStore({ showToast: vi.fn(), resetHistoryRef }));
    act(() => result.current.handleRenameVariant(result.current.store.activeId, 'Renamed'));
    expect(resetHistoryRef.current).not.toHaveBeenCalled();
    expect(result.current.activeVariant.name).toBe('Renamed');
  });

  it('ignores a blank rename', () => {
    const { result } = renderHook(() => useResumeStore({ showToast: vi.fn() }));
    const before = result.current.activeVariant.name;
    act(() => result.current.handleRenameVariant(result.current.store.activeId, '   '));
    expect(result.current.activeVariant.name).toBe(before);
  });

  it('survives being called without any arguments', () => {
    expect(() => renderHook(() => useResumeStore())).not.toThrow();
  });
});

describe('useUndoRedo', () => {
  /** Mount the real store + history pair the way App does. */
  const mountPair = () => {
    return renderHook(() => {
      const resetHistoryRef = { current: null };
      const storeApi = useResumeStore({ showToast: vi.fn(), resetHistoryRef });
      const historyApi = useUndoRedo({
        store: storeApi.store,
        setStore: storeApi.setStore,
        showToast: vi.fn(),
      });
      resetHistoryRef.current = historyApi.resetHistory;
      return { ...storeApi, ...historyApi };
    });
  };

  it('starts with nothing to undo or redo', () => {
    const { result } = mountPair();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo restores the previous resume data', async () => {
    const { result } = mountPair();
    const original = result.current.resumeData.summary;

    act(() => result.current.setResumeData((prev) => ({ ...prev, summary: 'EDIT ONE' })));
    // The history debounce is 600ms; wait for the push to land.
    await act(() => new Promise((r) => setTimeout(r, 750)));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.handleUndo());
    expect(result.current.resumeData.summary).toBe(original);
  });

  it('keeps redo available after an undo (the restoringRef guard)', async () => {
    const { result } = mountPair();

    act(() => result.current.setResumeData((prev) => ({ ...prev, summary: 'EDIT ONE' })));
    await act(() => new Promise((r) => setTimeout(r, 750)));

    act(() => result.current.handleUndo());
    // Without restoringRef the restore's setStore re-arms the debounce, pushes
    // the restored state and clears the redo branch.
    await act(() => new Promise((r) => setTimeout(r, 750)));

    expect(result.current.canRedo).toBe(true);

    act(() => result.current.handleRedo());
    expect(result.current.resumeData.summary).toBe('EDIT ONE');
  });

  it('does not record an undo as a new history entry', async () => {
    const { result } = mountPair();

    act(() => result.current.setResumeData((prev) => ({ ...prev, summary: 'EDIT ONE' })));
    await act(() => new Promise((r) => setTimeout(r, 750)));

    act(() => result.current.handleUndo());
    await act(() => new Promise((r) => setTimeout(r, 750)));

    // If the restore had been pushed, this undo would land on itself.
    expect(result.current.canUndo).toBe(false);
  });

  it('resetHistory clears both stacks', async () => {
    const { result } = mountPair();

    act(() => result.current.setResumeData((prev) => ({ ...prev, summary: 'EDIT ONE' })));
    await act(() => new Promise((r) => setTimeout(r, 750)));
    act(() => result.current.handleUndo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.resetHistory(result.current.store));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo at the bottom returns false and does not throw', () => {
    const { result } = mountPair();
    let returned;
    act(() => {
      returned = result.current.handleUndo();
    });
    expect(returned).toBe(false);
  });

  it('ignores Ctrl+Z while focus is in a text field', () => {
    const { result } = mountPair();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
      );
    });
    expect(result.current.canUndo).toBe(false);

    input.remove();
  });

  it('snapshotOfStore excludes name and letter', () => {
    const store = {
      activeId: 'a',
      variants: [
        {
          id: 'a',
          name: 'Named',
          data: { summary: 's' },
          theme: { templateId: 'modern' },
          letter: { body: 'letter' },
        },
      ],
    };
    expect(snapshotOfStore(store)).toEqual({
      id: 'a',
      data: { summary: 's' },
      theme: { templateId: 'modern' },
    });
    expect(snapshotOfStore(null)).toBeNull();
  });

  it('survives being called without arguments', () => {
    expect(() => renderHook(() => useUndoRedo())).not.toThrow();
  });
});

describe('useApplications', () => {
  it('starts closed with the stored count', () => {
    const { result } = renderHook(() => useApplications());
    expect(result.current.isTrackerOpen).toBe(false);
    expect(result.current.applicationCount).toBe(countApplications());
  });

  it('count updates after an application is added', () => {
    const { result } = renderHook(() => useApplications());
    const before = result.current.applicationCount;

    act(() => {
      addApplication({ company: 'Acme', role: 'QA Lead', variantId: 'v1' });
    });
    act(() => result.current.refreshApplicationCount());

    expect(result.current.applicationCount).toBe(before + 1);
  });

  it('updateApplications replaces the list and refreshes the count', () => {
    const { result } = renderHook(() => useApplications());
    const list = loadApplications();

    act(() => result.current.updateApplications(list));
    expect(result.current.applications).toEqual(list);
    expect(result.current.applicationCount).toBe(countApplications());
  });

  it('opens and closes the tracker', () => {
    const { result } = renderHook(() => useApplications());
    act(() => result.current.openTracker());
    expect(result.current.isTrackerOpen).toBe(true);
    act(() => result.current.closeTracker());
    expect(result.current.isTrackerOpen).toBe(false);
  });
});

describe('useLayoutMeasurement', () => {
  it('starts unmeasured so the ATS scorer uses its legacy path', () => {
    const { result } = renderHook(() => useLayoutMeasurement());
    expect(result.current.layout).toBeNull();
  });

  it('records a measurement', () => {
    const { result } = renderHook(() => useLayoutMeasurement());
    const measurement = { pageHeightPx: 1123, pageBudgetPx: 1123 };
    act(() => result.current.handleLayoutMeasured(measurement));
    expect(result.current.layout).toEqual(measurement);
  });

  it('ignores an identical measurement so the measure loop cannot spin', () => {
    const { result } = renderHook(() => useLayoutMeasurement());
    const first = { pageHeightPx: 1123, pageBudgetPx: 1123 };
    act(() => result.current.handleLayoutMeasured(first));

    const second = { pageHeightPx: 1123, pageBudgetPx: 1123 };
    act(() => result.current.handleLayoutMeasured(second));

    // Same object identity proves no state update happened.
    expect(result.current.layout).toBe(first);
  });

  it('accepts a genuinely different measurement', () => {
    const { result } = renderHook(() => useLayoutMeasurement());
    act(() => result.current.handleLayoutMeasured({ pageHeightPx: 1123, pageBudgetPx: 1123 }));
    act(() => result.current.handleLayoutMeasured({ pageHeightPx: 2246, pageBudgetPx: 1123 }));
    expect(result.current.layout.pageHeightPx).toBe(2246);
  });

  it('ignores a malformed measurement instead of storing garbage', () => {
    const { result } = renderHook(() => useLayoutMeasurement());
    const good = { pageHeightPx: 1123, pageBudgetPx: 1123 };
    act(() => result.current.handleLayoutMeasured(good));
    act(() => result.current.handleLayoutMeasured(null));
    act(() => result.current.handleLayoutMeasured('nope'));
    expect(result.current.layout).toEqual(good);
  });
});
