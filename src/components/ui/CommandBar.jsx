import React, { useEffect, useMemo, useRef } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import ModalShell from './ModalShell';
import { filterCommands, groupCommands } from '../../hooks/useCommandBar.js';

const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]';

/**
 * The ⌘K command palette.
 *
 * ACCESSIBILITY PATTERN — why a list of buttons, not `role="listbox"`.
 * A listbox models *selection*: the user picks one option and the value is
 * committed. A command palette models *invocation*: each row runs an action and
 * the palette closes. `role="listbox"`/`option` would tell a screen reader the
 * user is choosing a value, and would require `aria-selected` to mean something
 * it does not. The honest pattern is a dialog containing a search box and a
 * group of ordinary buttons, with `aria-activedescendant` pointing at the
 * currently highlighted one so the search input keeps focus while arrow keys
 * move the highlight.
 */
export default function CommandBar({
  isOpen,
  onClose,
  query,
  setQuery,
  activeIndex,
  setActiveIndex,
  commands = [],
}) {
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const visible = useMemo(() => filterCommands(commands, query), [commands, query]);
  const groups = useMemo(() => groupCommands(visible), [visible]);

  // Clamp the highlight when the filtered list shrinks.
  useEffect(() => {
    if (activeIndex > visible.length - 1) {
      setActiveIndex(Math.max(0, visible.length - 1));
    }
  }, [visible.length, activeIndex, setActiveIndex]);

  // Focus the search box on open.
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [isOpen]);

  // Keep the highlighted row in view.
  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [isOpen, activeIndex]);

  if (!isOpen) return null;

  const runAt = (index) => {
    const cmd = visible[index];
    if (!cmd) return;
    onClose();
    // Defer so the dialog is gone before the action runs; an action that opens
    // another modal would otherwise fight this one for the focus trap.
    setTimeout(() => cmd.run(), 0);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(visible.length ? (activeIndex + 1) % visible.length : 0);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(
        visible.length ? (activeIndex - 1 + visible.length) % visible.length : 0
      );
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      runAt(activeIndex);
    }
  };

  const activeId = visible[activeIndex] ? `cmd-${visible[activeIndex].id}` : undefined;

  return (
    <ModalShell onClose={onClose} labelledBy="commandbar-title" zIndex="z-[60]">
      <div className="flex max-h-[70vh] flex-col">
        <h2 id="commandbar-title" className="sr-only">
          Command palette
        </h2>

        <div className="flex items-center gap-3 border-b border-pink-500/25 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-rose-300" aria-hidden="true" />
          <label htmlFor="commandbar-input" className="sr-only">
            Search commands
          </label>
          <input
            ref={inputRef}
            id="commandbar-input"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Type a command…"
            autoComplete="off"
            role="combobox"
            aria-expanded="true"
            aria-controls="commandbar-list"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            className={`w-full bg-transparent text-base text-pink-50 placeholder:text-pink-300/50 focus:outline-none ${RING}`}
          />
        </div>

        <div
          ref={listRef}
          id="commandbar-list"
          role="group"
          aria-label="Commands"
          className="overflow-y-auto p-2"
        >
          {visible.length === 0 && (
            <p role="status" className="px-3 py-6 text-center text-sm text-pink-200/70">
              No commands match “{query}”.
            </p>
          )}

          {groups.map((group) => (
            <div key={group.category} className="mb-1">
              <p
                className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-pink-300/70"
                aria-hidden="true"
              >
                {group.category}
              </p>
              <ul role="list">
                {group.items.map((cmd) => {
                  const index = visible.indexOf(cmd);
                  const isActive = index === activeIndex;
                  return (
                    <li key={cmd.id} role="listitem">
                      <button
                        type="button"
                        id={`cmd-${cmd.id}`}
                        data-active={isActive ? 'true' : 'false'}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => runAt(index)}
                        aria-current={isActive ? 'true' : undefined}
                        className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${RING} ${
                          isActive
                            ? 'bg-rose-500/20 text-pink-50'
                            : 'text-pink-100/90 hover:bg-black/30'
                        }`}
                      >
                        <span>{cmd.title}</span>
                        {cmd.shortcut && (
                          <kbd className="shrink-0 rounded border border-pink-400/30 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-pink-200/80">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-pink-500/25 px-4 py-2 text-[11px] text-pink-200/60">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-pink-400/30 bg-black/40 px-1 py-0.5 font-mono">
              ↑
            </kbd>
            <kbd className="rounded border border-pink-400/30 bg-black/40 px-1 py-0.5 font-mono">
              ↓
            </kbd>
            to move
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-pink-400/30 bg-black/40 px-1 py-0.5 font-mono">
              <CornerDownLeft className="inline h-3 w-3" aria-hidden="true" />
            </kbd>
            to run
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-pink-400/30 bg-black/40 px-1 py-0.5 font-mono">
              Esc
            </kbd>
            to close
          </span>
        </div>
      </div>
    </ModalShell>
  );
}
