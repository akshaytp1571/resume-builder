import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import {
  createCoverLetter,
  normalizeCoverLetter,
  renderCoverLetter,
  suggestCoverLetter,
  formatLetterDate,
  isCoverLetterEmpty,
  countWords,
} from '../utils/coverLetter.js';
import { INITIAL_RESUME_DATA } from '../data/initialData.js';
import CoverLetterEditor from '../components/editor/CoverLetterEditor.jsx';

/** The shipped sample resume, cloned so a test cannot mutate the fixture. */
const sample = () => JSON.parse(JSON.stringify(INITIAL_RESUME_DATA));

const HOSTILE = [
  ['null', null],
  ['undefined', undefined],
  ['string', 'a resume'],
  ['number', 42],
  ['array', [1, 2, 3]],
  ['empty object', {}],
  ['null fields', { personalInfo: null, summary: null, skills: null, experience: null }],
  ['wrong types', { personalInfo: 5, summary: {}, skills: 'x', experience: {} }],
  ['null holes', { skills: [null, undefined], experience: [null], personalInfo: {} }],
];

describe('createCoverLetter', () => {
  it('returns every field with sensible defaults', () => {
    const l = createCoverLetter();
    expect(typeof l.id).toBe('string');
    expect(l.id.length).toBeGreaterThan(0);
    expect(l.jobTitle).toBe('');
    expect(l.company).toBe('');
    expect(l.hiringManager).toBe('');
    expect(l.body).toBe('');
    expect(l.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('gives each letter a unique id', () => {
    const ids = new Set();
    for (let i = 0; i < 200; i++) ids.add(createCoverLetter().id);
    expect(ids.size).toBe(200);
  });
});

describe('renderCoverLetter', () => {
  it('produces a salutation, body and sign-off', () => {
    const letter = {
      ...createCoverLetter(),
      body: 'First paragraph.\n\nSecond paragraph.',
    };
    const text = renderCoverLetter(letter, sample());

    expect(text).toContain('Dear Hiring Manager,');
    expect(text).toContain('First paragraph.');
    expect(text).toContain('Second paragraph.');
    expect(text).toContain('Sincerely,');
    // Sign-off is followed by the candidate's real name.
    expect(text.trimEnd().endsWith('Alex Morgan')).toBe(true);
  });

  it('uses the hiring manager name when given', () => {
    const text = renderCoverLetter(
      { ...createCoverLetter(), hiringManager: 'Priya Raman', body: 'Hi.' },
      sample()
    );
    expect(text).toContain('Dear Priya Raman,');
    expect(text).not.toContain('Dear Hiring Manager,');
  });

  it('falls back to "Dear Hiring Manager," when the name is blank', () => {
    const text = renderCoverLetter(
      { ...createCoverLetter(), hiringManager: '   ', body: 'Hi.' },
      sample()
    );
    expect(text).toContain('Dear Hiring Manager,');
  });

  it('keeps paragraph breaks instead of collapsing them', () => {
    const text = renderCoverLetter(
      { ...createCoverLetter(), body: 'One.\n\nTwo.\n\nThree.' },
      sample()
    );
    expect(text).toMatch(/One\.\n\nTwo\.\n\nThree\./);
  });

  it('renders a letter with an empty body without crashing', () => {
    const text = renderCoverLetter(createCoverLetter(), sample());
    expect(text).toContain('Dear Hiring Manager,');
    expect(text).toContain('Sincerely,');
  });

  it('survives hostile input for both arguments', () => {
    for (const [label, value] of HOSTILE) {
      expect(() => renderCoverLetter(value, value), label).not.toThrow();
      expect(() => renderCoverLetter(value, sample()), label).not.toThrow();
      expect(() => renderCoverLetter(createCoverLetter(), value), label).not.toThrow();
    }
  });

  it('never emits the literal "undefined" or "[object Object]"', () => {
    for (const [label, value] of HOSTILE) {
      const text = renderCoverLetter(value, value);
      expect(text, label).not.toContain('undefined');
      expect(text, label).not.toContain('[object Object]');
    }
  });
});

describe('suggestCoverLetter', () => {
  it('mentions the real role and a real skill from a full resume', () => {
    const draft = suggestCoverLetter(sample(), '');
    expect(draft).toContain('QA Lead');
    expect(draft).toContain('Northwind Technologies');
    // A real skill from the resume, not an invented one.
    expect(draft.toLowerCase()).toContain('manual functional testing');
    // The real name.
    expect(draft).toContain('Alex Morgan');
  });

  it('never produces a bracketed placeholder', () => {
    const cases = [sample(), {}, null, undefined, 'string', [1, 2], { personalInfo: {} }];
    for (const value of cases) {
      const draft = suggestCoverLetter(value, 'Some job description');
      expect(draft).not.toMatch(/\[[^\]]*\]/);
      expect(draft).not.toContain('[Company]');
      expect(draft).not.toContain('[Your Name]');
      expect(draft).not.toContain('undefined');
      expect(draft).not.toContain('[object Object]');
    }
  });

  it('does not open with the mail-merge cliché', () => {
    const draft = suggestCoverLetter(sample(), '');
    expect(draft.toLowerCase()).not.toContain('i am writing to express my interest');
  });

  it('produces real prose, not a template skeleton', () => {
    const draft = suggestCoverLetter(sample(), '');
    // Multiple paragraphs of connected sentences.
    expect(draft.split(/\n\s*\n/).length).toBeGreaterThanOrEqual(2);
    expect(countWords(draft)).toBeGreaterThan(30);
  });

  it('degrades to something short and honest on a sparse resume', () => {
    const draft = suggestCoverLetter({ personalInfo: { fullName: 'Sam Lee' } }, '');
    expect(draft.length).toBeGreaterThan(0);
    expect(draft).toContain('Sam Lee');
    // Short, not a padded skeleton.
    expect(countWords(draft)).toBeLessThan(40);
  });

  it('does not throw for any hostile resume', () => {
    for (const [label, value] of HOSTILE) {
      expect(() => suggestCoverLetter(value, 'jd'), label).not.toThrow();
      expect(() => suggestCoverLetter(value, value), label).not.toThrow();
    }
  });

  it('is deterministic for the same input', () => {
    const a = suggestCoverLetter(sample(), 'jd');
    const b = suggestCoverLetter(sample(), 'jd');
    expect(a).toBe(b);
  });

  it('does not mutate the resume it is given', () => {
    const data = sample();
    const before = JSON.stringify(data);
    suggestCoverLetter(data, 'jd');
    expect(JSON.stringify(data)).toBe(before);
  });
});

describe('normalizeCoverLetter', () => {
  it('fills every field from garbage', () => {
    const l = normalizeCoverLetter({ jobTitle: 5, company: null, body: undefined });
    expect(l.jobTitle).toBe('5');
    expect(l.company).toBe('');
    expect(l.body).toBe('');
    expect(typeof l.id).toBe('string');
  });

  it('preserves a real letter', () => {
    const original = {
      id: 'letter-1',
      jobTitle: 'QA Lead',
      company: 'Acme',
      hiringManager: 'Priya',
      body: 'Body text.',
      date: '2026-01-02',
    };
    expect(normalizeCoverLetter(original)).toEqual(original);
  });
});

describe('formatLetterDate', () => {
  it('formats a real ISO date', () => {
    expect(formatLetterDate('2026-01-02')).toMatch(/2026/);
  });

  it('returns the raw string for an unparseable date rather than "Invalid Date"', () => {
    expect(formatLetterDate('not-a-date')).toBe('not-a-date');
  });

  it('falls back to today when empty or missing', () => {
    expect(formatLetterDate('').length).toBeGreaterThan(0);
    expect(formatLetterDate(null).length).toBeGreaterThan(0);
    expect(formatLetterDate(null)).not.toContain('Invalid');
  });
});

describe('isCoverLetterEmpty / countWords', () => {
  it('treats a fresh letter as empty', () => {
    expect(isCoverLetterEmpty(createCoverLetter())).toBe(true);
    expect(isCoverLetterEmpty(null)).toBe(true);
  });

  it('treats a written letter as non-empty', () => {
    expect(isCoverLetterEmpty({ body: 'Hello.' })).toBe(false);
  });

  it('counts words and survives junk', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('   ')).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords(42)).toBe(1);
  });
});

