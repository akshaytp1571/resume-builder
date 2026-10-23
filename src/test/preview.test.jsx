import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ResumePreview from '../components/preview/ResumePreview.jsx';
import { fullResume, hostileThemes } from './fixtures.js';

/**
 * ResumePreview used to read `theme.templateId` without a guard, which threw
 * for ALL nine templates whenever the theme was null or missing. The templates
 * themselves were hardened in v2.0; this covers the preview wrapper, which is
 * the layer above them and was still unguarded.
 *
 * QA reported it as "theme = null throws for all 9 templates (mitigated by
 * normalizeTheme(null), not fixed in the templates)". This is the fix.
 */
describe('ResumePreview theme guard', () => {
  const renderWith = (theme) =>
    render(
      <ResumePreview
        resumeData={fullResume()}
        theme={theme}
        onDownloadPdf={() => {}}
        onDownloadDocx={() => {}}
      />
    );

  it('renders with a null theme instead of throwing', () => {
    expect(() => renderWith(null)).not.toThrow();
  });

  it('renders with an undefined theme', () => {
    expect(() => renderWith(undefined)).not.toThrow();
  });

  it('renders with every hostile theme in the matrix', () => {
    for (const [label, theme] of hostileThemes()) {
      expect(() => renderWith(theme), `threw on "${label}"`).not.toThrow();
    }
  });

  it('falls back to the classic template when templateId is missing', () => {
    const { container } = renderWith({});
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it('renders an unknown templateId rather than crashing', () => {
    expect(() => renderWith({ templateId: 'does-not-exist' })).not.toThrow();
  });
});
