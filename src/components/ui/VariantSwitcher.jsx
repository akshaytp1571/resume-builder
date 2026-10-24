import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Copy,
  Download,
  FileJson2,
  FilePlus2,
  Layers,
  Pencil,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { sound } from '../../utils/soundEffects';

/**
 * Resume variants as numbered plates.
 *
 * Each variant is a plate: `01`, its name, a hairline. The active one carries a
 * 2px lime left rule and the numeral in serif italic — the one place the serif
 * appears twice on screen, which is the point of an accent.
 *
 * Props are controlled — all mutation happens in the parent (App.jsx), which
 * owns the store from src/utils/resumeStore.js. This component only reports
 * intent, so it stays trivially testable and never touches storage.
 */

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const PLATE_BTN =
  'inline-flex h-8 cursor-pointer items-center gap-2 rounded-[2px] border border-rule-2 bg-transparent px-2 text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone';
const PLATE_ACTION =
  // No flex-1: these are commands, not segments of a control group. Growing
  // them to fill the bar made a row of four buttons read as one enormous
  // segmented widget instead of four separate actions.
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[2px] border border-rule-2 bg-transparent px-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone disabled:cursor-not-allowed disabled:opacity-40';
const ICON_ACT =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[2px] border border-transparent text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone disabled:cursor-not-allowed disabled:opacity-40';

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
  onOpenJsonResume,
}) {
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [draftName, setDraftName] = useState('');

  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const fileRef = useRef(null);

  const list = Array.isArray(variants) ? variants.filter(Boolean) : [];
  const active = list.find((v) => v.id === activeId) || null;

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!rootRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const startRename = (variant) => {
    setRenamingId(variant.id);
    setDraftName(variant.name || '');
  };

  const commitRename = () => {
    const name = draftName.trim();
    const id = renamingId;
    setRenamingId(null);
    if (id && name) onRename?.(id, name);
  };

  const select = (id) => {
    if (id !== activeId) {
      sound.playTab();
      onSelect?.(id);
    }
    close();
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onImportFile?.(file);
    if (fileRef.current) fileRef.current.value = '';
    close();
  };

  const activeIndex = list.findIndex((v) => v.id === activeId);

  return (
    <div
      ref={rootRef}
      className="relative flex items-center gap-2 border-b border-rule bg-housing px-3 py-1.5 no-print select-none sm:px-5"
    >
      {/* ---- trigger ------------------------------------------------------ */}
      <button
        type="button"
        onClick={() => {
          sound.playAction();
          setOpen((p) => !p);
        }}
        aria-expanded={open}
        title="Switch resume variant"
        className={`${PLATE_BTN} max-w-[240px]`}
      >
        <Layers size={13} className="shrink-0 text-bone-52" aria-hidden="true" />
        {activeIndex >= 0 && (
          <span className="dt-serif shrink-0 text-[13px] text-signal">
            {String(activeIndex + 1).padStart(2, '0')}
          </span>
        )}
        <span className="truncate font-mono text-[11px] uppercase tracking-[0.06em]">
          {active?.name || 'No resume'}
        </span>
        {list.length > 1 && (
          <span className="shrink-0 rounded-[2px] border border-rule-2 px-1 font-mono text-[9px] leading-[14px] text-bone-52">
            {list.length}
          </span>
        )}
        <ChevronDown
          size={13}
          className={`shrink-0 transition-transform duration-[90ms] ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <span aria-hidden="true" className="hidden h-4 w-px bg-[var(--rule)] sm:block" />

      {/* ---- quick actions ------------------------------------------------ */}
      <button
        type="button"
        onClick={() => {
          sound.playAction();
          onCreate?.();
          close();
        }}
        className={`${PLATE_ACTION} max-sm:hidden`}
        title="Create a new resume variant"
      >
        <FilePlus2 size={12} aria-hidden="true" />
        <span>New</span>
      </button>

      <button
        type="button"
        onClick={() => {
          sound.playSuccess();
          onExportAll?.();
        }}
        className={`${PLATE_ACTION} max-sm:hidden`}
        title="Export every variant as one JSON backup"
      >
        <Download size={12} aria-hidden="true" />
        <span>Export</span>
      </button>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`${PLATE_ACTION} max-sm:hidden`}
        title="Import a JSON backup"
      >
        <Upload size={12} aria-hidden="true" />
        <span>Import</span>
      </button>

      {/* JSON Resume interop — the public format, not this app's backup. */}
      <button
        type="button"
        onClick={() => {
          sound.playAction();
          onOpenJsonResume?.();
          close();
        }}
        className={`${PLATE_ACTION} max-sm:hidden`}
        title="Import or export the open JSON Resume format"
      >
        <FileJson2 size={12} aria-hidden="true" />
        <span>JSON Resume</span>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFile}
      />

      {/* ---- panel -------------------------------------------------------- */}
      {open && (
        <div
          ref={panelRef}
          role="group"
          aria-label="Resume variants"
          tabIndex={-1}
          className="absolute right-0 top-full z-50 mt-2 flex w-[330px] flex-col overflow-hidden rounded-none border border-rule-2 bg-housing-2 outline-none"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}
        >
          {/* header */}
          <div className="flex items-center justify-between border-b border-rule bg-housing px-3 py-2">
            <div className="flex items-center gap-2">
              <Layers size={13} className="text-bone-52" aria-hidden="true" />
              <span className="dt-label text-bone-70">Resume variants</span>
            </div>
            <span className="dt-data text-bone-32">
              {list.length} saved {list.length === 1 ? 'version' : 'versions'}
            </span>
            <button
              type="button"
              onClick={() => {
                sound.playAction();
                close();
              }}
              className={ICON_ACT}
              title="Close"
              aria-label="Close variants"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          {/* plates, separated by hairlines */}
          <ul className="max-h-64 divide-y divide-[var(--rule)] overflow-y-auto">
            {list.map((variant, i) => {
              const isActive = variant.id === active?.id;
              const isRenaming = variant.id === renamingId;

              return (
                <li
                  key={variant.id}
                  className={`flex items-center gap-2 px-3 py-2 ${
                    isActive ? 'border-l-2 border-l-signal bg-[rgba(237,232,220,0.04)]' : 'border-l-2 border-l-transparent'
                  }`}
                >
                  <span
                    className={`dt-serif w-[18px] shrink-0 text-[13px] ${
                      isActive ? 'text-signal' : 'text-bone-32'
                    }`}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>

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
                      className="min-w-0 flex-1 border-0 border-b bg-transparent px-0 py-1 text-[13px] text-bone focus:outline-none"
                      style={{ borderBottomColor: 'var(--signal)' }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => select(variant.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className="min-w-0 flex-1 cursor-pointer text-left"
                      title={variant.name}
                    >
                      <span className="block truncate font-sans text-[13px] text-bone">
                        {variant.name || 'Untitled resume'}
                      </span>
                      <span className="dt-data block text-bone-32">
                        {isActive ? 'Active' : `Updated ${formatDate(variant.updatedAt)}`}
                      </span>
                    </button>
                  )}

                  {!isRenaming && (
                    <span className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => startRename(variant)}
                        className={ICON_ACT}
                        title="Rename"
                        aria-label={`Rename ${variant.name || 'this variant'}`}
                      >
                        <Pencil size={12} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sound.playAction();
                          onDuplicate?.(variant.id);
                          close();
                        }}
                        className={ICON_ACT}
                        title="Duplicate"
                        aria-label={`Duplicate ${variant.name || 'this variant'}`}
                      >
                        <Copy size={12} aria-hidden="true" />
                      </button>
                      {list.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            onDelete?.(variant.id);
                            close();
                          }}
                          className={`${ICON_ACT} hover:text-alarm`}
                          title="Delete"
                          aria-label={`Delete ${variant.name || 'this variant'}`}
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