describe('CoverLetterEditor', () => {
  const mount = (overrides = {}) => {
    const onChange = vi.fn();
    const utils = render(
      <CoverLetterEditor
        letter={createCoverLetter()}
        resumeData={sample()}
        onChange={onChange}
        {...overrides}
      />
    );
    return { ...utils, onChange };
  };

  it('renders all five fields, labelled', () => {
    const { container } = mount();
    const fields = [...container.querySelectorAll('input, textarea')];
    expect(fields.length).toBe(5);
    for (const el of fields) {
      const labelled =
        Boolean(el.id && container.querySelector(`label[for="${el.id}"]`)) ||
        Boolean(el.getAttribute('aria-label'));
      expect(labelled, `field ${el.id || el.tagName} is unlabelled`).toBe(true);
    }
  });

  it('emits the edited letter through onChange', () => {
    const { container, onChange } = mount();
    const body = container.querySelector('textarea');
    fireEvent.change(body, { target: { value: 'Hello there.' } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)[0].body).toBe('Hello there.');
  });

  it('fills the body with a real draft when Generate draft is pressed', () => {
    const { container, onChange, getByRole } = mount();
    fireEvent.click(getByRole('button', { name: /generate draft/i }));
    const next = onChange.mock.calls.at(-1)[0];
    expect(next.body).toContain('QA Lead');
    expect(next.body).not.toMatch(/\[[^\]]*\]/);
    expect(container.querySelector('textarea').value).toBe('');
  });

  it('renders without throwing when the letter and resume are missing', () => {
    expect(() =>
      render(<CoverLetterEditor letter={null} resumeData={null} onChange={() => {}} />)
    ).not.toThrow();
  });
});
