import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  LoaderCircle,
} from 'lucide-react';
import { extractTextFromFile, parseResumeHeuristically, parseResumeWithAi } from '../../utils/resumeParser';
import { extractTextFromPdf } from '../../utils/pdfImporter';
import { getSavedAiConfig, isAiConfigReady } from '../../utils/aiService';
import { sound } from '../../utils/soundEffects';
import { normalizeResume } from '../../utils/resumeStore';
import ModalShell from './ModalShell';

const TAB =
  'inline-flex h-7 cursor-pointer items-center rounded-[2px] border px-[10px] font-mono text-[10px] uppercase tracking-[0.08em] transition-colors duration-[90ms]';
const TAB_ON = 'border-signal text-signal';
const TAB_OFF =
  'border-rule-2 text-bone-70 hover:bg-[rgba(237,232,220,0.05)] hover:text-bone';

export default function ResumeUploadModal({
  isOpen,
  onClose,
  currentResumeData,
  onApplyParsedResume,
  onOpenAiConfig,
}) {
  const [activeTab, setActiveTab] = useState('file'); // 'file' | 'paste'
  const [rawText, setRawText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [useAi, setUseAi] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedPreview, setParsedPreview] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const isAiReady = isAiConfigReady(getSavedAiConfig());

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    sound.playAction();
    setSelectedFile(file);
    setErrorMsg(null);
    setParsedPreview(null);
  };

  const handleParse = async () => {
    sound.playAction();
    setIsParsing(true);
    setErrorMsg(null);
    setParsedPreview(null);

    try {
      let extractedText = rawText;
      let directJsonData = null;

      if (activeTab === 'file') {
        if (!selectedFile) {
          throw new Error('Please select a file to upload first.');
        }

        const isPdf = /\.pdf$/i.test(selectedFile.name);
        const extractResult = isPdf
          ? await extractTextFromPdf(selectedFile)
          : await extractTextFromFile(selectedFile);
        if (extractResult.type === 'json') {
          directJsonData = extractResult.data;
        } else {
          extractedText = extractResult.text;
        }
      }

      if (directJsonData) {
        // Normalise before previewing: a JSON profile is untrusted input and
        // can carry objects where the renderer expects strings (a
        // personalInfo.fullName of {first, last} used to blank the whole app).
        sound.playSuccess();
        setParsedPreview(normalizeResume(directJsonData));
        setIsParsing(false);
        return;
      }

      if (!extractedText.trim()) {
        throw new Error('No readable text found in document. Please check file.');
      }

      let result = null;
      if (useAi && isAiReady) {
        try {
          result = await parseResumeWithAi(extractedText);
        } catch (aiErr) {
          console.warn('AI Parsing failed, falling back to heuristic parser:', aiErr);
          result = parseResumeHeuristically(extractedText);
        }
      } else {
        result = parseResumeHeuristically(extractedText);
      }

      // Normalise before previewing. Both the heuristic and the AI parser can
      // hand back objects where the renderer expects strings, and the preview
      // renders these values directly.
      const normalized = normalizeResume(result);

      // Preserve the existing photo and its crop when the uploaded document
      // does not carry one (it never will - documents have no photo data).
      // Done after normalising because rawPhoto/photoCrop are not part of the
      // normalised shape and would otherwise be stripped.
      if (currentResumeData?.personalInfo?.photo && !normalized.personalInfo.photo) {
        normalized.personalInfo.photo = currentResumeData.personalInfo.photo;
        normalized.personalInfo.rawPhoto = currentResumeData.personalInfo.rawPhoto;
        normalized.personalInfo.photoCrop = currentResumeData.personalInfo.photoCrop;
      }

      sound.playSuccess();
      setParsedPreview(normalized);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to parse resume document.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleApply = () => {
    if (parsedPreview) {
      sound.playSuccess();
      onApplyParsedResume(parsedPreview);
      onClose();
    }
  };

  const handleExportBackupJson = () => {
    sound.playAction();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentResumeData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${(currentResumeData?.personalInfo?.fullName || 'Resume').replace(/\s+/g, '_')}_backup.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <ModalShell onClose={onClose} labelledBy="resume-upload-title" className="max-w-2xl">
      {/* Header: serif kicker + mono title + 32px close, on a hairline. */}
      <div className="flex items-center justify-between border-b border-rule bg-housing px-4 py-3">
        <div className="flex items-baseline gap-2.5">
          <span className="dt-serif text-[13px] text-signal">IN</span>
          <h2 id="resume-upload-title" className="dt-label text-bone">
            Resume Document Ingestion
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close resume upload dialog"
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
        <p className="dt-data text-bone-32">
          Upload PDF (.pdf), Word (.docx), JSON backup (.json), or paste text to populate the studio
        </p>

        {/* Method tabs: two mono buttons, active one carries the signal rule. */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-rule pt-3">
          <button
            type="button"
            onClick={() => {
              sound.playTab();
              setActiveTab('file');
              setParsedPreview(null);
            }}
            className={`${TAB} ${activeTab === 'file' ? TAB_ON : TAB_OFF}`}
          >
            <span>Upload .PDF, .DOCX or .JSON</span>
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playTab();
              setActiveTab('paste');
              setParsedPreview(null);
            }}
            className={`${TAB} ${activeTab === 'paste' ? TAB_ON : TAB_OFF}`}
          >
            <span>Paste Text</span>
          </button>
        </div>

        {!parsedPreview ? (
          <div className="space-y-5">
            {activeTab === 'file' ? (
              /* Dropzone: a 1px dashed hairline rectangle, 0px radius, no fill. */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center border border-dashed border-rule-2 px-6 py-8 text-center transition-colors duration-[90ms] hover:border-signal"
              >
                <Upload size={20} className="mb-2 text-signal" aria-hidden="true" />
                <p className="font-sans text-[13px] text-bone">
                  {selectedFile ? selectedFile.name : 'Click to Select or Drag & Drop Resume File'}
                </p>
                <p className="dt-data mt-1 text-bone-32">
                  {isParsing && selectedFile && /\.pdf$/i.test(selectedFile.name)
                    ? 'Extracting text from PDF… this can take a few seconds'
                    : 'Supports PDF (.pdf), Microsoft Word (.docx), JSON Profile (.json), and Text (.txt)'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.json,.txt,.md"
                  onChange={handleFileChange}
                  aria-label="Resume file to upload"
                  className="hidden"
                />
              </div>
            ) : (
              /* Paste zone */
              <div className="border-t border-rule pt-3">
                <label
                  htmlFor="resume-paste-input"
                  className="dt-label mb-2 block text-bone-52"
                >
                  Paste Raw Resume Content
                </label>
                <textarea
                  id="resume-paste-input"
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste the text of your resume here (Summary, Skills, Experience, Education)..."
                  className="w-full resize-y select-text border-0 border-b bg-transparent px-0 py-2 font-sans text-[16px] leading-relaxed text-bone placeholder:text-bone-32 focus:outline-none focus-visible:outline-none"
                  style={{ borderBottomColor: 'var(--rule-2)' }}
                />
              </div>
            )}

            {/* Parsing engine */}
            <div className="border-t border-rule pt-3">
              <span className="dt-label mb-2 block text-bone-52">Parsing engine</span>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="use-ai-parser"
                    checked={useAi && isAiReady}
                    disabled={!isAiReady}
                    onChange={(e) => setUseAi(e.target.checked)}
                    style={{ accentColor: 'var(--signal)' }}
                  />
                  <label
                    htmlFor="use-ai-parser"
                    className="cursor-pointer font-sans text-[12.5px] text-bone-70"
                  >
                    Use AI Resume Parser (Structured Extraction)
                  </label>
                </div>

                {!isAiReady && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAiConfig();
                    }}
                    className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.08em] text-signal underline underline-offset-4 transition-colors duration-[90ms] hover:text-bone"
                  >
                    Configure AI to enable Neural Parser
                  </button>
                )}
              </div>
            </div>

            {errorMsg && (
              <p className="flex items-start gap-2 border-l-2 border-alarm py-1 pl-2 font-sans text-[12px] text-alarm">
                <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{errorMsg}</span>
              </p>
            )}
          </div>
        ) : (
          /* Parsed preview */
          <div className="space-y-5">
            <div className="border-t border-rule pt-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-signal" aria-hidden="true" />
                  <span className="dt-label text-bone-70">Parsed Resume Overview</span>
                </span>
                <button
                  type="button"
                  onClick={() => setParsedPreview(null)}
                  className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.08em] text-bone-52 underline underline-offset-4 transition-colors duration-[90ms] hover:text-bone"
                >
                  Upload Different File
                </button>
              </div>

              <div className="divide-y divide-[var(--rule)] border-t border-rule">
                <div className="flex items-baseline justify-between gap-3 py-[7px]">
                  <span className="dt-label text-bone-32">Candidate Name</span>
                  <span className="dt-data truncate text-bone">
                    {parsedPreview.personalInfo?.fullName || 'Not detected'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-[7px]">
                  <span className="dt-label text-bone-32">Professional Title</span>
                  <span className="dt-data truncate text-bone">
                    {parsedPreview.personalInfo?.title || 'Not detected'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-[7px]">
                  <span className="dt-label text-bone-32">Contact</span>
                  <span className="dt-data truncate text-bone-70">
                    {parsedPreview.personalInfo?.email || parsedPreview.personalInfo?.phone || 'None'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-[7px]">
                  <span className="dt-label text-bone-32">Extracted Sections</span>
                  <span className="dt-data text-signal">
                    {parsedPreview.skills?.length || 0} skill domains • {parsedPreview.experience?.length || 0} roles • {parsedPreview.education?.length || 0} degrees
                  </span>
                </div>
              </div>

              {parsedPreview.summary && (
                <div className="mt-3">
                  <span className="dt-label mb-2 block text-bone-52">Summary Preview</span>
                  <p className="line-clamp-3 border-t border-rule bg-void p-2 font-sans text-[12.5px] leading-relaxed text-bone-70">
                    {parsedPreview.summary}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Export JSON backup */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-3">
          <span className="dt-data text-bone-32">Need to back up current resume data?</span>
          <button
            type="button"
            onClick={handleExportBackupJson}
            className="inline-flex cursor-pointer items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-signal underline underline-offset-4 transition-colors duration-[90ms] hover:text-bone"
          >
            <Download size={12} aria-hidden="true" />
            Export JSON Backup
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-rule bg-housing px-4 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="mr-auto inline-flex h-8 cursor-pointer items-center rounded-[2px] border border-rule-2 px-[14px] font-mono text-[10px] uppercase tracking-[0.08em] text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
        >
          Dismiss
        </button>

        {!parsedPreview ? (
          <button
            type="button"
            onClick={handleParse}
            disabled={isParsing || (activeTab === 'file' && !selectedFile) || (activeTab === 'paste' && !rawText.trim())}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[2px] border border-signal bg-signal px-[14px] font-mono text-[10px] uppercase tracking-[0.08em] text-void transition-colors duration-[90ms] hover:bg-[#c8ef2e] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isParsing && <LoaderCircle size={12} aria-hidden="true" className="animate-spin" />}
            <span>{isParsing ? 'Parsing Document...' : 'Parse Resume'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[2px] border border-signal bg-signal px-[14px] font-mono text-[10px] uppercase tracking-[0.08em] text-void transition-colors duration-[90ms] hover:bg-[#c8ef2e] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 size={12} aria-hidden="true" />
            <span>Load into Builder</span>
          </button>
        )}
      </div>
    </ModalShell>
  );
}
