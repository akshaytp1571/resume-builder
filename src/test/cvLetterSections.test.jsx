import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import EditorSidebar from '../components/editor/EditorSidebar.jsx';
import { fullResume, DEFAULT_THEME } from './fixtures.js';

const base = {
  resumeData: fullResume(),
  theme: DEFAULT_THEME,
  letter: { id: 'l1', jobTitle: '', company: '', hiringManager: '', body: '', date: '' },
  onUpdateResume: () => {},
  onUpdateTheme: () => {},
  onUpdateLetter: () => {},
  onExportCoverLetter: () => {},
  onTriggerAiRefine: () => {},
  onOpenAiConfig: () => {},
};

describe('CV and Letter are separate sections', () => {
  it('has a top-level document switcher with both sections', () => {
    render(<EditorSidebar {...base} />);
    const switcher = screen.getByRole('tablist', { name: /document/i });
    expect(switcher).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^CV$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Letter$/ })).toBeInTheDocument();
  });

  it('starts on the CV section', () => {
    render(<EditorSidebar {...base} />);
    expect(screen.getByRole('tab', { name: /^CV$/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    // A CV tab is visible; the letter tab is not in this section.
    expect(screen.getByRole('tab', { name: /summary/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /cover letter/i })).not.toBeInTheDocument();
  });

  it('shows only the cover letter tab after switching to Letter', () => {
    render(<EditorSidebar {...base} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Letter$/ }));

    expect(screen.getByRole('tab', { name: /^Letter$/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: /cover letter/i })).toBeInTheDocument();
    // None of the CV tabs leak into the letter section.
    expect(screen.queryByRole('tab', { name: /summary/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /experience/i })).not.toBeInTheDocument();
  });

  it('returns to the CV tabs when switching back', () => {
    render(<EditorSidebar {...base} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Letter$/ }));
    fireEvent.click(screen.getByRole('tab', { name: /^CV$/ }));

    expect(screen.getByRole('tab', { name: /summary/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /cover letter/i })).not.toBeInTheDocument();
  });

  it('opens the cover letter editor, not a resume field, in the Letter section', () => {
    render(<EditorSidebar {...base} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Letter$/ }));
    // The CoverLetterEditor has a body textarea.
    expect(screen.getByRole('textbox', { name: /body|letter/i })).toBeInTheDocument();
  });

  it('labels each section tablist distinctly', () => {
    render(<EditorSidebar {...base} />);
    expect(screen.getByRole('tablist', { name: /^document$/i })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: /cv sections/i })).toBeInTheDocument();
  });

  it('every tab has an accessible name', () => {
    render(<EditorSidebar {...base} />);
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.textContent.trim().length).toBeGreaterThan(0);
    }
  });

  it('renders without a letter without crashing', () => {
    expect(() =>
      render(<EditorSidebar {...base} letter={undefined} />)
    ).not.toThrow();
  });

  it('shows the save status when provided', () => {
    const saveStatus = {
      status: 'saved',
      savedAt: new Date().toISOString(),
      isDefault: false,
      saveNow: () => {},
      setAsDefault: () => {},
      clearDefault: () => {},
    };
    render(<EditorSidebar {...base} saveStatus={saveStatus} />);
    expect(screen.getByRole('status')).toHaveTextContent(/saved/i);
    expect(screen.getByText('Set default')).toBeInTheDocument();
  });

  it('offers a Drive entry point when provided', () => {
    const onOpenDrive = vi.fn();
    render(<EditorSidebar {...base} onOpenDrive={onOpenDrive} />);
    fireEvent.click(screen.getByRole('button', { name: /google drive/i }));
    expect(onOpenDrive).toHaveBeenCalled();
  });

  it('hides the save status when not provided', () => {
    render(<EditorSidebar {...base} />);
    expect(screen.queryByText('Set default')).not.toBeInTheDocument();
  });
});
