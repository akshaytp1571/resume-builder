import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  ExternalLink,
  Inbox,
  Trash2,
  TrendingUp,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/soundEffects';
import {
  STATUSES,
  computeStats,
  updateApplication,
  removeApplication,
} from '../../utils/applicationTracker';

const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]';

/**
 * Per-status colours. Each is a background + text + border trio so a badge
 * reads as a status at a glance without relying on colour alone — every badge
 * also carries its label as text.
 */
const STATUS_STYLES = {
  applied: {
    label: 'Applied',
    badge: 'bg-sky-950/60 border-sky-500/40 text-sky-200',
    dot: 'bg-sky-400',
  },
  screening: {
    label: 'Screening',
    badge: 'bg-indigo-950/60 border-indigo-500/40 text-indigo-200',
    dot: 'bg-indigo-400',
  },
  interview: {
    label: 'Interview',
    badge: 'bg-amber-950/60 border-amber-500/40 text-amber-200',
    dot: 'bg-amber-400',
  },
  offer: {
    label: 'Offer',
    badge: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200',
    dot: 'bg-emerald-400',
  },
  rejected: {
    label: 'Rejected',
    badge: 'bg-rose-950/60 border-rose-500/40 text-rose-200',
    dot: 'bg-rose-400',
  },
  withdrawn: {
    label: 'Withdrawn',
    badge: 'bg-[#250d2b] border-pink-500/25 text-pink-300/85',
    dot: 'bg-pink-400/70',
  },
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
      {/* Header */}
      <div className="p-4 border-b border-pink-500/20 flex items-center justify-between bg-[#200824]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#2e0d34] border border-pink-500/40 flex items-center justify-center text-rose-300">
            <Briefcase size={18} />
          </div>
          <div>
            <h2 id="tracker-title" className="text-sm font-bold text-pink-50 tracking-wide">
              Application Tracker
            </h2>
            <p className="text-[11px] text-pink-300/70">
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
          className={`p-1.5 rounded-xl text-pink-400/85 hover:text-pink-100 hover:bg-pink-900/30 transition-colors cursor-pointer ${RING}`}
        >
          <X size={18} />
        </button>
      </div>

      {/* Stats strip */}
      <div className="px-4 py-3 border-b border-pink-500/15 bg-[#18071c] grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-xl bg-[#1b071e] border border-pink-500/20">
          <div className="text-[10px] uppercase tracking-wide text-pink-300/70">Total</div>
          <div className="text-lg font-black text-pink-100 leading-tight">{stats.total}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-[#1b071e] border border-pink-500/20">
          <div className="text-[10px] uppercase tracking-wide text-pink-300/70 flex items-center gap-1">
            <Clock size={10} aria-hidden="true" />
            Active
          </div>
          <div className="text-lg font-black text-emerald-300 leading-tight">{stats.activeCount}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-[#1b071e] border border-pink-500/20">
          <div className="text-[10px] uppercase tracking-wide text-pink-300/70 flex items-center gap-1">
            <TrendingUp size={10} aria-hidden="true" />
            Response rate
          </div>
          <div className="text-lg font-black text-amber-300 leading-tight">
            {Math.round(stats.responseRate * 100)}%
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 py-2.5 border-b border-pink-500/15 bg-[#18071c] flex flex-wrap items-center gap-2">
        <label htmlFor="tracker-filter" className="text-[11px] font-semibold text-pink-200">
          Filter
        </label>
        <select
          id="tracker-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`bg-[#150518] border border-pink-500/25 rounded-xl px-2.5 py-1 text-[11px] text-pink-100 focus:outline-none focus:border-rose-400 cursor-pointer ${RING}`}
        >
          <option value="all">All ({stats.total})</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_STYLES[s].label} ({stats.byStatus[s]})
            </option>
          ))}
        </select>
      </div>

      {/* Save error. aria-live so a quota failure is announced, not just drawn. */}
      <div aria-live="polite" role="status">
        {saveError && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-[11px] text-rose-200 flex items-start gap-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5 text-rose-400" aria-hidden="true" />
            <span>{saveError}</span>
          </div>
        )}
      </div>

      {/* List */}
      <div className="p-4 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#2d0d34] border border-pink-500/30 flex items-center justify-center text-rose-300">
              <Inbox size={22} />
            </div>
            <p className="text-xs font-semibold text-pink-100">
              {stats.total === 0 ? 'No applications yet' : 'Nothing matches this filter'}
            </p>
            <p className="text-[11px] text-pink-300/85 max-w-sm mx-auto leading-relaxed">
              {stats.total === 0
                ? 'When you apply to a job through the Apply Agent, it is recorded here automatically — the company, the date, and which resume variant you used.'
                : 'Try a different status filter to see the rest of your applications.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((app) => {
              const style = STATUS_STYLES[app.status] || STATUS_STYLES.applied;
              const isConfirming = confirmDeleteId === app.id;

              return (
                <li
                  key={app.id}
                  className="p-3 rounded-2xl bg-[#1b071e] border border-pink-500/20 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-pink-50 truncate">
                          {app.title || 'Untitled role'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-full border text-[9.5px] font-bold ${style.badge}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${style.dot}`} aria-hidden="true" />
                          {style.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10.5px] text-pink-300/85 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building2 size={10} aria-hidden="true" />
                          {app.company || 'Unknown company'}
                        </span>
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
                      <div className="mt-1 text-[10.5px]">
                        {app.variantOrphaned ? (
                          <span className="text-amber-300/90">
                            Resume “{app.variantName || 'unknown'}” has since been deleted
                          </span>
                        ) : (
                          <span className="text-pink-300/85">
                            Resume: <span className="text-pink-200">{app.variantName || 'unknown'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {app.url && (
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open the original job listing for ${app.title || 'this role'}`}
                          className={`p-1.5 rounded-lg text-pink-400/85 hover:text-pink-100 hover:bg-pink-900/30 transition-colors cursor-pointer ${RING}`}
                        >
                          <ExternalLink size={13} />
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
                        className={`px-1.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                          isConfirming
                            ? 'bg-rose-900/60 border border-rose-500/50 text-rose-100'
                            : 'text-pink-400/85 hover:text-rose-300 hover:bg-rose-950/40'
                        } ${RING}`}
                      >
                        <Trash2 size={12} />
                        {isConfirming && <span>Confirm</span>}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-pink-950/60">
                    <label
                      htmlFor={`status-${app.id}`}
                      className="text-[10.5px] font-semibold text-pink-300/85"
                    >
                      Status
                    </label>
                    <select
                      id={`status-${app.id}`}
                      value={app.status}
                      onChange={(e) => handleStatusChange(app.id, e.target.value)}
                      className={`bg-[#150518] border border-pink-500/25 rounded-lg px-2 py-0.5 text-[10.5px] text-pink-100 focus:outline-none focus:border-rose-400 cursor-pointer ${RING}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_STYLES[s].label}
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
                      className={`flex-1 min-w-[140px] bg-[#150518] border border-pink-500/25 rounded-lg px-2 py-0.5 text-[10.5px] text-pink-100 placeholder:text-pink-300/60 focus:outline-none focus:border-rose-400 ${RING}`}
                    />
                  </div>

                  {isConfirming && (
                    <p className="text-[10px] text-rose-300/90" role="status">
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
      <div className="p-3.5 border-t border-pink-500/20 bg-[#200824]/90 flex items-center justify-between">
        <span className="text-[10.5px] text-pink-300/70 flex items-center gap-1">
          <CheckCircle2 size={11} className="text-emerald-400" aria-hidden="true" />
          Saved in this browser only
        </span>
        <button
          type="button"
          onClick={() => {
            sound.playAction();
            onClose();
          }}
          className={`px-4 py-1.5 text-xs font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-pink-200 border border-pink-500/20 transition-colors cursor-pointer ${RING}`}
        >
          Close
        </button>
      </div>
    </ModalShell>
  );
}
