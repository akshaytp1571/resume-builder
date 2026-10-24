import React, { useEffect, useMemo, useRef } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import ModalShell from './ModalShell';
import { Keycap } from './primitives';
import { filterCommands, groupCommands } from '../../hooks/useCommandBar.js';

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

        {/* The input is the hero: full width, no box, one bottom rule. */}
        <div className="flex items-baseline gap-2.5 border-b border-rule-2 bg-housing px-4 pb-2 pt-3">
          <Search size={15} className="shrink-0 self-center text-signal" aria-hidden="true" />
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
            className="w-full border-0 bg-transparent px-0 py-1 text-[16px] text-bone placeholder:text-bone-32 focus:outline-none"
          />
        </div>

        <div
          ref={listRef}
          id="commandbar-list"
          role="group"
          aria-label="Commands"
          className="overflow-y-auto py-1"
        >
          {visible.length === 0 && (
            <p role="status" className="dt-serif px-4 py-6 text-center text-[14px] text-bone-52">
              No commands match “{query}”.
            </p>
          )}

          {groups.map((group) => (
            <div key={group.category}>
              <p
                className="dt-label border-t border-rule px-4 pb-1 pt-2 text-bone-32"
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
                        className={`flex w-full cursor-pointer items-center justify-between gap-3 border-l-2 px-4 py-2 text-left font-sans text-[13px] transition-colors duration-[90ms] ${
                          isActive
                            ? 'border-l-signal bg-[rgba(237,232,220,0.05)] text-bone'
                            : 'border-l-transparent text-bone-70 hover:text-bone'
                        }`}
                      >
                        <span>{cmd.title}</span>
                        {cmd.shortcut && (
                          <Keycap className="shrink-0">{cmd.shortcut}</Keycap>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer legend: keycaps and quiet mono prose. */}
        <div className="flex items-center justify-between gap-3 border-t border-rule bg-housing px-4 py-2">
          <span className="flex items-center gap-1.5">
            <Keycap>↑</Keycap>
            <Keycap>↓</Keycap>
            <span className="dt-data text-bone-32">to move</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Keycap>
              <CornerDownLeft size={10} aria-hidden="true" />
            </Keycap>
            <span className="dt-data text-bone-32">to run</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Keycap>Esc</Keycap>
            <span className="dt-data text-bone-32">to close</span>
          </span>
        </div>
      </div>
    </ModalShell>
  );
}
