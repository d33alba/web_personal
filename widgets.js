/* ============================================================
   widgets.js — comportamiento de los widgets (ver «WIDGETS» en style.css)
   1. Aparición escalonada al entrar en pantalla.
   2. Inclinación 3D + brillo que sigue al cursor (solo con ratón).
   3. El «pulgar» deslizante del control segmentado de Hobbies.
   No añade texto: todo lo que se ve ya está en el HTML y en el diccionario ES/EN.
   ============================================================ */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  /* ---------- 1. Aparición escalonada ---------- */
  /* Los .widget con .reveal ya los anima script.js; aquí solo el resto. */
  const widgets = $$('.widget:not(.reveal)');
  if (reduce || !('IntersectionObserver' in window)) {
    widgets.forEach((w) => w.classList.add('is-in'));
  } else {
    widgets.forEach((w) => {
      const sibs = Array.from(w.parentElement.children).filter((c) => c.classList.contains('widget'));
      w.style.setProperty('--i', Math.min(sibs.indexOf(w), 8));      /* retraso según su posición en el grupo */
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    widgets.forEach((w) => io.observe(w));
  }

  /* ---------- 1b. Títulos con máscara ----------
     El título (.mask) está recortado con clip-path al 100 %, y algunos navegadores calculan
     su visibilidad ya recortada (área 0), así que script.js nunca llegaba a revelarlo.
     Aquí lo observamos a través de su contenedor, que sí ocupa espacio. */
  if ('IntersectionObserver' in window) {
    const mio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.querySelectorAll('.mask').forEach((m) => m.classList.add('is-in'));
        mio.unobserve(e.target);
      });
    }, { threshold: 0.1 });
    new Set($$('.mask').map((m) => m.parentElement)).forEach((p) => mio.observe(p));
  } else {
    $$('.mask').forEach((m) => m.classList.add('is-in'));
  }

  /* ---------- 2. Inclinación 3D y brillo ---------- */
  if (fine && !reduce) {
    $$('[data-tilt]').forEach((el) => {
      let raf = 0;
      el.addEventListener('pointermove', (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          const max = Math.max(2.5, Math.min(9, 2200 / r.width));   /* las tarjetas grandes se inclinan menos */
          el.classList.add('is-tilting');
          el.style.setProperty('--rx', ((0.5 - py) * max).toFixed(2) + 'deg');
          el.style.setProperty('--ry', ((px - 0.5) * max).toFixed(2) + 'deg');
          el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
          el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
          el.style.setProperty('--tx', (px - 0.5).toFixed(2));
          el.style.setProperty('--ty', (py - 0.5).toFixed(2));
        });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf); raf = 0;
        el.classList.remove('is-tilting');
        ['--rx', '--ry', '--tx', '--ty'].forEach((p) => el.style.removeProperty(p));
      });
    });
  }

  /* ---------- 3. Control segmentado (Hobbies) ---------- */
  $$('.seg').forEach((seg) => {
    const place = () => {
      const a = seg.querySelector('.tab.is-active');
      if (!a) return;
      seg.style.setProperty('--tx', a.offsetLeft + 'px');
      seg.style.setProperty('--tw', a.offsetWidth + 'px');
    };
    seg.classList.add('seg--js');
    place();
    new MutationObserver(place).observe(seg, { attributes: true, attributeFilter: ['class'], subtree: true });   /* script.js cambia .is-active */
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(seg);                                    /* idioma o fuentes cambian los anchos */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    addEventListener('resize', place);
  });
})();
