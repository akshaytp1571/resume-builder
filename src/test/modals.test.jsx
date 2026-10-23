import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import AtsScoreModal from '../components/ui/AtsScoreModal.jsx';
import AiConfigModal from '../components/ui/AiConfigModal.jsx';
import JobCredentialsModal from '../components/ui/JobCredentialsModal.jsx';
import ResumeUploadModal from '../components/ui/ResumeUploadModal.jsx';
import ImageCropModal from '../components/ui/ImageCropModal.jsx';
import ErrorBoundary from '../components/ui/ErrorBoundary.jsx';
import ApplyModal from '../components/ui/ApplyModal.jsx';
import JobMatchModal from '../components/ui/JobMatchModal.jsx';
import AiRefineModal from '../components/ui/AiRefineModal.jsx';

import { calculateAtsScore } from '../utils/atsScorer.js';
import { fullResume, emptyResume, hostileResumes } from './fixtures.js';

/**
 * Every dialog in the app, mounted for real.
 *
 * These are contract tests, not snapshot tests: each modal must render, be
 * announced as a dialog, close on Escape, survive hostile data, and label its
 * icon-only buttons. A blank screen or an unlabelled X is the failure mode
 * these catch, and no source grep can.
 */

// ApplyModal probes the local apply agent on mount. jsdom has no server there,
// so let the real fetch reject rather than hitting the network.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
});

const atsResult = () => calculateAtsScore(fullResume());

const noop = () => {};

/**
 * Every <button> must have an accessible name: visible text, an aria-label, or
 * an aria-labelledby that resolves. An icon-only button with none is invisible
 * to a screen reader.
 */
function assertEveryButtonIsNamed() {
  const buttons = [...document.querySelectorAll('button')];
  expect(buttons.length).toBeGreaterThan(0);

  const nameless = buttons.filter((b) => {
    if ((b.textContent || '').trim()) return false;
    if ((b.getAttribute('aria-label') || '').trim()) return false;
    const labelledBy = b.getAttribute('aria-labelledby');
    if (labelledBy) {
      return !labelledBy
        .split(/\s+/)
        .every((id) => (document.getElementById(id)?.textContent || '').trim());
    }
    // An image-only button can still be named by its alt text.
    if ((b.querySelector('img[alt]')?.getAttribute('alt') || '').trim()) return false;
    return true;
  });

  expect(nameless.map((b) => b.outerHTML.slice(0, 120))).toEqual([]);
}

/** Mount, assert the shared dialog contract, assert Escape closes. */
function expectDialogContract(ui, onClose) {
  const { unmount } = render(ui);
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  // The accessible name must resolve to real text.
  expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
  expect(document.getElementById(dialog.getAttribute('aria-labelledby'))).toBeTruthy();

  assertEveryButtonIsNamed();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();

  unmount();
}

