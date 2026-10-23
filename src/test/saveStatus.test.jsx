import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import useSaveStatus, {
  loadDefaultPointer,
  saveDefaultPointer,
  resolveDefault,
} from '../hooks/useSaveStatus.js';
import SaveStatus from '../components/ui/SaveStatus.jsx';

const DEFAULT_KEY = 'precision_resume_default_v1';

function Harness({ save, variantId = 'v1' }) {
  const s = useSaveStatus({ save, variantId, signature: variantId });
  return (
    <div>
      <span data-testid="status">{s.status}</span>
      <span data-testid="isDefault">{String(s.isDefault)}</span>
      <button onClick={s.saveNow}>save</button>
      <button onClick={s.setAsDefault}>pin</button>
      <button onClick={s.clearDefault}>unpin</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('default pointer storage', () => {
  it('round-trips a pointer', () => {
    saveDefaultPointer({ variantId: 'abc', savedAt: '2026-01-01T00:00:00Z' });
    expect(loadDefaultPointer()).toEqual({
      variantId: 'abc',
      savedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('returns null when nothing is stored', () => {
    expect(loadDefaultPointer()).toBeNull();
  });

  it('survives corrupt JSON', () => {
    localStorage.setItem(DEFAULT_KEY, '{{{not json');
    expect(loadDefaultPointer()).toBeNull();
  });

  it('survives a non-object value', () => {
    localStorage.setItem(DEFAULT_KEY, '"a string"');
    expect(loadDefaultPointer()).toBeNull();
  });

  it('clears with null', () => {
    saveDefaultPointer({ variantId: 'abc', savedAt: 'x' });
    saveDefaultPointer(null);
    expect(loadDefaultPointer()).toBeNull();
  });

  it('reports a quota failure rather than throwing', () => {
    // The test harness replaces globalThis.localStorage with a plain class, so
    // patching Storage.prototype would not be observed. Replace the instance
    // method instead.
    const original = localStorage.setItem;
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      const result = saveDefaultPointer({ variantId: 'a', savedAt: 'b' });
      expect(result.ok).toBe(false);
    } finally {
      localStorage.setItem = original;
    }
  });
});

describe('resolveDefault', () => {
  it('finds the pinned variant', () => {
    const store = { variants: [{ id: 'a' }, { id: 'b' }] };
    expect(resolveDefault({ variantId: 'b' }, store)).toEqual({ id: 'b' });
  });

  it('returns null when the pinned variant was deleted', () => {
    const store = { variants: [{ id: 'a' }] };
    expect(resolveDefault({ variantId: 'gone' }, store)).toBeNull();
  });

  it('returns null for a null pointer or store', () => {
    expect(resolveDefault(null, { variants: [] })).toBeNull();
    expect(resolveDefault({ variantId: 'a' }, null)).toBeNull();
  });
});

describe('useSaveStatus', () => {
  it('saves explicitly and reports success', async () => {
    const save = vi.fn(() => ({ ok: true }));
    render(<Harness save={save} />);

    await act(async () => {
      fireEvent.click(screen.getByText('save'));
    });

    expect(save).toHaveBeenCalled();
    expect(screen.getByTestId('status')).toHaveTextContent('saved');
  });

  it('reports a failed save instead of pretending it worked', async () => {
    const save = vi.fn(() => ({ ok: false }));
    render(<Harness save={save} />);

    await act(async () => {
      fireEvent.click(screen.getByText('save'));
    });

    expect(screen.getByTestId('status')).toHaveTextContent('failed');
  });

  it('reports a thrown save as failed, not as a crash', async () => {
    const save = vi.fn(() => {
      throw new Error('boom');
    });
    render(<Harness save={save} />);

    await act(async () => {
      fireEvent.click(screen.getByText('save'));
    });

    expect(screen.getByTestId('status')).toHaveTextContent('failed');
  });

  it('pins the current variant as default', async () => {
    const save = vi.fn(() => ({ ok: true }));
    render(<Harness save={save} variantId="variant-7" />);

    await act(async () => {
      fireEvent.click(screen.getByText('pin'));
    });

    expect(loadDefaultPointer().variantId).toBe('variant-7');
    expect(screen.getByTestId('isDefault')).toHaveTextContent('true');
  });

  it('pinning also saves, so the pinned data is on disk', async () => {
    const save = vi.fn(() => ({ ok: true }));
    render(<Harness save={save} />);

    await act(async () => {
      fireEvent.click(screen.getByText('pin'));
    });

    expect(save).toHaveBeenCalled();
  });

  it('unpins', async () => {
    saveDefaultPointer({ variantId: 'v1', savedAt: 'x' });
    const save = vi.fn(() => ({ ok: true }));
    render(<Harness save={save} variantId="v1" />);

    await act(async () => {
      fireEvent.click(screen.getByText('unpin'));
    });

    expect(loadDefaultPointer()).toBeNull();
    expect(screen.getByTestId('isDefault')).toHaveTextContent('false');
  });

  it('reflects the pin state of a different variant', () => {
    saveDefaultPointer({ variantId: 'other', savedAt: 'x' });
    const save = vi.fn(() => ({ ok: true }));
    render(<Harness save={save} variantId="v1" />);
    expect(screen.getByTestId('isDefault')).toHaveTextContent('false');
  });

  it('does not throw when variantId is missing', async () => {
    const save = vi.fn(() => ({ ok: true }));
    // `null`, not `undefined`: the Harness declares `variantId = 'v1'` as a
    // default parameter, so undefined would silently become 'v1' and this test
    // would pass without exercising the missing-id path at all.
    render(<Harness save={save} variantId={null} />);

    await act(async () => {
      fireEvent.click(screen.getByText('pin'));
    });
    // No variant, so no pin — and no crash.
    expect(loadDefaultPointer()).toBeNull();
  });
});

describe('SaveStatus component', () => {
  const base = {
    savedAt: null,
    isDefault: false,
    onSave: () => {},
    onSetDefault: () => {},
    onClearDefault: () => {},
  };

  it('shows a live region', () => {
    render(<SaveStatus {...base} status="saved" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('says Saved with a timestamp', () => {
    render(<SaveStatus {...base} status="saved" savedAt={new Date().toISOString()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/saved/i);
  });

  it('says Saving while in flight', () => {
    render(<SaveStatus {...base} status="saving" />);
    expect(screen.getByRole('status')).toHaveTextContent(/saving/i);
  });

  it('says Save failed, not something reassuring', () => {
    render(<SaveStatus {...base} status="failed" />);
    expect(screen.getByRole('status')).toHaveTextContent(/save failed/i);
  });

  it('offers Set default when not pinned', () => {
    render(<SaveStatus {...base} status="saved" isDefault={false} />);
    expect(screen.getByText('Set default')).toBeInTheDocument();
  });

  it('offers Default (unpin) when pinned', () => {
    render(<SaveStatus {...base} status="saved" isDefault />);
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('calls the right handler for each button', () => {
    const onSave = vi.fn();
    const onSetDefault = vi.fn();
    const onClearDefault = vi.fn();

    const { rerender } = render(
      <SaveStatus
        {...base}
        status="saved"
        isDefault={false}
        onSave={onSave}
        onSetDefault={onSetDefault}
      />
    );
    fireEvent.click(screen.getByText('Save'));
    fireEvent.click(screen.getByText('Set default'));
    expect(onSave).toHaveBeenCalled();
    expect(onSetDefault).toHaveBeenCalled();

    rerender(
      <SaveStatus
        {...base}
        status="saved"
        isDefault
        onSave={onSave}
        onClearDefault={onClearDefault}
      />
    );
    fireEvent.click(screen.getByText('Default'));
    expect(onClearDefault).toHaveBeenCalled();
  });

  it('every control has an accessible name', () => {
    render(<SaveStatus {...base} status="saved" />);
    for (const button of screen.getAllByRole('button')) {
      expect(button.textContent.trim().length).toBeGreaterThan(0);
    }
  });
});
