import React, { useState } from 'react';
import { X, Eye, EyeOff, Trash2 } from 'lucide-react';
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
import { Button, Field, IconButton } from './primitives';

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
    <ModalShell
      onClose={onClose}
      labelledBy="job-credentials-title"
      zIndex="z-[60]"
      className="max-w-lg"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-rule bg-housing px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="dt-serif text-[13px] text-signal">LOG</span>
            <h2 id="job-credentials-title" className="dt-label text-bone">
              Job Board Logins
            </h2>
          </div>
          <p className="dt-data mt-1 text-bone-32">
            Optional - unlocks filtered and personalised listings
          </p>
        </div>
        <button
          type="button"
          aria-label="Close job board logins dialog"
          onClick={() => {
            sound.playAction();
            onClose();
          }}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[2px] border border-transparent text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-5 overflow-y-auto p-4 text-[13px] sm:p-5">
        <p className="border-l-2 border-rule-2 py-1 pl-2 font-sans text-[12px] leading-relaxed text-bone-52">
          Stored in this browser only and sent to your local discovery service on{' '}
          <span className="font-mono text-bone-70">localhost:3457</span>. Never sent to the
          AI provider or any third party. On a shared machine, clear them when you are done.
        </p>

        {/* Resume file path */}
        <div className="border-t border-rule pt-3">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="dt-label text-bone-52">Resume file for applications</span>
            {resumeFile && (
              <span className="dt-label text-signal">SET</span>
            )}
          </div>
          <p className="dt-data mb-1 text-bone-32">
            Absolute path to the DOCX or PDF the apply agent should upload. Export one from
            this app first, then paste its full path here.
          </p>
          <input
            type="text"
            value={resumeFile}
            onChange={(e) => setResumeFile(e.target.value)}
            placeholder="C:\Users\aksha\Downloads\Akshay_Saseendran_Resume.docx"
            aria-label="Resume file for applications"
            className="w-full border-0 border-b bg-transparent px-0 py-2 font-mono text-[16px] text-bone placeholder:text-bone-32 focus:outline-none"
            style={{ borderBottomColor: 'var(--rule-2)' }}
          />
        </div>

        {CREDENTIAL_FIELDS.map((field) => {
          const entry = draft[field.id] || {};
          const isSet = configured.includes(field.id);
          return (
            <div key={field.id} className="border-t border-rule pt-3">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="flex items-baseline gap-2">
                  <span className="dt-label text-bone-52">{field.label}</span>
                  {isSet && <span className="dt-label text-signal">CONFIGURED</span>}
                </span>
                {isSet && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSite(field.id)}
                    className="inline-flex cursor-pointer items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-alarm/80 transition-colors duration-[90ms] hover:text-alarm"
                  >
                    <Trash2 size={11} aria-hidden="true" />
                    Remove
                  </button>
                )}
              </div>

              <p className="dt-data mb-2 text-bone-32">{field.hint}</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label={field.usernameLabel}
                  type="text"
                  autoComplete="username"
                  value={entry.username || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, [field.id]: { ...entry, username: e.target.value } })
                  }
                  placeholder="you@example.com"
                />

                <div>
                  <label
                    htmlFor={`cred-${field.id}-password`}
                    className="dt-label mb-1 block text-bone-52"
                  >
                    {field.passwordLabel}
                  </label>
                  <div className="relative">
                    <input
                      id={`cred-${field.id}-password`}
                      type={showPassword[field.id] ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={entry.password || ''}
                      onChange={(e) =>
                        setDraft({ ...draft, [field.id]: { ...entry, password: e.target.value } })
                      }
                      placeholder="••••••••"
                      className="w-full border-0 border-b bg-transparent py-2 pr-8 text-[16px] text-bone placeholder:text-bone-32 focus:outline-none"
                      style={{ borderBottomColor: 'var(--rule-2)' }}
                    />
                    <IconButton
                      size="sm"
                      label={
                        showPassword[field.id]
                          ? `Hide ${field.label} password`
                          : `Show ${field.label} password`
                      }
                      title={showPassword[field.id] ? 'Hide' : 'Show'}
                      onClick={() =>
                        setShowPassword({
                          ...showPassword,
                          [field.id]: !showPassword[field.id],
                        })
                      }
                      className="absolute right-0 top-1/2 -translate-y-1/2"
                    >
                      {showPassword[field.id] ? (
                        <EyeOff size={13} aria-hidden="true" />
                      ) : (
                        <Eye size={13} aria-hidden="true" />
                      )}
                    </IconButton>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-rule bg-housing px-4 py-2.5">
        <Button variant="danger" onClick={handleClear} className="mr-auto">
          Clear All
        </Button>

        {saved && (
          <span className="dt-label self-center text-signal">Saved</span>
        )}

        <Button
          onClick={() => {
            sound.playAction();
            onClose();
          }}
        >
          Close
        </Button>

        <Button variant="signal" onClick={handleSave}>
          Save Logins
        </Button>
      </div>
    </ModalShell>
  );
}
