import React, { useState } from 'react';
import { X, KeyRound, ShieldCheck, Eye, EyeOff, Trash2, Check } from 'lucide-react';
import {
  CREDENTIAL_FIELDS,
  getSavedCredentials,
  saveCredentials,
  clearCredentials,
  getConfiguredSites,
} from '../../utils/jobCredentials';
import { getResumePath, setResumePath } from '../../utils/resumePath';
import { sound } from '../../utils/soundEffects';
import ModalShell from './ModalShell';

export default function JobCredentialsModal({ isOpen, onClose, onSaved }) {
  const [draft, setDraft] = useState({});
  const [showPassword, setShowPassword] = useState({});
  const [configured, setConfigured] = useState([]);
  const [saved, setSaved] = useState(false);
  const [resumeFile, setResumeFile] = useState('');

  // Reload the stored values each time the modal is opened, so the form
  // always shows what is actually saved. Doing this during render avoids a
  // cascading render.
  const [loadedFor, setLoadedFor] = useState(null);
  if (isOpen && loadedFor !== isOpen) {
    setLoadedFor(isOpen);
    const existing = getSavedCredentials();
    setDraft(existing);
    setConfigured(getConfiguredSites(existing));
    setResumeFile(getResumePath());
    setSaved(false);
  }

  if (!isOpen) return null;

  const handleSave = () => {
    const merged = saveCredentials(draft);
    setDraft(merged);
    setConfigured(getConfiguredSites(merged));
    setResumePath(resumeFile);
    setSaved(true);
    sound.playSuccess();
    onSaved?.(merged);
  };

  const handleClear = () => {
    const cleared = clearCredentials();
    setDraft(cleared);
    setConfigured([]);
    setSaved(false);
    sound.playAction();
    onSaved?.(cleared);
  };

  const handleRemoveSite = (siteId) => {
    const next = { ...draft };
    delete next[siteId];
    setDraft(next);
    const merged = saveCredentials(next);
    setDraft(merged);
    setConfigured(getConfiguredSites(merged));
    sound.playAction();
    onSaved?.(merged);
  };

  return (
    <ModalShell onClose={onClose} labelledBy="job-credentials-title" zIndex="z-[60]" className="max-w-lg">
        {/* Header */}
        <div className="p-4 border-b border-pink-500/20 flex items-center justify-between bg-[#200824]/90 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#2e0d34] border border-pink-500/40 flex items-center justify-center text-rose-300">
              <KeyRound size={18} />
            </div>
            <div>
              <h2
                id="job-credentials-title"
                className="text-sm font-bold text-pink-50 tracking-wide"
              >
                Job Board Logins
              </h2>
              <p className="text-[11px] text-pink-300/70">
                Optional - unlocks filtered and personalised listings
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close job board logins dialog"
            onClick={() => {
              sound.playAction();
              onClose();
            }}
            className="p-1.5 rounded-xl text-pink-400/60 hover:text-pink-100 hover:bg-pink-900/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="p-3 rounded-2xl bg-emerald-950/25 border border-emerald-500/30 flex items-start gap-2">
            <ShieldCheck size={15} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-emerald-100/85 leading-relaxed text-[11px]">
              Stored in this browser only and sent to your local discovery
              service on <span className="font-mono">localhost:3457</span>.
              Never sent to the AI provider or any third party. On a shared
              machine, clear them when you are done.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#150518] border border-pink-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-pink-100 flex items-center gap-2">
                Resume file for applications
              </span>
              {resumeFile && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/50 text-[9px] font-bold text-emerald-300">
                  SET
                </span>
              )}
            </div>
            <p className="text-[10px] text-pink-300/60 leading-relaxed">
              Absolute path to the DOCX or PDF the apply agent should upload.
              Export one from this app first, then paste its full path here.
            </p>
            <input
              type="text"
              value={resumeFile}
              onChange={(e) => setResumeFile(e.target.value)}
              placeholder="C:\Users\aksha\Downloads\Akshay_Saseendran_Resume.docx"
              className="w-full bg-[#100410] border border-pink-500/25 rounded-xl p-2 text-xs text-pink-100 placeholder:text-pink-300/25 focus:outline-none focus:border-rose-400 font-mono"
            />
          </div>

          {CREDENTIAL_FIELDS.map((field) => {
            const entry = draft[field.id] || {};
            const isSet = configured.includes(field.id);
            return (
              <div
                key={field.id}
                className="p-3.5 rounded-2xl bg-[#150518] border border-pink-500/20 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-pink-100 flex items-center gap-2">
                    {field.label}
                    {isSet && (
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/50 text-[9px] font-bold text-emerald-300">
                        CONFIGURED
                      </span>
                    )}
                  </span>
                  {isSet && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSite(field.id)}
                      className="text-[10px] text-rose-300/70 hover:text-rose-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={11} />
                      Remove
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-pink-300/60 leading-relaxed">
                  {field.hint}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-pink-300 mb-1">
                      {field.usernameLabel}
                    </label>
                    <input
                      type="text"
                      autoComplete="username"
                      value={entry.username || ''}
                      onChange={(e) =>
                        setDraft({ ...draft, [field.id]: { ...entry, username: e.target.value } })
                      }
                      placeholder="you@example.com"
                      className="w-full bg-[#100410] border border-pink-500/25 rounded-xl p-2 text-xs text-pink-100 placeholder:text-pink-300/25 focus:outline-none focus:border-rose-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-pink-300 mb-1">
                      {field.passwordLabel}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword[field.id] ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={entry.password || ''}
                        onChange={(e) =>
                          setDraft({ ...draft, [field.id]: { ...entry, password: e.target.value } })
                        }
                        placeholder="••••••••"
                        className="w-full bg-[#100410] border border-pink-500/25 rounded-xl p-2 pr-8 text-xs text-pink-100 placeholder:text-pink-300/25 focus:outline-none focus:border-rose-400"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword({ ...showPassword, [field.id]: !showPassword[field.id] })
                        }
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-pink-400/50 hover:text-pink-200 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
                        title={showPassword[field.id] ? 'Hide' : 'Show'}
                        aria-label={
                          showPassword[field.id]
                            ? `Hide ${field.label} password`
                            : `Show ${field.label} password`
                        }
                      >
                        {showPassword[field.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-pink-500/20 bg-[#200824]/90 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl text-rose-300/70 hover:text-rose-200 hover:bg-rose-950/30 cursor-pointer"
          >
            Clear All
          </button>

          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
                <Check size={12} /> Saved
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                sound.playAction();
                onClose();
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl text-pink-300/70 hover:text-pink-100 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 text-white shadow-[0_2px_15px_rgba(244,63,94,0.35)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <KeyRound size={13} />
              <span>Save Logins</span>
            </button>
          </div>
        </div>
      </ModalShell>
  );
}
