/* Resume Studio — kinetic poster. Everything transform/opacity/clip-path. */
(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement;

  /* ---- 1. mask-wipe reveals, staggered per line ---- */
  const reveals = document.querySelectorAll('.display, .display--h2, .display--xl');
  reveals.forEach((head) => {
    head.querySelectorAll('.line__i').forEach((line, i) => {
      line.style.setProperty('--d', `${i * 95}ms`);
    });
    head.classList.add('reveal');
  });

  if (reduce || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }

  /* ---- 2. counter-scroll hero word (rAF-throttled) ---- */
  const paraEls = [...document.querySelectorAll('[data-parallax]')];
  if (paraEls.length && !reduce) {
    let ticking = false;
    const apply = () => {
      const y = window.scrollY;
      for (const el of paraEls) {
        el.style.transform = `translate3d(0,${(-y * 0.22).toFixed(2)}px,0)`;
      }
      ticking = false;
    };
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }, { passive: true });
    apply();
  }

  /* ---- 3. numeral counts ---- */
  const counters = [...document.querySelectorAll('[data-count]')];
  const render = (el, n) => {
    const pad = el.dataset.pad ? Number(el.dataset.pad) : 0;
    el.textContent = pad ? String(n).padStart(pad, '0') : String(n);
  };
  if (counters.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      counters.forEach((el) => render(el, Number(el.dataset.count)));
    } else {
      const cio = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target;
          cio.unobserve(el);
          const to = Number(el.dataset.count);
          if (!to) { render(el, 0); continue; }
          const dur = 900 + Math.min(to * 4, 500);
          const t0 = performance.now();
          const step = (t) => {
            const p = Math.min((t - t0) / dur, 1);
            render(el, Math.round(to * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(step);
          };
          el.textContent = el.dataset.pad ? '0'.repeat(el.dataset.pad.length) : '0';
          requestAnimationFrame(step);
        }
      }, { threshold: 0.5 });
      counters.forEach((el) => cio.observe(el));
    }
  }

  if (!fine) return;

  /* ---- 4. magnetic CTA ---- */
  const MAX = 8;
  document.querySelectorAll('[data-magnetic]').forEach((btn) => {
    if (reduce) return;
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      btn.style.setProperty('--bx', `${(dx * MAX).toFixed(2)}px`);
      btn.style.setProperty('--by', `${(dy * MAX).toFixed(2)}px`);
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.setProperty('--bx', '0px');
      btn.style.setProperty('--by', '0px');
    });
  });

  /* ---- 5. cursor-follow dot ---- */
  const dot = document.querySelector('.cursor');
  if (!dot || reduce) return;
  let tx = -100, ty = -100, cx = -100, cy = -100, raf = 0, on = false;

  const loop = () => {
    cx += (tx - cx) * 0.16;
    cy += (ty - cy) * 0.16;
    dot.style.transform = `translate3d(${cx.toFixed(2)}px,${cy.toFixed(2)}px,0) translate(-50%,-50%)`;
    raf = Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1 ? requestAnimationFrame(loop) : 0;
  };

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY;
    if (!on) { on = true; dot.classList.add('is-on'); }
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });

  root.addEventListener('pointerleave', () => { dot.classList.remove('is-on'); on = false; });
})();
