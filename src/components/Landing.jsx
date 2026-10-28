import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
// lucide stopped exporting brand marks, so GitHub comes from the app's own
// Icons.jsx — which exists for exactly this reason.
import { GithubIcon } from './ui/Icons.jsx';
import { ROUTE_APP } from '../hooks/useHashRoute';
import {
  useReveal,
  useCountUp,
  useScrollProgress,
  useMastTone,
  useClock,
  useCursor,
  useMagnetic,
  useMaskedHeadlines,
  useSheetDrag,
  usePeel,
} from '../hooks/useLandingMotion';

/**
 * The landing page — the STUDIO version.
 *
 * A bench, not a brochure. The mast inverts over paper sections, the cursor is a
 * dot and a lagging ring, the hero holds a résumé you can actually pick up and
 * tilt, and the parser section peels between the designed sheet and the
 * extracted text it becomes.
 *
 * Layout rule carried over from the preview audit: the page is a dense grid, so
 * no band of it reads as void. Every section's right margin carries a note,
 * every list closes against a border.
 *
 * All copy claims are checkable against the running app.
 */

const SECTIONS = [
  { id: 'score', label: 'Score' },
  { id: 'gaps', label: 'Gaps' },
  { id: 'templates', label: 'Templates' },
  { id: 'parser', label: 'Parser' },
  { id: 'ledger', label: 'Ledger' },
];

const FIGS = [
  { k: 'Accounts', v: 0, count: true },
  { k: 'Requests', v: 0, count: true },
  { k: 'Templates', v: 9, count: true },
  { k: 'Licence', v: 'MIT' },
];

const TICKER = [
  'Nine templates',
  'Vector PDF',
  'ATS score',
  'Keyword match',
  'Parser view',
  'Cover letters',
  'Tracker',
  'A4 & Letter',
];

const SCORES = [
  ['Layout & fit', 25],
  ['Experience', 22],
  ['Contact block', 18],
  ['Summary', 13],
  ['Skills', 12],
  ['Education', 6],
  ['Projects', 4],
];

const DEDUCTIONS = [
  ['−4', 'Summary runs two lines past the fold of the eye'],
  ['−2', 'Education before Projects; recruiters scan backwards'],
  ['−2', 'One bullet has no number in it'],
];

const GAPS = [
  ['01', 'Two-column body', 'A side table reads as interleaved lines. Text order inverts and the summary lands after the phone number.', 'Fix · collapse to one column'],
  ['02', 'Contact inside a header', 'Anything grouped in a graphic header is skipped whole. The parser reports a résumé with no way to reply.', 'Fix · lift to a plain text block'],
  ['03', 'En-dash date ranges', '“2021 — Present” is read as a role some of the time. The date column returns empty and the tenure scores zero.', 'Fix · normalise to a hyphen'],
  ['04', 'Skills as a graphic', 'Dots and bars have no text. A five-dot rating extracts as nothing at all, and the skill is simply lost.', 'Fix · print the level as a word'],
  ['05', 'Spill past one page', 'A line crossing the page edge is cut, not wrapped. The last bullet of the last role is the one that goes.', 'Fix · show the spill before export'],
  ['06', 'Decorative glyph bullets', 'A dingbat before every line attaches to the previous line on extraction, doubling the length of the parse.', 'Fix · plain hyphens, always'],
];

// The plate minis are pure CSS drawings of the real templates' layouts, keyed
// to the same nine the editor ships.
const TEMPLATES = [
  ['Executive Classic', 'Default · framed photo, slate rules', 'm1', 'safe'],
  ['Modern Two-Tone', 'Dual column, accent sidebar', 'm2', ''],
  ['Minimal ATS Pro', 'One column, nothing decorative', 'm3', 'safe'],
  ['Emerald Horizon', 'Deep rule, soft headers', 'm4', 'safe'],
  ['Nordic Luxury', 'Wide margins, quiet type', 'm5', 'safe'],
  ['Grid Master', 'Strict baseline, one page', 'm6', ''],
  ['Developer Console', 'Mono accents, tight leading', 'm7', 'safe'],
  ['Academic CV', 'Publications first, no summary', 'm8', ''],
  ['Startup One-Pager', 'Colour accent, one page hard', 'm9', ''],
];

