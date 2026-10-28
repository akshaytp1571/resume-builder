/* ===========================================================================
   F — STUDIO · motion

   Seven separate mechanisms. Each owns its own elements, so no two ever write
   the same transform. The two continuous loops (cursor, sheet) skip their
   style write when nothing has moved, so an idle page costs nothing.

   Every mechanism has a reduced-motion path. The universal CSS kill-switch
   handles twitches; the JS below handles the ones that need to resolve to a
   final state rather than freeze mid-way.
   =========================================================================== */

(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ===================================================================== 1
     Cursor dot + ring
     Ring lags the dot on a spring; grows over anything interactive.
     ===================================================================== */
  if (canHover && !reduced) {
    const cur = document.querySelector('[data-cursor]');
    const dot = cur?.querySelector('.cursor__dot');
    const ring = cur?.querySelector('.cursor__ring');
    let mx = innerWidth / 2, my = innerHeight / 2;
    let rx = mx, ry = my;
    let last = null;

    addEventListener('pointermove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      if (dot) dot.style.transform = `translate(${mx}px, ${my}px)`;
      // Reveal the custom cursor only once the pointer has actually moved:
      // before that we do not know where it is, and a ring parked at 0,0 in
      // the corner reads as a rendering artefact.
      if (cur && !cur.classList.contains('is-live')) cur.classList.add('is-live');
      const t = e.target;
      const hot = t instanceof Element && t.closest('a, button, .sheet, .plate, .sheetrow, input, [data-peel]');
      cur.classList.toggle('is-hot', Boolean(hot));
    }, { passive: true });

    addEventListener('pointerdown', () => cur?.classList.add('is-down'));
    addEventListener('pointerup', () => cur?.classList.remove('is-down'));

    (function ringLoop() {
      requestAnimationFrame(ringLoop);
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      const k = `${rx.toFixed(1)},${ry.toFixed(1)}`;
      if (k === last) return;
      last = k;
      if (ring) ring.style.transform = `translate(${rx.toFixed(1)}px, ${ry.toFixed(1)}px)`;
    })();
  }

  /* ===================================================================== 2
     Magnetic buttons — the whole button leans toward the pointer a few px and
     springs back on leave. Capped so it cannot wander.
     ===================================================================== */
  if (canHover && !reduced) {
    const MAG = 7;
    document.querySelectorAll('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        el.style.setProperty('--mx', `${(dx * MAG).toFixed(2)}px`);
        el.style.setProperty('--my', `${(dy * MAG).toFixed(2)}px`);
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      });
    });
  }

  /* ===================================================================== 3
     Draggable specimen — 3D tilt with inertia, rubber bands, and a glare that
     tracks the pointer. One loop owns the transform.
     ===================================================================== */
  const sheet = document.querySelector('[data-sheet]');
  if (sheet) {
    const TMAX = 13;
    let tx = 0, ty = 0;        // current deg
    let vx = 0, vy = 0;        // deg/sec
    let ttx = 0, tty = 0;      // target deg
    let held = false;
    let pid = null;
    let lastX = 0, lastY = 0, lastT = 0;
    let pvx = 0, pvy = 0;
    let dirty = true;
    const readout = document.querySelector('[data-ry]');
    const hint = document.querySelector('[data-hint]');

    function paint() {
      sheet.style.transform =
        `rotateX(${ty.toFixed(2)}deg) rotateY(${tx.toFixed(2)}deg)`;
      const g = sheet.querySelector('.sheet__glare');
      if (g) g.style.transform = `translate(${(tx * 2.2).toFixed(1)}px, ${(ty * -2.2).toFixed(1)}px) translateZ(1px)`;
      if (readout) readout.textContent = `${Math.abs(tx).toFixed(0)}° / ${Math.abs(ty).toFixed(0)}°`;
    }

    function clamp(v) { return Math.max(-TMAX * 1.7, Math.min(TMAX * 1.7, v)); }

    let frameT = null;

    function loop(now) {
      requestAnimationFrame(loop);
      const dt = frameT == null ? 1 / 60 : Math.min(0.032, (now - frameT) / 1000);
      frameT = now;

      if (!held) {
        // spring back to the pointer target, then to flat when it is gone
        vx += (-60 * (tx - ttx) - 11 * vx) * dt;
        vy += (-60 * (ty - tty) - 11 * vy) * dt;
        if (Math.abs(tx - ttx) < 0.02 && Math.abs(vx) < 0.05) { tx = ttx; vx = 0; }
        if (Math.abs(ty - tty) < 0.02 && Math.abs(vy) < 0.05) { ty = tty; vy = 0; }
        tx += vx * dt;
        ty += vy * dt;
      }
      if (dirty || Math.abs(vx) > 0.02 || Math.abs(vy) > 0.02) { paint(); dirty = false; }
    }

    sheet.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button !== 0) return;
      held = true; pid = e.pointerId;
      vx = 0; vy = 0;
      lastX = e.clientX; lastY = e.clientY;
      lastT = performance.now();
      pvx = 0; pvy = 0;
      sheet.setPointerCapture?.(e.pointerId);
      if (hint) hint.textContent = 'Release';
      e.preventDefault();
    });

    sheet.addEventListener('pointermove', (e) => {
      if (!held || e.pointerId !== pid) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const dt = Math.max(1, now - lastT) / 1000;
      tx = clamp(tx + dx * 0.34);
      ty = clamp(ty - dy * 0.34);
      pvx = pvx * 0.6 + ((dx * 0.34) / dt) * 0.4;
      pvy = pvy * 0.6 + ((-dy * 0.34) / dt) * 0.4;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      dirty = true;
      if (readout) readout.textContent = `${Math.abs(tx).toFixed(0)}° / ${Math.abs(ty).toFixed(0)}°`;
    });

    function release() {
      if (!held) return;
      held = false;
      if (pid != null) { try { sheet.releasePointerCapture?.(pid); } catch { /* gone */ } }
      pid = null;

      /* Where it comes to rest is a judgement, not a reset. Snapping flat on
         every release throws away the thing the user just did — a card you
         tilted and let go of stays tilted. So: keep the tilt, and only return
         toward flat when the throw was gentle AND the angle is shallow, which
         is the "gave it a nudge" case. A firm throw settles with momentum. */
      const throwSpeed = Math.hypot(pvx, pvy);
      const angle = Math.hypot(tx, ty);
      const firmEnough = throwSpeed > 55 || angle > TMAX * 0.55;

      if (firmEnough) {
        ttx = tx;   // stay here
        tty = ty;
        vx = Math.max(-140, Math.min(140, pvx));
        vy = Math.max(-140, Math.min(140, pvy));
      } else {
        ttx = 0;
        tty = 0;
        vx = 0;
        vy = 0;
      }
      if (hint) hint.textContent = firmEnough ? 'Double-tap to reset' : 'Drag me';
    }
    sheet.addEventListener('pointerup', release);
    sheet.addEventListener('pointercancel', release);
    addEventListener('blur', release);

    sheet.addEventListener('keydown', (e) => {
      const step = 4;
      let handled = true;
      if (e.key === 'ArrowLeft') { tx = clamp(tx - step); ttx = tx; }
      else if (e.key === 'ArrowRight') { tx = clamp(tx + step); ttx = tx; }
      else if (e.key === 'ArrowUp') { ty = clamp(ty - step); tty = ty; }
      else if (e.key === 'ArrowDown') { ty = clamp(ty + step); tty = ty; }
      else if (e.key === 'Home') { tx = 0; ty = 0; ttx = 0; tty = 0; }
      else handled = false;
      if (!handled) return;
      e.preventDefault();
      dirty = true;
    });

    if (!reduced) requestAnimationFrame(loop);
    else paint();
  }

  /* ===================================================================== 4
     Template plates — per-card tilt toward the pointer, with a ghost numeral
     behind. Cheap, and only while hovered.
     ===================================================================== */
  if (canHover && !reduced) {
    document.querySelectorAll('.tilt').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ty', `${(x * 9).toFixed(2)}deg`);
        el.style.setProperty('--tx', `${(-y * 9).toFixed(2)}deg`);
        el.style.setProperty('--tz', '-4px');
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--tx', '0deg');
        el.style.setProperty('--ty', '0deg');
        el.style.setProperty('--tz', '0px');
      });
    });
  }

  /* ===================================================================== 5
     The peel — one property, --peel 0..100, clips the extracted panel over the
     designed one. Drag it, click it, or press it. Same dual-clip idea as D but
     as a reveal rather than a mirror.
     ===================================================================== */
  const peel = document.querySelector('[data-peel]');
  const peelBtn = document.querySelector('[data-peel-btn]');
  if (peel && peelBtn) {
    let open = false;
    let dragging = false;
    let pid = null;
    let rect = null;

    const setPeel = (p) => {
      const v = Math.max(0, Math.min(100, p));
      peel.style.setProperty('--peel', v.toFixed(1));
      peelBtn.setAttribute('aria-pressed', String(v >= 50));
      open = v >= 50;
    };

    function fromX(x) {
      if (!rect) return 0;
      return ((x - rect.left) / rect.width) * 100;
    }

    peel.addEventListener('pointerdown', (e) => {
      // Do not start a drag when the press began on the handle: capturing the
      // pointer on the panel retargets the subsequent click to the panel, so
      // the button's own handler never runs and the control looks dead.
      if (e.target instanceof Element && e.target.closest('[data-peel-btn]')) return;
      rect = peel.getBoundingClientRect();
      dragging = true;
      pid = e.pointerId;
      peel.setPointerCapture?.(e.pointerId);
      setPeel(fromX(e.clientX));
    });
    peel.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerId !== pid) return;
      setPeel(fromX(e.clientX));
    });
    peel.addEventListener('pointerup', () => { dragging = false; pid = null; });
    peel.addEventListener('pointercancel', () => { dragging = false; pid = null; });

    peelBtn.addEventListener('click', () => setPeel(open ? 0 : 100));
    peel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); setPeel(open ? 100 : 100); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setPeel(0); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPeel(open ? 0 : 100); }
    });

    setPeel(reduced ? 100 : 0);
  }

  /* ===================================================================== 6
     The gauge — 40 hairlines, staged fill, numeral count. Runs once.
     ===================================================================== */
  const gauge = document.querySelector('[data-gauge]');
  const gaugeNum = document.querySelector('[data-gauge-num]');
  const TARGET = 92;
  const TICKS = 40;

  if (gauge) {
    for (let i = 0; i < TICKS; i += 1) gauge.appendChild(document.createElement('i'));
  }

  let gaugeDone = false;
  function runGauge() {
    if (gaugeDone || !gauge) return;
    gaugeDone = true;
    const lit = Math.round((TARGET / 100) * TICKS);

    if (reduced) {
      [...gauge.children].forEach((t, i) => { if (i < lit) t.classList.add('is-on'); });
      if (gaugeNum) gaugeNum.textContent = String(TARGET);
      return;
    }

    [...gauge.children].forEach((t, i) => {
      if (i >= lit) return;
      setTimeout(() => t.classList.add('is-on'), i * 34);
    });
    const t0 = performance.now();
    (function count(now) {
      const p = Math.min(1, (now - t0) / 1100);
      if (gaugeNum) gaugeNum.textContent = String(Math.round(TARGET * p));
      if (p < 1) requestAnimationFrame(count);
    })(t0);
  }

  /* ===================================================================== 7
     Reveals, weights, tape, progress, mast
     ===================================================================== */

  function primeTape() {
    const t = document.querySelector('[data-tape]');
    const set = document.querySelector('[data-tape-set]');
    if (!t || !set) return;
    // Duplicate the set so the -50% loop is seamless.
    const clone = set.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    t.appendChild(clone);
  }
  primeTape();

  const progress = document.querySelector('[data-progress]');
  const mast = document.querySelector('[data-mast]');

  /* The mast inverts with whatever section is under it. Measured, not guessed:
     the paper sections are the ones whose computed background is lighter than
     the shell, so a new section inherits the behaviour for free. */
  const PAPER_SECTIONS = [...document.querySelectorAll('.templates, .ledger')];

  function toneUnderMast() {
    /* Probe just below the mast's actual bottom, not at a fixed 24px. A fixed
       offset sits inside the mast itself (it is ~62px tall), so the probe
       always reported the page background and the inversion never fired. */
    const y = mast ? mast.getBoundingClientRect().height + 2 : 64;
    for (const s of PAPER_SECTIONS) {
      const r = s.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) return 'paper';
    }
    return 'dark';
  }

  let queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const doc = document.documentElement;
      const max = doc.scrollHeight - innerHeight;
      if (progress) progress.style.transform = `scaleX(${(max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0).toFixed(4)})`;
      if (mast) {
        mast.classList.toggle('is-stuck', scrollY > 20);
        const tone = toneUnderMast();
        mast.setAttribute('data-tone', tone);
        // The custom cursor flips its ink on paper, or it disappears against it.
        document.body.setAttribute('data-tone', tone);
      }
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Every section that owns a masked headline reveals on its own. This used to
     add is-hot to the hero only, so the close section's headline was masked
     forever — 359px of black above its buttons. */
  document.querySelectorAll('main > section').forEach((s) => {
    const lines = s.querySelectorAll('.ln__i');
    if (!lines.length) return;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      s.classList.add('is-hot');
      return;
    }
    const so = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-hot');
        so.unobserve(e.target);
      }
    }, { threshold: 0.01, rootMargin: '0px' });
    so.observe(s);
  });

  /* ------------------------------------------------------------- bench clock --- */

  /* A ticking clock in the mast. It is the only element that reads as "now",
     and it costs one interval. */
  const clock = document.querySelector('[data-clock]');
  if (clock) {
    const tick = () => {
      const d = new Date();
      clock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    tick();
    setInterval(tick, 20000);
  }

  const revealTargets = [...document.querySelectorAll('[data-reveal]')];
  const weights = document.querySelector('.weights');

  if (reduced || typeof IntersectionObserver === 'undefined') {
    revealTargets.forEach((el) => el.classList.add('is-in'));
    weights?.classList.add('is-in');
    runGauge();
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
          if (entry.target === weights) weights.classList.add('is-in');
        }
      },
      // Zero inset: a negative bottom margin silently skips content that lands
      // in the last few percent of the viewport on first paint.
      { threshold: 0.01, rootMargin: '0px' }
    );
    revealTargets.forEach((el) => io.observe(el));
    if (weights) io.observe(weights);

    const gio = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        gio.disconnect();
        runGauge();
      }
    }, { threshold: 0.35, rootMargin: '0px' });
    if (gauge) gio.observe(gauge);
  }

  /* ------------------------------------------------------ button char wave --- */

  /* Split each label into characters. A real space stays a real space — the
     char spans are inline-block, so a bare space would collapse; a padded .sp
     span keeps the accessible name correct ("Flip it", not "Flip\u00a0it"). */
  document.querySelectorAll('[data-split]').forEach((el) => {
    const text = el.textContent || '';
    if (!text.trim()) return;
    el.textContent = '';
    const frag = document.createDocumentFragment();
    let i = 0;
    for (const ch of text) {
      const span = document.createElement('span');
      if (ch === ' ') { span.className = 'sp'; span.textContent = ' '; }
      else span.textContent = ch;
      span.style.transitionDelay = `${i * 14}ms`;
      frag.appendChild(span);
      i += 1;
    }
    el.appendChild(frag);
  });
})();
