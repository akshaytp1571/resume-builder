import React from 'react';
import { Palette, Type, Layout, Check, Sparkles, FileText, Layers, AlertTriangle } from 'lucide-react';
import { TEMPLATES_CONFIG } from '../../data/initialData';
import { getDroppedSections } from '../../data/templateCapabilities';
import { sound } from '../../utils/soundEffects';

const COLOR_PRESETS = [
  {
    name: 'Executive Slate (Default)',
    primary: '#3E5566',
    secondary: '#56707F',
  },
  {
    name: 'Deep Cyber Navy',
    primary: '#1e3a8a',
    secondary: '#2563eb',
  },
  {
    name: 'Matrix Emerald',
    primary: '#0f766e',
    secondary: '#0d9488',
  },
  {
    name: 'Cyberpunk Violet',
    primary: '#3730a3',
    secondary: '#6366f1',
  },
  {
    name: 'Obsidian Stealth',
    primary: '#18181b',
    secondary: '#52525b',
  },
  {
    name: 'Neon Crimson',
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

export default function ThemeCustomizer({ theme, onChange, resumeData }) {
  const handleUpdate = (field, value) => {
    sound.playAction();
    onChange({
      ...theme,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6 text-xs text-pink-100 animate-fade-in font-sans">
      {/* Template Chooser Matrix */}
      <div>
        <label className="block text-[11px] font-bold text-pink-200 uppercase tracking-wider mb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Layout size={13} className="text-rose-400" />
            ✦ Resume Template Design ({TEMPLATES_CONFIG.length})
          </span>
          <span className="text-[10px] text-pink-400/85 font-sans">Instant Preview</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {TEMPLATES_CONFIG.map((tpl) => {
            const isSelected = theme.templateId === tpl.id;
            const dropped = getDroppedSections(tpl.id, resumeData);
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleUpdate('templateId', tpl.id)}
                className={`p-3 rounded-xl text-left transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'bg-[#3b133e] border border-pink-400 shadow-[0_6px_24px_rgba(244,63,94,0.3)]'
                    : 'bg-[#1b081e] border border-pink-500/20 hover:border-pink-500/50 hover:bg-[#250c29]'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold">
                    <Check size={11} className="stroke-[3]" />
                  </span>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_6px_currentColor]"
                    style={{ backgroundColor: tpl.previewColor }}
                  />
                  <span className="text-xs font-bold text-pink-50">{tpl.name}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] font-semibold px-2 py-0.2 rounded-full bg-pink-950/80 text-pink-300 border border-pink-500/30">
                    {tpl.badge}
                  </span>
                </div>
                <p className="text-[11px] text-pink-300/70 line-clamp-2 leading-relaxed">
                  {tpl.description}
                </p>
                {!isSelected && dropped.length > 0 && (
                  <p
                    className="mt-1.5 flex items-start gap-1 text-[10px] font-medium text-amber-300/90 leading-snug"
                    title={`This template does not render: ${dropped.join(', ')}`}
                  >
                    <AlertTriangle size={10} className="mt-0.5 shrink-0 text-amber-400" />
                    <span>Hides {dropped.join(', ')}</span>
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chromatic Palette Matrix */}
      <div>
        <label className="block text-[11px] font-bold text-pink-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Palette size={13} className="text-rose-400" />
          ✦ Palette & Chromatics
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
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
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  isMatch
                    ? 'bg-[#3b133e] border-pink-400 shadow-[0_0_15px_rgba(244,63,94,0.25)]'
                    : 'bg-[#1b081e] border-pink-500/20 hover:border-pink-500/40 hover:bg-[#250c29]'
                }`}
              >
                <div className="flex items-center -space-x-1">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/40"
                    style={{ backgroundColor: cp.primary }}
                  />
                  <span
                    className="w-3 h-3 rounded-full border border-white/40"
                    style={{ backgroundColor: cp.secondary }}
                  />
                </div>
                <span className="text-[10.5px] font-medium text-pink-200 truncate">
                  {cp.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom hex selector */}
        <div className="flex items-center gap-4 p-2.5 rounded-xl bg-[#1b081e] border border-pink-500/20 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-pink-300 text-[10px] uppercase font-bold">Primary:</span>
            <input
              type="color"
              value={theme.primaryColor || '#3E5566'}
              onChange={(e) => handleUpdate('primaryColor', e.target.value)}
              className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent"
            />
            <span className="text-pink-200 text-[11px] font-mono">{theme.primaryColor}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-pink-300 text-[10px] uppercase font-bold">Secondary:</span>
            <input
              type="color"
              value={theme.secondaryColor || '#56707F'}
              onChange={(e) => handleUpdate('secondaryColor', e.target.value)}
              className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent"
            />
            <span className="text-pink-200 text-[11px] font-mono">{theme.secondaryColor}</span>
          </div>
        </div>
      </div>

      {/* Page Budget & Fit Mode */}
      <div>
        <label className="block text-[11px] font-bold text-pink-200 uppercase tracking-wider mb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <FileText size={13} className="text-rose-400" />
            ✦ Page Budget & Strict 1-Page Fit
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            theme.singlePage !== false
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
              : 'bg-pink-950/80 text-pink-300 border-pink-700'
          }`}>
            {theme.singlePage !== false ? '1-PAGE LOCKED' : 'EXPANDED'}
          </span>
        </label>
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
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              theme.singlePage !== false
                ? 'bg-[#102b20] border-emerald-400 text-emerald-200 shadow-[0_4px_16px_rgba(16,185,129,0.2)]'
                : 'bg-[#1b081e] border-pink-500/20 text-pink-300/70 hover:border-pink-500/40'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
              <Sparkles size={12} className={theme.singlePage !== false ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
              <span>1-PAGE STRICT</span>
            </div>
            <p className="text-[10.5px] text-pink-300/70">
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
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              theme.singlePage === false
                ? 'bg-[#3b133e] border-pink-400 text-pink-100 shadow-[0_4px_16px_rgba(244,63,94,0.25)]'
                : 'bg-[#1b081e] border-pink-500/20 text-pink-300/70 hover:border-pink-500/40'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
              <Layers size={12} className={theme.singlePage === false ? 'text-rose-400' : 'text-slate-400'} />
              <span>MULTI-PAGE</span>
            </div>
            <p className="text-[10.5px] text-pink-300/70">
              Relaxed spacing for multi-page documents and extensive CVs.
            </p>
          </button>
        </div>
      </div>

      {/* Typography & Spacing */}
      <div>
        <label className="block text-[11px] font-bold text-pink-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Type size={13} className="text-rose-400" />
          ✦ Typography & Information Density
        </label>
        <div className="space-y-3">
          <div>
            <label className="block text-[10.5px] font-medium text-pink-300/80 mb-1">
              Resume Font Family
            </label>
            <select
              value={theme.fontFamily || "'Calibri', 'Segoe UI', system-ui, sans-serif"}
              onChange={(e) => handleUpdate('fontFamily', e.target.value)}
              className="w-full bg-[#1b081e] border border-pink-500/30 rounded-xl px-3 py-2 text-xs text-pink-100 focus:outline-none focus:border-pink-400"
            >
              {FONT_OPTIONS.map((f, i) => (
                <option key={i} value={f.value} className="bg-[#1b081e] text-pink-100">
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10.5px] font-medium text-pink-300/80 mb-1">
              Content Density Preset
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['compact', 'normal', 'relaxed'].map((density) => (
                <button
                  key={density}
                  type="button"
                  onClick={() => handleUpdate('fontSize', density)}
                  className={`py-2 text-[11px] font-bold uppercase rounded-xl transition-all cursor-pointer ${
                    theme.fontSize === density
                      ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-[0_2px_12px_rgba(244,63,94,0.35)]'
                      : 'bg-[#1b081e] border border-pink-500/20 text-pink-300/70 hover:border-pink-500/40 hover:text-pink-100'
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
