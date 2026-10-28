/* Resume Studio — A/Letterpress
   Motion: ink settling, one sheet under the roller, rules drawing.
   Every scroll effect fires once. Reduced motion → final state. */

(() => {
  const root = document.documentElement;
  /* The stylesheet hides .reveal behind html:not(.js). That is the no-JS
     fallback: with scripting off nothing matches the hiding rule and the page
     is fully readable. Marking the root here is what opts INTO the hidden start
     state, so it must happen before first paint — adding it later gives a frame
     of visible content that then vanishes. */
  root.classList.add('js');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- overlap detection for the stagger; no library ---- */
  const words = [...document.querySelectorAll('.display .w > span')];
  words.forEach((w, i) => w.style.setProperty('--i', i));
  /* last word carries the full stop's color via markup, not JS */

  if (reduced) {
    document.body.classList.add('is-ready', 'is-still');
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-in'));
    document.querySelector('.colophon')?.classList.add('is-drawn');
    document.querySelector('.press-frame')?.classList.add('is-printed');
    return;
  }

  /* ---- 1. ink bleed on load ---- */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.add('is-ready');
  }));

  /* ---- shared observer ---- */
  const once = (el, cb, opts = {}) => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        cb(e.target);
        io.unobserve(e.target);
      }
    /* rootMargin is zero on purpose. A -8% bottom inset silently excludes
       anything sitting in the last 8% of the viewport, which is exactly where a
       section heading lands on first paint — and that section then never
       reveals at all. Verified the hard way. */
    }, { threshold: 0.01, rootMargin: '0px', ...opts });
    io.observe(el);
  };

  /* ---- 2. the printing press ---- */
  const frame = document.querySelector('.press-frame');
  if (frame) {
    once(frame, () => frame.classList.add('is-printing'), { threshold: 0.35 });
  }

  /* ---- 3. drop cap swell ---- */
  const cap = document.querySelector('.dropcap');
  if (cap) {
    const art = cap.closest('.argument') || cap;
    once(art, () => cap.classList.add('is-swell'), { threshold: 0.25 });
  }

  /* ---- 4. section settles ---- */
  document.querySelectorAll('.reveal').forEach(el => {
    once(el, node => node.classList.add('is-in'));
  });

  /* ---- 5. colophon rules draw in sequence ---- */
  const colophon = document.querySelector('.colophon');
  if (colophon) {
    once(colophon, node => node.classList.add('is-drawn'), { threshold: 0.2 });
  }

  /* ---- 6. nav marks the section you are reading ---- */
  const links = [...document.querySelectorAll('.nav a[href^="#"]')];
  const targets = links
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if (targets.length) {
    const spy = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach(a => {
          const on = a.getAttribute('href') === '#' + e.target.id;
          a.classList.toggle('is-current', on);
          if (on) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      }
    }, { threshold: 0.15, rootMargin: '-30% 0px -55% 0px' });
    targets.forEach(t => spy.observe(t));
  }
})();
