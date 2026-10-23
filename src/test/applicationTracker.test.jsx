import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ApplyModal from '../components/ui/ApplyModal.jsx';
import ApplicationTracker from '../components/ui/ApplicationTracker.jsx';
import Navbar from '../components/ui/Navbar.jsx';
import {
  loadApplications,
  saveApplications,
  addApplication,
  updateApplication,
  removeApplication,
  computeStats,
  pruneOrphanedVariants,
  countApplications,
  STATUSES,
} from '../utils/applicationTracker.js';

// The agent is mocked so each test controls exactly what it reports back.
vi.mock('../utils/applyService.js', () => ({
  // A prepared form always reports status 'filled' - ApplyModal reads .status.
  prepareApplication: vi.fn().mockResolvedValue({ status: 'filled', filled: [], needsHuman: [] }),
  submitApplication: vi.fn(),
  generateCoverLetter: vi.fn(),
  isApplyAgentOnline: vi.fn().mockResolvedValue(true),
}));

const { submitApplication, isApplyAgentOnline } = await import('../utils/applyService.js');

const KEY = 'precision_applications_v1';

/**
 * These tests run against the MemoryStorage stub in src/test/setup.js, which
 * is cleared before every test. The quota test swaps setItem out temporarily.
 */

beforeEach(() => {
  localStorage.clear();
});

function seed(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function baseRecord(overrides = {}) {
  return {
    company: 'Acme',
    title: 'QA Lead',
    url: 'https://acme.test/apply',
    appliedAt: '2026-03-01T10:00:00.000Z',
    status: 'applied',
    variantId: 'var-1',
    variantName: 'QA Resume',
    ...overrides,
  };
}

describe('add / load round-trip', () => {
  it('stores a record and reads it back with a generated id', () => {
    const stored = addApplication(baseRecord());

    expect(stored.id).toBeTruthy();
    expect(stored.company).toBe('Acme');

    const list = loadApplications();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(stored.id);
    expect(list[0].variantName).toBe('QA Resume');
  });

  it('defaults status to applied and stamps lastUpdatedAt', () => {
    const stored = addApplication(baseRecord({ status: 'not-a-status' }));
    expect(stored.status).toBe('applied');
    expect(stored.lastUpdatedAt).toBeTruthy();
  });

  it('returns newest first', () => {
    addApplication(baseRecord({ company: 'Old', appliedAt: '2026-01-01T00:00:00.000Z' }));
    addApplication(baseRecord({ company: 'New', appliedAt: '2026-06-01T00:00:00.000Z' }));

    const list = loadApplications();
    expect(list[0].company).toBe('New');
    expect(list[1].company).toBe('Old');
  });

  it('countApplications matches the list length', () => {
    expect(countApplications()).toBe(0);
    addApplication(baseRecord());
    addApplication(baseRecord({ company: 'Other' }));
    expect(countApplications()).toBe(2);
  });
});

describe('loadApplications tolerance', () => {
  it('returns [] when the key is missing', () => {
    expect(loadApplications()).toEqual([]);
  });

  it('returns [] on corrupt JSON instead of throwing', () => {
    localStorage.setItem(KEY, '{not valid json');
    expect(() => loadApplications()).not.toThrow();
    expect(loadApplications()).toEqual([]);
  });

  it('returns [] when the stored value is not an array', () => {
    localStorage.setItem(KEY, JSON.stringify({ nope: true }));
    expect(loadApplications()).toEqual([]);

    localStorage.setItem(KEY, JSON.stringify('a string'));
    expect(loadApplications()).toEqual([]);

    localStorage.setItem(KEY, JSON.stringify(null));
    expect(loadApplications()).toEqual([]);
  });

  it('survives records with missing or wrong-typed fields', () => {
    seed([
      { company: 'Has Only Company' },
      { company: 5, title: { nested: true }, status: 42 },
      null,
      undefined,
      'a string',
      [],
    ]);

    const list = loadApplications();
    // The two object records survive; the junk entries are dropped.
    expect(list.length).toBe(2);
    for (const record of list) {
      expect(typeof record.company).toBe('string');
      expect(typeof record.title).toBe('string');
      expect(STATUSES).toContain(record.status);
      expect(record.id).toBeTruthy();
    }
  });

  it('does not throw when localStorage.getItem itself throws', () => {
    const spy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    expect(() => loadApplications()).not.toThrow();
    expect(loadApplications()).toEqual([]);
    spy.mockRestore();
  });
});

describe('saveApplications', () => {
  it('returns { ok: true } on success', () => {
    expect(saveApplications([baseRecord()])).toEqual({ ok: true });
  });

  it('returns { ok: false } with an error when the write fails', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    });

    const res = saveApplications([baseRecord()]);

    expect(res.ok).toBe(false);
    expect(typeof res.error).toBe('string');

    spy.mockRestore();
  });

  it('rejects a non-array without throwing', () => {
    expect(saveApplications(null).ok).toBe(false);
    expect(saveApplications('nope').ok).toBe(false);
  });
});