const SHEET_ROLES = [
  {
    title: 'Staff Engineer',
    org: 'Nordpay · Stockholm',
    years: '2021 — Present',
    bullets: [
      'Rebuilt the ledger append-only; reconciliation errors 1 in 4,000 → 1 in 900,000.',
      'p99 authorisation 340ms → 61ms by moving risk scoring off the write path.',
      'Migrated 41M accounts with zero downtime and no dual-write window.',
      'Cut on-call pages 62% by making the retry path idempotent end to end.',
    ],
  },
  {
    title: 'Senior Engineer',
    org: 'Klarna · Stockholm',
    years: '2018 — 2021',
    bullets: [
      'Owned the settlement service through a 4× volume increase.',
      'Introduced contract tests across nine services; integration breaks down 71%.',
    ],
  },
  {
    title: 'Engineer',
    org: 'Tink · Stockholm',
    years: '2016 — 2018',
    bullets: ['Built the account-aggregation connector for four Nordic banks.'],
  },
];

const LEDGER_ROWS = [
  ['Storage', 'localStorage — a browser key, not a row in a database.'],
  ['Network', 'None by default. Scorer, matcher and exporters are all client-side.'],
  ['Export', 'Vector PDF, DOCX, JSON Resume. Real A4 and US Letter.'],
  ['AI', 'Your own key, or Ollama on your own machine. Optional.'],
  ['Deleted', 'Thirty days in the trash, one-click restore.'],
  ['Cost', 'Nothing. MIT, no paid tier, no telemetry.'],
  ['Trash', 'Every removal is recoverable for thirty days, then purged.'],
  ['Paper', 'A4 and US Letter, measured in real millimetres, not pixels.'],
];

const EXTRACTED = `CONTACT
Tomas Lindqvist
Platform Engineer | Stockholm

EXPERIENCE
Staff Engineer | Nordpay | 2021 - Present
- Append-only ledger; errors down 225x
- p99 340ms to 61ms
- Migration of 41M accounts

STACK
Data: Postgres, Kafka
Infra: K8s, Terraform
Lang: Go, Kotlin`;

const PROOF_SIDE = {
  name: 'Tomas Lindqvist',
  role: 'Platform Engineer · Stockholm',
  sum: 'Payments infrastructure at scale — ledgers, authorisation, and the migration paths between them.',
  exp: [
    ['Staff Engineer', 'Nordpay'],
    ['Append-only ledger; errors down 225×'],
    ['p99 340ms → 61ms'],
    ['Migration of 41M accounts'],
    ['', ''],
    ['Senior Engineer', 'Klarna'],
  ],
  stack: [
    ['Data', 'Postgres, Kafka'],
    ['Infra', 'K8s, Terraform'],
    ['Lang', 'Go, Kotlin'],
    ['Cloud', 'AWS'],
  ],
};

/** One reveal wrapper — same contract as the preview's data-reveal. */
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

/** Section heads: numeral, headline, and a note that owns the right margin. */
function SecHead({ num, kick, title, note, ink = false }) {
  return (
    <div className={`dt-sechead ${ink ? 'dt-sechead--ink' : ''}`}>
      <span className="dt-secnum dt-rise">{num}</span>
      <div>
        <p className="dt-kick dt-rise">{kick}</p>
        <h2 className="dt-h2 dt-rise">
          {title.pre}
          <br />
          <em>{title.em}</em>
        </h2>
      </div>
      <p className={`dt-sechead__note dt-rise ${ink ? 'text-ink-2' : 'text-bone-52'}`}>{note}</p>
    </div>
  );
}

/** The ATS gauge. Counts to 92 once in view; its ticks light in stages. */
function Gauge() {
  const [ref, value] = useCountUp(92, { duration: 1100, start: 0 });
  const filled = Math.round((value / 100) * 40);
  return (
    <div ref={ref} className="dt-gaugebox dt-rise" role="img" aria-label={`ATS readiness ${value} out of 100`}>
      <div className="dt-gauge__top">
        <span className="dt-kick">Readiness</span>
        <span className="dt-gauge__num font-mono tabular-nums">
          <b>{value}</b>
          <i>/100</i>
        </span>
      </div>
      <div className="dt-gauge" aria-hidden="true">
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i} className={i < filled ? 'is-on' : ''} style={{ height: i % 5 === 0 ? '100%' : '76%' }} />
        ))}
      </div>
      <p className="dt-gauge__foot">Weighted, deterministic, runs offline. Illustrated at 92 — the score of the specimen above.</p>
      <p className="dt-gauge__band" aria-hidden="true">
        <span>Weak</span>
        <span>Solid</span>
        <span>Shortlisted</span>
      </p>
      <div className="dt-gauge__marks" aria-hidden="true"><i /><i /><i /></div>
    </div>
  );
}

