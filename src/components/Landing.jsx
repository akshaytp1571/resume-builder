import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Printer,
  ScanText,
  Trash2,
  FileText,
  Keyboard,
  HardDrive,
} from 'lucide-react';
// lucide stopped exporting brand marks, so GitHub comes from the app's own
// Icons.jsx — which exists for exactly this reason.
import { GithubIcon } from './ui/Icons.jsx';
import { ROUTE_APP } from '../hooks/useHashRoute';
import {
  useReveal,
  useCountUp,
  useScrollProgress,
} from '../hooks/useLandingMotion';

/**
 * The landing page.
 *
 * Written in the app's own materials at display scale: warm black, bone ink,
 * hairlines, one lime signal. The hero is a tilted miniature of the real editor
 * with a scan line crossing it — the same gesture as the export sweep — so the
 * page and the product share a verb instead of the page merely describing one.
 *
 * The argument, in order, is the one that actually differentiates this from
 * Reactive Resume and Rezi: no account, no server, no upload. Everything below
 * the hero is evidence for that, not a feature list.
 *
 * All copy that claims something is checkable against the running app.
 */

/** One reveal wrapper. Keeps the data-step stagger consistent everywhere. */
function Reveal({ as: Tag = 'div', step, className = '', children, ...rest }) {
  const [ref, shown] = useReveal();
  return (
    <Tag
      ref={ref}
      data-step={step}
      className={`landing-rise ${shown ? 'is-in' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function Rule({ className = '' }) {
  const [ref, shown] = useReveal({ threshold: 0.05 });
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`landing-rule h-px w-full bg-[var(--rule-2)] ${shown ? 'is-in' : ''} ${className}`}
    />
  );
}

/** The hero readout: a mini ATS gauge that counts up once in view. */
function HeroGauge() {
  const [ref, value] = useCountUp(92, { duration: 1100, start: 0 });
  const filled = Math.round((value / 100) * 32);

  return (
    <div ref={ref} className="w-[168px]">
      <div className="flex items-baseline justify-between">
        <span className="landing-eyebrow">ATS</span>
        <span className="font-mono text-[13px] tabular-nums text-bone" aria-hidden="true">
          {value}
        </span>
      </div>
      <div
        className="mt-1.5 flex h-5 items-end gap-[2px]"
        role="img"
        aria-label={`ATS score ${value} out of 100`}
      >
        {Array.from({ length: 32 }).map((_, i) => (
          <span
            key={i}
            className={`landing-tick ${i < filled ? 'is-on' : ''}`}
            style={{ height: i % 4 === 0 ? 18 : 10 }}
          />
        ))}
      </div>
    </div>
  );
}

const TICKER = [
  'No account',
  'No server',
  'No upload',
  'Runs offline',
  'Local-first',
  'Nine templates',
  'Vector PDF',
  'DOCX export',
  'ATS scoring',
  'Keyword matching',
  'Cover letters',
  'Application tracker',
  'JSON Resume',
  'Google Drive backup',
  'Trash with recovery',
  'US Letter & A4',
];

const SPECS = [
  {
    k: 'Storage',
    v: 'localStorage',
    note: 'Your résumé is a browser key, not a row in someone’s database.',
  },
  {
    k: 'Network',
    v: 'None by default',
    note: 'The editor, scorer, keyword matcher and exporters all run in the tab.',
  },
  {
    k: 'Accounts',
    v: 'Zero',
    note: 'No sign-up, no email, no password to reset.',
  },
  {
    k: 'AI',
    v: 'Bring your own key',
    note: 'Any OpenAI-compatible endpoint, or Ollama on your own machine.',
  },
  {
    k: 'Paper',
    v: 'A4 · US Letter',
    note: 'Real page sizes. The PDF comes out at the right dimensions.',
  },
  {
    k: 'Export',
    v: 'PDF · DOCX · JSON',
    note: 'Vector PDF keeps text selectable, so parsers can read it.',
  },
];

const WHY = [
  {
    icon: ShieldCheck,
    title: 'Nothing leaves the tab',
    body: 'The scorer, the matcher, the exporters and every keystroke stay in the browser. There is no backend to send them to.',
  },
  {
    icon: ScanText,
    title: 'See what the parser sees',
    body: 'One click shows the résumé as an applicant tracking system extracts it — one column, no styling. If a field is missing there, it is missing from the employer’s view.',
  },
  {
    icon: Trash2,
    title: 'A delete you can undo',
    body: 'Deleted résumés sit in a trash for thirty days with one-click restore. One misclick on a phone is no longer final.',
  },
  {
    icon: FileText,
    title: 'Two documents, not one',
    body: 'A résumé and a cover letter per variant, each with its own export. The letter inherits your details and keeps its own design.',
  },
  {
    icon: Keyboard,
    title: 'Fast without a mouse',
    body: 'A command palette, real shortcuts, and undo that spans both. Reaching for the trackpad is optional.',
  },
  {
    icon: HardDrive,
    title: 'Yours to take',
    body: 'Export everything as JSON, or back it up to your own Google Drive with the narrowest scope Drive offers.',
  },
];

const STEPS = [
  {
    n: '01',
    t: 'Start from your own file',
    d: 'Drop in a DOCX or PDF, or paste the text. The parser fills the fields; you correct what it got wrong.',
  },
  {
    n: '02',
    t: 'Watch the score, then the evidence',
    d: 'A readiness score updates as you type. Open the parser view to read the same résumé the way software will.',
  },
  {
    n: '03',
    t: 'Tailor, then send',
    d: 'Paste a posting to see the keywords you are missing. Export a vector PDF and log the application.',
  },
];

export default function Landing({ navigate }) {
  const progress = useScrollProgress();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The landing page is a document, not the app shell: give it the page title
  // and restore the editor's on the way out.
  useEffect(() => {
    const previous = document.title;
    document.title = 'Resume Studio — a résumé builder that runs in your tab';
    return () => {
      document.title = previous;
    };
  }, []);

  const enter = (e) => {
    e?.preventDefault?.();
    navigate(ROUTE_APP);
  };

  return (
    <div className="landing min-h-screen">
      {/* scroll progress */}
      <div
        aria-hidden="true"
        className="landing-progress"
        style={{ transform: `scaleX(${progress})` }}
      />

      {/* ---- nav ----------------------------------------------------------
          Solid once scrolled, not translucent. A 2px backdrop-blur scrim left
          the headline visibly bleeding through the bar, which read as a
          rendering fault rather than a material choice. */}
      <header
        className={`sticky top-0 z-50 border-b no-print transition-colors duration-300 ${
          scrolled
            ? 'border-[var(--rule)] bg-[var(--void)]'
            : 'border-transparent bg-transparent'
        }`}
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center border border-[var(--rule-2)] text-signal"
            >
              <svg width="13" height="15" viewBox="0 0 13 15" fill="none">
                <rect x="0.5" y="0.5" width="12" height="14" stroke="currentColor" />
                <path d="M3 4.5h7M3 7.5h7M3 10.5h4" stroke="currentColor" strokeLinecap="square" />
              </svg>
            </span>
            <span className="flex items-baseline gap-1">
              <span className="text-[15px] font-semibold tracking-[-0.02em]">Resume</span>
              <span className="landing-serif text-[15px] text-signal">Studio</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href="https://github.com/akshaytp1571/resume-builder"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-52 transition-colors hover:text-bone sm:flex"
            >
              <GithubIcon size={13} />
              Source
            </a>
            <button
              type="button"
              onClick={enter}
              className="landing-cta inline-flex h-8 items-center gap-1.5 px-3.5 font-mono text-[10px] uppercase tracking-[0.1em]"
            >
              Open editor
              <ArrowRight size={12} aria-hidden="true" />
            </button>
          </div>
        </nav>
      </header>

      {/* ---- hero --------------------------------------------------------- */}
      <section className="mx-auto grid max-w-6xl gap-x-10 gap-y-12 px-5 pt-10 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
        <div>
          <Reveal step={1}>
            <span className="landing-eyebrow flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-[5px] w-[5px] bg-signal" />
              Local-first · open source · MIT
            </span>
          </Reveal>

          <Reveal as="h1" step={2} className="landing-display mt-5">
            The résumé builder
            <br />
            that never leaves
            <br />
            <span className="landing-serif text-signal">your tab.</span>
          </Reveal>

          <Reveal step={3} className="mt-6 max-w-[46ch]">
            <p className="text-[15px] leading-relaxed text-bone-70">
              Write, score and tailor a résumé against a real posting — then export a
              vector PDF that an applicant tracking system can actually read. No
              account, no upload, nothing to sign up for.
            </p>
          </Reveal>

          <Reveal step={4} className="mt-7 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={enter}
              className="landing-cta inline-flex h-11 items-center gap-2 px-5 font-mono text-[11px] uppercase tracking-[0.1em]"
            >
              Start building
              <ArrowRight size={14} aria-hidden="true" />
            </button>
            <a
              href="#how"
              className="landing-cta-ghost inline-flex h-11 items-center gap-2 px-5 font-mono text-[11px] uppercase tracking-[0.1em]"
            >
              How it works
            </a>
          </Reveal>

          <Reveal step={5} className="mt-8">
            <Rule />
          </Reveal>

          {/* Not wrapped in <Reveal>. The gauge runs its own IntersectionObserver
              to start counting, and nesting one observer inside another that
              begins at opacity:0 means the inner one never fires — the element
              is already "in view" the moment the outer container is, and a
              parent at opacity 0 reports as non-intersecting. Two independent
              observers, or none. */}
          <div className="landing-rise is-in mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
            <HeroGauge />
            <div className="sm:border-l sm:border-[var(--rule)] sm:pl-6">
              <span className="landing-eyebrow block">Templates</span>
              <span className="font-mono text-[13px] tabular-nums text-bone">09</span>
            </div>
            <div className="sm:border-l sm:border-[var(--rule)] sm:pl-6">
              <span className="landing-eyebrow block">Installed</span>
              <span className="font-mono text-[13px] text-bone">0 MB</span>
            </div>
          </div>
        </div>

        {/* the tilted sheet */}
        <div className="relative">
          <div
            className="landing-hero-sheet relative mx-auto w-full max-w-[420px]"
            style={{ '--scan-travel': '520px' }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-y-4 -inset-x-3 sm:-inset-x-6"
              style={{
                background:
                  'radial-gradient(closest-side, rgba(216,255,62,0.09), rgba(216,255,62,0))',
              }}
            />

            {/* sheet */}
            <div className="relative border border-[var(--rule-2)] bg-paper p-5 text-[#1a1a17] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)]">
              <div className="landing-scan" />

              <div className="h-1 w-24 bg-[#3e5566]" />
              <p className="mt-3 text-[13px] font-semibold tracking-[-0.01em]">Alex Morgan</p>
              <p className="text-[10px] text-[#3e5566]">
                QA Lead · Functional, API &amp; Performance Testing
              </p>
              <p className="mt-1 text-[8px] text-[#6b7280]">
                Springfield, USA · alex.morgan@example.com
              </p>

              {['Summary', 'Technical skills', 'Experience'].map((h) => (
                <div key={h} className="mt-4">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#3e5566]">
                    {h}
                  </p>
                  <div className="mt-1 h-px w-full bg-[#3e5566]/40" />
                  <div className="mt-1.5 space-y-1">
                    <div className="h-[3px] w-full rounded-full bg-black/10" />
                    <div className="h-[3px] w-[92%] rounded-full bg-black/10" />
                    <div className="h-[3px] w-[78%] rounded-full bg-black/10" />
                  </div>
                </div>
              ))}

              <div className="mt-4 flex items-end gap-[2px]">
                {Array.from({ length: 26 }).map((_, i) => (
                  <span
                    key={i}
                    className="flex-1 bg-[#3e5566]"
                    style={{ height: i % 5 === 0 ? 7 : 3, opacity: i < 24 ? 1 : 0.3 }}
                  />
                ))}
              </div>
            </div>

            {/* crop marks, to say "printed matter" */}
            <span aria-hidden="true" className="dt-crop dt-crop-tl" />
            <span aria-hidden="true" className="dt-crop dt-crop-tr" />
            <span aria-hidden="true" className="dt-crop dt-crop-bl" />
            <span aria-hidden="true" className="dt-crop dt-crop-br" />
          </div>

          <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-bone-32 lg:text-left">
            Plate 01 · live preview
          </p>
        </div>
      </section>

      {/* ---- ticker ------------------------------------------------------- */}
      <div className="overflow-hidden border-y border-[var(--rule)] py-3">
        <div className="landing-ticker gap-8 pr-8">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={copy === 1}>
              {TICKER.map((t) => (
                <span
                  key={t}
                  className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-32"
                >
                  <span className="inline-block h-[3px] w-[3px] bg-signal/60" />
                  {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ---- why --------------------------------------------------------- */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
        <Reveal>
          <span className="landing-eyebrow">The difference</span>
        </Reveal>
        <Reveal as="h2" step={1} className="landing-h2 mt-3 max-w-[24ch]">
          Most builders want your data.
          <span className="landing-serif text-signal"> This one doesn’t.</span>
        </Reveal>

        <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} step={(i % 3) + 1} className="border-t border-[var(--rule)] pt-4">
                <Icon size={17} className="text-signal" aria-hidden="true" />
                <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.015em]">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-bone-52">{item.body}</p>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ---- specs ------------------------------------------------------- */}
      <section className="border-y border-[var(--rule)] bg-[var(--housing)]/40">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Reveal>
            <span className="landing-eyebrow">Specification</span>
          </Reveal>
          <Reveal as="h2" step={1} className="landing-h2 mt-3 max-w-[26ch]">
            The whole architecture is one sentence.
          </Reveal>

          <dl className="mt-10 border-t border-[var(--rule-2)]">
            {SPECS.map((s, i) => (
              <Reveal
                key={s.k}
                step={Math.min(i + 1, 6)}
                className="landing-row grid gap-1 py-3.5 sm:grid-cols-[140px_180px_1fr] sm:items-baseline sm:gap-6"
              >
                <dt className="landing-eyebrow">{s.k}</dt>
                <dd className="font-mono text-[12px] text-signal">{s.v}</dd>
                <dd className="text-[12.5px] leading-relaxed text-bone-52">{s.note}</dd>
              </Reveal>
            ))}
          </dl>

          <Reveal className="mt-8 flex items-start gap-2.5 border-l-2 border-[var(--rule-2)] pl-3">
            <Printer size={14} className="mt-0.5 shrink-0 text-bone-52" aria-hidden="true" />
            <p className="max-w-[70ch] text-[12.5px] leading-relaxed text-bone-32">
              Print output is real print output: A4 or US Letter at true dimensions,
              crop marks and readouts stripped, page breaks that keep a job title with
              its bullets. The PDF is the product; the screen is the workshop.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---- steps ------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal>
          <span className="landing-eyebrow">Three steps</span>
        </Reveal>
        <Reveal as="h2" step={1} className="landing-h2 mt-3 max-w-[22ch]">
          Import, score, tailor, send.
        </Reveal>

        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} step={i + 1} as="li" className="border-t border-[var(--rule-2)] pt-4">
              <span className="landing-serif text-[15px] text-signal">{s.n}</span>
              <h3 className="mt-2 text-[15px] font-semibold tracking-[-0.015em]">{s.t}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-bone-52">{s.d}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ---- closing CTA ------------------------------------------------- */}
      <section className="border-t border-[var(--rule)]">
        <div className="mx-auto max-w-6xl px-5 py-24 text-center">
          <Reveal as="h2" className="landing-display mx-auto max-w-[18ch]">
            Open it. Nothing to
            <span className="landing-serif text-signal"> install.</span>
          </Reveal>
          <Reveal step={2} className="mx-auto mt-6 max-w-[52ch]">
            <p className="text-[14px] leading-relaxed text-bone-52">
              The editor loads with sample data so you can try every control before
              typing anything personal. Clearing it is one click.
            </p>
          </Reveal>
          <Reveal step={3} className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={enter}
              className="landing-cta inline-flex h-11 items-center gap-2 px-6 font-mono text-[11px] uppercase tracking-[0.1em]"
            >
              Open the editor
              <ArrowRight size={14} aria-hidden="true" />
            </button>
            <a
              href="https://github.com/akshaytp1571/resume-builder"
              target="_blank"
              rel="noreferrer"
              className="landing-cta-ghost inline-flex h-11 items-center gap-2 px-6 font-mono text-[11px] uppercase tracking-[0.1em]"
            >
              <GithubIcon size={13} />
              Read the source
            </a>
          </Reveal>
        </div>
      </section>

      {/* ---- footer ------------------------------------------------------ */}
      <footer className="border-t border-[var(--rule)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-32">
          <span>Resume Studio · MIT</span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-[4px] w-[4px] bg-signal" />
            No tracking · no ads · no paywall
          </span>
        </div>
      </footer>
    </div>
  );
}
