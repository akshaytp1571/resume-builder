import React from 'react';
import { AlertTriangle, RefreshCw, Download, ShieldAlert } from 'lucide-react';

// Must match STORE_KEY in src/utils/resumeStore.js. Duplicated on purpose: this
// component has to keep working when that module (or its data) is the thing
// that broke, so it must not import anything from it.
const STORE_KEY = 'precision_resume_store_v2';
/**
 * Prefix of the quarantined copies resumeStore keeps when the main value will
 * not parse. Duplicated for the same reason as STORE_KEY above.
 */
const RECOVERY_PREFIX = `${STORE_KEY}__recovery_`;

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]';

/**
 * Last line of defence. Any render throw in the tree below blanks the whole
 * app, so this catches it and offers two things: a reload, and - more
 * importantly - a way to get the user's resume data out of the browser before
 * they clear site data in a panic.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, downloadNote: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Resume builder crashed:', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  /**
   * Everything worth rescuing. Returns null when storage itself is blocked.
   *
   * The main key alone is not enough. When resumeStore cannot parse the store
   * it moves the unreadable value to a `__recovery_` key and the next save
   * writes a fresh, near-empty store over the main one. Rescuing only the main
   * key in that state hands the user a blank resume and quietly loses the real
   * one — the exact failure this button exists to prevent.
   *
   * Only the resume store and its recovery copies are included. Job-board
   * credentials and the AI key live under separate keys and are deliberately
   * NOT part of this download: someone recovering from a crash wants their
   * resume back, not a plaintext file with their passwords in it.
   */
  collectRescuePayload() {
    let storage = null;
    try {
      storage = window.localStorage;
      // Touch length so disabled storage throws here, not mid-loop.
      void storage.length;
    } catch (e) {
      // Private mode / disabled storage throws on access.
      console.error('localStorage unavailable while rescuing data:', e);
      return null;
    }

    const read = (key) => {
      try {
        return storage.getItem(key);
      } catch (e) {
        return null;
      }
    };

    const main = read(STORE_KEY);

    const recovery = [];
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(RECOVERY_PREFIX)) {
          const raw = read(key);
          if (raw != null) recovery.push({ key, raw });
        }
      }
    } catch (e) {
      // A storage that cannot be enumerated still leaves us the main key.
    }
    // Timestamps are the suffix, so a descending string sort is newest-first.
    recovery.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));

    return { main, recovery };
  }

  handleDownload = () => {
    const collected = this.collectRescuePayload();

    if (!collected) {
      this.setState({
        downloadNote: 'This browser is blocking storage access, so nothing can be read.',
      });
      return;
    }

    const { main, recovery } = collected;

    // A lone recovery copy with no main store is still worth handing over: it
    // is the only surviving copy of the user's data.
    if (main == null && recovery.length === 0) {
      this.setState({
        downloadNote: 'No saved data found in this browser, so there is nothing to download.',
      });
      return;
    }

    // Deliberately the RAW strings, never JSON.parse'd: this button exists for
    // the case where the store is malformed, and re-parsing would throw on
    // exactly the data we are trying to rescue.
    //
    // One plain file when only the main store exists (unchanged behaviour); a
    // bundle when quarantined copies exist, so nothing is left behind.
    const isBundle = recovery.length > 0;
    const body = isBundle
      ? JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            note:
              'Crash rescue bundle. "store" is the main value; "recovery" holds ' +
              'quarantined copies of a store that could not be parsed, newest first. ' +
              'Values are raw strings and may be malformed.',
            store: main,
            recovery: recovery.map((entry) => ({ key: entry.key, raw: entry.raw })),
          },
          null,
          2
        )
      : main;

    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([body], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = isBundle
      ? `resume-data-rescue-${stamp}.bundle.json`
      : `resume-data-rescue-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    this.setState({
      downloadNote: isBundle
        ? `Saved your resume data plus ${recovery.length} quarantined ${
            recovery.length === 1 ? 'copy' : 'copies'
          } to a .json file.`
        : 'Saved your raw resume data to a .json file.',
    });
  };

  render() {
    const { error, downloadNote } = this.state;

    if (!error) return this.props.children;

    const detail = String(error?.message || error || 'Unknown error');

    return (
      <div className="min-h-screen bg-[#140715] text-pink-50 font-sans flex items-center justify-center p-4">
        <div
          role="alert"
          aria-live="assertive"
          className="w-full max-w-xl bg-[#18071c] border border-rose-500/40 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-pink-500/20 bg-[#200824] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2e0d34] border border-rose-500/40 flex items-center justify-center text-rose-300 shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide text-pink-50">
                Something broke the resume builder
              </h1>
              <p className="text-[11px] text-pink-300/70">
                Your saved data is still in this browser. Nothing has been deleted.
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 text-xs">
            <p className="text-pink-200 leading-relaxed">
              The screen went blank because a part of the app hit an error it could
              not recover from. Download your data first, then reload.
            </p>

            <pre className="p-3 rounded-xl bg-[#100410] border border-rose-500/25 text-[11px] text-rose-200 font-mono whitespace-pre-wrap break-words overflow-x-auto">
              {detail}
            </pre>

            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/35 text-amber-100 flex items-start gap-2">
              <ShieldAlert size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Download your data before clearing site data or reinstalling the
                browser, otherwise the resume is gone.
              </span>
            </div>

            {downloadNote && (
              <p className="text-[11px] text-emerald-300" role="status">
                {downloadNote}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="p-3.5 border-t border-pink-500/20 bg-[#200824] flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={this.handleDownload}
              className={`px-4 py-2 text-xs font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-pink-200 border border-pink-500/30 transition-colors cursor-pointer flex items-center gap-1.5 ${FOCUS_RING}`}
            >
              <Download size={13} />
              <span>Download my data</span>
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className={`px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:opacity-95 text-white shadow-[0_2px_15px_rgba(244,63,94,0.35)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${FOCUS_RING}`}
            >
              <RefreshCw size={13} />
              <span>Reload</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
