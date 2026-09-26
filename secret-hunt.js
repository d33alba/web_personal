/* ============================================================
   secret-hunt.js — El hilo del easter egg: la pista en la mancha,
   la terminal del pie de página y la transición hacia secret.html.

   Todo esto es SOLO de escritorio: en móvil no hay sitio para
   "fijarse bien" ni cursor con el que apartar la tinta, así que ni
   siquiera se ejecuta (misma condición que ya usa spots.js).
   La nube de la pista (.secret-bubble) es puro CSS ( :hover ),
   no hace falta JS para eso — este archivo solo enciende la
   terminal y gestiona qué pasa cuando escribes algo en ella.
   ============================================================ */
(function () {
  'use strict';

  const skip = matchMedia('(max-width: 820px), (hover: none) and (pointer: coarse)');
  if (skip.matches) return;

  const term = document.getElementById('secretTerm');
  const input = document.getElementById('termInput');
  const log = document.getElementById('termLog');
  if (!term || !input || !log) return;

  const CODE = 'bad_time';
  let unlocked = false;

  /* La terminal no tiene versión ES/EN: un terminal de verdad no se traduce,
     así que su copy se queda siempre en inglés, estilo Linux/bash real. */
  term.classList.add('is-on');

  function printLine(text, cls) {
    const p = document.createElement('p');
    p.textContent = text;
    if (cls) p.className = cls;
    log.appendChild(p);
    while (log.children.length > 5) log.removeChild(log.firstChild);
  }

  /* Precarga en frío los recursos del juego mientras el visitante anda por la
     terminal: si acierta el código, la caché ya los tiene y la navegación
     final se siente instantánea en vez de con un parón de carga. */
  let preloaded = false;
  function preload() {
    if (preloaded) return;
    preloaded = true;
    ['secret.html', 'secret.js', 'boss.js', 'audio/rachmaninoff-concierto2-mov1-b.ogg'].forEach((u) => {
      fetch(u, { mode: 'same-origin' }).catch(() => {});
    });
  }
  input.addEventListener('focus', preload, { once: true });

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || unlocked) return;
    const val = input.value.trim();
    input.value = '';
    if (!val) return;
    printLine('> ' + val);
    if (val.toLowerCase() === CODE) {
      unlocked = true;
      input.disabled = true;
      term.classList.add('unlocked');
      printLine('…', 'ok');
      preload();
      setTimeout(startCollapse, 350);
    } else {
      term.classList.remove('glitch'); void term.offsetWidth; term.classList.add('glitch');
      /* Mismo mensaje que soltaría un bash real ante un comando que no existe. */
      printLine('bash: ' + val + ': command not found', 'err');
    }
  });

  /* ---------- Transición: partículas que caen a un agujero negro que se
     traga la pantalla entera. Cuando ya está todo negro, navega a
     secret.html (que, gracias al preload de arriba, ya está en caché). ---------- */
  function startCollapse() {
    try { sessionStorage.setItem('daar-secret-entry', '1'); } catch (e) {}

    const canvas = document.createElement('canvas');
    canvas.className = 'secret-collapse';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
    resize();
    addEventListener('resize', resize);

    const cx = innerWidth / 2, cy = innerHeight / 2;
    const reachR = Math.hypot(innerWidth, innerHeight) * 0.62;
    const N = 160;
    const parts = Array.from({ length: N }, () => {
      const a = Math.random() * Math.PI * 2;
      const d = reachR * (0.35 + Math.random() * 0.65);
      return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, a, d, sp: 0.55 + Math.random() * 0.9 };
    });

    const DUR = 1500;
    const t0 = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - t0) / DUR);
      const e = t * t * (3 - 2 * t);                 /* smoothstep: acelera y frena suave */
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      parts.forEach((p) => {
        const k = Math.min(1, Math.pow(e, p.sp));
        const d = p.d * (1 - k);
        const x = cx + Math.cos(p.a) * d, y = cy + Math.sin(p.a) * d;
        const r = Math.max(0.4, 2.2 * (1 - k) + 0.3);
        ctx.globalAlpha = Math.max(0, 1 - k * 0.25);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      });

      ctx.globalAlpha = 1;
      const holeR = e * reachR * 1.15;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(cx, cy, holeR, 0, Math.PI * 2); ctx.fill();

      if (t < 1) requestAnimationFrame(frame);
      else location.href = 'secret.html';
    }
    requestAnimationFrame(frame);
  }
})();
