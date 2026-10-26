import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { TEMPLATES_CONFIG } from '../../data/initialData';
import { getDroppedSections } from '../../data/templateCapabilities';
import { sound } from '../../utils/soundEffects';
import { SectionIndex, Chip } from '../ui/primitives';

const COLOR_PRESETS = [
  {
    name: 'Slate (default)',
    primary: '#3E5566',
    secondary: '#56707F',
  },
  {
    name: 'Deep Navy',
    primary: '#1e3a8a',
    secondary: '#2563eb',
  },
  {
    name: 'Emerald',
    primary: '#0f766e',
    secondary: '#0d9488',
  },
  {
    name: 'Violet',
    primary: '#3730a3',
    secondary: '#6366f1',
  },
  {
    name: 'Near Black',
    primary: '#18181b',
    secondary: '#52525b',
  },
  {
    name: 'Crimson',
    primary: '#881337',
    secondary: '#be123c',
  },
];

const FONT_OPTIONS = [
  { name: 'Calibri (Original)', value: "'Calibri', 'Segoe UI', system-ui, sans-serif" },
  { name: 'Inter (Modern Sans)', value: "'Inter', system-ui, sans-serif" },
  { name: 'Poppins (Geometric)', value: "'Poppins', sans-serif" },
  { name: 'Roboto (Clean)', value: "'Roboto', sans-serif" },
  { name: 'Merriweather (Classic Serif)', value: "'Merriweather', Georgia, serif" },
];

/**
 * A miniature plate per template: pure CSS bars approximating that template's
 * layout. No image dependency, no icon per template — the arrangement is the mark.
 */
function TemplatePlate({ id, color }) {
  const bar = (key, w, h = 2, extra = '') => (
    <span
      key={key}
      className={`block ${extra}`}
      style={{ width: w, height: h, backgroundColor: 'var(--rule-2)' }}
    />
  );
  const accent = { backgroundColor: color };

  const layouts = {
    classic: (
      <>
        {bar('h', '55%', 3, 'mb-1')}
        <span className="mb-1 block h-[8px] w-[10px]" style={accent} />
        {bar('a', '90%')}
        {bar('b', '74%')}
      </>
    ),
    modern: (
      <span className="flex h-full gap-1">
        <span className="flex w-1/3 flex-col gap-0.5 border-r pr-1" style={{ borderColor: 'var(--rule)' }}>
          <span className="block h-[7px] w-full" style={accent} />
          {bar('a', '80%')}
          {bar('b', '60%')}
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          {bar('c', '70%', 3, 'mb-0.5')}
          {bar('d', '100%')}
          {bar('e', '88%')}
        </span>
      </span>
    ),
    minimal: (
      <>
        {bar('h', '42%', 2, 'mb-1')}
        <span className="mb-1 block h-px w-full" style={accent} />
        {bar('a', '96%')}
        {bar('b', '96%')}
        {bar('c', '68%')}
      </>
    ),
    creative: (
      <>
        <span className="mb-1 block h-[6px] w-full" style={accent} />
        {bar('h', '64%', 3, 'mb-1')}
        <span className="flex flex-wrap gap-0.5">
          <span className="block h-[3px] w-[9px] border" style={{ borderColor: color }} />
          <span className="block h-[3px] w-[9px] border" style={{ borderColor: color }} />
          <span className="block h-[3px] w-[9px] border" style={{ borderColor: color }} />
        </span>
      </>
    ),
    executive: (
      <>
        {bar('h', '48%', 3, 'mb-1')}
        <span className="mb-1 block h-px w-8" style={accent} />
        {bar('a', '90%')}
        {bar('b', '82%')}
      </>
    ),
    compact: (
      <>
        {bar('h', '38%', 2, 'mb-0.5')}
        {bar('a', '94%')}
        {bar('b', '94%')}
        {bar('c', '94%', 2, 'mt-0.5')}
        {bar('d', '70%')}
      </>
    ),
    tech: (
      <span className="flex h-full gap-1">
        <span className="flex w-[3px] flex-col" style={accent} />
        <span className="flex flex-1 flex-col gap-0.5">
          {bar('a', '100%', 2)}
          {bar('b', '84%')}
          {bar('c', '92%')}
          {bar('d', '66%')}
        </span>
      </span>
    ),
    academic: (
      <>
        {bar('h', '60%', 2, 'mx-auto mb-1')}
        <span className="mb-1 block h-px w-full" style={accent} />
        {bar('a', '100%')}
        {bar('b', '94%')}
        {bar('c', '88%')}
      </>
    ),
    startup: (
      <>
        <span className="mb-1 flex items-center gap-1">
          <span className="block h-[8px] w-[8px]" style={accent} />
          {bar('h', '60%', 3)}
        </span>
        {bar('a', '92%')}
        {bar('b', '78%')}
      </>
    ),
  };

  return (
    <span
      aria-hidden="true"
      className="mb-1.5 flex h-11 w-full flex-col justify-start overflow-hidden border border-rule bg-void px-1.5 py-1.5"
    >
      {layouts[id] || layouts.classic}
    </span>
  );
}

