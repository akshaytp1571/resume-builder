import React from 'react';
import { RefreshCw, Download, ShieldAlert } from 'lucide-react';

// Must match STORE_KEY in src/utils/resumeStore.js. Duplicated on purpose: this
// component has to keep working when that module (or its data) is the thing
// that broke, so it must not import anything from it.
const STORE_KEY = 'precision_resume_store_v2';
/**
 * Prefix of the quarantined copies resumeStore keeps when the main value will
 * not parse. Duplicated for the same reason as STORE_KEY above.
 */
const RECOVERY_PREFIX = `${STORE_KEY}__recovery_`;

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
      <div className="flex min-h-screen items-center justify-center bg-void p-4 font-sans text-bone">
        <div
          role="alert"
          aria-live="assertive"
          className="w-full max-w-xl overflow-hidden border border-rule-2 bg-housing-2"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-alarm/40 bg-housing px-4 py-3">
            <span className="dt-serif shrink-0 text-[15px] text-alarm">!</span>
            <div>
              <h1 className="dt-label text-bone">Something broke the resume builder</h1>
              <p className="mt-0.5 font-sans text-[11px] text-bone-52">
                Your saved data is still in this browser. Nothing has been deleted.
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-4 p-4 text-[13px] sm:p-5">
            <p className="font-sans leading-relaxed text-bone-70">
              The screen went blank because a part of the app hit an error it could
              not recover from. Download your data first, then reload.
            </p>

            <pre className="overflow-x-auto whitespace-pre-wrap break-words border-l-2 border-alarm/50 bg-void py-2 pl-2 font-mono text-[11px] leading-relaxed text-bone-70">
              {detail}
            </pre>

            <p className="flex items-start gap-2 border-l-2 border-alarm py-1 pl-2 font-sans text-[12px] leading-relaxed text-bone-70">
              <ShieldAlert size={13} className="mt-0.5 shrink-0 text-alarm" aria-hidden="true" />
              <span>
                Download your data before clearing site data or reinstalling the
                browser, otherwise the resume is gone.
              </span>
            </p>

            {downloadNote && (
              <p className="border-l-2 border-signal py-1 pl-2 font-mono text-[11px] text-signal" role="status">
                {downloadNote}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-rule bg-housing px-4 py-2.5">
            <button
              type="button"
              onClick={this.handleDownload}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[2px] border border-rule-2 px-[14px] font-mono text-[10px] uppercase tracking-[0.08em] text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
            >
              <Download size={12} aria-hidden="true" />
              <span>Download my data</span>
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[2px] border border-signal bg-signal px-[14px] font-mono text-[10px] uppercase tracking-[0.08em] text-void transition-colors duration-[90ms] hover:bg-[#c8ef2e]"
            >
              <RefreshCw size={12} aria-hidden="true" />
              <span>Reload</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}