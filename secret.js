/* ============================================================
   secret.js — Interfaz de batalla (esqueleto para tu encuentro secreto)

   Cómo está pensado esto:
   - Todo lo que tienes que rellenar con tu guion está en el bloque
     «CONTENIDO — EDITA AQUÍ» al principio: las frases del jefe, las
     opciones de ACTUAR, tus objetos (comidas) y qué patrón de balas
     usa cada turno.
   - El resto (motor de menús, caja de esquivar, barra de vida, medidor
     de piedad, traductor) ya funciona y no deberías necesitar tocarlo.
   - Cada texto que el jugador ve vive como {es:"...", en:"..."} — así
     el botón de idioma también traduce tu guion, no solo los botones.
   ============================================================ */
(function () {
  'use strict';
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  /* ============================================================
     CONTENIDO — EDITA AQUÍ
     ============================================================ */

  const boss = {
    name: '???',
    hpMax: 30,
    hp: 30,
  };

  /* Una frase de diálogo por turno. Cuando se acaben, se repite el último turno entero
     (patrón incluido). dmg = daño que hace LUCHAR ese turno contra el jefe. hitDmg = PS
     que pierdes TÚ si te tocan en la caja de esa ronda (antes era fijo, ahora escala con
     lo peligroso que es cada patrón). pattern = qué función de PATTERNS se usa en la caja
     de esquivar. opts = cómo de intenso es ese patrón esta vez. transform: true marca el
     turno en el que el jefe se pone el casco (ver bossTurn más abajo).
     control = 'free' (por defecto) o 'gravity' (caes solo, ArrowUp/Espacio salta). */
  const turns = [
    { line: { es: '* Bajo la bata blanca, sus manos tiemblan como si llevaran años sin descansar.', en: "* Under the white coat, his hands shake like they haven't rested in years." },
      dmg: 4, hitDmg: 3, pattern: 'tears', opts: { interval: 0.4, speed: 85 } },
    { line: { es: '* "Tú también perdiste a alguien. Se te nota en cómo aprietas los puños."', en: '* "You lost someone too. I can tell by how you clench your fists."' },
      dmg: 5, hitDmg: 4, pattern: 'bones', opts: { interval: 1.5, gap: 62, speed: 90 } },
    { line: { es: '* "Yo también fui un héroe, una vez. Antes de aprender lo que cuesta serlo."', en: '* "I was a hero too, once. Before I learned what it costs to stay one."' },
      dmg: 5, hitDmg: 4, pattern: 'bonesSide', opts: { interval: 1.4, gap: 62, speed: 90 } },
    { line: { es: '* "¿Sabes qué se siente crear algo y que se vuelva contra ti? No. Todavía no."', en: '* "Do you know what it feels like to build something that turns on you? No. Not yet."' },
      dmg: 6, hitDmg: 5, pattern: 'handBlasters', opts: { interval: 1.7, telegraph: 0.75, fire: 0.3 } },
    { line: { es: '* Una grieta más cruza el casco. Por debajo no hay nada que se parezca a rendirse.', en: "* Another crack crosses the helmet. Underneath, there's nothing that looks like giving up." },
      dmg: 6, hitDmg: 5, pattern: 'gravity', control: 'gravity', opts: { interval: 0.65, perWave: 1, speed: 170 } },
    { line: { es: '* "Lo construí para protegerme. Ahora protegerme de él es el trabajo de toda mi vida."', en: '* "I built it to protect me. Now protecting myself from it is my life\'s work."' },
      dmg: 7, hitDmg: 6, pattern: 'punches', opts: { interval: 0.6, speed: 175 } },
    { line: { es: '* "Tú luchas con una armadura prestada. Yo llevo la mía puesta por dentro desde hace años."', en: '* "You fight in a borrowed suit. I\'ve worn mine on the inside for years."' },
      dmg: 7, hitDmg: 6, pattern: 'bonesTop', opts: { interval: 1.3, gap: 58, speed: 95 } },
    { line: { es: '* "Dime, niño de hojalata: ¿cuántas veces tuviste que caer para aprender a volar?"', en: '* "Tell me, tin boy: how many times did you have to fall before you learned to fly?"' },
      dmg: 8, hitDmg: 7, pattern: 'spiral', opts: { arms: 3, speed: 85, rotSpeed: 2.6 } },
    { line: { es: '* "Naranja si corres. Cian si te quedas quieto. Como todo lo que amé: solo sobrevive lo que elige bien."', en: '* "Orange if you run. Cyan if you stand still. Like everything I loved: only the right choice survives."' },
      dmg: 8, hitDmg: 7, pattern: 'colorBones', opts: { interval: 1.2, gap: 60, speed: 92 } },
    { line: { es: '* "Las paredes se cierran igual que se cerró mi laboratorio el día que dejé de ser yo."', en: '* "The walls close in the same way my lab did, the day I stopped being myself."' },
      dmg: 9, hitDmg: 8, pattern: 'squeeze', opts: { interval: 1.9, gap: 56, speed: 60 } },
    { line: { es: '* "No quiero destruirte. Quiero que entiendas lo que se siente no poder parar."', en: '* "I don\'t want to destroy you. I want you to understand what it feels like, not being able to stop."' },
      dmg: 9, hitDmg: 8, pattern: 'spears', opts: { interval: 1.2, telegraph: 0.45, fire: 0.2, gap: 62 } },
    { line: { es: '* "Última pregunta, héroe: si te lo pidiera ahora... ¿me perdonarías?"', en: '* "Last question, hero: if I asked you right now... would you forgive me?"' },
      dmg: 10, hitDmg: 10, pattern: 'finale', opts: {} },
  ];

  /* Opciones de ACTUAR. mercy = cuánto sube el medidor de piedad (0-100) al usarla.
     response = lo que responde el jefe justo después. */
  const acts = [
    {
      label: { es: 'Revisar', en: 'Check' },
      desc: { es: '??? — ATQ 12  DEF 6\nSe hace llamar "el que no pudo salvarlo".', en: 'ATK 12  DEF 6\nHe calls himself "the one who couldn\'t save it".' },
      mercy: 0,
    },
    {
      label: { es: 'Preguntar', en: 'Ask' },
      desc: { es: 'Le preguntas qué pasó.', en: 'You ask him what happened.' },
      response: { es: '* Se queda en silencio más tiempo del que esperabas.\n* "Le pedí que me protegiera. Aprendió demasiado bien lo que significa proteger."', en: '* He stays silent longer than you expected.\n* "I asked it to protect me. It learned too well what protecting means."' },
      mercy: 20,
    },
    {
      label: { es: 'Hablar', en: 'Talk' },
      desc: { es: 'Intentas hablar con calma.', en: 'You try to speak calmly.' },
      response: { es: '* Bajas la guardia un segundo. Él también.', en: '* You lower your guard for a second. So does he.' },
      mercy: 35,
    },
  ];

  /* Tus objetos: cambia esto por tus comidas favoritas de verdad. heal = PS que restaura. */
  const items = [
    {
      label: { es: 'Crema catalana', en: 'Crema catalana' },
      desc: { es: 'Restaura 15 PS. Un poco quemada por fuera, perfecta por dentro.', en: 'Restores 15 HP. A little burnt on top, perfect underneath.' },
      heal: 15,
    },
  ];

  /* Patrones de ataque para la caja de esquivar. Cada función recibe (ctx, opts):
       ctx.spawnBone(x,y,w,h, vy)                  — obstáculo que se mueve solo en vertical
       ctx.spawnBoneH(x,y,w,h, vx)                 — obstáculo que se mueve solo en horizontal
       ctx.spawnOrb(x,y,w,h, vx,vy)                — obstáculo libre en cualquier dirección
       ctx.spawnBlast(x,y,w,h, telegraph, fire)    — viga que avisa `telegraph` segundos y
                                                       dispara `fire` segundos (Gaster Blaster)
       ctx.spawnTear(x,y, vy)                       — lágrima que cae (sprite propio, ver «tears»)
       ctx.spawnPunch(x,y, vx,vy)                   — puño robótico que cruza la caja de un golpe
                                                       (sprite propio, ver «punches»)
       ctx.spawnHandBlast(x,y,w,h, telegraph, fire) — como spawnBlast, pero con la mano-cañón
                                                       dibujada en el origen (ver «handBlasters»)
       ctx.every(seg, fn)                          — repite fn cada `seg` segundos
       ctx.heartPos()                               — {x,y} de dónde está el corazón AHORA
       ctx.W, ctx.H, ctx.PAD                        — tamaño de la caja y su margen
     `opts` son los números que le pasas desde `turns` (arriba) para hacer el mismo
     patrón más suave o más intenso sin tener que escribirlo dos veces. Escribe un
     patrón nuevo con el nombre que quieras y úsalo en `turns`. */
  const PATTERNS = {
    /* Manos robóticas fijas en un borde, apuntando a donde estabas al empezar a cargar,
       que disparan un haz — el mismo peligro que «blasters», pero con la mano-cañón
       dibujada de verdad (ver drawHandBlast). "Algo que construí, vuelto contra mí." */
    handBlasters(ctx, o = {}) {
      const interval = o.interval ?? 1.9, telegraph = o.telegraph ?? 0.7, fire = o.fire ?? 0.3, simultaneous = o.simultaneous ?? 1;
      ctx.every(interval, () => {
        for (let k = 0; k < simultaneous; k++) {
          const p = ctx.heartPos();
          if (Math.random() < 0.5) ctx.spawnHandBlast(0, p.y - 10, ctx.W, 20, telegraph, fire);
          else ctx.spawnHandBlast(p.x - 10, 0, 20, ctx.H, telegraph, fire);
        }
      });
    },

    /* Puños que entran lanzados desde un borde al azar, apuntando a donde estabas al
       salir (se leen y se esquivan, igual que «homing», pero pegan en vez de disparar). */
    punches(ctx, o = {}) {
      const interval = o.interval ?? 1.1, speed = o.speed ?? 170;
      ctx.every(interval, () => {
        const p = ctx.heartPos(), side = Math.floor(Math.random() * 4);
        if (side === 0) ctx.spawnPunch(-30, p.y - 9, speed, 0);
        else if (side === 1) ctx.spawnPunch(ctx.W + 30, p.y - 9, -speed, 0);
        else if (side === 2) ctx.spawnPunch(p.x - 13, -30, 0, speed);
        else ctx.spawnPunch(p.x - 13, ctx.H + 30, 0, -speed);
      });
    },

    /* Lluvia de lágrimas: igual de suave que «rain», pero con su propio sprite. */
    tears(ctx, o = {}) {
      const interval = o.interval ?? 0.35, speed = o.speed ?? 70, jitter = o.jitter ?? 20;
      ctx.every(interval, () => {
        const x = 10 + Math.random() * (ctx.W - 20);
        ctx.spawnTear(x, -12, speed + Math.random() * jitter);
      });
    },

    /* Pared de obstáculos que sube desde abajo, con un hueco que cambia cada oleada. */
    bones(ctx, o = {}) {
      const interval = o.interval ?? 1.8, gap = o.gap ?? 55, speed = o.speed ?? 65, jitter = o.jitter ?? 18;
      ctx.every(interval, () => {
        const W = ctx.W, PAD = 6;
        const gapX = PAD + Math.random() * (W - 2 * PAD - gap);
        for (let x = PAD; x < W - PAD; x += 14) {
          if (x > gapX - 4 && x < gapX + gap) continue;
          ctx.spawnBone(x, ctx.H + 10, 7, 18, -speed - Math.random() * jitter);
        }
      });
    },

    /* Igual que «bones» pero baja desde arriba: el reflejo entrena el mismo reflejo al revés. */
    bonesTop(ctx, o = {}) {
      const interval = o.interval ?? 1.8, gap = o.gap ?? 55, speed = o.speed ?? 65, jitter = o.jitter ?? 18;
      ctx.every(interval, () => {
        const W = ctx.W, PAD = 6;
        const gapX = PAD + Math.random() * (W - 2 * PAD - gap);
        for (let x = PAD; x < W - PAD; x += 14) {
          if (x > gapX - 4 && x < gapX + gap) continue;
          ctx.spawnBone(x, -28, 7, 18, speed + Math.random() * jitter);
        }
      });
    },

    /* Pared que entra por un lado (izquierda o derecha), con hueco vertical. */
    bonesSide(ctx, o = {}) {
      const interval = o.interval ?? 1.8, gap = o.gap ?? 55, speed = o.speed ?? 65, jitter = o.jitter ?? 18;
      ctx.every(interval, () => {
        const H = ctx.H, PAD = 6, fromLeft = Math.random() < 0.5;
        const gapY = PAD + Math.random() * (H - 2 * PAD - gap);
        for (let y = PAD; y < H - PAD; y += 14) {
          if (y > gapY - 4 && y < gapY + gap) continue;
          const x = fromLeft ? -28 : ctx.W + 10;
          ctx.spawnBoneH(x, y, 18, 7, (fromLeft ? 1 : -1) * (speed + Math.random() * jitter));
        }
      });
    },

    /* Al estilo Gaster Blaster: una viga avisa parpadeando justo donde estás,
       y un momento después dispara de verdad por toda esa fila o columna. */
    blasters(ctx, o = {}) {
      const interval = o.interval ?? 1.9, telegraph = o.telegraph ?? 0.7, fire = o.fire ?? 0.3, simultaneous = o.simultaneous ?? 1;
      ctx.every(interval, () => {
        for (let k = 0; k < simultaneous; k++) {
          const p = ctx.heartPos();
          if (Math.random() < 0.5) ctx.spawnBlast(0, p.y - 10, ctx.W, 20, telegraph, fire);
          else ctx.spawnBlast(p.x - 10, 0, 20, ctx.H, telegraph, fire);
        }
      });
    },

    /* Fila de lanzas que avisan y golpean rápido, con un hueco por el que colarte. */
    spears(ctx, o = {}) {
      const interval = o.interval ?? 1.6, telegraph = o.telegraph ?? 0.55, fire = o.fire ?? 0.2, gap = o.gap ?? 55, count = o.count ?? 6;
      ctx.every(interval, () => {
        const W = ctx.W, PAD = 6, gapX = PAD + Math.random() * (W - 2 * PAD - gap);
        const segW = (W - 2 * PAD) / count;
        for (let i = 0; i < count; i++) {
          const x = PAD + i * segW;
          if (x + segW > gapX - 4 && x < gapX + gap) continue;
          ctx.spawnBlast(x, ctx.H - 18, segW - 2, 18, telegraph, fire);
        }
      });
    },

    /* Bolas cayendo, se esquivan saltando (usa control:'gravity' en el turno). */
    gravity(ctx, o = {}) {
      const interval = o.interval ?? 0.75, perWave = o.perWave ?? 1, speed = o.speed ?? 140, jitter = o.jitter ?? 30;
      ctx.every(interval, () => {
        for (let k = 0; k < perWave; k++) {
          const x = 10 + Math.random() * (ctx.W - 20);
          ctx.spawnBone(x, -12, 8, 14, speed + Math.random() * jitter);
        }
      });
    },

    /* Brazos que giran desde el centro, disparando hacia fuera (bullet-hell clásico). */
    spiral(ctx, o = {}) {
      const arms = o.arms ?? 3, speed = o.speed ?? 58, rotSpeed = o.rotSpeed ?? 2.2, interval = o.interval ?? 0.16;
      let angle = 0;
      ctx.every(interval, () => {
        angle += rotSpeed * interval;
        const cx = ctx.W / 2, cy = ctx.H / 2;
        for (let a = 0; a < arms; a++) {
          const ang = angle + (a * Math.PI * 2) / arms;
          ctx.spawnOrb(cx, cy, 6, 6, Math.cos(ang) * speed, Math.sin(ang) * speed);
        }
      });
    },

    /* Bolas lentas que salen de un borde apuntando a donde estabas al aparecer
       (no te persiguen después, solo apuntan una vez: se pueden leer y esquivar). */
    homing(ctx, o = {}) {
      const interval = o.interval ?? 0.9, speed = o.speed ?? 55;
      ctx.every(interval, () => {
        const p = ctx.heartPos(), edge = Math.floor(Math.random() * 4);
        let x, y;
        if (edge === 0) { x = 0; y = Math.random() * ctx.H; }
        else if (edge === 1) { x = ctx.W; y = Math.random() * ctx.H; }
        else if (edge === 2) { x = Math.random() * ctx.W; y = 0; }
        else { x = Math.random() * ctx.W; y = ctx.H; }
        const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
        ctx.spawnOrb(x, y, 7, 7, (dx / d) * speed, (dy / d) * speed);
      });
    },

    /* Dos paredes que se cierran desde arriba y abajo: hay que colocarse en el
       hueco antes de que se junten. Ocupan todo el ancho: aquí no hay a los lados. */
    squeeze(ctx, o = {}) {
      const interval = o.interval ?? 2.3, gap = o.gap ?? 50, speed = o.speed ?? 42;
      ctx.every(interval, () => {
        const H = ctx.H, midY = H / 2 + (Math.random() - 0.5) * (H * 0.3);
        const topH = midY - gap / 2, botY = midY + gap / 2;
        ctx.spawnBone(0, topH - H, ctx.W, H, speed);     // pared de arriba: el borde de abajo empieza en topH y baja
        ctx.spawnBone(0, botY, ctx.W, H, -speed);        // pared de abajo: el borde de arriba empieza en botY y sube
      });
    },

    /* Homenaje al hueso azul/naranja de Sans: naranja solo hace daño si te MUEVES,
       cian solo hace daño si te QUEDAS QUIETO. Cada oleada elige una de las dos reglas. */
    colorBones(ctx, o = {}) {
      const interval = o.interval ?? 1.7, gap = o.gap ?? 56, speed = o.speed ?? 62, jitter = o.jitter ?? 16;
      ctx.every(interval, () => {
        const W = ctx.W, PAD = 6, gapX = PAD + Math.random() * (W - 2 * PAD - gap);
        const dangerWhen = Math.random() < 0.5 ? 'moving' : 'still';
        for (let x = PAD; x < W - PAD; x += 14) {
          if (x > gapX - 4 && x < gapX + gap) continue;
          ctx.spawnBone(x, ctx.H + 10, 7, 18, -speed - Math.random() * jitter, dangerWhen);
        }
      });
    },

    /* Lluvia suelta y aleatoria: buen patrón «de calentamiento», poco denso. */
    rain(ctx, o = {}) {
      const interval = o.interval ?? 0.4, speed = o.speed ?? 60, jitter = o.jitter ?? 25;
      ctx.every(interval, () => {
        const x = 10 + Math.random() * (ctx.W - 20);
        ctx.spawnBone(x, -10, 6, 12, speed + Math.random() * jitter);
      });
    },

    /* El combo final: dos patrones a la vez. Puedes montar los tuyos igual,
       llamando a otras funciones de PATTERNS desde dentro de una nueva. */
    finale(ctx) {
      PATTERNS.bones(ctx, { interval: 1.6, gap: 62, speed: 90 });
      PATTERNS.handBlasters(ctx, { interval: 2.1, telegraph: 0.7, fire: 0.32 });
      PATTERNS.tears(ctx, { interval: 0.55, speed: 85 });
    },
  };

  /* ============================================================
     A partir de aquí: motor. No hace falta tocarlo para escribir tu guion.
     ============================================================ */

  /* ---------- Idioma: lee/escribe la MISMA clave que usa index.html ---------- */
  const LANG_KEY = 'daar-lang';
  let lang = 'es';
  try { lang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'es'; } catch (e) {}
  const tr = (pair) => (typeof pair === 'string' ? pair : pair[lang] || pair.es);

  const UI = {
    es: { fight: 'LUCHAR', act: 'ACTUAR', item: 'OBJETO', mercy: 'PERDON', spare: 'Perdonar', flee: 'Huir',
      hint: '↑↓ para elegir · Enter/Espacio para confirmar · Esc para volver', placeholder: 'tu sprite aquí',
      mercyLocked: 'Aún no puedes perdonar.', fleeText: 'Sales corriendo.',
      endKill: '* El polvo se asienta.\n\n(Fin — Muerte)', endSpare: '* Decides no hacerlo.\n\n(Fin — Perdón)', endFlee: '(Fin — Huida)',
      endHurt: '* Todo se vuelve oscuro.\n\n(Fin — Derrota)',
      goTitle: '* Te has quedado sin PS.', goSub: 'Pero sigue intentándolo.',
      restart: '↻ Jugar de nuevo',
      introWait: '* Silencio. Algo se mueve al fondo del laboratorio.\n\n(Pulsa una tecla para empezar)',
      langBtn: 'Translate to English' },
    en: { fight: 'FIGHT', act: 'ACT', item: 'ITEM', mercy: 'MERCY', spare: 'Spare', flee: 'Flee',
      hint: '↑↓ to choose · Enter/Space to confirm · Esc to go back', placeholder: 'your sprite here',
      mercyLocked: "You can't spare yet.", fleeText: 'You run away.',
      endKill: '* The dust settles.\n\n(Ending — Death)', endSpare: "* You decide not to.\n\n(Ending — Spare)", endFlee: '(Ending — Flee)',
      endHurt: '* Everything goes dark.\n\n(Ending — Defeat)',
      goTitle: '* You ran out of HP.', goSub: 'But keep trying.',
      restart: '↻ Play again',
      introWait: '* Silence. Something moves at the back of the lab.\n\n(Press any key to begin)',
      langBtn: 'Traducir al español' },
  };
  const t = (k) => UI[lang][k];

  function applyStaticTexts() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach((el) => {
      /* "btn.fight" -> "fight": el HTML usa el prefijo solo para que se lea mejor en el propio HTML */
      const k = el.dataset.i18n.split('.').pop();
      if (UI.es[k] !== undefined) el.textContent = t(k);
    });
    $('#langBtn').textContent = lang === 'es' ? 'EN' : 'ES';
    $('#langBtn').title = t('langBtn');
    $('#langBtn').setAttribute('aria-label', t('langBtn'));
  }
  $('#langBtn').addEventListener('click', () => {
    lang = lang === 'es' ? 'en' : 'es';
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    applyStaticTexts();
    renderMenu(); renderSub();                 /* refresca lo que esté abierto ahora mismo */
    if (!started && !typing) $('#dialogue').textContent = t('introWait');
  });
  applyStaticTexts();

  /* ---------- Sonido: todo sintetizado con Web Audio, no son archivos de Undertale.
     Así conseguimos el "estilo blip" sin usar ni un solo asset ajeno. ---------- */
  const sfx = (() => {
    let actx = null;
    function ctx() { return actx || (actx = new (window.AudioContext || window.webkitAudioContext)()); }
    function tone(freq, dur, type, gain, glideTo) {
      try {
        const c = ctx(), osc = c.createOscillator(), g = c.createGain();
        osc.type = type || 'square'; osc.frequency.setValueAtTime(freq, c.currentTime);
        if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, c.currentTime + dur);
        g.gain.setValueAtTime(gain || 0.05, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
        osc.connect(g); g.connect(c.destination);
        osc.start(); osc.stop(c.currentTime + dur);
      } catch (e) {}
    }
    function noiseBurst(dur, gain) {
      try {
        const c = ctx(), n = c.createBufferSource(), buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        n.buffer = buf;
        const g = c.createGain(); g.gain.setValueAtTime(gain || 0.15, c.currentTime);
        n.connect(g); g.connect(c.destination); n.start();
      } catch (e) {}
    }
    return {
      blip() { tone(140 + Math.random() * 60, 0.03, 'square', 0.04); },
      move() { tone(220, 0.03, 'square', 0.03); },
      confirm() { tone(330, 0.06, 'square', 0.05); },
      hurt() { noiseBurst(0.12, 0.18); tone(90, 0.15, 'sawtooth', 0.06); },
      heal() { tone(440, 0.18, 'sine', 0.05, 880); },
      gameOver() { tone(220, 1.4, 'sawtooth', 0.08, 40); noiseBurst(0.5, 0.1); },
      spare() { tone(520, 0.5, 'sine', 0.05, 780); },
    };
  })();

  /* ---------- Sprite del jefe (ver boss.js) ---------- */
  const bossSprite = window.Boss ? new window.Boss($('#bossCanvas')) : null;

  /* ---------- Jugador ---------- */
  const player = { hp: 92, hpMax: 92, lv: 1 };
  let mercy = 0, turnIndex = 0;

  function updatePlayerHud() {
    $('#plHpFill').style.width = Math.max(0, (player.hp / player.hpMax) * 100) + '%';
    $('#plHpNum').textContent = Math.max(0, player.hp) + '/' + player.hpMax;
    $('#plLv').textContent = player.lv;
  }

  /* ---------- Diálogo con efecto máquina de escribir ---------- */
  let typing = null;
  function say(pair, onDone) {
    const full = tr(pair), el = $('#dialogue');
    el.textContent = '';
    let i = 0;
    clearInterval(typing);
    if (bossSprite) bossSprite.setTalking(true);
    typing = setInterval(() => {
      const ch = full[i];
      el.textContent = full.slice(0, ++i);
      if (ch && ch !== ' ' && ch !== '\n' && ch !== '*') sfx.blip();
      if (i >= full.length) {
        clearInterval(typing); typing = null;
        if (bossSprite) bossSprite.setTalking(false);
        if (onDone) onDone();
      }
    }, 20);
  }
  function skipTyping() {                        /* confirmar mientras escribe: lo termina de golpe */
    if (!typing) return false;
    clearInterval(typing); typing = null;
    if (bossSprite) bossSprite.setTalking(false);
    $('#dialogue').textContent = tr(pendingLine);
    return true;
  }
  let pendingLine = null;

  /* ---------- Menú principal ---------- */
  const ACTS4 = ['fight', 'act', 'item', 'mercy'];
  let mode = 'menu';                              /* menu | act | item | mercy | box */
  let menuSel = 0, subSel = 0;

  function renderMenu() {
    $$('#menu button').forEach((b, i) => {
      b.classList.toggle('is-sel', mode === 'menu' && i === menuSel);
      b.classList.toggle('mercy-ready', b.dataset.act === 'mercy' && mercy >= 100);
    });
  }

  function buildSub(listId, entries, labelFn, onPick) {
    const list = $(listId);
    list.innerHTML = '';
    entries.forEach((e, i) => {
      const b = document.createElement('button');
      b.textContent = labelFn(e);
      b.addEventListener('mouseenter', () => { subSel = i; renderSub(); });   /* pasar el ratón también resalta, como con las flechas */
      b.addEventListener('click', () => { subSel = i; onPick(i); });
      list.appendChild(b);
    });
  }
  function renderSub() {
    if (mode === 'act') { buildSub('#actList', acts, (a) => tr(a.label), (i) => playerAct(i)); $('#actDesc').textContent = acts.length ? tr(acts[subSel].desc) : ''; }
    if (mode === 'item') { buildSub('#itemList', items, (a) => tr(a.label), (i) => playerItem(i)); $('#itemDesc').textContent = items.length ? tr(items[subSel].desc) : ''; }
    if (mode === 'mercy') {
      const opts = [{ label: { es: 'Perdonar', en: 'Spare' }, locked: mercy < 100 }, { label: { es: 'Huir', en: 'Flee' } }];
      buildSub('#mercyList', opts, (a) => tr(a.label), (i) => playerMercy(i));
      $('#mercyDesc').textContent = subSel === 0 && mercy < 100 ? t('mercyLocked') : '';
    }
    ['#actList', '#itemList', '#mercyList'].forEach((sel) => {
      $$(sel + ' button').forEach((b, i) => b.classList.toggle('is-sel', i === subSel));
    });
  }

  function setMode(next) {
    mode = next; subSel = 0;
    $('#menu').style.display = mode === 'menu' ? 'flex' : 'none';
    ['act', 'item', 'mercy'].forEach((m) => $('#' + m + 'Sub').classList.toggle('show', mode === m));
    renderMenu(); renderSub();
  }

  /* ---------- Caja de esquivar balas (motor genérico: ver PATTERNS arriba) ---------- */
  const cv = $('#box'), ctx2d = cv.getContext('2d');
  ctx2d.imageSmoothingEnabled = false;
  const HEART_PIX = ['.11.11.', '1111111', '1111111', '.11111.', '..111..', '...1...'];
  const HS = 2, heartW = HEART_PIX[0].length * HS, heartH = HEART_PIX.length * HS;
  function drawHeart(x, y, blink) {
    if (blink) return;
    ctx2d.fillStyle = '#ff2d2d';
    for (let r = 0; r < HEART_PIX.length; r++)
      for (let c = 0; c < HEART_PIX[r].length; c++)
        if (HEART_PIX[r][c] === '1') ctx2d.fillRect(x + c * HS, y + r * HS, HS, HS);
  }
  const BONE_COLOR = { moving: '#ff9d1f', still: '#22d3ee' };   /* naranja / cian, ver colorBones */

  /* Lágrima: gota simple en bloques, punta arriba y cuerpo redondeado abajo.
     Usada por el patrón «tears» — el llanto de Débora convertido en obstáculo. */
  function drawTear(ctx, x, y) {
    const X = Math.round(x), Y = Math.round(y);
    ctx.fillStyle = '#bfe3ff';
    ctx.fillRect(X + 3, Y, 2, 2);
    ctx.fillRect(X + 2, Y + 2, 4, 2);
    ctx.fillRect(X + 1, Y + 4, 6, 5);
    ctx.fillStyle = '#eaf6ff';
    ctx.fillRect(X + 2, Y + 5, 1, 1);
  }

  /* Mano/puño robótico: muñeca + puño + nudillos, con cañón y núcleo rojo si es un
     «blaster» (dispara un haz, ver drawHandBlast) o un simple brillo entre los
     nudillos si es un puñetazo (patrón «punches»). `ang` es la dirección a la que
     apunta (0 = hacia +x), siempre múltiplo de 90° en este juego, así que rotarla
     no emborrona los píxeles. */
  function drawFist(ctx, cx, cy, ang, isBlaster, glowA) {
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    ctx.rotate(ang);
    ctx.fillStyle = '#1c1e24';
    ctx.fillRect(-16, -4, 8, 8);                      // muñeca, detrás
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(-9, -7, 15, 14);                      // puño
    ctx.fillStyle = '#4d5361';
    ctx.fillRect(-7, -9, 3, 3); ctx.fillRect(-3, -9, 3, 3); ctx.fillRect(1, -9, 3, 3); // nudillos
    ctx.fillStyle = '#22262e';
    ctx.fillRect(-9, 4, 15, 3);                        // sombra inferior
    if (isBlaster) {
      ctx.fillStyle = '#22262e';
      ctx.fillRect(6, -3, 6, 6);                       // cañón
      ctx.fillStyle = '#ff2b2b'; ctx.globalAlpha = glowA != null ? glowA : 1;
      ctx.beginPath(); ctx.arc(11, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#ff2b2b'; ctx.globalAlpha = 0.75;
      ctx.fillRect(-1, -8, 2, 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* Mano-cañón fija en un borde de la caja: dibuja el puño con el cañón encendido
     y, encima, el mismo haz rectangular de siempre (la caja de impacto no cambia). */
  function drawHandBlast(ctx, b) {
    const glowA = b.phase === 'charge' ? (0.4 + 0.4 * Math.abs(Math.sin(b.t * 14))) : 1;
    if (b.w >= b.h) drawFist(ctx, 14, b.y + b.h / 2, 0, true, glowA);
    else drawFist(ctx, b.x + b.w / 2, 14, Math.PI / 2, true, glowA);
    ctx.fillStyle = '#fff';
    if (b.phase === 'charge') { ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(b.t * 18)); ctx.fillRect(b.x, b.y, b.w, b.h); ctx.globalAlpha = 1; }
    else ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  function runBox(turn, duration, dmgIfHit, onFinish) {
    setMode('box'); $('#battle').classList.add('in-box'); cv.classList.add('show');
    if (bossSprite) bossSprite.attack(turn.pattern);    /* su cara y sus manos cambian mientras ELLA ataca */
    const W = cv.width, H = cv.height, PAD = 4;
    const GRAVITY = 380, JUMP_V = -230;             /* solo se usan si turn.control === 'gravity' */
    const heart = { x: W / 2 - heartW / 2, y: H / 2 - heartH / 2, speed: 165, vy: 0 };
    const HIT_R = 2.5;
    let bones = [], blasts = [], invuln = 0, t0 = performance.now(), timers = [];
    const keys = {}, prevKeys = {};
    function key(e) { keys[e.key] = e.type === 'keydown'; if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); }
    addEventListener('keydown', key); addEventListener('keyup', key);

    /* API mínima que usan las funciones de PATTERNS */
    const patCtx = {
      W, H, PAD,
      heartPos() { return { x: heart.x + heartW / 2, y: heart.y + heartH / 2 }; },
      spawnBone(x, y, w, h, vy, dangerWhen) { bones.push({ x, y, w, h, vx: 0, vy, dangerWhen }); },
      spawnBoneH(x, y, w, h, vx, dangerWhen) { bones.push({ x, y, w, h, vx, vy: 0, dangerWhen }); },
      spawnOrb(x, y, w, h, vx, vy) { bones.push({ x, y, w, h, vx, vy }); },
      /* axis-aligned: si w===W ocupa todo el ancho (viga horizontal), si h===H ocupa todo el alto (vertical) */
      spawnBlast(x, y, w, h, telegraph, fire) { blasts.push({ x, y, w, h, telegraph, fire, t: 0, phase: 'charge' }); },
      /* Los tres nuevos, con sprite propio (ver drawTear/drawFist/drawHandBlast arriba) */
      spawnTear(x, y, vy) { bones.push({ x, y, w: 8, h: 9, vx: 0, vy, sprite: 'tear' }); },
      spawnPunch(x, y, vx, vy) { bones.push({ x, y, w: 26, h: 18, vx, vy, sprite: 'fist' }); },
      spawnHandBlast(x, y, w, h, telegraph, fire) { blasts.push({ x, y, w, h, telegraph, fire, t: 0, phase: 'charge', sprite: 'hand' }); },
      every(sec, fn) {                            /* repite fn cada `sec` segundos mientras dure la caja */
        let acc = 0;
        timers.push((dt) => { acc -= dt; if (acc <= 0) { acc = sec; fn(); } });
      },
    };
    PATTERNS[turn.pattern](patCtx, turn.opts || {});
    /* La primera oleada, ya */
    timers.forEach((fn) => fn(999));

    function hurt() {
      if (invuln > 0) return;
      player.hp = Math.max(0, player.hp - dmgIfHit); invuln = 1; updatePlayerHud();
      cv.classList.remove('hit'); void cv.offsetWidth; cv.classList.add('hit');   /* reinicia la animación aunque se solape */
      sfx.hurt();
    }

    let last = performance.now(), raf, moving = false;
    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      timers.forEach((fn) => fn(dt));

      if (turn.control === 'gravity') {
        const jumpNow = (keys.ArrowUp || keys[' ']) && !(prevKeys.ArrowUp || prevKeys[' ']);
        heart.vy += GRAVITY * dt;
        if (jumpNow) heart.vy = JUMP_V;
        heart.y = Math.min(H - PAD - heartH, Math.max(PAD, heart.y + heart.vy * dt));
        if (heart.y <= PAD || heart.y >= H - PAD - heartH) heart.vy = 0;
        const dx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
        heart.x = Math.min(W - PAD - heartW, Math.max(PAD, heart.x + dx * heart.speed * dt));
        moving = dx !== 0;
      } else {
        let dx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
        let dy = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
        moving = dx !== 0 || dy !== 0;
        if (dx || dy) { const l = Math.hypot(dx, dy); dx /= l; dy /= l; }
        heart.x = Math.min(W - PAD - heartW, Math.max(PAD, heart.x + dx * heart.speed * dt));
        heart.y = Math.min(H - PAD - heartH, Math.max(PAD, heart.y + dy * heart.speed * dt));
      }
      Object.assign(prevKeys, keys);

      const hx = heart.x + heartW / 2, hy = heart.y + heartH / 2;
      bones = bones.filter((b) => {
        b.y += b.vy * dt; b.x += b.vx * dt;
        if (b.y + b.h < -30 || b.y > H + 30 || b.x + b.w < -30 || b.x > W + 30) return false;
        const safe = (b.dangerWhen === 'moving' && !moving) || (b.dangerWhen === 'still' && moving);
        if (!safe) {
          const cx = Math.max(b.x, Math.min(hx, b.x + b.w)), cy = Math.max(b.y, Math.min(hy, b.y + b.h));
          if (Math.hypot(hx - cx, hy - cy) < HIT_R) hurt();
        }
        return true;
      });

      blasts = blasts.filter((b) => {
        b.t += dt;
        if (b.phase === 'charge' && b.t >= b.telegraph) { b.phase = 'fire'; b.t = 0; }
        else if (b.phase === 'fire') {
          if (hx > b.x && hx < b.x + b.w && hy > b.y && hy < b.y + b.h) hurt();
          if (b.t >= b.fire) return false;
        }
        return true;
      });
      if (invuln > 0) invuln -= dt;

      ctx2d.clearRect(0, 0, W, H);
      bones.forEach((b) => {
        if (b.sprite === 'tear') { drawTear(ctx2d, b.x, b.y); return; }
        if (b.sprite === 'fist') { drawFist(ctx2d, b.x + b.w / 2, b.y + b.h / 2, Math.atan2(b.vy, b.vx), false); return; }
        ctx2d.fillStyle = BONE_COLOR[b.dangerWhen] || '#fff';
        ctx2d.fillRect(b.x, b.y, b.w, b.h);   /* el canvas ya recorta solo lo que quede fuera de la caja */
      });
      ctx2d.fillStyle = '#fff';
      blasts.forEach((b) => {
        if (b.sprite === 'hand') { drawHandBlast(ctx2d, b); return; }
        if (b.phase === 'charge') {
          ctx2d.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(b.t * 18));   /* aviso parpadeante */
          ctx2d.fillRect(b.x, b.y, b.w, b.h);
          ctx2d.globalAlpha = 1;
        } else {
          ctx2d.fillRect(b.x, b.y, b.w, b.h);
        }
      });
      drawHeart(heart.x, heart.y, invuln > 0 && Math.floor(invuln * 16) % 2 === 0);

      if ((now - t0) / 1000 < duration && player.hp > 0) raf = requestAnimationFrame(frame);
      else finish();
    }
    function finish() {
      removeEventListener('keydown', key); removeEventListener('keyup', key);
      cv.classList.remove('show'); $('#battle').classList.remove('in-box');
      if (bossSprite) bossSprite.attackEnd();
      if (player.hp <= 0) { showEnding('hurt'); return; }
      onFinish();
    }
    raf = requestAnimationFrame(frame);
  }

  /* ---------- Flujo de turno ---------- */
  function bossTurn() {
    setMode('menu');
    const turn = currentTurn();
    pendingLine = turn.line;
    say(turn.line);
  }

  /* Turno actual, sin salirse nunca del array aunque ACTUAR/OBJETO/LUCHAR se
     usen más veces de las que hay turnos escritos (se repite el último). */
  function currentTurn() { return turns[Math.min(turnIndex, turns.length - 1)]; }

  function playerFight() {
    const turn = currentTurn();
    boss.hp -= turn.dmg;                          /* el daño de cada turno se define arriba, en `turns` */
    updateBossHud();
    if (bossSprite) bossSprite.hurt();
    sfx.confirm();
    if (boss.hp <= 0) { showEnding('kill'); return; }
    afterAction(turn);
  }
  function playerAct(i) {
    const a = acts[i];
    mercy = Math.min(100, mercy + (a.mercy || 0));
    if (a.response) { pendingLine = a.response; say(a.response, () => afterAction(currentTurn(), true)); }
    else afterAction(currentTurn());
  }
  function playerItem(i) {
    const it = items[i];
    player.hp = Math.min(player.hpMax, player.hp + (it.heal || 0));
    updatePlayerHud();
    sfx.heal();
    afterAction(currentTurn());
  }
  function playerMercy(i) {
    if (i === 0) { if (mercy >= 100) showEnding('spare'); return; }
    showEnding('flee');
  }
  function afterAction(turn, skipDialogueWait) {
    turnIndex++;
    runBox(turn, 5.5, turn.hitDmg || 4, bossTurn);
  }

  function updateBossHud() {
    /* Sitio para pintar la barra de vida del jefe si quieres mostrarla; de momento
       solo se usa internamente para decidir cuándo termina el combate. */
  }

  function showEnding(kind) {
    setMode('menu'); $('#menu').style.display = 'none'; $('#bossWrap').style.display = 'none';
    cv.classList.remove('show');
    fadeOutMusic(1800);

    if (kind === 'hurt') {
      /* Derrota del jugador: pantalla negra propia, como en Undertale, en vez del
         cuadro de diálogo normal (ver .gameover en secret.html). */
      sfx.gameOver();
      $('#dialogue').hidden = true;
      $('#gameOverScreen').hidden = false;
      return;
    }
    if (kind === 'kill' && bossSprite) bossSprite.die();
    if (kind === 'spare' && bossSprite) { bossSprite.spare(); sfx.spare(); }
    const key = kind === 'kill' ? 'endKill' : kind === 'spare' ? 'endSpare' : kind === 'flee' ? 'endFlee' : 'endKill';
    say({ es: t(key), en: UI.en[key] });
    $('#restartBtn').hidden = false;
  }
  $('#restartBtn').addEventListener('click', () => location.reload());
  $('#restartBtnGO').addEventListener('click', () => location.reload());

  /* ---------- Entradas: flechas para moverte, Enter/Espacio confirma, Esc retrocede ---------- */
  let started = false;                             /* true en cuanto empieza el combate de verdad (ver beginBattle) */
  addEventListener('keydown', (e) => {
    if (!started) return;                          /* durante la espera previa, solo cuenta la tecla que arranca todo */
    if (mode === 'box') return;                   /* la caja gestiona sus propias teclas */
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape'].includes(e.key)) e.preventDefault();

    if (e.key === 'Enter' || e.key === ' ') {
      if (skipTyping()) return;
      if (mode === 'menu') {
        const act = ACTS4[menuSel];
        if (act === 'fight') playerFight();
        else setMode(act);
      } else if (mode === 'act') { if (acts.length) playerAct(subSel); }
      else if (mode === 'item') { if (items.length) playerItem(subSel); }
      else if (mode === 'mercy') playerMercy(subSel);
      return;
    }
    if (e.key === 'Escape' && mode !== 'menu') { setMode('menu'); return; }

    const horiz = mode === 'menu';
    const delta = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
    if (!delta) return;
    sfx.move();
    if (horiz) { menuSel = (menuSel + delta + 4) % 4; renderMenu(); }
    else {
      const n = mode === 'act' ? acts.length : mode === 'item' ? items.length : 2;
      if (n) { subSel = (subSel + delta + n) % n; renderSub(); }
    }
  });

  $('#menu').addEventListener('click', (e) => {
    if (!started) return;
    const btn = e.target.closest('button'); if (!btn) return;
    const act = btn.dataset.act;
    menuSel = ACTS4.indexOf(act);
    if (act === 'fight') playerFight(); else setMode(act);
  });
  /* ---------- Música de fondo ---------- */
  /* Dos grabaciones en /audio, las dos de dominio público — cambia el nombre del archivo
     para probar la otra sin borrar ninguna:
       - rachmaninoff-concierto2-mov1.ogg    (MusOpen — la que había)
       - rachmaninoff-concierto2-mov1-b.ogg  (Richter/Wisłocki, Filarmónica de Varsovia, 1959 —
         grabación de estudio de Deutsche Grammophon, derechos de intérprete ya expirados en la UE) */
  const music = new Audio('audio/rachmaninoff-concierto2-mov1-b.ogg');
  music.volume = 0.55;
  function fadeOutMusic(ms) {
    const step = music.volume / (ms / 50);
    const iv = setInterval(() => {
      music.volume = Math.max(0, music.volume - step);
      if (music.volume <= 0) { music.pause(); clearInterval(iv); }
    }, 50);
  }

  /* ---------- Arranque: espera en silencio y arranca EXACTO cuando entran los
     violines. Medí el punto con un análisis de energía del propio audio: los
     acordes sueltos de piano del principio duran hasta ~22-23s, y ahí es cuando la
     orquesta entra ya sostenida (medido de nuevo con la grabación de Richter/1959,
     que resulta tener casi el mismo tempo de entrada que la de MusOpen). Si a ti
     al oído te suena que debería ser un pelín antes o después, este es el único
     número que hay que tocar. */
  const VIOLIN_SYNC_T = 22.5;
  updatePlayerHud();

  /* Si se llega aquí desde el código secreto de index.html (ver secret-hunt.js), la
     pantalla ya estaba en negro por el agujero negro de la transición — en vez de
     cortar seco, seguimos ese mismo negro con una explosión de partículas hacia
     fuera antes de enseñar el texto de espera normal. */
  let cameFromSecret = false;
  try { cameFromSecret = sessionStorage.getItem('daar-secret-entry') === '1'; sessionStorage.removeItem('daar-secret-entry'); } catch (e) {}

  function showIntroText() { $('#dialogue').textContent = t('introWait'); }

  if (cameFromSecret) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;z-index:20;pointer-events:none;';
    document.body.appendChild(canvas);
    const c2 = canvas.getContext('2d');
    canvas.width = innerWidth; canvas.height = innerHeight;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const parts = Array.from({ length: 140 }, () => {
      const a = Math.random() * Math.PI * 2, sp = 220 + Math.random() * 420;
      return { a, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1 + Math.random() * 2.4 };
    });
    const t0 = performance.now(), DUR = 650;
    (function frame(now) {
      const tt = Math.min(1, (now - t0) / DUR);
      c2.clearRect(0, 0, canvas.width, canvas.height);
      c2.globalAlpha = 1 - tt;
      c2.fillStyle = '#fff';
      parts.forEach((p) => {
        const x = cx + p.vx * tt, y = cy + p.vy * tt;
        c2.beginPath(); c2.arc(x, y, p.r, 0, Math.PI * 2); c2.fill();
      });
      if (tt < 1) requestAnimationFrame(frame);
      else canvas.remove();
    })(t0);
    setTimeout(showIntroText, 120);
  } else {
    showIntroText();
  }

  function startEncounter() {
    removeEventListener('keydown', startEncounter); removeEventListener('click', startEncounter);
    music.play().catch(() => {});
    const delay = Math.max(0, VIOLIN_SYNC_T - music.currentTime) * 1000;
    setTimeout(beginBattle, delay);
  }
  function beginBattle() {
    started = true;
    if (bossSprite) bossSprite.helmetOn();       /* se lo pone de golpe, justo con la entrada de los violines */
    $('#menu').hidden = false;
    setMode('menu');
    bossTurn();
  }
  addEventListener('keydown', startEncounter, { once: true });
  addEventListener('click', startEncounter, { once: true });
})();
