import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import App from '../App.jsx';

/**
 * The palette is only useful if it is wired into the real app, not just
 * renderable in isolation. These mount <App /> and drive it the way a user
 * would: jsdom cannot prove the browser behaviour, but it proves the listener,
 * the registry and the component are actually connected.
 */
const openPalette = async () => {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
};

describe('command palette in the real App', () => {
  it('is closed until asked for', () => {
    render(<App />);
    expect(screen.queryByText('Command palette')).not.toBeInTheDocument();
  });

  it('opens on Ctrl+K and lists commands that really exist', async () => {
    render(<App />);
    await openPalette();

    expect(screen.getByText('Command palette')).toBeInTheDocument();
    // Extra (non-shortcut) commands supplied by App.jsx.
    expect(screen.getByText('Import or export JSON Resume')).toBeInTheDocument();
    expect(screen.getByText('Open application tracker')).toBeInTheDocument();
    expect(screen.getByText('New resume variant')).toBeInTheDocument();
  });

  it('opens on ⌘K too', async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.getByText('Command palette')).toBeInTheDocument();
  });

  it('opens even when the caret is in a textarea', async () => {
    render(<App />);
    // ⌘K is navigation, not an edit — a deliberate exception to the
    // isEditableTarget guard every other shortcut respects.
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    await openPalette();

    expect(screen.getByText('Command palette')).toBeInTheDocument();
    document.body.removeChild(textarea);
  });

  it('shows shortcut-backed commands with the registry’s own key labels', async () => {
    render(<App />);
    await openPalette();
    // From SHORTCUTS, not a copy — if the registry changes, this follows.
    expect(screen.getAllByText('Ctrl + S').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ctrl + Shift + S').length).toBeGreaterThan(0);
  });

  it('filters as the user types', async () => {
    render(<App />);
    await openPalette();

    const input = screen.getByLabelText(/search commands/i);
    fireEvent.change(input, { target: { value: 'tracker' } });

    expect(screen.getByText('Open application tracker')).toBeInTheDocument();
    expect(screen.queryByText('New resume variant')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(<App />);
    await openPalette();
    expect(screen.getByText('Command palette')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByText('Command palette')).not.toBeInTheDocument();
  });
});
