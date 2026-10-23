import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Download,
  Sparkles,
  Clipboard,
} from 'lucide-react';
import { extractTextFromFile, parseResumeHeuristically, parseResumeWithAi } from '../../utils/resumeParser';
import { extractTextFromPdf } from '../../utils/pdfImporter';
import { getSavedAiConfig, isAiConfigReady } from '../../utils/aiService';
import { sound } from '../../utils/soundEffects';
import { normalizeResume } from '../../utils/resumeStore';
import ModalShell from './ModalShell';

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
        {/* Modal Header */}
        <div className="p-4 border-b border-pink-500/20 flex items-center justify-between bg-[#200824]/90 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#2e0d34] border border-pink-500/40 flex items-center justify-center text-rose-300">
              <Upload size={18} />
            </div>
            <div>
              <h2
                id="resume-upload-title"
                className="text-sm font-bold text-pink-50 tracking-wide flex items-center gap-2"
              >
                Resume Document Ingestion
              </h2>
              <p className="text-[11px] text-pink-300/70">
                Upload PDF (.pdf), Word (.docx), JSON backup (.json), or paste text to populate the studio
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close resume upload dialog"
            onClick={() => {
              sound.playAction();
              onClose();
            }}
            className="p-1.5 rounded-xl text-pink-400/60 hover:text-pink-100 hover:bg-pink-900/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Ingestion Method Tabs */}
          <div className="flex items-center gap-2 border-b border-pink-500/20 pb-2">
            <button
              type="button"
              onClick={() => {
                sound.playTab();
                setActiveTab('file');
                setParsedPreview(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'file'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-xs'
                  : 'text-pink-300/70 hover:text-white hover:bg-[#200824]'
              }`}
            >
              <FileSpreadsheet size={13} />
              <span>Upload .PDF, .DOCX or .JSON</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sound.playTab();
                setActiveTab('paste');
                setParsedPreview(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'paste'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-xs'
                  : 'text-pink-300/70 hover:text-white hover:bg-[#200824]'
              }`}
            >
              <Clipboard size={13} />
              <span>Paste Text</span>
            </button>
          </div>

          {!parsedPreview ? (
            <div className="space-y-4">
              {activeTab === 'file' ? (
                /* Drag & Drop Zone */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 border-2 border-dashed border-pink-500/35 hover:border-rose-400 rounded-2xl bg-[#140517] hover:bg-[#1f0923] transition-all cursor-pointer flex flex-col items-center justify-center text-center group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#2d0d34] border border-pink-500/40 flex items-center justify-center text-rose-300 mb-3 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(244,63,94,0.25)]">
                    <Upload size={22} />
                  </div>
                  <p className="font-semibold text-pink-50 text-xs tracking-wide">
                    {selectedFile ? selectedFile.name : 'Click to Select or Drag & Drop Resume File'}
                  </p>
                  <p className="text-[11px] text-pink-300/70 mt-1">
                    {isParsing && selectedFile && /\.pdf$/i.test(selectedFile.name)
                      ? 'Extracting text from PDF… this can take a few seconds'
                      : 'Supports PDF (.pdf), Microsoft Word (.docx), JSON Profile (.json), and Text (.txt)'}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.json,.txt,.md"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              ) : (
                /* Paste Text Zone */
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold text-pink-200 tracking-wide">
                    Paste Raw Resume Content:
                  </label>
                  <textarea
                    rows={8}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Paste the text of your resume here (Summary, Skills, Experience, Education)..."
                    className="w-full bg-[#150518] border border-pink-500/25 rounded-2xl p-3.5 text-xs text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400 font-sans leading-relaxed"
                  />
                </div>
              )}

              {/* Parsing Engine Options */}
              <div className="p-3.5 rounded-2xl bg-[#1b071e] border border-pink-500/20 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="use-ai-parser"
                    checked={useAi && isAiReady}
                    disabled={!isAiReady}
                    onChange={(e) => setUseAi(e.target.checked)}
                    className="rounded accent-rose-500"
                  />
                  <label htmlFor="use-ai-parser" className="text-xs font-semibold text-pink-100 cursor-pointer flex items-center gap-1.5">
                    <Sparkles size={13} className="text-rose-400" />
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
                    className="text-[11px] text-amber-300 underline cursor-pointer hover:text-amber-200"
                  >
                    Configure AI to enable Neural Parser →
                  </button>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          ) : (
            /* Parsed Data Preview */
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#220a26] border border-pink-500/40 space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between border-b border-pink-500/20 pb-2">
                  <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    <span>Parsed Resume Overview</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setParsedPreview(null)}
                    className="text-[11px] text-pink-300/70 hover:text-white underline cursor-pointer"
                  >
                    Upload Different File
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <span className="text-pink-300/60 block text-[10.5px]">Candidate Name:</span>
                    <strong className="text-pink-50">{parsedPreview.personalInfo?.fullName || 'Not detected'}</strong>
                  </div>
                  <div>
                    <span className="text-pink-300/60 block text-[10.5px]">Professional Title:</span>
                    <strong className="text-pink-50">{parsedPreview.personalInfo?.title || 'Not detected'}</strong>
                  </div>
                  <div>
                    <span className="text-pink-300/60 block text-[10.5px]">Contact:</span>
                    <span className="text-pink-200">{parsedPreview.personalInfo?.email || parsedPreview.personalInfo?.phone || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-pink-300/60 block text-[10.5px]">Extracted Sections:</span>
                    <span className="text-rose-300 font-semibold">
                      {parsedPreview.skills?.length || 0} skill domains • {parsedPreview.experience?.length || 0} roles • {parsedPreview.education?.length || 0} degrees
                    </span>
                  </div>
                </div>

                {parsedPreview.summary && (
                  <div className="pt-1">
                    <span className="text-pink-300/60 block text-[10.5px] mb-1">Summary Preview:</span>
                    <p className="text-pink-100 font-sans text-xs line-clamp-3 bg-[#150518] p-2.5 rounded-xl border border-pink-500/20 leading-relaxed">
                      {parsedPreview.summary}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Export JSON backup link */}
          <div className="pt-2 flex justify-between items-center text-[11px] text-pink-300/60 border-t border-pink-500/15">
            <span>Need to back up current resume data?</span>
            <button
              type="button"
              onClick={handleExportBackupJson}
              className="text-rose-300 hover:text-white flex items-center gap-1 underline cursor-pointer"
            >
              <Download size={12} />
              Export JSON Backup
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-pink-500/20 bg-[#200824]/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl text-pink-300/70 hover:text-pink-100 cursor-pointer"
          >
            Dismiss
          </button>

          {!parsedPreview ? (
            <button
              type="button"
              onClick={handleParse}
              disabled={isParsing || (activeTab === 'file' && !selectedFile) || (activeTab === 'paste' && !rawText.trim())}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:opacity-95 text-white shadow-[0_2px_15px_rgba(244,63,94,0.35)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
            >
              <Cpu size={13} className={isParsing ? 'animate-spin' : ''} />
              <span>{isParsing ? 'Parsing Document...' : 'Parse Resume'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-bold tracking-wide rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-95 text-white shadow-[0_2px_15px_rgba(16,185,129,0.35)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <CheckCircle2 size={15} className="stroke-[3]" />
              <span>Load into Builder</span>
            </button>
          )}
        </div>
      </ModalShell>
  );
}