export default function ThemeCustomizer({ theme, onChange, resumeData }) {
  const handleUpdate = (field, value) => {
    sound.playAction();
    onChange({
      ...theme,
      [field]: value,
    });
  };

  return (
    <div className="space-y-5">
      {/* template plates — 3x3, hairline grid */}
      <div>
        <SectionIndex
          index={1}
          title="Theme"
          action={<Chip>{TEMPLATES_CONFIG.length} templates</Chip>}
        />

        <div className="grid grid-cols-3 gap-2">
          {TEMPLATES_CONFIG.map((tpl) => {
            const isSelected = theme.templateId === tpl.id;
            const dropped = getDroppedSections(tpl.id, resumeData);
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleUpdate('templateId', tpl.id)}
                className={`cursor-pointer rounded-[2px] border p-1.5 text-left transition-colors duration-[90ms] ${
                  isSelected
                    ? 'border-signal/60 bg-[rgba(216,255,62,0.04)]'
                    : 'border-rule hover:border-rule-2'
                }`}
              >
                <TemplatePlate id={tpl.id} color={tpl.previewColor} />
                {/* Two lines rather than one truncated line. "EXECUTIVE ..."
                    tells the user nothing, and every name here is a real
                    choice they have to distinguish. leading-tight keeps a
                    two-line label from pushing the grid out of alignment. */}
                <span
                  className={`dt-label mt-1 block text-[9px] leading-tight ${
                    isSelected ? 'text-signal' : 'text-bone-52'
                  }`}
                  title={tpl.name}
                >
                  {tpl.name}
                </span>
                {!isSelected && dropped.length > 0 && (
                  <span
                    className="mt-0.5 flex items-start gap-1 text-[9px] leading-snug text-alarm"
                    title={`This template does not render: ${dropped.join(', ')}`}
                  >
                    <AlertTriangle size={9} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">Hides {dropped.join(', ')}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* palette — 1px-bordered swatch squares with hex readouts */}
      <div className="border-t border-rule pt-4">
        <span className="dt-label mb-2 block text-bone-52">Palette &amp; Chromatics</span>

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {COLOR_PRESETS.map((cp, idx) => {
            const isMatch = theme.primaryColor === cp.primary;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  sound.playAction();
                  onChange({
                    ...theme,
                    primaryColor: cp.primary,
                    secondaryColor: cp.secondary,
                  });
                }}
                className={`flex cursor-pointer items-center gap-2 rounded-[2px] border px-2 py-1.5 text-left transition-colors duration-[90ms] ${
                  isMatch ? 'border-signal/50' : 'border-rule hover:border-rule-2'
                }`}
              >
                <span className="flex shrink-0 items-center gap-1">
                  <span
                    className="block h-4 w-4 border border-rule-2"
                    style={{ backgroundColor: cp.primary }}
                  />
                  <span
                    className="block h-4 w-4 border border-rule-2"
                    style={{ backgroundColor: cp.secondary }}
                  />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="dt-data block truncate text-[11px] text-bone-70">{cp.name}</span>
                  <span className="dt-data block text-[10px] text-bone-32">
                    {cp.primary} · {cp.secondary}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* custom hex selector */}
        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-rule pt-3">
          <div className="flex items-center gap-2">
            <span className="dt-label text-bone-32">Primary</span>
            {/* A bare <input type="color"> is a control with no accessible name:
                the <span> beside it is a sibling, not a label. */}
            <input
              type="color"
              aria-label="Primary colour"
              value={theme.primaryColor || '#3E5566'}
              onChange={(e) => handleUpdate('primaryColor', e.target.value)}
              className="h-6 w-6 cursor-pointer rounded-[2px] border border-rule-2 bg-transparent"
            />
            <span className="dt-data text-bone-70">{theme.primaryColor}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="dt-label text-bone-32">Secondary</span>
            <input
              type="color"
              aria-label="Secondary colour"
              value={theme.secondaryColor || '#56707F'}
              onChange={(e) => handleUpdate('secondaryColor', e.target.value)}
              className="h-6 w-6 cursor-pointer rounded-[2px] border border-rule-2 bg-transparent"
            />
            <span className="dt-data text-bone-70">{theme.secondaryColor}</span>
          </div>
        </div>
      </div>

      {/* page budget */}
      <div className="border-t border-rule pt-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="dt-label text-bone-52">Page Budget &amp; Fit</span>
          <Chip tone={theme.singlePage !== false ? 'present' : 'neutral'}>
            {theme.singlePage !== false ? '1-page locked' : 'Expanded'}
          </Chip>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onChange({
                ...theme,
                singlePage: true,
                fontSize: 'compact',
              });
            }}
            className={`cursor-pointer rounded-[2px] border p-2.5 text-left transition-colors duration-[90ms] ${
              theme.singlePage !== false
                ? 'border-signal/50'
                : 'border-rule hover:border-rule-2'
            }`}
          >
            <span
              className={`dt-label mb-1 block ${
                theme.singlePage !== false ? 'text-signal' : 'text-bone-52'
              }`}
            >
              1-Page Strict
            </span>
            <p className="text-[11px] leading-snug text-bone-32">
              Auto-compresses margins so Languages & Education fit on Page 1.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onChange({
                ...theme,
                singlePage: false,
                fontSize: 'normal',
              });
            }}
            className={`cursor-pointer rounded-[2px] border p-2.5 text-left transition-colors duration-[90ms] ${
              theme.singlePage === false
                ? 'border-signal/50'
                : 'border-rule hover:border-rule-2'
            }`}
          >
            <span
              className={`dt-label mb-1 block ${
                theme.singlePage === false ? 'text-signal' : 'text-bone-52'
              }`}
            >
              Multi-Page
            </span>
            <p className="text-[11px] leading-snug text-bone-32">
              Relaxed spacing for multi-page documents and extensive CVs.
            </p>
          </button>
        </div>
      </div>

      {/* typography & density */}
      <div className="border-t border-rule pt-4">
        <span className="dt-label mb-2 block text-bone-52">
          Typography &amp; Information Density
        </span>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="theme-font"
              className="dt-label mb-1 block text-bone-32"
            >
              Resume Font Family
            </label>
            <select
              id="theme-font"
              value={theme.fontFamily || "'Calibri', 'Segoe UI', system-ui, sans-serif"}
              onChange={(e) => handleUpdate('fontFamily', e.target.value)}
              className="dt-data w-full cursor-pointer rounded-[2px] border border-rule-2 bg-transparent px-2 py-1.5 text-bone focus:outline-none"
            >
              {FONT_OPTIONS.map((f, i) => (
                <option key={i} value={f.value} className="bg-housing text-bone">
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="dt-label mb-1 block text-bone-32">Content Density Preset</span>
            <div className="grid grid-cols-3 gap-1.5">
              {['compact', 'normal', 'relaxed'].map((density) => (
                <button
                  key={density}
                  type="button"
                  onClick={() => handleUpdate('fontSize', density)}
                  className={`dt-label cursor-pointer rounded-[2px] border py-1.5 text-center capitalize transition-colors duration-[90ms] ${
                    theme.fontSize === density
                      ? 'border-signal/50 text-signal'
                      : 'border-rule text-bone-32 hover:border-rule-2 hover:text-bone-70'
                  }`}
                >
                  {density}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
