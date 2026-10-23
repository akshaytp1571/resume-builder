import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Copy,
  Download,
  FilePlus2,
  Layers,
  Pencil,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { sound } from '../../utils/soundEffects';

const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#18071c]';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Compact navbar dropdown for named resume variants.
 *
 * Props are controlled — all mutation happens in the parent (App.jsx), which
 * owns the store from src/utils/resumeStore.js. This component only reports
 * intent, so it stays trivially testable and never touches storage.
 */
export default function VariantSwitcher({
  variants = [],
  activeId,
  onSelect,
  onDuplicate,
  onRename,
  onDelete,
  onCreate,
  onExportAll,
  onImportFile,
}) {
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [draftName, setDraftName] = useState('');

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const fileRef = useRef(null);

  const list = Array.isArray(variants) ? variants : [];
  const active = list.find((v) => v.id === activeId) || list[0] || null;
  const canDelete = list.length > 1;

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setRenamingId(null);
      }
    };

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (renamingId) {
        // Escape cancels an in-progress rename instead of closing the panel.
        event.stopPropagation();
        setRenamingId(null);
        return;
      }
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, renamingId]);

  // Move focus into the panel on open so keyboard users land somewhere useful.
  useEffect(() => {
    if (!open) return;
    const node = panelRef.current;
    if (!node) return;
    const first = node.querySelector('button:not([disabled])');
    (first || node).focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setRenamingId(null);
  };

  const select = (id) => {
    if (id === activeId) {
      close();
      return;
    }
    sound.playAction();
    onSelect?.(id);
    close();
  };

  const startRename = (variant) => {
    setRenamingId(variant.id);
    setDraftName(variant.name || '');
  };

  const commitRename = () => {
    if (!renamingId) return;
    const name = draftName.trim();
    const current = list.find((v) => v.id === renamingId);
    if (name && current && name !== current.name) onRename?.(renamingId, name);
    setRenamingId(null);
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    // Reset first so re-picking the same file still fires onChange.
    event.target.value = '';
    if (file) onImportFile?.(file);
    close();
  };

  return (
    <div ref={rootRef} className="relative no-print select-none">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          sound.playAction();
          setOpen((v) => !v);
        }}
        aria-haspopup="true"
        aria-expanded={open}
        title="Switch resume variant"
        className={`px-2.5 py-2 rounded-xl bg-[#200b24] hover:bg-[#2c1031] text-pink-300/70 hover:text-pink-100 border border-pink-500/20 hover:border-pink-500/40 transition-all cursor-pointer flex items-center gap-1.5 max-w-[220px] ${RING}`}
      >
        <Layers size={13} className="text-rose-300 shrink-0" />
        <span className="text-[11px] font-semibold tracking-wide truncate">
          {active?.name || 'No resume'}
        </span>
        {list.length > 1 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-pink-950/80 text-pink-300 border border-pink-500/40 shrink-0">
            {list.length}
          </span>
        )}
        <ChevronDown
          size={13}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          role="group"
          aria-label="Resume variants"
          tabIndex={-1}
          className="absolute right-0 top-full mt-2 z-50 w-[330px] bg-[#18071c] border border-pink-500/35 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col font-sans outline-none"
        >
          {/* Panel header */}
          <div className="px-3 py-2 border-b border-pink-500/20 bg-[#200824]/90 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#2e0d34] border border-pink-500/40 flex items-center justify-center text-rose-300">
                <Layers size={13} />
              </div>
              <div>
                <div className="text-[11px] font-bold text-pink-50 tracking-wide">
                  Resume Variants
                </div>
                <div className="text-[10px] text-pink-300/70">
                  {list.length} saved {list.length === 1 ? 'version' : 'versions'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                sound.playAction();
                close();
              }}
              className={`p-1 rounded-lg text-pink-400/85 hover:text-pink-100 hover:bg-pink-900/30 transition-colors cursor-pointer ${RING}`}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>

          {/* Variant rows */}
          <ul className="max-h-64 overflow-y-auto p-2 space-y-1.5">
            {list.map((variant) => {
              const isActive = variant.id === active?.id;
              const isRenaming = variant.id === renamingId;

              return (
                <li
                  key={variant.id}
                  className={`rounded-xl border px-2 py-1.5 flex items-center gap-1.5 transition-colors ${
                    isActive
                      ? 'bg-[#2e0d34] border-pink-500/45 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                      : 'bg-[#1b071e] border-pink-500/20 hover:border-pink-500/35'
                  }`}
                >
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitRename();
                        }
                      }}
                      aria-label="Variant name"
                      maxLength={60}
                      className={`flex-1 min-w-0 bg-[#120414] border border-rose-500/50 rounded-lg px-2 py-1 text-xs text-pink-50 focus:outline-none focus:ring-2 focus:ring-rose-400/70 ${RING}`}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => select(variant.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className={`flex-1 min-w-0 text-left cursor-pointer rounded-lg px-1 py-0.5 ${RING}`}
                      title={variant.name}
                    >
                      <span
                        className={`block text-xs font-semibold truncate ${
                          isActive ? 'text-pink-50' : 'text-pink-200/85'
                        }`}
                      >
                        {variant.name || 'Untitled resume'}
                      </span>
                      <span className="block text-[10px] text-pink-300/70">
                        {isActive ? 'Active' : `Updated ${formatDate(variant.updatedAt)}`}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => startRename(variant)}
                    title="Rename"
                    aria-label={`Rename ${variant.name || 'resume'}`}
                    className={`p-1 rounded-lg text-pink-400/85 hover:text-pink-100 hover:bg-pink-900/30 transition-colors cursor-pointer shrink-0 ${RING}`}
                  >
                    <Pencil size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sound.playAction();
                      onDuplicate?.(variant.id);
                    }}
                    title="Duplicate"
                    aria-label={`Duplicate ${variant.name || 'resume'}`}
                    className={`p-1 rounded-lg text-pink-400/85 hover:text-pink-100 hover:bg-pink-900/30 transition-colors cursor-pointer shrink-0 ${RING}`}
                  >
                    <Copy size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sound.playAction();
                      onDelete?.(variant.id);
                    }}
                    disabled={!canDelete}
                    title={
                      canDelete
                        ? 'Delete variant'
                        : 'Keep at least one resume — duplicate or create another first'
                    }
                    aria-label={`Delete ${variant.name || 'resume'}`}
                    className={`p-1 rounded-lg transition-colors shrink-0 ${
                      canDelete
                        ? 'text-pink-400/85 hover:text-rose-300 hover:bg-rose-900/30 cursor-pointer'
                        : 'text-pink-400/85 cursor-not-allowed'
                    } ${RING}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })}

            {list.length === 0 && (
              <li className="px-2 py-3 text-[11px] text-pink-300/70 text-center">
                No resumes yet.
              </li>
            )}
          </ul>

          {/* Actions */}
          <div className="p-2 border-t border-pink-500/20 bg-[#200824]/90 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => {
                sound.playAction();
                onCreate?.();
                close();
              }}
              className={`px-2 py-1.5 text-[11px] font-semibold rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:opacity-95 text-white flex items-center justify-center gap-1 shadow-[0_2px_15px_rgba(244,63,94,0.35)] transition-all active:scale-95 cursor-pointer ${RING}`}
            >
              <FilePlus2 size={12} />
              <span>New</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sound.playSuccess();
                onExportAll?.();
              }}
              className={`px-2 py-1.5 text-[11px] font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-pink-200 border border-pink-500/20 flex items-center justify-center gap-1 transition-colors cursor-pointer ${RING}`}
            >
              <Download size={12} className="text-pink-300" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`px-2 py-1.5 text-[11px] font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-pink-200 border border-pink-500/20 flex items-center justify-center gap-1 transition-colors cursor-pointer ${RING}`}
            >
              <Upload size={12} className="text-pink-300" />
              <span>Import</span>
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      )}
    </div>
  );
}