describe('updateApplication', () => {
  it('patches the record and bumps lastUpdatedAt', () => {
    const stored = addApplication(baseRecord({ appliedAt: '2026-01-01T00:00:00.000Z' }));

    const updated = updateApplication(stored.id, { status: 'interview' });

    expect(updated.status).toBe('interview');
    expect(updated.id).toBe(stored.id);
    // Creation time is immutable; only lastUpdatedAt moves.
    expect(updated.appliedAt).toBe('2026-01-01T00:00:00.000Z');

    expect(loadApplications()[0].status).toBe('interview');
  });

  it('returns null for an unknown id', () => {
    expect(updateApplication('does-not-exist', { status: 'offer' })).toBeNull();
  });

  it('ignores an attempt to change id or appliedAt', () => {
    const stored = addApplication(baseRecord());
    const updated = updateApplication(stored.id, { id: 'hijacked', appliedAt: '1999-01-01T00:00:00.000Z' });

    expect(updated.id).toBe(stored.id);
    expect(updated.appliedAt).toBe(stored.appliedAt);
  });
});

describe('removeApplication', () => {
  it('removes only the requested record', () => {
    const a = addApplication(baseRecord({ company: 'Keep' }));
    const b = addApplication(baseRecord({ company: 'Delete' }));

    const remaining = removeApplication(b.id);

    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(a.id);
    expect(loadApplications()[0].company).toBe('Keep');
  });

  it('is a no-op for an unknown id', () => {
    addApplication(baseRecord());
    expect(removeApplication('nope')).toHaveLength(1);
  });
});

describe('computeStats', () => {
  it('returns zeros on an empty list, not NaN', () => {
    const stats = computeStats([]);

    expect(stats.total).toBe(0);
    expect(stats.activeCount).toBe(0);
    expect(stats.responseRate).toBe(0);
    expect(Number.isNaN(stats.responseRate)).toBe(false);
  });

  it('responseRate is 0 and finite when total is 0', () => {
    const stats = computeStats([]);
    expect(stats.responseRate).toBe(0);
    expect(Number.isFinite(stats.responseRate)).toBe(true);
  });

  it('handles null and undefined input', () => {
    expect(computeStats(null).total).toBe(0);
    expect(computeStats(undefined).responseRate).toBe(0);
    expect(computeStats('nope').total).toBe(0);
  });

  it('counts by status', () => {
    const stats = computeStats([
      { status: 'applied' },
      { status: 'applied' },
      { status: 'interview' },
      { status: 'offer' },
      { status: 'rejected' },
    ]);

    expect(stats.total).toBe(5);
    expect(stats.byStatus.applied).toBe(2);
    expect(stats.byStatus.interview).toBe(1);
    expect(stats.byStatus.offer).toBe(1);
    expect(stats.byStatus.rejected).toBe(1);
    expect(stats.byStatus.screening).toBe(0);
  });

  it('responseRate counts screening + interview + offer only', () => {
    const stats = computeStats([
      { status: 'applied' },
      { status: 'applied' },
      { status: 'screening' },
      { status: 'interview' },
    ]);

    // 2 responses out of 4.
    expect(stats.responseRate).toBe(0.5);
  });

  it('activeCount excludes rejected and withdrawn', () => {
    const stats = computeStats([
      { status: 'applied' },
      { status: 'interview' },
      { status: 'rejected' },
      { status: 'withdrawn' },
    ]);

    expect(stats.total).toBe(4);
    expect(stats.activeCount).toBe(2);
  });

  it('an unknown status falls back to applied rather than breaking the count', () => {
    const stats = computeStats([{ status: 'banana' }, { status: 'offer' }]);
    expect(stats.total).toBe(2);
    expect(stats.byStatus.applied).toBe(1);
    expect(stats.byStatus.offer).toBe(1);
  });

  it('every status is present in byStatus even at zero', () => {
    const stats = computeStats([{ status: 'applied' }]);
    for (const status of STATUSES) {
      expect(typeof stats.byStatus[status]).toBe('number');
    }
  });
});

