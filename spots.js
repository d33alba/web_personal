/* ============================================================
   spots.js — Manchas «The Spot» líquidas (WebGL + físicas de partículas)

   Cómo funciona, de dentro hacia fuera:
   1. FORMA: cada mancha se descompone en ~55 gotas (partículas). El HTML guarda
      el dibujo de cada mancha en <defs> (#spot-a / #spot-b); aquí se leen y se
      reparten gotas siguiendo ese dibujo. Ese reparto es la «posición de casa».
   2. FÍSICA: cada gota tiene un muelle hacia su casa (vuelve despacio), muelles
      con las gotas vecinas (la mancha se flexiona como gelatina) y la empuja el
      ratón. Si el ratón va rápido, además le transmite su velocidad: la mancha
      se estira y se parte. Los muelles entre vecinas se debilitan al estirarse
      mucho, por eso se «cortan» y luego se vuelven a unir.
   3. DIBUJO: un shader suma un campo por cada gota («metabolas»): donde las
      gotas se solapan se funden en una masa líquida. Las normales de ese campo
      dan el relieve 3D (brillo, borde curvado, sombra).
   Sin WebGL (o con «reducir movimiento») se usa el <svg> estático del HTML.
   ============================================================ */
(function () {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const holes = Array.from(document.querySelectorAll('.spot__hole'));
  if (!holes.length) return;

  /* ---------- Constantes de ajuste ---------- */
  const MAXP = 64;             /* máximo de gotas por mancha (tamaño del array del shader) */
  const SIZE = 300;            /* el canvas cubre 300 unidades: la mancha (200) + margen para salpicar */
  const ORIGIN = -50;          /* la esquina del canvas está en (-50,-50) respecto al dibujo */
  const renderScale = () => Math.min(window.devicePixelRatio || 1, 1.5);   /* píxeles internos / píxeles CSS */

  const K_HOME = 5.5;          /* fuerza del muelle hacia casa (bajo = se reúne despacio) */
  const K_NEIGH = 55;          /* fuerza de los muelles entre vecinas (flexión) */
  const DAMP = 3.2;            /* rozamiento: bajo = más bamboleo */
  const REACH = 76;            /* radio de influencia del ratón (en unidades) */
  const REPEL = 2200;          /* empuje radial del ratón */
  const DRAG = 12;             /* cuánto arrastra la velocidad del ratón */
  const WOBBLE_BODY = 2.6;     /* bamboleo en reposo del cuerpo (unidades) */
  const WOBBLE_DROP = 4.5;     /* bamboleo en reposo de las gotas sueltas */
  const MAX_V = 1100;          /* velocidad máxima de una gota (unidades/s) */

  /* ---------- Shaders ---------- */
  const VERT = `
    attribute vec2 a;
    varying vec2 vUv;
    void main() { vUv = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform vec3 uP[${MAXP}];   /* x, y, radio de cada gota (radio 0 = sin usar) */
    uniform float uPx;          /* píxeles del canvas por unidad */
    uniform float uWhite;       /* 0 = tinta negra, 1 = tinta blanca */

    const float SIZE = ${SIZE}.0;
    const float ORIGIN = ${ORIGIN}.0;
    const float T = 0.30;       /* umbral: el borde de la mancha está donde el campo vale T */

    void main() {
      vec2 p = vec2(vUv.x, 1.0 - vUv.y) * SIZE + ORIGIN;

      float f = 0.0;   vec2 g = vec2(0.0);    /* campo «apretado» (define la forma) y su gradiente */
      float h2 = 0.0;  vec2 g2 = vec2(0.0);   /* campo «ancho» (da la cúpula suave del volumen) */
      for (int i = 0; i < ${MAXP}; i++) {
        vec3 q = uP[i];
        if (q.z > 0.0) {
          vec2 d = p - q.xy;
          float d2 = dot(d, d);
          float R = q.z * 1.85;
          float R2 = R * R;
          if (d2 < R2) {
            float w = 1.0 - d2 / R2;
            float w2 = w * w;
            f += w2 * w;
            g += (-6.0 * w2 / R2) * d;
          }
          float S = q.z * 3.4;
          float e = exp(-d2 / (S * S));
          h2 += e;
          g2 += (-2.0 / (S * S)) * e * d;
        }
      }
      if (f < 0.004) { gl_FragColor = vec4(0.0); return; }

      float s = f - T;
      float gm = max(length(g), 1e-4);

      /* Sombra suave desplazada (aproximada con el gradiente, sin segundo bucle) */
      float sh = clamp(((f - dot(g, vec2(4.0, 6.0))) - T) / (gm * 7.0) + 0.5, 0.0, 1.0);
      float shadowA = sh * 0.30 * (1.0 - uWhite * 0.75);

      /* Antialias del borde: distancia al borde en unidades -> píxeles */
      float a = clamp(s / gm * uPx + 0.5, 0.0, 1.0);
      if (a <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, shadowA); return; }

      /* Relieve: borde redondeado (bisel) + cúpula suave */
      float ex = exp(-4.2 * max(s, 0.0));
      vec2 slope = 5.0 * 4.2 * ex * g + 22.0 * 0.22 * exp(-0.22 * h2) * g2;
      vec3 n = normalize(vec3(-slope, 1.0));

      vec3 V = vec3(0.0, 0.0, 1.0);
      vec3 L = normalize(vec3(-0.5, -0.6, 0.65));       /* luz principal, arriba-izquierda */
      vec3 H = normalize(L + V);
      float nl = max(dot(n, L), 0.0);
      float nh = max(dot(n, H), 0.0);
      float spec = pow(nh, 55.0);                        /* brillo puntual */
      float sheen = pow(nh, 8.0);                        /* brillo amplio */
      vec3 L2 = normalize(vec3(0.7, 0.55, 0.4));         /* luz de relleno, abajo-derecha */
      float fill = max(dot(n, L2), 0.0);
      float rim = pow(1.0 - n.z, 2.0);                   /* borde: más luz donde la superficie se curva */

      float spec3 = pow(nh, 260.0);                      /* punto de luz muy fino: el «mojado» */

      /* Reflejo de un pequeño estudio (cielo arriba + ventana a la izquierda) que crece hacia los bordes (Fresnel) */
      vec3 Rv = reflect(vec3(0.0, 0.0, -1.0), n);
      float sky = 1.0 - smoothstep(-0.85, 0.05, Rv.y);
      float win = (1.0 - smoothstep(0.0, 0.30, abs(Rv.x + 0.45))) * (1.0 - smoothstep(-0.5, 0.1, Rv.y));
      float fres = 0.05 + 0.95 * pow(1.0 - n.z, 4.0);
      vec3 env = (vec3(0.55, 0.72, 0.85) * sky * 0.55 + vec3(1.0) * win * 0.9) * fres;

      vec3 ink = vec3(0.012, 0.016, 0.024)
               + vec3(0.05, 0.075, 0.10) * nl
               + vec3(0.06, 0.14, 0.20) * rim * (0.35 + fill)
               + env
               + vec3(0.9, 0.96, 1.0) * (spec * 0.9 + spec3 * 0.9 + sheen * 0.06);
      vec3 pearl = mix(vec3(0.55, 0.62, 0.69), vec3(0.98, 0.99, 1.0), nl) * (1.0 - rim * 0.32)
                 + vec3(0.10, 0.16, 0.22) * fill * 0.25
                 + env * 0.35
                 + vec3(1.0) * (spec * 0.5 + spec3 * 0.6);
      vec3 col = mix(ink, pearl, uWhite);
      /* Ruido mínimo para evitar bandas en los degradados oscuros */
      col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;

      gl_FragColor = vec4(col * a, a + shadowA * (1.0 - a));
    }
  `;

  /* ---------- Utilidades ---------- */
  function mulberry32(seed) {                 /* generador pseudoaleatorio con semilla: cada mancha es siempre igual */
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function inPoly(poly, x, y) {               /* ¿el punto está dentro del polígono? (rayo) */
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function distPoly(poly, x, y) {             /* distancia al vértice más cercano del contorno */
    let m = 1e9;
    for (const q of poly) { const d = Math.hypot(q[0] - x, q[1] - y); if (d < m) m = d; }
    return m;
  }

  /* ---------- 1. FORMA: repartir gotas siguiendo el dibujo del HTML ---------- */
  function buildParticles(hole, seed) {
    const spot = hole.parentElement;
    const use = hole.querySelector('use');
    if (!use) return null;
    const key = use.getAttribute('href').slice(1);
    const body = document.getElementById(key + '-body');
    const dropsG = document.getElementById(key + '-drops');
    if (!body || !dropsG || !body.getTotalLength) return null;

    const rot = ((parseFloat(spot.style.getPropertyValue('--rot')) || 0) * Math.PI) / 180;
    const len = body.getTotalLength();
    const M = 90, poly = [];
    for (let i = 0; i < M; i++) { const p = body.getPointAtLength((len * i) / M); poly.push([p.x, p.y]); }

    const rnd = mulberry32(seed);
    const parts = [];

    /* Gotas de borde: siguen el contorno, un poco hacia dentro */
    const nb = Math.round(len / 19);
    for (let k = 0; k < nb; k++) {
      const l = (len * k) / nb;
      const p = body.getPointAtLength(l);
      const q = body.getPointAtLength((l + 3) % len), o = body.getPointAtLength((l - 3 + len) % len);
      let nx = -(q.y - o.y), ny = q.x - o.x;
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      if (!inPoly(poly, p.x + nx * 3, p.y + ny * 3)) { nx = -nx; ny = -ny; }   /* que apunte hacia dentro */
      parts.push({ x: p.x + nx * 8, y: p.y + ny * 8, r: 11 + rnd() * 3, body: true, inner: false });
    }
    /* Gotas interiores: rellenan el cuerpo */
    let tries = 0, inner = 0;
    while (tries++ < 900 && inner < 24) {
      const x = 30 + rnd() * 140, y = 30 + rnd() * 140;
      if (!inPoly(poly, x, y) || distPoly(poly, x, y) < 20) continue;
      if (parts.some((q) => (q.inner ? Math.hypot(q.x - x, q.y - y) < 21 : Math.hypot(q.x - x, q.y - y) < 14))) continue;
      parts.push({ x, y, r: 15 + rnd() * 4, body: true, inner: true });
      inner++;
    }
    /* Salpicaduras: cada gota suelta del dibujo */
    Array.from(dropsG.children).forEach((el) => {
      const r = el.tagName.toLowerCase() === 'ellipse'
        ? Math.sqrt(+el.getAttribute('rx') * +el.getAttribute('ry'))
        : +el.getAttribute('r');
      parts.push({ x: +el.getAttribute('cx'), y: +el.getAttribute('cy'), r: r * 0.95, body: false, inner: false });
    });
    parts.length = Math.min(parts.length, MAXP);

    /* Rotar toda la mancha alrededor de su centro (la rotación del HTML ya no la hace el CSS) */
    const cs = Math.cos(rot), sn = Math.sin(rot);
    parts.forEach((q) => {
      const dx = q.x - 100, dy = q.y - 100;
      q.x = 100 + dx * cs - dy * sn;
      q.y = 100 + dx * sn + dy * cs;
    });

    const n = parts.length;
    const s = {
      hole, spot, n,
      x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n),
      hx: new Float32Array(n), hy: new Float32Array(n), r: new Float32Array(n), imi: new Float32Array(n),
      ph: new Float32Array(n), amp: new Float32Array(n), ax: new Float32Array(n), ay: new Float32Array(n),
      pairs: [], canvas: null, gl: null, loc: null, buf: new Float32Array(MAXP * 3), W: 0
    };
    parts.forEach((q, i) => {
      s.x[i] = s.hx[i] = q.x; s.y[i] = s.hy[i] = q.y; s.r[i] = q.r;
      s.imi[i] = 1 / (0.35 + (q.r * q.r) / 180);      /* las gotas pequeñas pesan menos: reaccionan más */
      s.ph[i] = rnd() * 6.283;
      s.amp[i] = q.body ? WOBBLE_BODY : WOBBLE_DROP;
    });
    /* Muelles entre gotas del cuerpo que están cerca */
    for (let i = 0; i < n; i++) {
      if (!parts[i].body) continue;
      for (let j = i + 1; j < n; j++) {
        if (!parts[j].body) continue;
        const d = Math.hypot(parts[i].x - parts[j].x, parts[i].y - parts[j].y);
        if (d < 30) s.pairs.push([i, j, d]);
      }
    }
    return s;
  }

  /* ---------- 2. WebGL ---------- */
  function initGL(s) {
    const canvas = document.createElement('canvas');
    canvas.className = 'spot__gl';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl || gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) < MAXP + 30) return false;

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    /* Un solo triángulo que cubre toda la pantalla */
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

    s.canvas = canvas; s.gl = gl;
    s.loc = { p: gl.getUniformLocation(prog, 'uP'), px: gl.getUniformLocation(prog, 'uPx'), white: gl.getUniformLocation(prog, 'uWhite') };
    s.hole.appendChild(canvas);
    s.hole.classList.add('is-gl');
    return true;
  }

  function resize(s) {
    const css = s.spot.clientWidth * 1.5;
    const W = Math.max(64, Math.round(css * renderScale()));
    if (W === s.W) return;
    s.W = W; s.canvas.width = W; s.canvas.height = W;
  }

  function isWhite(s) {                          /* el CSS decide el color de la tinta (tema claro/oscuro/pie) */
    const m = getComputedStyle(s.hole).color.match(/[\d.]+/g);
    return m && (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255 > 0.5 ? 1 : 0;
  }

  function draw(s) {
    const gl = s.gl;
    for (let i = 0; i < s.n; i++) { s.buf[i * 3] = s.x[i]; s.buf[i * 3 + 1] = s.y[i]; s.buf[i * 3 + 2] = s.r[i]; }
    for (let i = s.n * 3; i < MAXP * 3; i++) s.buf[i] = 0;
    gl.viewport(0, 0, s.W, s.W);
    gl.uniform3fv(s.loc.p, s.buf);
    gl.uniform1f(s.loc.px, s.W / SIZE);
    gl.uniform1f(s.loc.white, isWhite(s));
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ---------- 3. FÍSICA ---------- */
  const ptr = { x: 0, y: 0, lx: 0, ly: 0, vx: 0, vy: 0, has: false };

  function step(s, dt, t) {
    const { n, x, y, vx, vy, hx, hy, imi, ph, amp, ax, ay, pairs } = s;

    /* Muelle hacia casa. La «casa» respira despacio y tiembla con dos frecuencias, para que nunca esté quieta */
    const breathe = 1 + 0.02 * Math.sin(t * 0.55);
    for (let i = 0; i < n; i++) {
      const A = amp[i];
      const wx = 100 + (hx[i] - 100) * breathe + Math.sin(t * 0.8 + ph[i]) * A + Math.sin(t * 1.7 + ph[i] * 2.1) * A * 0.35;
      const wy = 100 + (hy[i] - 100) * breathe + Math.cos(t * 0.7 + ph[i] * 1.3) * A + Math.cos(t * 1.5 + ph[i] * 1.7) * A * 0.35;
      ax[i] = K_HOME * (wx - x[i]);
      ay[i] = K_HOME * (wy - y[i]);
    }
    /* Muelles entre vecinas: se debilitan al estirarse y se cortan; al acercarse vuelven a unirse */
    for (let k = 0; k < pairs.length; k++) {
      const i = pairs[k][0], j = pairs[k][1], rest = pairs[k][2];
      const dx = x[j] - x[i], dy = y[j] - y[i];
      const d = Math.hypot(dx, dy);
      if (d < 1e-4) continue;
      const ratio = d / rest;
      const strength = ratio < 1.7 ? 1 : ratio > 2.6 ? 0 : (2.6 - ratio) / 0.9;
      const f = K_NEIGH * (d - rest) * strength;
      const fx = (f * dx) / d, fy = (f * dy) / d;
      ax[i] += fx * imi[i]; ay[i] += fy * imi[i];
      ax[j] -= fx * imi[j]; ay[j] -= fy * imi[j];
    }
    /* Ratón: empuje radial + arrastre según su velocidad (golpe brusco = se parte) */
    const rect = s.spot.getBoundingClientRect();
    if (ptr.has && rect.width > 0) {
      const ppu = rect.width / 200;
      const lx = (ptr.x - (rect.left + rect.width / 2)) / ppu + 100;
      const ly = (ptr.y - (rect.top + rect.height / 2)) / ppu + 100;
      const cvx = ptr.vx / ppu, cvy = ptr.vy / ppu;
      for (let i = 0; i < n; i++) {
        let dx = x[i] - lx, dy = y[i] - ly;
        const d = Math.hypot(dx, dy), reach = REACH + s.r[i] * 0.6;
        if (d >= reach) continue;
        const q = 1 - d / reach;
        if (d < 1e-3) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
        ax[i] += (dx * REPEL * q * q + cvx * DRAG * q) * imi[i];
        ay[i] += (dy * REPEL * q * q + cvy * DRAG * q) * imi[i];
      }
    }
    /* Integrar */
    const damp = Math.exp(-DAMP * dt);
    for (let i = 0; i < n; i++) {
      vx[i] = (vx[i] + ax[i] * dt) * damp;
      vy[i] = (vy[i] + ay[i] * dt) * damp;
      const v = Math.hypot(vx[i], vy[i]);
      if (v > MAX_V) { vx[i] *= MAX_V / v; vy[i] *= MAX_V / v; }
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      /* Rebote suave contra el borde del canvas: ninguna gota se corta a medias */
      const R = s.r[i] * 1.85, lo = ORIGIN + R, hi = ORIGIN + SIZE - R;
      if (x[i] < lo) { x[i] = lo; vx[i] = Math.abs(vx[i]) * 0.3; } else if (x[i] > hi) { x[i] = hi; vx[i] = -Math.abs(vx[i]) * 0.3; }
      if (y[i] < lo) { y[i] = lo; vy[i] = Math.abs(vy[i]) * 0.3; } else if (y[i] > hi) { y[i] = hi; vy[i] = -Math.abs(vy[i]) * 0.3; }
    }
  }

  /* ---------- Puesta en marcha ---------- */
  /* En móvil y en pantallas táctiles no se crea nada (ni contextos WebGL): hardware más variado,
     poco espacio y sin cursor no hay interacción. En el CSS esas manchas están ocultas. */
  const skip = matchMedia('(max-width: 820px), (hover: none) and (pointer: coarse)');
  let started = false;

  function start() {
    if (started || skip.matches) return;
    started = true;

    const spots = [];
    holes.forEach((hole, i) => {
      const s = buildParticles(hole, 1000 + i * 77);
      if (!s || !initGL(s)) return;          /* sin WebGL o sin datos: se queda el SVG del HTML */
      resize(s);
      spots.push(s);
    });
    if (!spots.length) return;

    const byEl = new Map(spots.map((s) => [s.spot, s]));
    const live = new Set();
    let raf = 0, last = 0;

    function frame(now) {
      raf = 0;
      const dt = Math.min(0.033, (now - last) / 1000) || 0.016;
      last = now;
      if (ptr.has) {
        ptr.vx += ((ptr.x - ptr.lx) / dt - ptr.vx) * 0.35;      /* velocidad del ratón, suavizada */
        ptr.vy += ((ptr.y - ptr.ly) / dt - ptr.vy) * 0.35;
      }
      ptr.lx = ptr.x; ptr.ly = ptr.y;
      live.forEach((s) => { step(s, dt, now / 1000); draw(s); });
      if (live.size) raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf && live.size) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    /* Solo se simulan y dibujan las manchas que se ven en pantalla */
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const s = byEl.get(e.target);
        if (e.isIntersecting) live.add(s); else live.delete(s);
      });
      if (!reduce) wake();
    }, { rootMargin: '150px' });
    spots.forEach((s) => io.observe(s.spot));

    const ro = new ResizeObserver((entries) => entries.forEach((e) => {
      const s = byEl.get(e.target);
      if (s) { resize(s); if (reduce) draw(s); }
    }));
    spots.forEach((s) => ro.observe(s.spot));

    if (reduce) {
      /* Movimiento reducido: una imagen fija 3D, sin física */
      spots.forEach(draw);
      new MutationObserver(() => spots.forEach(draw)).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } else {
      addEventListener('pointermove', (e) => {
        ptr.x = e.clientX; ptr.y = e.clientY;
        if (!ptr.has) { ptr.has = true; ptr.lx = ptr.x; ptr.ly = ptr.y; }
      }, { passive: true });
      document.documentElement.addEventListener('pointerleave', () => { ptr.has = false; ptr.vx = ptr.vy = 0; });
    }
  }

  start();
  skip.addEventListener('change', start);      /* p. ej. al girar una tablet o ensanchar la ventana */
})();
