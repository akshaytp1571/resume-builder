import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import React from 'react';
import GoogleDriveModal from '../components/ui/GoogleDriveModal.jsx';
import {
  isDriveConfigured,
  getClientId,
  isConnected,
  getAccessToken,
  disconnect,
  driveFilename,
  listFiles,
  uploadJson,
  downloadText,
  trashFile,
  __setTokenForTests,
} from '../utils/googleDrive.js';
import { fullResume } from './fixtures.js';

const store = { activeId: 'v1', variants: [{ id: 'v1', name: 'Mine' }] };

const base = {
  isOpen: true,
  onClose: () => {},
  store,
  resumeData: fullResume(),
  onImportStore: () => {},
};

beforeEach(() => {
  localStorage.clear();
  disconnect();
  delete import.meta.env.VITE_GOOGLE_CLIENT_ID;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('drive configuration', () => {
  it('reports unconfigured when no client id is set', () => {
    expect(getClientId()).toBe('');
    expect(isDriveConfigured()).toBe(false);
  });

  it('reports configured when a client id is set', () => {
    import.meta.env.VITE_GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    expect(isDriveConfigured()).toBe(true);
  });
});

describe('token handling', () => {
  it('starts disconnected', () => {
    expect(isConnected()).toBe(false);
    expect(getAccessToken()).toBeNull();
  });

  it('holds a token in memory after connecting', () => {
    __setTokenForTests('tok-123', 3600);
    expect(isConnected()).toBe(true);
    expect(getAccessToken()).toBe('tok-123');
  });

  it('treats a token inside its last minute as expired', () => {
    __setTokenForTests('tok-123', 30);
    expect(getAccessToken()).toBeNull();
    expect(isConnected()).toBe(false);
  });

  it('drops the token on disconnect', () => {
    __setTokenForTests('tok-123', 3600);
    disconnect();
    expect(getAccessToken()).toBeNull();
  });

  it('never writes the token to localStorage', () => {
    __setTokenForTests('super-secret-token', 3600);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      expect(localStorage.getItem(key)).not.toContain('super-secret-token');
    }
    // And nothing stored the token under any obvious key either.
    expect(localStorage.getItem('google_token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});

describe('REST calls refuse without a token', () => {
  it('listFiles throws NOT_CONNECTED rather than calling fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(listFiles()).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uploadJson throws NOT_CONNECTED', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(uploadJson('{}', 'x.json')).rejects.toMatchObject({
      code: 'NOT_CONNECTED',
    });
  });

  it('downloadText throws NOT_CONNECTED', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(downloadText('abc')).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });
});

describe('REST calls with a token', () => {
  it('sends a bearer token and parses the file list', async () => {
    __setTokenForTests('tok', 3600);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ files: [{ id: 'f1', name: 'a.json' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const files = await listFiles();
    expect(files).toEqual([{ id: 'f1', name: 'a.json' }]);
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer tok');
  });

  it('clears the token and reports EXPIRED on a 401', async () => {
    __setTokenForTests('tok', 3600);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }))
    );

    await expect(listFiles()).rejects.toMatchObject({ code: 'EXPIRED' });
    expect(isConnected()).toBe(false);
  });

  it('surfaces Google’s own error message', async () => {
    __setTokenForTests('tok', 3600);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'Insufficient permissions' } }),
      }))
    );

    await expect(listFiles()).rejects.toThrow(/Insufficient permissions/);
  });

  it('trashFile patches trashed:true rather than deleting', async () => {
    __setTokenForTests('tok', 3600);
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);

    await trashFile('f1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('files/f1');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({ trashed: true });
  });
});

describe('driveFilename', () => {
  it('produces a timestamped .json name', () => {
    const name = driveFilename(new Date('2026-10-23T12:34:56Z'));
    expect(name).toMatch(/^resume-backup-2026-10-23-12-34-56\.json$/);
  });
});

describe('GoogleDriveModal', () => {
  it('renders the dialog with a labelled title', () => {
    render(<GoogleDriveModal {...base} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Google Drive')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<GoogleDriveModal {...base} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('states the narrow scope before the user connects', () => {
    render(<GoogleDriveModal {...base} />);
    expect(screen.getByText(/drive\.file/)).toBeInTheDocument();
    expect(screen.getByText(/cannot read anything else/i)).toBeInTheDocument();
  });

  it('explains how to configure an unconfigured build', () => {
    render(<GoogleDriveModal {...base} />);
    expect(screen.getByText(/not configured for this build/i)).toBeInTheDocument();
    expect(screen.getByText(/VITE_GOOGLE_CLIENT_ID/)).toBeInTheDocument();
  });

  it('offers Connect when configured', () => {
    import.meta.env.VITE_GOOGLE_CLIENT_ID = 'test-client';
    render(<GoogleDriveModal {...base} />);
    expect(screen.getByRole('button', { name: /connect google drive/i })).toBeInTheDocument();
  });

  it('shows the backup actions once connected', async () => {
    import.meta.env.VITE_GOOGLE_CLIENT_ID = 'test-client';
    __setTokenForTests('tok', 3600);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ files: [] }) }))
    );

    render(<GoogleDriveModal {...base} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Scoped to the dialog: if a previous test's cleanup has not run, an
    // unscoped query can match two dialogs and fail for the wrong reason.
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/back up everything/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/export current resume/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/disconnect/i)).toBeInTheDocument();
  });

  it('every button has an accessible name', () => {
    import.meta.env.VITE_GOOGLE_CLIENT_ID = 'test-client';
    __setTokenForTests('tok', 3600);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ files: [] }) }))
    );
    render(<GoogleDriveModal {...base} />);
    for (const button of screen.getAllByRole('button')) {
      const named =
        button.textContent.trim().length > 0 || button.getAttribute('aria-label');
      expect(named).toBeTruthy();
    }
  });
});