describe('pruneOrphanedVariants', () => {
  const store = { activeId: 'var-1', variants: [{ id: 'var-1' }, { id: 'var-2' }] };

  it('marks records whose variant is gone instead of deleting them', () => {
    const list = [
      { id: 'a', variantId: 'var-1', company: 'Kept' },
      { id: 'b', variantId: 'deleted-variant', company: 'Orphaned' },
    ];

    const out = pruneOrphanedVariants(list, store);

    // Nothing is dropped - that is the whole point.
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.id === 'a').variantOrphaned).toBe(false);
    expect(out.find((r) => r.id === 'b').variantOrphaned).toBe(true);
    // The record itself is intact.
    expect(out.find((r) => r.id === 'b').company).toBe('Orphaned');
  });

  it('does not mutate the input list', () => {
    const list = [{ id: 'b', variantId: 'gone' }];
    pruneOrphanedVariants(list, store);
    expect(list[0].variantOrphaned).toBeUndefined();
  });

  it('treats a record with no variantId as not orphaned', () => {
    const out = pruneOrphanedVariants([{ id: 'a', variantId: '' }], store);
    expect(out[0].variantOrphaned).toBe(false);
  });

  it('leaves the list untouched when the store is missing', () => {
    const list = [{ id: 'a', variantId: 'var-1' }];
    // No variant store means nothing is known about variants, so nothing can be
    // judged orphaned. Records pass through unchanged rather than being stamped
    // false: a store that has not loaded yet must not mark everything.
    expect(pruneOrphanedVariants(list, null)).toHaveLength(1);
    expect(pruneOrphanedVariants(list, null)[0].variantOrphaned).toBeUndefined();
    expect(pruneOrphanedVariants(list, {})[0].variantOrphaned).toBeUndefined();
    expect(pruneOrphanedVariants(list, { variants: 'nope' })[0].variantOrphaned).toBeUndefined();
  });

  it('handles a hostile list without throwing', () => {
    expect(() => pruneOrphanedVariants(null, store)).not.toThrow();
    expect(pruneOrphanedVariants([null, undefined], store)).toEqual([]);
  });
});

describe('end-to-end', () => {
  it('a full add -> update -> prune -> remove cycle stays consistent', () => {
    const stored = addApplication(baseRecord({ variantId: 'var-1' }));
    expect(loadApplications()).toHaveLength(1);

    updateApplication(stored.id, { status: 'screening' });
    expect(loadApplications()[0].status).toBe('screening');

    // Simulate the user deleting that resume variant.
    const pruned = pruneOrphanedVariants(loadApplications(), { variants: [] });
    expect(pruned[0].variantOrphaned).toBe(true);
    expect(pruned).toHaveLength(1);

    saveApplications(pruned);
    expect(loadApplications()[0].variantOrphaned).toBe(true);

    removeApplication(stored.id);
    expect(loadApplications()).toEqual([]);
  });

  it('does not touch the variant store key', () => {
    addApplication(baseRecord());
    expect(localStorage.getItem('precision_resume_store_v2')).toBeNull();
  });
});

// ==== ApplyModal integration (mocked agent) ====

const job = {
  id: 'j1',
  title: 'QA Lead',
  company: 'Acme',
  applyUrl: 'https://acme.test/apply',
};

function renderModal(extra = {}) {
  return render(
    <ApplyModal
      isOpen
      onClose={() => {}}
      job={job}
      resumeData={{ personalInfo: { fullName: 'Alex' } }}
      activeVariantId="var-7"
      activeVariantName="QA Resume v2"
      {...extra}
    />
  );
}