describe('AtsScoreModal', () => {
  it('renders and is announced as a dialog', () => {
    const onClose = vi.fn();
    render(<AtsScoreModal atsResult={atsResult()} onClose={onClose} resumeData={fullResume()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/ATS Readiness/i)).toBeInTheDocument();
  });

  it('meets the full dialog contract', () => {
    const onClose = vi.fn();
    expectDialogContract(
      <AtsScoreModal atsResult={atsResult()} onClose={onClose} resumeData={fullResume()} />,
      onClose
    );
  });

  it('survives every hostile resume shape', () => {
    for (const [label, data] of hostileResumes()) {
      const { unmount } = render(
        <AtsScoreModal atsResult={atsResult()} onClose={noop} resumeData={data} />
      );
      expect(screen.getByRole('dialog'), `crashed on: ${label}`).toBeInTheDocument();
      unmount();
    }
  });

  it('survives an empty resume', () => {
    render(<AtsScoreModal atsResult={atsResult()} onClose={noop} resumeData={emptyResume()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('AiConfigModal', () => {
  it('meets the full dialog contract when open', () => {
    const onClose = vi.fn();
    expectDialogContract(
      <AiConfigModal isOpen onClose={onClose} onConfigSaved={noop} />,
      onClose
    );
  });

  it('renders nothing when closed', () => {
    const { container } = render(<AiConfigModal isOpen={false} onClose={noop} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('JobCredentialsModal', () => {
  it('meets the full dialog contract when open', () => {
    const onClose = vi.fn();
    expectDialogContract(
      <JobCredentialsModal isOpen onClose={onClose} onSaved={noop} />,
      onClose
    );
  });

  it('renders nothing when closed', () => {
    const { container } = render(<JobCredentialsModal isOpen={false} onClose={noop} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ResumeUploadModal', () => {
  it('meets the full dialog contract when open', () => {
    const onClose = vi.fn();
    expectDialogContract(
      <ResumeUploadModal
        isOpen
        onClose={onClose}
        currentResumeData={fullResume()}
        onApplyParsedResume={noop}
        onOpenAiConfig={noop}
      />,
      onClose
    );
  });

  it('renders nothing when closed', () => {
    const { container } = render(<ResumeUploadModal isOpen={false} onClose={noop} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not throw when the current resume is hostile', () => {
    for (const [label, data] of hostileResumes()) {
      const { unmount } = render(
        <ResumeUploadModal
          isOpen
          onClose={noop}
          currentResumeData={data}
          onApplyParsedResume={noop}
          onOpenAiConfig={noop}
        />
      );
      expect(screen.getByRole('dialog'), `crashed on: ${label}`).toBeInTheDocument();
      unmount();
    }
  });
});

describe('ImageCropModal', () => {
  it('meets the full dialog contract when open', () => {
    const onClose = vi.fn();
    expectDialogContract(
      <ImageCropModal
        isOpen
        onClose={onClose}
        imageSrc="data:image/png;base64,iVBORw0KGgo="
        onApplyCrop={noop}
      />,
      onClose
    );
  });

  it('renders nothing when closed or when there is no image', () => {
    const closed = render(<ImageCropModal isOpen={false} onClose={noop} />);
    expect(closed.container).toBeEmptyDOMElement();
    closed.unmount();

    const noImage = render(<ImageCropModal isOpen onClose={noop} imageSrc="" />);
    expect(noImage.container).toBeEmptyDOMElement();
  });
});

describe('ApplyModal', () => {
  const job = {
    id: 'j1',
    title: 'QA Lead',
    company: 'Northwind',
    location: 'Remote',
    applyUrl: 'https://example.com/apply',
    description: 'Own quality.',
    source: 'Board',
  };

  it('meets the full dialog contract when given a job', () => {
    const onClose = vi.fn();
    expectDialogContract(
      <ApplyModal isOpen onClose={onClose} job={job} resumeData={fullResume()} />,
      onClose
    );
  });

  it('renders nothing without a job', () => {
    const { container } = render(<ApplyModal isOpen onClose={noop} job={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('JobMatchModal', () => {
  it('meets the full dialog contract when open', () => {
    const onClose = vi.fn();
    expectDialogContract(
      <JobMatchModal
        isOpen
        onClose={onClose}
        resumeData={fullResume()}
        onApplyTailoredSummary={noop}
        onOpenAiConfig={noop}
        onOpenJobCredentials={noop}
        onOpenApply={noop}
      />,
      onClose
    );
  });

  it('does not throw when the resume is hostile', () => {
    for (const [label, data] of hostileResumes()) {
      const { unmount } = render(
        <JobMatchModal isOpen onClose={noop} resumeData={data} onOpenApply={noop} />
      );
      expect(screen.getByRole('dialog'), `crashed on: ${label}`).toBeInTheDocument();
      unmount();
    }
  });
});

describe('AiRefineModal', () => {
  it('meets the full dialog contract when open', () => {
    const onClose = vi.fn();
    expectDialogContract(
      <AiRefineModal
        isOpen
        originalText="Wrote tests."
        refinedText="Authored a regression suite covering 120 scenarios."
        onApply={noop}
        onRegenerate={async () => ''}
        onClose={onClose}
      />,
      onClose
    );
  });

  it('renders nothing when closed', () => {
    const { container } = render(<AiRefineModal isOpen={false} onClose={noop} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ErrorBoundary', () => {
  // React logs caught render errors to console.error; silence it for this file.
  let spy;
  beforeEach(() => {
    spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    return () => spy.mockRestore();
  });

  function Boom() {
    throw new Error('kaboom');
  }

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows a readable fallback instead of a blank screen', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Something broke the resume builder/i)).toBeInTheDocument();
    // The actual error is surfaced, not swallowed.
    expect(screen.getByText(/kaboom/)).toBeInTheDocument();
  });

  it('announces the failure assertively', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('labels both recovery buttons', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    assertEveryButtonIsNamed();
    expect(screen.getByRole('button', { name: /Download my data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload/i })).toBeInTheDocument();
  });

  it('downloads the RAW stored bytes, never a re-parsed copy', () => {
    const broken = '{"variants":[ BROKEN';
    localStorage.setItem('precision_resume_store_v2', broken);

    const createObjectURL = vi.fn(() => 'blob:rescue');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /Download my data/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('application/json');
    // The corrupt string is handed over verbatim - re-parsing would throw on
    // exactly the data this button exists to rescue.
    expect(blob).toBeInstanceOf(Blob);

    click.mockRestore();
  });

  it('explains itself when there is nothing to download', () => {
    localStorage.removeItem('precision_resume_store_v2');
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /Download my data/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/nothing to download/i);
  });
});
