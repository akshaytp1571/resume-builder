/* C-instrument motion. Signatures: line draw, typewriter readout, gauge fill,
   pointer crosshair. All transform/opacity/stroke-dashoffset. Final state is
   correct with JS absent and with reduced motion. */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canObserve = 'IntersectionObserver' in window;

  /* ---------------------------------------------------------- line draw --- */
  // Real path lengths so a 12px tick and a 622px dimension finish in step.
  // Draw order is construction -> callouts -> revision note, on a group stagger.
  const SVGS = [...document.querySelectorAll('.drawing, .mob-svg')];

  for (const svg of SVGS) {
    for (const el of svg.querySelectorAll(
      '.dim__line, .dim__tick, .dim__arrow, .call__leader, .note__rev, .cross path, .rule'
    )) {
      const len = el.getTotalLength();
      if (!len) continue;
      el.style.setProperty('--len', len.toFixed(1));
      el.setAttribute('data-draw', '');
    }
    [...svg.querySelectorAll('.page, .cross, .dim, .call, .call__note')].forEach((g, i) => {
      g.style.setProperty('--delay', `${i * 110}ms`);
    });
  }

  if (reduced || !canObserve) {
    SVGS.forEach((s) => s.classList.add('is-drawn'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          const svg = entry.target;
          requestAnimationFrame(() => svg.classList.add('is-drawn'));
        }
      },
      { threshold: 0.15 }
    );
    SVGS.forEach((s) => io.observe(s));
  }

  /* -------------------------------------------------------- typewriter --- */
  const typed = document.querySelector('[data-type]');
  const caret = document.querySelector('.caret');

  if (typed) {
    // The readout is authored in the data-type attribute, so the markup stays
    // readable while the element body starts empty.
    const full = typed.dataset.type;
    if (reduced || !canObserve) {
      typed.textContent = full;
      caret && caret.classList.add('caret--idle');
    } else {
      typed.textContent = '';
      const io2 = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) return;
          io2.disconnect();
          let i = 0;
          const tick = () => {
            typed.textContent = full.slice(0, i);
            if (i >= full.length) {
              caret && caret.classList.add('caret--idle');
              return;
            }
            // Newlines breathe; ordinary characters fire at reading speed.
            const ch = full[i];
            i += 1;
            setTimeout(tick, ch === '\n' ? 200 : 16 + Math.random() * 20);
          };
          setTimeout(tick, 300);
        },
        { threshold: 0.5 }
      );
      io2.observe(typed.parentElement);
    }
  }

  /* ------------------------------------------------------------- gauge --- */
  const gauge = document.querySelector('[data-gauge]');
  if (gauge) {
    const N = 40;
    const on = 37; // 92 of 100, rounded to a whole hairline
    const bars = [];
    for (let i = 0; i < N; i += 1) {
      const bar = document.createElement('i');
      bar.className = 'gauge__bar';
      // Height profile reads as the seven weighted categories rather than forty
      // identical ticks, so the silhouette carries information.
      const shape = Math.abs(Math.sin(i * 0.62)) * 0.55 + Math.abs(Math.cos(i * 0.19)) * 0.45;
      bar.style.height = `${(22 + shape * 70).toFixed(1)}%`;
      if (i < on) bar.dataset.on = '';
      gauge.append(bar);
      bars.push(bar);
    }

    const arm = () => {
      bars.forEach((b, i) => {
        if (b.dataset.on === undefined) return;
        if (reduced) b.classList.add('is-on');
        else setTimeout(() => b.classList.add('is-on'), 80 + i * 20);
      });
    };

    if (reduced || !canObserve) arm();
    else {
      const io3 = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) return;
          io3.disconnect();
          arm();
        },
        { threshold: 0.4 }
      );
      io3.observe(gauge);
    }
  }

  /* --------------------------------------------------------- crosshair --- */
  const schematic = document.querySelector('[data-schematic]');

  if (schematic && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const xy = schematic.querySelector('[data-xy]');
    const xh = document.createElement('div');
    xh.className = 'xhair';
    xh.setAttribute('aria-hidden', 'true');
    schematic.append(xh);

    const pad = (n) => String(Math.round(n)).padStart(4, '0');
    const vb = schematic.querySelector('svg').viewBox.baseVal;
    let queued = false;

    schematic.addEventListener('pointermove', (e) => {
      if (queued) return;
      queued = true;
      const r = schematic.getBoundingClientRect();
      // Report in drawing units, not CSS pixels, so the numbers stay true at
      // every viewport width.
      const ux = ((e.clientX - r.left) / r.width) * vb.width;
      const uy = ((e.clientY - r.top) / r.height) * vb.height;
      requestAnimationFrame(() => {
        queued = false;
        schematic.classList.add('is-tracking');
        xh.style.setProperty('--x', `${(ux / vb.width) * 100}%`);
        xh.style.setProperty('--y', `${(uy / vb.height) * 100}%`);
        if (xy) xy.textContent = `x: ${pad(ux)}  y: ${pad(uy)}`;
      });
    });

    schematic.addEventListener('pointerleave', () => {
      schematic.classList.remove('is-tracking');
      if (xy) xy.textContent = 'x: ----  y: ----';
    });
  }
})();
