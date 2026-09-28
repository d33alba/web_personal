/* ============================================================
   secret-hunt.js — La terminal secreta del pie de página y la
   transición hacia el juego (secret.html).

   La portada NO descarga este archivo al cargar: lo pide su script
   la primera vez que alguien hace clic en la terminal. Así quien
   entra a ver el currículum no paga ni un byte del easter egg.
   La terminal solo se ve en escritorio (lo decide el CSS).
   ============================================================ */
(function () {
  'use strict';

  const term = document.getElementById('secretTerm');
  const input = document.getElementById('termInput');
  const log = document.getElementById('termLog');
  if (!term || !input || !log) return;

  /* Las rutas salen de dónde está ESTE archivo, así funciona igual
     desde index.html que desde en/index.html */
  const base = new URL('.', document.currentScript.src);
  const url = (p) => new URL(p, base).href;

  const CODE = 'bad_time';
  let unlocked = false;

  /* La terminal no se traduce: un terminal de verdad no se traduce,
     así que su texto va siempre en inglés, estilo bash. */
  function printLine(text, cls) {
    const p = document.createElement('p');
    p.textContent = text;
    if (cls) p.className = cls;
    log.appendChild(p);
    while (log.children.length > 5) log.removeChild(log.firstChild);
  }

  /* Ya que alguien está curioseando, descargamos el juego en segundo plano:
     si acierta el código, la navegación se siente instantánea. */
  ['secret.html', 'secret.js', 'boss.js', 'audio/rachmaninoff-concierto2-mov1-b.ogg'].forEach((u) => {
    fetch(url(u), { mode: 'same-origin' }).catch(() => {});
  });

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
      setTimeout(startCollapse, 350);
    } else {
      term.classList.remove('glitch'); void term.offsetWidth; term.classList.add('glitch');
      /* Mismo mensaje que soltaría un bash real ante un comando que no existe. */
      printLine('bash: ' + val + ': command not found', 'err');
    }
  });

  /* ---------- Transición: partículas que caen a un agujero negro que se
     traga la pantalla entera. Cuando ya está todo negro, navega al juego. ---------- */
  function startCollapse() {
    try { sessionStorage.setItem('daar-secret-entry', '1'); } catch (e) {}

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;z-index:999;pointer-events:none';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = innerWidth; canvas.height = innerHeight;

    const cx = innerWidth / 2, cy = innerHeight / 2;
    const reachR = Math.hypot(innerWidth, innerHeight) * 0.62;
    const parts = Array.from({ length: 160 }, () => {
      const a = Math.random() * Math.PI * 2;
      const d = reachR * (0.35 + Math.random() * 0.65);
      return { a, d, sp: 0.55 + Math.random() * 0.9 };
    });

    const DUR = 1500, t0 = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - t0) / DUR);
      const e = t * t * (3 - 2 * t);                 /* smoothstep: acelera y frena suave */
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      parts.forEach((p) => {
        const k = Math.min(1, Math.pow(e, p.sp));
        const d = p.d * (1 - k);
        ctx.globalAlpha = Math.max(0, 1 - k * 0.25);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(p.a) * d, cy + Math.sin(p.a) * d, Math.max(0.4, 2.2 * (1 - k) + 0.3), 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(cx, cy, e * reachR * 1.15, 0, Math.PI * 2); ctx.fill();

      if (t < 1) requestAnimationFrame(frame);
      else location.href = url('secret.html');
    }
    requestAnimationFrame(frame);
  }
})();