/** Drive the modal to the result step, then double-submit. */
async function submitWith(agentResponse) {
  const onApplicationRecorded = vi.fn();
  submitApplication.mockResolvedValue(agentResponse);

  renderModal({ onApplicationRecorded });

  fireEvent.click(screen.getByRole('button', { name: /prepare application/i }));
  await waitFor(() => expect(screen.getByText(/application preview/i)).toBeInTheDocument());

  // Submitting needs two clicks (explicit double confirmation).
  fireEvent.click(screen.getByRole('button', { name: /submit application/i }));
  await waitFor(() => expect(screen.getByText(/click again to confirm/i)).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

  return { onApplicationRecorded };
}

describe('ApplyModal records applications', () => {
  it('records the application when the agent confirms submission', async () => {
    const { onApplicationRecorded } = await submitWith({ submitted: true, status: 'submitted' });

    await waitFor(() => expect(onApplicationRecorded).toHaveBeenCalledTimes(1));

    const list = loadApplications();
    expect(list).toHaveLength(1);
    expect(list[0].company).toBe('Acme');
    expect(list[0].title).toBe('QA Lead');
    expect(list[0].url).toBe('https://acme.test/apply');
    expect(list[0].status).toBe('applied');
  });

  it('records WHICH resume variant was used', async () => {
    await submitWith({ submitted: true, status: 'submitted' });
    await waitFor(() => expect(loadApplications()).toHaveLength(1));

    const [record] = loadApplications();
    expect(record.variantId).toBe('var-7');
    expect(record.variantName).toBe('QA Resume v2');
  });

  it('does NOT record when the form was only filled, not submitted', async () => {
    await submitWith({ status: 'filled', filled: [] });

    // Give any stray async work a chance to run before asserting absence.
    await new Promise((r) => setTimeout(r, 50));
    expect(loadApplications()).toEqual([]);
  });

  it('does NOT record a failed submission', async () => {
    await submitWith({ status: 'failed', error: 'The apply agent timed out.' });

    await new Promise((r) => setTimeout(r, 50));
    expect(loadApplications()).toEqual([]);
  });

  it('does NOT record a refused submission', async () => {
    await submitWith({ status: 'refused' });

    await new Promise((r) => setTimeout(r, 50));
    expect(loadApplications()).toEqual([]);
  });

  it('does NOT record when the agent is offline (failed, no submitted flag)', async () => {
    await submitWith({ status: 'failed', error: 'The apply agent service is not running.' });

    await new Promise((r) => setTimeout(r, 50));
    expect(loadApplications()).toEqual([]);
  });

  it('still calls the existing onSubmitted callback', async () => {
    const onSubmitted = vi.fn();
    submitApplication.mockResolvedValue({ submitted: true, status: 'submitted' });

    renderModal({ onSubmitted });

    fireEvent.click(screen.getByRole('button', { name: /prepare application/i }));
    await waitFor(() => expect(screen.getByText(/application preview/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));
    await waitFor(() => expect(screen.getByText(/click again to confirm/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
  });

  it('records an empty variant id gracefully when no variant is passed', async () => {
    submitApplication.mockResolvedValue({ submitted: true, status: 'submitted' });

    render(
      <ApplyModal
        isOpen
        onClose={() => {}}
        job={job}
        resumeData={{}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /prepare application/i }));
    await waitFor(() => expect(screen.getByText(/application preview/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));
    await waitFor(() => expect(screen.getByText(/click again to confirm/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => expect(loadApplications()).toHaveLength(1));
    expect(loadApplications()[0].variantId).toBe('');
  });
});

// ==== ApplicationTracker UI + Navbar entry point ====

/**
 * Smoke coverage for the two UI surfaces the tracker adds: the panel itself and
 * the Navbar entry point. These assert what a user can see and do, not internals.
 */

beforeEach(() => {
  localStorage.clear();
});

function seedTwo() {
  addApplication({
    company: 'Acme',
    title: 'QA Lead',
    url: 'https://acme.test/apply',
    appliedAt: '2026-03-01T10:00:00.000Z',
    variantId: 'v1',
    variantName: 'QA Resume',
  });
  addApplication({
    company: 'Globex',
    title: 'SDET',
    url: 'https://globex.test/apply',
    appliedAt: '2026-04-01T10:00:00.000Z',
    variantId: 'v2',
    variantName: 'Dev Resume',
  });
}

describe('ApplicationTracker panel', () => {
  it('renders an empty state that explains the feature', () => {
    render(<ApplicationTracker isOpen onClose={() => {}} applications={[]} />);
    expect(screen.getByText(/no applications yet/i)).toBeInTheDocument();
    expect(screen.getByText(/apply agent/i)).toBeInTheDocument();
  });

  it('lists applications with company, title and the resume used', () => {
    seedTwo();
    render(<ApplicationTracker isOpen onClose={() => {}} applications={loadApplications()} />);

    expect(screen.getByText('QA Lead')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText(/QA Resume/)).toBeInTheDocument();
    expect(screen.getByText(/Dev Resume/)).toBeInTheDocument();
  });

  it('shows the stats strip with a numeric response rate, never NaN', () => {
    seedTwo();
    render(<ApplicationTracker isOpen onClose={() => {}} applications={loadApplications()} />);

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Response rate')).toBeInTheDocument();
    // Both are 'applied', so 0% - and specifically the string "0%", not "NaN%".
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('changes status through the per-row select', () => {
    seedTwo();
    const list = loadApplications();
    const onListChange = vi.fn();

    render(
      <ApplicationTracker isOpen onClose={() => {}} applications={list} onListChange={onListChange} />
    );

    const select = screen.getByLabelText(`Status`, { selector: `#status-${list[0].id}` });
    fireEvent.change(select, { target: { value: 'interview' } });

    expect(onListChange).toHaveBeenCalled();
    const updated = loadApplications().find((a) => a.id === list[0].id);
    expect(updated.status).toBe('interview');
  });

  it('filters by status', () => {
    seedTwo();
    const list = loadApplications();
    updateApplication(list[0].id, { status: 'offer' });

    render(<ApplicationTracker isOpen onClose={() => {}} applications={loadApplications()} />);

    fireEvent.change(screen.getByLabelText(/filter/i), { target: { value: 'offer' } });

    expect(screen.getByText('Globex')).toBeInTheDocument();
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
  });

  it('requires two clicks to delete', () => {
    seedTwo();
    const list = loadApplications();

    render(<ApplicationTracker isOpen onClose={() => {}} applications={list} />);

    const del = screen.getByRole('button', { name: /delete the application to globex/i });
    fireEvent.click(del);

    // First click only arms the confirmation; nothing is gone yet.
    expect(loadApplications()).toHaveLength(2);
    expect(screen.getByText(/press confirm again/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm deleting the application to globex/i }));
    expect(loadApplications()).toHaveLength(1);
  });

  it('shows "resume since deleted" for an orphaned variant', () => {
    const list = [
      {
        id: 'x',
        company: 'Initech',
        title: 'Tester',
        url: '',
        appliedAt: '2026-05-01T00:00:00.000Z',
        status: 'applied',
        variantId: 'gone',
        variantName: 'Old Resume',
        notes: '',
        lastUpdatedAt: '2026-05-01T00:00:00.000Z',
        variantOrphaned: true,
      },
    ];

    render(<ApplicationTracker isOpen onClose={() => {}} applications={list} />);
    expect(screen.getByText(/has since been deleted/i)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <ApplicationTracker isOpen={false} onClose={() => {}} applications={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Navbar applications button', () => {
  const baseProps = {
    onDownloadPdf: () => {},
    onDownloadDocx: () => {},
    onPrint: () => {},
    onResetDefault: () => {},
    onOpenUpload: () => {},
    onOpenAts: () => {},
    onOpenAiConfig: () => {},
    onOpenJobMatch: () => {},
    aiConfig: {},
    atsScore: { score: 80 },
    isExporting: false,
    templateName: 'Classic',
  };

  it('renders with a count badge and a labelled control', () => {
    render(<Navbar {...baseProps} applicationCount={3} onOpenApplications={() => {}} />);

    expect(
      screen.getByRole('button', { name: /open application tracker, 3 applications recorded/i })
    ).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('hides the badge at zero but keeps the button usable', () => {
    const onOpen = vi.fn();
    render(<Navbar {...baseProps} applicationCount={0} onOpenApplications={onOpen} />);

    const btn = screen.getByRole('button', { name: /open application tracker/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalled();
  });

  it('uses the singular form for exactly one application', () => {
    render(<Navbar {...baseProps} applicationCount={1} onOpenApplications={() => {}} />);
    expect(
      screen.getByRole('button', { name: /1 application recorded/i })
    ).toBeInTheDocument();
  });
});
