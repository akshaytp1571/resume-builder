import React, { useMemo, useState } from 'react';
import {
  ExternalLink,
  Trash2,
  X,
  CheckCircle2,
} from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/soundEffects';
import { Button, Chip, EmptyState } from './primitives';
import {
  STATUSES,
  computeStats,
  updateApplication,
  removeApplication,
} from '../../utils/applicationTracker';

/**
 * Status → chip tone. Colour carries state, but every chip also carries its
 * label as text so it never relies on hue alone.
 */
const STATUS_TONE = {
  applied: 'neutral',
  screening: 'neutral',
  interview: 'neutral',
  offer: 'present',
  rejected: 'missing',
  withdrawn: 'neutral',
};

const STATUS_LABELS = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function hostOf(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

/**
 * Application tracker panel.
 *
 * Controlled: the parent owns the list and persistence. This component renders
 * it and reports changes through onListChange so the parent can re-render
 * anything else that depends on the count (the Navbar badge).
 */
export default function ApplicationTracker({
  isOpen,
  onClose,
  applications = [],
  onListChange,
}) {
  const [filter, setFilter] = useState('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const stats = useMemo(() => computeStats(applications), [applications]);

  const visible = useMemo(() => {
    if (filter === 'all') return applications;
    return applications.filter((a) => a.status === filter);
  }, [applications, filter]);

  if (!isOpen) return null;

  const handleStatusChange = (id, status) => {
    sound.playAction();
    // updateApplication persists and returns the record; rebuild the list from
    // storage so ordering and timestamps stay authoritative.
    const updated = updateApplication(id, { status });
    if (!updated) {
      setSaveError('That application is no longer in the list.');
      return;
    }
    const next = applications.map((a) => (a.id === id ? updated : a));
    onListChange?.(next);
    setSaveError(null);
  };

  const handleDelete = (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    sound.playAction();
    const next = removeApplication(id);
    onListChange?.(next);
    setConfirmDeleteId(null);
    setSaveError(null);
  };

  const handleNotesChange = (id, notes) => {
    const updated = updateApplication(id, { notes });
    if (!updated) return;
    const next = applications.map((a) => (a.id === id ? updated : a));
    onListChange?.(next);
  };

  return (
    <ModalShell onClose={onClose} labelledBy="tracker-title" className="max-w-4xl">
      {/* Header: serif kicker + mono title + 32px close, on a hairline. */}
      <div className="flex items-center justify-between border-b border-rule bg-housing px-4 py-3">
        <div className="flex items-baseline gap-2.5">
          <span className="dt-serif text-[13px] text-signal">Log</span>
          <div>
            <h2 id="tracker-title" className="dt-label text-bone">
              Application Tracker
            </h2>
            <p className="dt-data mt-0.5 text-bone-32">
              Every application you sent, and which resume you used
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            sound.playAction();
            onClose();
          }}
          aria-label="Close application tracker"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[2px] border border-transparent text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
        >
          <X size={15} />
        </button>
      </div>

      {/* Stats readout: three columns of numerals on hairlines, no cards. */}
      <div className="grid grid-cols-3 divide-x divide-[var(--rule)] border-b border-rule bg-housing px-4 py-3">
        <div className="pr-3">
          <div className="dt-label text-bone-52">Total</div>
          <div className="font-mono text-[18px] leading-tight tabular-nums text-bone">
            {stats.total}
          </div>
        </div>
        <div className="px-3">
          <div className="dt-label text-bone-52">Active</div>
          <div className="font-mono text-[18px] leading-tight tabular-nums text-signal">
            {stats.activeCount}
          </div>
        </div>
        <div className="pl-3">
          <div className="dt-label text-bone-52">Response rate</div>
          <div className="font-mono text-[18px] leading-tight tabular-nums text-bone">
            {Math.round(stats.responseRate * 100)}%
          </div>
        </div>
      </div>

      {/* Filter: a ledger select, not a boxed control. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-housing px-4 py-2">
        <label htmlFor="tracker-filter" className="dt-label text-bone-52">
          Filter
        </label>
        <select
          id="tracker-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="cursor-pointer border-0 border-b bg-transparent px-0 py-1 font-mono text-[11px] text-bone focus:outline-none"
          style={{ borderBottomColor: 'var(--rule-2)' }}
        >
          <option value="all">All ({stats.total})</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]} ({stats.byStatus[s]})
            </option>
          ))}
        </select>
      </div>

      {/* Save error. aria-live so a quota failure is announced, not just drawn. */}
      <div aria-live="polite" role="status">
        {saveError && (
          <div className="mx-4 mt-3 border-l-2 border-alarm py-1 pl-2">
            <p className="font-sans text-[12px] text-alarm">{saveError}</p>
          </div>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto p-4">
        {visible.length === 0 ? (
          <EmptyState
            title={stats.total === 0 ? 'No applications yet' : 'Nothing matches this filter'}
            hint={
              stats.total === 0
                ? 'When you apply to a job through the Apply Agent, it is recorded here automatically — the company, the date, and which resume variant you used.'
                : 'Try a different status filter to see the rest of your applications.'
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--rule)]">
            {visible.map((app) => {
              const tone = STATUS_TONE[app.status] || 'neutral';
              const isConfirming = confirmDeleteId === app.id;

              return (
                <li key={app.id} className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-sans text-[13px] font-medium text-bone">
                          {app.title || 'Untitled role'}
                        </span>
                        <Chip tone={tone}>{STATUS_LABELS[app.status] || STATUS_LABELS.applied}</Chip>
                      </div>

                      <div className="dt-data mt-0.5 flex flex-wrap items-center gap-2 text-bone-52">
                        <span>{app.company || 'Unknown company'}</span>
                        <span aria-hidden="true">•</span>
                        <span>{formatDate(app.appliedAt)}</span>
                        {hostOf(app.url) && (
                          <>
                            <span aria-hidden="true">•</span>
                            <span className="truncate">{hostOf(app.url)}</span>
                          </>
                        )}
                      </div>

                      {/* Which resume was used - the payoff for variants. */}
                      <div className="dt-data mt-1">
                        {app.variantOrphaned ? (
                          <span className="text-alarm">
                            Resume “{app.variantName || 'unknown'}” has since been deleted
                          </span>
                        ) : (
                          <span className="text-bone-52">
                            Resume: <span className="text-bone-70">{app.variantName || 'unknown'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {app.url && (
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open the original job listing for ${app.title || 'this role'}`}
                          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[2px] border border-transparent text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
                        >
                          <ExternalLink size={13} aria-hidden="true" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(app.id)}
                        aria-label={
                          isConfirming
                            ? `Confirm deleting the application to ${app.company || 'this company'}`
                            : `Delete the application to ${app.company || 'this company'}`
                        }
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-[2px] border px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors duration-[90ms] ${
                          isConfirming
                            ? 'border-alarm bg-alarm/10 text-alarm'
                            : 'border-transparent text-alarm hover:bg-alarm/10'
                        }`}
                      >
                        <Trash2 size={12} aria-hidden="true" />
                        {isConfirming && <span>Confirm</span>}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-2">
                    <label
                      htmlFor={`status-${app.id}`}
                      className="dt-label text-bone-52"
                    >
                      Status
                    </label>
                    <select
                      id={`status-${app.id}`}
                      value={app.status}
                      onChange={(e) => handleStatusChange(app.id, e.target.value)}
                      className="cursor-pointer border-0 border-b bg-transparent px-0 py-0.5 font-mono text-[11px] text-bone focus:outline-none"
                      style={{ borderBottomColor: 'var(--rule-2)' }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>

                    <label
                      htmlFor={`notes-${app.id}`}
                      className="sr-only"
                    >
                      Notes for the application to {app.company || 'this company'}
                    </label>
                    <input
                      id={`notes-${app.id}`}
                      type="text"
                      value={app.notes || ''}
                      onChange={(e) => handleNotesChange(app.id, e.target.value)}
                      placeholder="Notes (recruiter name, next step...)"
                      className="min-w-[140px] flex-1 border-0 border-b bg-transparent px-0 py-0.5 font-sans text-[16px] text-bone placeholder:text-bone-32 focus:outline-none sm:text-[11px]"
                      style={{ borderBottomColor: 'var(--rule-2)' }}
                    />
                  </div>

                  {isConfirming && (
                    <p className="border-l-2 border-alarm py-0.5 pl-2 font-sans text-[11px] text-alarm" role="status">
                      Press Confirm again to delete. This cannot be undone.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-rule bg-housing px-4 py-2.5">
        <span className="dt-data flex items-center gap-1.5 text-bone-32">
          <CheckCircle2 size={11} className="text-signal" aria-hidden="true" />
          Saved in this browser only
        </span>
        <Button
          variant="quiet"
          onClick={() => {
            sound.playAction();
            onClose();
          }}
        >
          Close
        </Button>
      </div>
    </ModalShell>
  );
}