export default function Landing({ navigate }) {
  const progress = useScrollProgress();
  const tone = useMastTone();
  const clock = useClock();
  useCursor();
  useMagnetic();
  useMaskedHeadlines();
  const peel = usePeel();
  const sheetRef = useRef(null);
  const sheetApi = useSheetDrag(sheetRef);
  const srcHref = 'https://github.com/akshaytp1571/resume-builder';

  useEffect(() => {
    const previous = document.title;
    document.title = 'Resume Studio — the résumé that survives the machine';
    return () => {
      document.title = previous;
    };
  }, []);

  const enter = (e) => {
    e?.preventDefault?.();
    navigate(ROUTE_APP);
  };

  return (
    <div className="landing min-h-screen" data-tone={tone}>
      {/* scroll progress */}
      <div
        aria-hidden="true"
        className="landing-progress"
        style={{ transform: `scaleX(${progress})` }}
      />

      {/* custom cursor: a dot and a lagging ring. Gated to fine pointers. */}
      <div className="dt-cursor no-print" aria-hidden="true">
        <span className="dt-cursor__dot" />
        <span className="dt-cursor__ring"><i /></span>
      </div>

      {/* ---- mast ------------------------------------------------------- */}
      <header className={`dt-mast no-print ${tone === 'paper' ? 'dt-mast--paper' : ''}`}>
        <nav className="dt-mast__in" aria-label="Sections">
          <a className="dt-mark" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0 }); }}>
            <svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true">
              <rect x=".5" y=".5" width="15" height="17" stroke="currentColor" />
              <path d="M4 5h8M4 8h8M4 11h5" stroke="currentColor" />
            </svg>
            <span>Resume<b>Studio</b></span>
          </a>
          <p className="dt-mast__stat font-mono" aria-hidden="true">
            <span className="dt-pip" />
            Bench open · <span data-clock>{clock}</span>
          </p>
          <div className="dt-mast__nav font-mono">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`}>{s.label}</a>
            ))}
          </div>
          <div className="dt-mast__end">
            <a className="dt-mast__src font-mono" href={srcHref} target="_blank" rel="noreferrer">Source</a>
            <button type="button" onClick={enter} className="dt-btn dt-btn--solid font-mono">
              Open
              <ArrowRight size={11} aria-hidden="true" />
            </button>
          </div>
        </nav>
      </header>

      <main id="main">
      {/* ---- hero ------------------------------------------------------- */}
      <section className="dt-hero" id="top">
        <div className="dt-hero__rail font-mono" aria-hidden="true">
          <span>Specimen 01 · A4 · 96 dpi</span>
          <span className="dt-hero__railrule" />
          <span>Issued for review</span>
        </div>

        <div className="dt-hero__main">
          <p className="dt-tag font-mono dt-tag--on">
            <span className="dt-pip" aria-hidden="true" />
            Local-first · MIT · no account
          </p>
          <h1 className="dt-mega">
            <span className="ln"><span className="ln__i">Make a résumé</span></span>
            <span className="ln"><span className="ln__i">the machine</span></span>
            <span className="ln"><span className="ln__i"><em>can read.</em></span></span>
          </h1>
          <p className="dt-deck">
            Nine templates. A live ATS score computed in your tab. A parser view
            that shows the single column the tracking software extracts — before
            a human ever opens it.
          </p>
          <div className="dt-acts">
            <button type="button" onClick={enter} className="dt-btn dt-btn--solid dt-btn--lg dt-magnetic font-mono">
              Open the studio
              <ArrowRight size={14} aria-hidden="true" />
            </button>
            <a href="#score" className="dt-btn dt-btn--line dt-btn--lg dt-magnetic font-mono">How it scores</a>
          </div>
          <dl className="dt-figs font-mono">
            {FIGS.map((f) => <Fig key={f.k} f={f} />)}
          </dl>
        </div>

        {/* the specimen, draggable */}
        <div className="dt-specimen">
          <div className="dt-specimen__shadow" aria-hidden="true" />
          <div
            ref={sheetRef}
            className="dt-sheet"
            role="group"
            tabIndex={0}
            aria-label="Résumé specimen, drag or use arrow keys to tilt"
            {...sheetApi.aria}
          >
            <div className="dt-sheet__in">
              <p className="dt-sheet__k font-mono">Specimen · front</p>
              <h2 className="dt-sheet__nm">Tomas Lindqvist</h2>
              <p className="dt-sheet__rl">Platform Engineer · payments, distributed systems</p>
              <p className="dt-sheet__ct font-mono">Stockholm · t.lindqvist@hey.com · github.com/tlqv · +46 70 118 44 02</p>

              <h3 className="dt-sheet__h font-mono">Summary</h3>
              <p className="dt-sheet__p">
                Payments infrastructure at scale — ledgers, authorisation, and the migration paths between them. Eleven years, three markets, two zero-downtime replatforms.
              </p>

              {SHEET_ROLES.map((r) => (
                <React.Fragment key={r.title}>
                  <h3 className="dt-sheet__h font-mono">Experience</h3>
                  <p className="dt-sheet__jt">{r.title} <span className="dt-sheet__co">{r.org}</span></p>
                  <p className="dt-sheet__yr font-mono">{r.years}</p>
                  <ul className="dt-sheet__ul">
                    {r.bullets.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                </React.Fragment>
              ))}

              <h3 className="dt-sheet__h font-mono">Skills</h3>
              <p className="dt-sheet__p">Go, Kotlin, TypeScript · Postgres, Kafka, Redis · Kubernetes, Terraform, AWS · Distributed systems, payment rails, PSD2</p>
              <h3 className="dt-sheet__h font-mono">Education</h3>
              <p className="dt-sheet__li2"><b>MSc Computer Science</b> KTH Royal Institute of Technology · 2014 — 2016</p>
              <div className="dt-sheet__foot">
                <span className="dt-sheet__fill"><i style={{ '--f': '96%' }} /></span>
                <span className="dt-sheet__fillk font-mono">One page · 96% full · 4% before spill</span>
              </div>
            </div>
            <div className="dt-sheet__glare" aria-hidden="true" />
          </div>
          <p className="dt-specimen__hint font-mono">
            <span>{sheetApi.hint}</span> · <span>{sheetApi.readout}</span>
          </p>
          <p className="dt-specimen__verdict">
            <span className="dt-specimen__stamp font-mono">Passes</span>
            Parsed as one column. No table crossed the contact block.
          </p>
        </div>
      </section>

      {/* ---- ticker ------------------------------------------------------- */}
      <div className="dt-tape no-print" aria-hidden="true">
        <div className="dt-tape__t">
          {[0, 1].map((copy) => (
            <div key={copy} className="dt-tape__set font-mono" aria-hidden={copy === 1}>
              {TICKER.map((t) => (
                <React.Fragment key={t}>
                  <span>{t}</span>
                  <span className="dt-tape__s">◆</span>
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ---- score (dark) ------------------------------------------------ */}
      <section className="dt-section dt-section--dark" id="score">
        <div className="dt-wrap">
          <SecHead
            num="01"
            kick="The score"
            title={{ pre: 'Seven categories.', em: 'Every one of them fixable.' }}
            note="Nothing here is a black box. Each line below is a rule you can read, and the number moves the moment you fix it."
          />
          <div className="dt-score__grid">
            <Gauge />
            <ol className="dt-weights font-mono dt-rise">
              {SCORES.map(([k, v]) => (
                <li key={k}>
                  <span className="w__k">{k}</span>
                  <span className="w__bar"><i style={{ '--p': `${v}%` }} /></span>
                  <span className="w__v">{v}</span>
                </li>
              ))}
              <li className="weights__sum">
                <span className="w__k">Total</span>
                <span className="w__bar w__bar--solid"><i style={{ '--p': '100%' }} /></span>
                <span className="w__v">100</span>
              </li>
            </ol>
            <div className="dt-score__aside dt-rise">
              <p className="dt-score__note">
                Layout is measured from the rendered page — 1123px is one A4 sheet at 96 dpi,
                and anything over it costs points. The other six are content rules you can
                see and correct.
              </p>
              <div className="dt-score__facts font-mono">
                <div><b>1123px</b><span>one A4 sheet at 96 dpi</span></div>
                <div><b>92</b><span>the specimen above</span></div>
                <div><b>0</b><span>network calls to score</span></div>
              </div>
            </div>
            <div className="dt-deductions dt-rise">
              <p className="dt-deductions__h font-mono">The eight points the specimen spends</p>
              <ul className="dt-deductions__l">
                {DEDUCTIONS.map(([n, d]) => (
                  <li key={d}><span>{n}</span>{d}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---- gaps (paper) -------------------------------------------------- */}
      <section className="dt-section dt-section--paper" id="gaps">
        <div className="dt-wrap">
          <SecHead
            ink
            num="02"
            kick="Where résumés actually die"
            title={{ pre: 'Six ways in.', em: 'All six named.' }}
            note="Most rejections happen before a person reads a word. These are the six the scorer looks for, and each one has a fix the editor will do for you."
          />
          <ol className="dt-gaps__grid">
            {GAPS.map(([n, t, p, fix]) => (
              <Reveal as="li" key={n} className="dt-gap" step>
                <span className="dt-gap__n font-mono">{n}</span>
                <h3 className="dt-gap__h">{t}</h3>
                <p className="dt-gap__p">{p}</p>
                <span className="dt-gap__fix font-mono">{fix}</span>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- templates (paper) -------------------------------------------- */}
      <section className="dt-section dt-section--paper dt-section--bound" id="templates">
        <div className="dt-wrap">
          <SecHead
            ink
            num="03"
            kick="Nine templates, plus blank"
            title={{ pre: 'Pick a shape.', em: 'Every one stays parseable.' }}
            note="Palette, font and density are independent of the template. Cropping is never automatic — you see the spill before you export."
          />
          <ul className="dt-plates">
            {TEMPLATES.map(([n, d, m, tag]) => (
              <li key={n} className="dt-plate">
                <div className="dt-plate__box">
                  <span className={`dt-plate__mini ${m}`} aria-hidden="true" />
                </div>
                <p className="dt-plate__n">
                  {n}
                  {tag && <span className={`dt-plate__tag font-mono ${tag === 'safe' ? 'dt-plate__tag--safe' : ''}`}>{tag === 'safe' ? 'ATS-safe' : 'collapses'}</span>}
                </p>
                <p className="dt-plate__d">{d}</p>
              </li>
            ))}
            <li className="dt-plate dt-plate--blank">
              <div className="dt-plate__box"><span className="dt-plate__blank" aria-hidden="true">+</span></div>
              <p className="dt-plate__n">Start blank<span className="dt-plate__tag dt-plate__tag--safe font-mono">ATS-safe</span></p>
              <p className="dt-plate__d">No decoration, nothing to undo</p>
            </li>
          </ul>
        </div>
      </section>

      {/* ---- parser (dark) ------------------------------------------------ */}
      <section className="dt-section dt-section--dark" id="parser">
        <div className="dt-wrap">
          <SecHead
            num="04"
            kick="The parser"
            title={{ pre: 'This is what gets read.', em: 'Word for word.' }}
            note="The right-hand panel is generated from your data, not a screenshot — so it is always the current version of the file."
          />

          <div className="dt-peel" ref={peel.ref} style={{ '--peel': peel.v }}>
            <div className="dt-peel__side dt-peel__side--proof">
              <p className="dt-peel__k font-mono">As designed</p>
              <h3 className="dt-peel__nm">{PROOF_SIDE.name}</h3>
              <p className="dt-peel__rl">{PROOF_SIDE.role}</p>
              <p className="dt-peel__sum">{PROOF_SIDE.sum}</p>
              <div className="dt-peel__cols">
                <div>
                  <p className="dt-peel__h font-mono">Experience</p>
                  <p className="dt-peel__li"><b>Staff Engineer</b> Nordpay</p>
                  <p className="dt-peel__yr font-mono">2021 — Present</p>
                  <p className="dt-peel__li">Append-only ledger; errors down 225×</p>
                  <p className="dt-peel__li">p99 340ms → 61ms</p>
                  <p className="dt-peel__li">Migration of 41M accounts</p>
                  <p className="dt-peel__yr font-mono">2018 — 2021</p>
                  <p className="dt-peel__li"><b>Senior Engineer</b> Klarna</p>
                </div>
                <div>
                  <p className="dt-peel__h font-mono">Stack</p>
                  <table className="dt-peel__tbl"><tbody>
                    {PROOF_SIDE.stack.map(([k, v]) => (
                      <tr key={k}><th>{k}</th><td>{v}</td></tr>
                    ))}
                  </tbody></table>
                  <p className="dt-peel__h dt-peel__h--2 font-mono">Education</p>
                  <p className="dt-peel__li">MSc CS, KTH</p>
                </div>
              </div>
              <p className="dt-peel__foot font-mono">One page · A4 · 96 dpi</p>
            </div>

            <div className="dt-peel__side dt-peel__side--read" aria-hidden={peel.v < 50}>
              <p className="dt-peel__k font-mono">As extracted</p>
              <pre className="dt-peel__pre font-mono">{EXTRACTED}</pre>
              <p className="dt-peel__delta font-mono">
                <b>3 rows</b> promoted out of the side table. <b>2 glyphs</b> normalised. <b>0 lines</b> lost.
              </p>
            </div>

            <button
              type="button"
              className="dt-peel__handle font-mono"
              onClick={peel.toggle}
              aria-label="Reveal the extracted text"
              aria-pressed={peel.v >= 50}
            >
              Peel
            </button>
          </div>

          <div className="dt-parser__notes">
            <p className="dt-rise"><b>Two columns collapse.</b> The side table becomes a labelled list, which is why the template picker marks which ones are ATS-safe.</p>
            <p className="dt-rise"><b>Em-dash ranges normalise.</b> Some parsers read “2021 — Present” as a role, not a date.</p>
            <p className="dt-rise"><b>Nothing is invented.</b> The extracted side is generated from your data, not a screenshot — so it is always current.</p>
          </div>
        </div>
      </section>

      {/* ---- ledger (paper) ----------------------------------------------- */}
      <section className="dt-section dt-section--paper" id="ledger">
        <div className="dt-wrap">
          <SecHead
            ink
            num="05"
            kick="The ledger"
            title={{ pre: 'What you get.', em: 'What it costs.' }}
            note="Everything below is true of the build you can clone right now. No tier unlocks any of it."
          />
          <dl className="dt-sheets">
            {LEDGER_ROWS.map(([k, v]) => (
              <Reveal as="div" key={k} className="dt-sheetrow" step>
                <dt className="font-mono">{k}</dt>
                <dd>{v}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* ---- close (dark) --------------------------------------------------- */}
      <section className="dt-section dt-section--dark dt-close">
        <div className="dt-wrap">
          <h2 className="dt-mega dt-close__h" id="masked-close">
            <span className="ln"><span className="ln__i">Open it.</span></span>
            <span className="ln"><span className="ln__i"><em>Close the tab.</em></span></span>
            <span className="ln"><span className="ln__i">Lose nothing.</span></span>
          </h2>
          <div className="dt-acts dt-acts--c">
            <button type="button" onClick={enter} className="dt-btn dt-btn--solid dt-btn--lg dt-magnetic font-mono">
              Open the studio
              <ArrowRight size={14} aria-hidden="true" />
            </button>
            <a href={srcHref} target="_blank" rel="noreferrer" className="dt-btn dt-btn--line dt-btn--lg dt-magnetic font-mono">Read the source</a>
          </div>
          <p className="dt-close__note font-mono">Sample data loads first. Clearing it is one click.</p>
          <div className="dt-close__strip">
            <div><b className="font-mono">Runs in</b><span>The tab. No server, no queue, no cold start.</span></div>
            <div><b className="font-mono">Stores in</b><span>One browser key. Nothing leaves unless you say so.</span></div>
            <div><b className="font-mono">Costs</b><span>Nothing. MIT from the first commit.</span></div>
          </div>
        </div>
      </section>
      </main>

      <footer className="dt-foot font-mono no-print">
        <span>Resume Studio · MIT</span>
        <span>No cookies. No analytics. One font request, then never again.</span>
      </footer>
    </div>
  );
}

/** Count-up figure. Rendered as a definition term. */
function Fig({ f }) {
  const [ref, value] = useCountUp(f.v, { duration: 900, start: 0 });
  return (
    <div>
      <dt>{f.k}</dt>
      <dd data-count={f.count ? f.v : undefined} ref={ref}>{f.count ? value : f.v}</dd>
    </div>
  );
}
