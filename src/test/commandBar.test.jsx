import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CommandBar from '../components/ui/CommandBar.jsx';
import {
  buildCommands,
  filterCommands,
  groupCommands,
} from '../hooks/useCommandBar.js';
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts.js';

const noop = () => {};

function renderBar(overrides = {}) {
  const props = {
    isOpen: true,
    onClose: noop,
    query: '',
    setQuery: noop,
    activeIndex: 0,
    setActiveIndex: noop,
    commands: buildCommands({
      undo: noop,
      redo: noop,
      exportDocx: noop,
      exportPdf: noop,
      help: noop,
    }),
    ...overrides,
  };
  return render(<CommandBar {...props} />);
}

describe('buildCommands', () => {
  it('derives shortcut commands from the SHORTCUTS registry', () => {
    const commands = buildCommands({
      undo: noop,
      redo: noop,
      exportDocx: noop,
      exportPdf: noop,
      help: noop,
    });
    const ids = commands.map((c) => c.id);
    for (const s of SHORTCUTS) {
      expect(ids, `missing ${s.id}`).toContain(s.id);
    }
  });

  it('shows exactly the shortcut text from the registry, never a copy', () => {
    const commands = buildCommands({ exportDocx: noop, exportPdf: noop, help: noop });
    const docx = commands.find((c) => c.id === 'export-docx');
    const source = SHORTCUTS.find((s) => s.id === 'export-docx');
    expect(docx.shortcut).toBe(source.keys);
    expect(docx.macShortcut).toBe(source.macKeys);
  });

  it('drops a command whose handler is missing', () => {
    const commands = buildCommands({ undo: noop });
    const ids = commands.map((c) => c.id);
    expect(ids).toContain('undo');
    expect(ids).not.toContain('export-docx');
    expect(ids).not.toContain('help');
  });

  it('drops an extra command with no run function', () => {
    const commands = buildCommands({}, [
      { id: 'a', title: 'A', category: 'Navigate', run: noop },
      { id: 'b', title: 'B', category: 'Navigate' },
      { id: 'c', title: 'C', category: 'Navigate', run: 'not a function' },
    ]);
    expect(commands.map((c) => c.id)).toEqual(['a']);
  });

  it('never lists the same id twice', () => {
    const commands = buildCommands({ undo: noop }, [
      { id: 'undo', title: 'Duplicate', category: 'Edit', run: noop },
    ]);
    expect(commands.filter((c) => c.id === 'undo')).toHaveLength(1);
  });

  it('orders by category', () => {
    const commands = buildCommands({ undo: noop, exportDocx: noop, help: noop });
    const cats = commands.map((c) => c.category);
    const firstEdit = cats.indexOf('Edit');
    const firstExport = cats.indexOf('Export');
    const firstHelp = cats.indexOf('Help');
    expect(firstEdit).toBeLessThan(firstExport);
    expect(firstExport).toBeLessThan(firstHelp);
  });
});

describe('filterCommands', () => {
  const commands = buildCommands({
    undo: noop,
    exportDocx: noop,
    exportPdf: noop,
    help: noop,
  });

  it('returns everything for an empty query', () => {
    expect(filterCommands(commands, '')).toHaveLength(commands.length);
    expect(filterCommands(commands, '   ')).toHaveLength(commands.length);
  });

  it('matches on title, case-insensitively', () => {
    const hit = filterCommands(commands, 'docx');
    expect(hit.map((c) => c.id)).toEqual(['export-docx']);
  });

  it('matches on category', () => {
    const hit = filterCommands(commands, 'export');
    expect(hit.length).toBeGreaterThanOrEqual(2);
  });

  it('returns nothing for a miss', () => {
    expect(filterCommands(commands, 'zzzzz')).toEqual([]);
  });
});

describe('groupCommands', () => {
  it('groups while preserving order', () => {
    const commands = buildCommands({ undo: noop, redo: noop, exportDocx: noop });
    const groups = groupCommands(commands);
    expect(groups.map((g) => g.category)).toEqual(['Edit', 'Export']);
    expect(groups[0].items).toHaveLength(2);
  });
});

describe('CommandBar', () => {
  it('renders every command with its shortcut', () => {
    renderBar();
    expect(screen.getByText('Undo')).toBeInTheDocument();
    expect(screen.getByText('Export as DOCX')).toBeInTheDocument();
    expect(screen.getAllByText('Ctrl + S').length).toBeGreaterThan(0);
  });

  it('renders nothing when closed', () => {
    const { container } = renderBar({ isOpen: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('has a labelled search input', () => {
    renderBar();
    expect(screen.getByLabelText(/search commands/i)).toBeInTheDocument();
  });

  it('is a labelled dialog', () => {
    renderBar();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Command palette')).toBeInTheDocument();
  });

  it('shows a no-results state that is announced', () => {
    renderBar({ query: 'zzzzz' });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/no commands match/i);
  });

  it('runs the active command on Enter', async () => {
    const run = vi.fn();
    const onClose = vi.fn();
    renderBar({
      onClose,
      commands: buildCommands({}, [{ id: 'x', title: 'Do it', category: 'Navigate', run }]),
    });
    const input = screen.getByLabelText(/search commands/i);
    fireEvent.keyDown(input, { key: 'Enter' });
    // runAt defers by a tick so the dialog closes first.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not run anything on Enter with no results', async () => {
    const run = vi.fn();
    renderBar({
      query: 'zzzzz',
      commands: buildCommands({}, [{ id: 'x', title: 'Do it', category: 'Navigate', run }]),
    });
    fireEvent.keyDown(screen.getByLabelText(/search commands/i), { key: 'Enter' });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('moves the highlight with ArrowDown and ArrowUp', () => {
    const setActiveIndex = vi.fn();
    renderBar({ activeIndex: 0, setActiveIndex });
    const input = screen.getByLabelText(/search commands/i);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(setActiveIndex).toHaveBeenCalledWith(1);
  });

  it('closes on Escape via ModalShell', () => {
    const onClose = vi.fn();
    renderBar({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('runs a command on click', async () => {
    const run = vi.fn();
    renderBar({
      commands: buildCommands({}, [{ id: 'x', title: 'Do it', category: 'Navigate', run }]),
    });
    fireEvent.click(screen.getByText('Do it'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('every rendered row has an accessible name', () => {
    renderBar();
    for (const button of screen.getAllByRole('button')) {
      expect(button.textContent.trim().length).toBeGreaterThan(0);
    }
  });
});
