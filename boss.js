/* ============================================================
   boss.js — Sprite de DÉBORA ALPHA. Pixel art a color de sprite de
   batalla, de medio cuerpo: melena azul, piel clara, chaqueta techwear
   oscura, núcleo rojo en el pecho y ojos rojos. Su armadura (casco con
   visor en T y hombreras) se ensambla, se rompe o se desmonta según la
   ruta que siga el jugador.

   Cómo está montado:
   1. El sprite real mide G x G px (96) y se escala con
      image-rendering:pixelated: cada píxel es un bloque duro.
   2. Cada fotograma se «pinta» en un MAPA DE ZONAS (L): cada píxel
      guarda a qué pieza pertenece (pelo, cara, chaqueta, casco...).
      Las piezas se dibujan de atrás hacia delante, como capas.
   3. El color se calcula solo a partir de ese mapa: cada pieza tiene
      4 tonos (contorno, sombra, base y brillo). Un píxel es CONTORNO
      si toca una pieza que está por detrás (o el vacío); es SOMBRA si
      está cerca del borde de abajo a la derecha y BRILLO si está cerca
      del de arriba a la izquierda (la luz viene de arriba a la izquierda).
   4. Encima se dibujan los DETALLES a mano (ojos, boca, cejas,
      lágrimas, cremallera, grietas, sangre azul, cables...).
   5. applyGlitch() destroza el resultado (aberración roja, franjas,
      estática...) según «glitchLevel».
   6. Las piezas que se sueltan (hombreras, visor, brazo...) se
      «fotografían» del propio sprite y caen como restos (debris).

   API pública para secret.js:
     appear(seg) / show()        aparece desde la oscuridad / aparece ya armada
     assemble(seg, avisos)       el casco llega flotando y las hombreras se ensamblan (Promise)
     setTalking(on)              mueve la boca y suelta símbolos de código a su alrededor
     setMood(nombre, seg)        cambia la cara durante unos segundos
     attack({ mood, hands }) / attackEnd()     hands: 'fist' | 'open' | null
     launch(lado), wristPos(lado), armOK(lado)
     hurt()                      destello y sacudida (no rompe nada)
     bigImpact() / repair(seg)   primer gran impacto: grieta en la visera y un trozo que salta
     setDamage(n)                0..7: daños acumulados de la ruta de lucha
     finalHit(n) / collapse()    1..8: golpes finales / se desploma en restos (Promise)
     setCalm(k)                  0..1: se va calmando (ruta pacifista)
     dismantle(seg)              la armadura se desmonta sola (Promise)
     dissolveTo(k, seg)          se deshace en píxeles y código, 0..1 (Promise)
   ============================================================ */
(function () {
  'use strict';

  const G = 96;
  const W = G, H = G;

  /* Colores (RGB) */
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const C = {
    lash: hex('#050304'), sclera: hex('#ddd5d2'), iris: hex('#ff2b2b'), irisDk: hex('#a3111b'), irisHi: hex('#ffd6d6'), pupil: hex('#1a0406'),
    skin: hex('#d6cbc7'), skinSh: hex('#a2928f'), skinLn: hex('#6e5a57'), bags: hex('#6b5566'),
    brow: hex('#122a48'), hairDk: hex('#173558'), hairHi: hex('#6fa9d6'),
    lip: hex('#8a4a48'), mouthIn: hex('#3d060c'), tongue: hex('#b3202e'), tooth: hex('#f6f1ea'), toothSh: hex('#cdc3ba'),
    tear: hex('#bfe3ff'), tearHi: hex('#eaf6ff'),
    seam: hex('#2a2f3c'), zip: hex('#8a93a6'), zipHi: hex('#cfd6e0'), cyan: hex('#5fb7dd'),
    red: hex('#e02323'), redDim: hex('#7a0f0f'), crack: hex('#0a0a0a'), rivet: hex('#6b7280'), metalLn: hex('#1c1e24'),
    blood: hex('#2f7bff'), bloodDk: hex('#173e8f'), bloodHi: hex('#9cc9ff'),   /* sangre azul: es una IA */
    glow: hex('#9ff3ff'), cable: hex('#e0b04a'), pipe: hex('#3a3f4a'),
  };
  const PAL = { iris: '#ff2b2b', spark: '#c7ccd4', glitchA: '#ff2b2b', cyan: '#5fd8ff', code: '#39ff7a' };
  /* Colores que emiten luz: no se oscurecen con la penumbra del torso */
  const EMIT = new Set([C.iris, C.irisHi, C.irisDk, C.red, C.redDim, C.glow]);

  /* ---------- Estados de ánimo: pose objetivo de la cara ----------
     smile   0..1   sonrisa (1 = sonrisa ancha con dientes)
     arc     0..1   ojos en media luna (sonrisa inquietante)
     squint  0..1   ojos apretados > <  (dolor)
     open    0..1   apertura de los ojos
     wide    0..1   ojos desorbitados
     brow   -1..1   cejas: + rabia (el lado interior baja), - pena
     mouth   0..1   boca abierta (sorpresa, grito)
     pupil   0..1   tamaño del iris rojo (bajo = mirada fija)
     cry     0..1   lágrimas
     shake   0..1   temblor
     tilt           ladeo de la cabeza (se traduce en píxeles)          */
  const MOODS = {
    idle:  { smile: 0.1,  arc: 0, squint: 0, open: 1,    wide: 0,   brow: 0,     mouth: 0,    pupil: 1,    cry: 0,   shake: 0,    tilt: 0 },
    smirk: { smile: 0.45, arc: 0, squint: 0, open: 0.75, wide: 0,   brow: 0.35,  mouth: 0,    pupil: 0.8,  cry: 0,   shake: 0,    tilt: 0.07 },
    grin:  { smile: 1,    arc: 1, squint: 0, open: 1,    wide: 0,   brow: 0.2,   mouth: 0.2,  pupil: 0.5,  cry: 0,   shake: 0.25, tilt: -0.1 },
    rage:  { smile: 0.5,  arc: 0, squint: 0, open: 0.8,  wide: 0,   brow: 1,     mouth: 0.1,  pupil: 0.6,  cry: 0,   shake: 0.85, tilt: 0 },
    cry:   { smile: 0,    arc: 0, squint: 0, open: 0.7,  wide: 0,   brow: -0.9,  mouth: 0.15, pupil: 1,    cry: 1,   shake: 0.1,  tilt: 0.05 },
    shock: { smile: 0,    arc: 0, squint: 0, open: 1,    wide: 1,   brow: -0.4,  mouth: 0.9,  pupil: 0.3,  cry: 0,   shake: 0.3,  tilt: 0 },
    hurt:  { smile: 0,    arc: 0, squint: 1, open: 0.4,  wide: 0,   brow: 0.9,   mouth: 0.45, pupil: 1,    cry: 0,   shake: 1,    tilt: 0 },
    stare: { smile: 0,    arc: 0, squint: 0, open: 1,    wide: 0.8, brow: 0.1,   mouth: 0,    pupil: 0.2,  cry: 0,   shake: 0,    tilt: -0.04 },
    soft:  { smile: 0.35, arc: 0.4, squint: 0, open: 0.6, wide: 0,  brow: -0.55, mouth: 0,    pupil: 1,    cry: 0.6, shake: 0,    tilt: 0.06 },
    tired: { smile: 0,    arc: 0, squint: 0, open: 0.5,  wide: 0,   brow: -0.35, mouth: 0.25, pupil: 0.9,  cry: 0,   shake: 0.05, tilt: 0.12 },   /* agotada, jadeando */
  };
  const MOOD_KEYS = Object.keys(MOODS.idle);

  /* ---------- Piezas del sprite: orden (z), grupo y tonos ----------
     Dos piezas del mismo grupo no dibujan contorno entre ellas (p. ej. el pelo de delante y el de detrás).
     Tonos: [contorno, sombra, base, brillo]; shade = cuántos píxeles de sombra/brillo junto al borde. */
  const Z = {
    HAIR_B: 1, JACKET: 2, NECK: 3, ARM_L: 4, ARM_R: 5, COLLAR: 6, PLATE_L: 7, PLATE_R: 8,
    FACE: 9, HAIR_F: 10, HELMET: 11, VISOR: 12, HAND_L: 13, HAND_R: 14, SLEEVE_L: 15, SLEEVE_R: 16, CAVITY: 17,
  };
  const tones = (a, b, c, d) => [hex(a), hex(b), hex(c), hex(d)];
  const HAIR = tones('#0b1a2e', '#16345a', '#2a5f94', '#4b86ba');
  const SUIT = tones('#2a2f3b', '#07080b', '#0f1116', '#1b1f28');
  const SKIN = tones('#6e5a57', '#a2928f', '#d6cbc7', '#e6dfdc');
  const PLATE = tones('#1b2733', '#243140', '#34465a', '#5fb7dd');
  const METAL = tones('#1c1e24', '#22262e', '#3a3f4a', '#4d5361');
  const REG = [];
  REG[Z.HAIR_B]  = { z: 1,  group: 'hair',   c: HAIR, shade: 2 };
  REG[Z.JACKET]  = { z: 2,  group: 'jacket', c: SUIT, shade: 2 };
  REG[Z.NECK]    = { z: 3,  group: 'neck',   c: tones('#4a3b39', '#6e5f5c', '#8f807d', '#a3948f'), shade: 1 };
  REG[Z.ARM_L]   = { z: 4,  group: 'armL',   c: SUIT, shade: 2 };
  REG[Z.ARM_R]   = { z: 4,  group: 'armR',   c: SUIT, shade: 2 };
  REG[Z.CAVITY]  = { z: 4.5, group: 'cavity', c: tones('#050506', '#0a0b0e', '#15171d', '#262a33'), shade: 1 };   /* pecho abierto */
  REG[Z.COLLAR]  = { z: 5,  group: 'collar', c: tones('#3a4050', '#12141a', '#1e222c', '#2c3140'), shade: 1 };
  REG[Z.PLATE_L] = { z: 6,  group: 'plateL', c: PLATE, shade: 1 };
  REG[Z.PLATE_R] = { z: 6,  group: 'plateR', c: PLATE, shade: 1 };
  REG[Z.FACE]    = { z: 7,  group: 'face',   c: SKIN, shade: 2 };
  REG[Z.HAIR_F]  = { z: 8,  group: 'hair',   c: HAIR, shade: 2 };
  REG[Z.HELMET]  = { z: 9,  group: 'helmet', c: tones('#111317', '#1a1c21', '#2c2f37', '#454b57'), shade: 3 };
  REG[Z.VISOR]   = { z: 10, group: 'visor',  c: tones('#111317', '#060505', '#060505', '#060505'), shade: 0 };
  REG[Z.SLEEVE_L] = { z: 11, group: 'sleeveL', c: SUIT, shade: 2 };      /* brazo con la manga de la chaqueta */
  REG[Z.SLEEVE_R] = { z: 11, group: 'sleeveR', c: SUIT, shade: 2 };
  REG[Z.HAND_L]  = { z: 12, group: 'handL',  c: METAL, shade: 2 };
  REG[Z.HAND_R]  = { z: 12, group: 'handR',  c: METAL, shade: 2 };
  const ALL_Z = Object.values(Z);                                        /* «sobre cualquier pieza, pero no en el vacío» */
  const HEAD_Z = new Set([Z.HAIR_B, Z.FACE, Z.HAIR_F, Z.HELMET, Z.VISOR]);

  function ri(v) { return Math.round(v); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function mirror(pts) { return pts.map(([x, y]) => [G - x, y]); }
  /* ¿Está el punto dentro del polígono? (regla par-impar) */
  function inPoly(pts, px, py) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  /* Agujero del casco a partir de sus puntos (coordenadas de la cabeza, sin desplazar) */
  function holeFrom(pts) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x = Math.min(...xs) - 1, y = Math.min(...ys) - 1, w = Math.max(...xs) - x + 2, h = Math.max(...ys) - y + 2;
    return { pts, x, y, w, h, cx: x + w / 2, cy: y + h / 2, s: 1 };
  }

  /* ---------- Formas base (coordenadas del sprite, sin desplazar) ---------- */
  /* Media melena (bob) por detrás de la cabeza */
  const HAIR_BACK = (() => {
    const pts = [];
    for (let a = 180; a >= 0; a -= 15) { const r = a * Math.PI / 180; pts.push([48 + 26 * Math.cos(r), 33 - 27 * Math.sin(r)]); }
    return pts.concat([[75, 48], [75, 60], [72, 67], [70, 64], [67, 69], [63, 65], [58, 69], [54, 66], [42, 66], [38, 69], [33, 65], [29, 69], [26, 64], [24, 67], [21, 60], [21, 48]]);
  })();
  /* Pelo de delante: cúpula, flequillo en picos y dos mechones que enmarcan la cara */
  const HAIR_FRONT = (() => {
    const pts = [];
    for (let a = 180; a >= 0; a -= 12) { const r = a * Math.PI / 180; pts.push([48 + 23.5 * Math.cos(r), 32 - 25 * Math.sin(r)]); }
    return pts.concat([
      [72, 40], [72, 52], [69, 63], [66, 66], [64, 58], [64, 44], [63, 36],                 // mechón derecho
      [61, 34], [58, 29], [55, 35], [51, 29], [48, 34], [45, 28], [41, 34], [37, 30], [34, 35], // flequillo
      [33, 44], [32, 58], [30, 66], [27, 63], [24, 52], [24, 40],                            // mechón izquierdo
    ]);
  })();
  /* Chaqueta techwear: hombros caídos, se corta por abajo (medio cuerpo) */
  const JACKET = [[40, 64], [26, 69], [15, 76], [9, 86], [7, 96], [89, 96], [87, 86], [81, 76], [70, 69], [56, 64]];
  const JACKET_NO_L = [[40, 64], [26, 69], [23, 74], [24, 84], [22, 96], [89, 96], [87, 86], [81, 76], [70, 69], [56, 64]];   /* sin el brazo izquierdo */
  const ARM_L = [[15, 76], [9, 86], [7, 96], [22, 96], [24, 84], [22, 76]];
  const ARM_R = mirror(ARM_L);
  const COLLAR = [[36, 72], [37, 61], [42, 64], [48, 65], [54, 64], [59, 61], [60, 72], [55, 75], [48, 76], [41, 75]];
  const PLATE_L = [[12, 80], [18, 72], [28, 68], [36, 69], [35, 74], [26, 78], [19, 85], [14, 87]];
  const PLATE_R = mirror(PLATE_L);
  const CAVITY = [[57, 79], [64, 77], [72, 78], [76, 86], [74, 96], [58, 96], [55, 88]];

  /* Daños (coordenadas de la cabeza, sin desplazar) */
  const HOLES = {
    temple: { x: 58, y: 13, w: 13, h: 12 },   // sien
    cheek:  { x: 26, y: 38, w: 12, h: 13 },   // mejilla izquierda
    jaw:    { x: 53, y: 46, w: 16, h: 12 },   // mandíbula derecha
    eye:    { x: 52, y: 36, w: 13, h: 10 },   // el visor se rompe sobre el ojo derecho
    chip:   { x: 29, y: 13, w: 13, h: 10 },   // el trozo que salta en el primer gran impacto
  };
  const VISOR_CRACK = [[24, 28], [31, 33], [36, 38], [42, 40], [47, 43], [52, 42], [58, 47], [63, 51], [69, 55]];   /* grieta en diagonal */
  const VISOR_CRACK_B = [[42, 40], [40, 45], [41, 50]];
  const VISOR_BREAK = [[29, 37], [33, 35], [40, 36], [46, 34], [52, 36], [58, 35], [64, 36], [67, 38], [66, 44], [60, 46], [53, 45], [53, 52], [51, 58], [46, 58], [44, 52], [43, 46], [36, 45], [30, 44]];
  const FACE_CRACK = [[28, 22], [34, 28], [38, 34], [44, 37], [48, 44], [53, 47], [57, 54], [63, 60]];   /* grieta digital en la cara */

  /* Fuente mínima de 3x5 para los símbolos de código que flotan a su alrededor */
  const FONT3 = {
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
    '{': ['011', '010', '110', '010', '011'], '}': ['110', '010', '011', '010', '110'],
    ';': ['000', '010', '000', '010', '100'], '<': ['001', '010', '100', '010', '001'],
    '>': ['100', '010', '001', '010', '100'], '/': ['001', '001', '010', '100', '100'],
    '=': ['000', '111', '000', '111', '000'], '(': ['010', '100', '100', '100', '010'], ')': ['010', '001', '001', '001', '010'],
  };
  const CODE_CH = Object.keys(FONT3);
  function drawGlyph(g, ch, x, y) {
    const rows = FONT3[ch];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (rows[r][c] === '1') g.fillRect(x + c, y + r, 1, 1);
  }

  class Boss {
    constructor(canvas) {
      this.canvas = canvas;
      canvas.width = G; canvas.height = G;
      this.W = W; this.H = H;
      this.g = canvas.getContext('2d');
      this.g.imageSmoothingEnabled = false;

      const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').imageSmoothingEnabled = false; return c; };
      this.buf = mk(); this.bg = this.buf.getContext('2d');    /* sprite limpio + aura + partículas */
      this.spr = mk(); this.sg = this.spr.getContext('2d');    /* solo el sprite */
      this.rBuf = mk(); this.cBuf = mk();                      /* copias teñidas para el glitch */
      this.vignette = this.g.createRadialGradient(W / 2, H * 0.42, W * 0.3, W / 2, H * 0.42, W * 0.72);
      this.vignette.addColorStop(0, 'rgba(0,0,0,0)'); this.vignette.addColorStop(1, 'rgba(0,0,0,0.75)');

      this.L = new Uint8Array(W * H);                          /* mapa de zonas */
      this.img = this.sg.createImageData(W, H);
      this.px = this.img.data;
      /* cuánta luz llega a cada fila: la cara iluminada, el torso hundiéndose en la oscuridad */
      this.dark = Array.from({ length: H }, (_, y) => y < 58 ? 1 : Math.max(0.28, 1 - Math.pow((y - 58) / 38, 1.3) * 0.72));
      /* umbral de cada píxel para aparecer (al azar) y para deshacerse (primero el cuerpo, la cabeza al final) */
      this.thrA = new Float32Array(W * H); this.thrD = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) { const y = (i / W) | 0; this.thrA[i] = Math.random() * 0.999; this.thrD[i] = Math.random() * 0.55 + (1 - y / (H - 1)) * 0.44; }

      this.time = 0; this._last = 0;
      this.talking = false; this.talkPhase = 0;
      this.glitchBase = 0.34;
      this.glitchLevel = 0.16;
      this.burstT = 0; this.burstI = 0;
      this.corrupted = false;
      this.stabilizing = false;
      this.calm = 0;                          /* 0..1: se va calmando (ruta pacifista) */
      this.dull = true;                       /* ojos apagados hasta que se pone la armadura */
      this.hurtFlash = 0; this.coreFlash = 0;
      this.strips = []; this._stripT = 0;
      this.parts = []; this.code = []; this.debris = [];
      this.blankEyesT = 0;
      this.demonT = 0; this.flashT = 0; this.freezeT = 0;   /* ojos negros, fotograma subliminal, imagen congelada */
      this.drips = []; this.smoke = [];
      this.anims = [];

      this.pose = Object.assign({}, MOODS.idle);
      this.moodName = 'idle'; this.moodHold = 0;
      this._moodT = 3 + Math.random() * 3;
      this.look = { x: 0, y: 0, tx: 0, ty: 0, t: 2 };
      this._blinkT = 2 + Math.random() * 3; this.blinking = false; this._blinkDur = 0;
      this.tilt = 0; this._tiltTarget = 0;
      this._ghostT = 0;

      this.attacking = false; this.attackMood = 'grin'; this.hands = null;
      this.handK = 0;
      this.gone = { '-1': 0, '1': 0 };      /* segundos que le faltan a cada mano para volver a salir tras lanzarla */

      /* Presencia: aparece desde la nada y, en la ruta pacifista, se deshace */
      this.visibleK = 0; this.dissolveK = 0; this._dissPrev = 0; this.bodyGone = false;

      /* Armadura */
      this.hasHelmet = false; this.helmetOff = { x: 0, y: 0 };
      this.plateOn = [false, false]; this.plateOff = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
      this.crackHoles = []; this.crackLines = []; this.crackA = 1;
      this.visorLines = []; this.visorFlickerT = 0; this.repairK = -1;
      this.visorGone = false; this.remnant = false;

      /* Daños de la ruta de lucha */
      this.dmg = 0; this.fin = 0;
      this.wound = 0;                        /* 0..1: lo herida y cansada que está */
      this.armHang = false; this.armLost = false;
      this.chestCracks = false; this.chestOpen = false; this.coreBroken = false;
      this.faceCrack = false; this.pixelK = 0; this.sink = 0; this.lean = 0;
      this.blood = []; this.cables = [];
      this._hx = 0; this._hy = 0;

      this._raf = requestAnimationFrame(this.loop.bind(this));
    }

    /* ---------- API que usa secret.js ---------- */
    setTalking(on) { this.talking = on; }
    setMood(name, hold) { if (!MOODS[name]) return; this.moodName = name; this.moodHold = hold || 0; }
    baseMood() {
      if (this.stabilizing || this.calm > 0.5) return 'soft';
      if (this.attacking) return this.attackMood;
      if (this.wound > 0) return 'tired';
      if (this.dull) return 'idle';
      return (this.corrupted && !this.hasHelmet) ? 'smirk' : 'idle';
    }
    attack(o = {}) {
      this.attacking = true; this.hands = o.hands || null;
      this.attackMood = o.mood || (this.calm > 0.5 ? 'soft' : this.hands === 'fist' ? 'rage' : 'grin');
      this.setMood(this.attackMood, 0);
      this.glitchBurst(0.6 * (1 - this.calm), 0.35);
      this.spawnParts(10, PAL.glitchA);
    }
    attackEnd() { this.attacking = false; this.hands = null; this.setMood(this.baseMood(), 0); }
    /* Lanza el puño de un lado (-1 izquierda, 1 derecha): sale disparado de la muñeca y tarda en volver a salir */
    launch(side) {
      this.gone[side] = 1.1;
      const w = this.wristPos(side);
      for (let i = 0; i < 10; i++) this.parts.push({ x: w.x, y: w.y - 4, vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 40, s: 1 + Math.random() * 2, life: 0, max: 0.3 + Math.random() * 0.4, col: i % 2 ? PAL.spark : PAL.iris });
    }
    /* Dónde está la muñeca de un lado, en píxeles del sprite (secret.js lo usa para que el puño salga de ahí) */
    wristPos(side) { const h = this.handPos(this.time, side); return { x: h.x, y: h.y }; }
    /* ¿Puede usar ese brazo? (el derecho cuelga y el izquierdo puede haberse caído) */
    armOK(side) { return !(side === 1 && this.armHang) && !(side === -1 && this.armLost); }

    /* Animación con duración: step(k) recibe 0..1 y la promesa se cumple al acabar */
    tween(dur, step) { return new Promise((res) => this.anims.push({ t: 0, dur: Math.max(0.001, dur), step, res })); }

    /* Aparece desde la oscuridad: los píxeles se van materializando */
    appear(dur = 1.6) { this.glitchBurst(0.8, dur); return this.tween(dur, (k) => { this.visibleK = k; }); }
    /* Directamente armada (reintentos y atajos de prueba) */
    show() {
      this.visibleK = 1; this.dull = false; this.hasHelmet = true;
      this.plateOn = [true, true]; this.helmetOff = { x: 0, y: 0 }; this.plateOff = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    }
    /* El casco llega flotando y se posa; después las hombreras se ensamblan desde los lados.
       avisos.helmet() suena al posarse el casco y avisos.plates() al encajar las hombreras */
    assemble(dur = 5, avisos = {}) {
      const fly = dur * 0.72;
      this.hasHelmet = true; this.helmetOff = { x: 0, y: -72 };
      return this.tween(fly, (k) => {
        const e = 1 - Math.pow(1 - k, 3);                                  /* baja rápido y se posa despacio */
        this.helmetOff.y = ri(-72 * (1 - e) + Math.sin(k * Math.PI * 4) * 2 * (1 - k));
        this.helmetOff.x = ri(Math.sin(k * 5) * 3 * (1 - k));
      }).then(() => {
        this.helmetOff = { x: 0, y: 0 }; this.dull = false;
        this.glitchBurst(1.1, 0.5); this.spawnParts(22, PAL.spark);
        if (avisos.helmet) avisos.helmet();
        this.plateOn = [true, true];
        return this.tween(dur - fly, (k) => {
          const e = k * k * (3 - 2 * k);
          this.plateOff[0] = { x: ri(-34 * (1 - e)), y: ri(-8 * (1 - e)) }; this.plateOff[1] = { x: ri(34 * (1 - e)), y: ri(-8 * (1 - e)) };
        });
      }).then(() => {
        for (const x of [22, 74]) for (let i = 0; i < 8; i++) this.parts.push({ x, y: 74, vx: (Math.random() - 0.5) * 60, vy: -10 - Math.random() * 40, s: 1, life: 0, max: 0.4 + Math.random() * 0.3, col: i % 2 ? PAL.spark : PAL.cyan });
        this.glitchBurst(1.3, 0.5);
        if (avisos.plates) avisos.plates();
      });
    }
    hurt() {
      this.glitchBurst(0.9, 0.4); this.hurtFlash = 1; this.spawnParts(14, PAL.glitchA);
      this._tiltTarget += (Math.random() - 0.5) * 0.5;
      this.setMood('hurt', 0.55);
    }
    /* Primer gran impacto: grieta diagonal en la visera, el visor parpadea y un trozo del casco salta */
    bigImpact() {
      this.hurt(); this.glitchBurst(1.6, 0.8);
      this.visorFlickerT = 1.8;
      this.visorLines.push({ pts: VISOR_CRACK, k: 1 }, { pts: VISOR_CRACK_B, k: 1 });
      this.breakHole(HOLES.chip, -40);
      this.spawnParts(26, PAL.spark);
    }
    /* La armadura se regenera: el agujero se cierra y las grietas se borran bajo una línea de luz */
    repair(dur = 2) {
      const holes = this.crackHoles.slice(), lines = this.visorLines.slice();
      return this.tween(dur, (k) => {
        holes.forEach((h) => { h.s = 1 - k; });
        lines.forEach((l) => { l.k = 1 - k; });
        this.crackA = 1 - k; this.repairK = k;
        if (Math.random() < 0.3) this.parts.push({ x: 26 + Math.random() * 44, y: 6 + k * 56, vx: (Math.random() - 0.5) * 20, vy: -8, s: 1, life: 0, max: 0.4, col: PAL.cyan });
      }).then(() => { this.crackHoles = []; this.visorLines = []; this.crackLines = []; this.crackA = 1; this.repairK = -1; });
    }
    /* Daños acumulados de la ruta de lucha (0..7). Cada nivel añade lo suyo, en orden */
    setDamage(n) {
      while (this.dmg < n) {
        const s = ++this.dmg;
        if (s === 1) { this.breakHole(HOLES.temple, 30); this.hairline(); }
        if (s === 2) { this.breakHole(HOLES.cheek, -30); this.addBlood(64, 24, 'head', 11); }
        if (s === 3) { this.visorLines.push({ pts: VISOR_CRACK, k: 1 }, { pts: VISOR_CRACK_B, k: 1 }); this.hairline(); }
        if (s === 4) { this.wound = 0.25; this.cables.push({ x: 27, y: 84, rel: 'body', len: 4 }); }
        if (s === 5) { this.wound = 0.5; this.armHang = true; this.cables.push({ x: 72, y: 75, rel: 'body', len: 5 }); }
        if (s === 6) { this.wound = 0.75; this.breakHole(HOLES.jaw, 20); this.chestCracks = true; this.addBlood(60, 57, 'head', 12); }
        if (s === 7) { this.wound = 1; this.breakHole(HOLES.eye, 25); this.addBlood(57, 46, 'head', 14); this.addBlood(40, 30, 'head', 9); }
        this.spawnParts(16, PAL.spark); this.glitchBurst(1.2, 0.45);
      }
    }
    /* La secuencia de golpes finales (1..8) */
    finalHit(n) {
      this.fin = n; this.hurt(); this.glitchBurst(1.5, 0.6);
      if (n === 1) { this.faceCrack = true; this.addBlood(49, 43, 'head', 14); this.addBlood(57, 53, 'head', 10); }
      if (n === 2) {                                                        /* cae una hombrera y queda un cable al aire */
        this.detach((x, y, z) => z === Z.PLATE_L, { vx: -22, vy: -26, vr: -3 });
        this.plateOn[0] = false; this.cables.push({ x: 22, y: 71, rel: 'body', len: 6 });
      }
      if (n === 3) {                                                        /* el visor se rompe y deja ver su cara */
        const hole = holeFrom(VISOR_BREAK);
        this.shatter((x, y, z) => (z === Z.VISOR || z === Z.HELMET) && inPoly(hole.pts, x + 0.5 - this._hx, y + 0.5 - this._hy), 3);
        this.crackHoles.push(hole); this.visorGone = true; this.visorLines = [];
      }
      if (n === 4) {                                                        /* se le cae un brazo */
        this.detach((x, y, z) => z === Z.ARM_L || (z === Z.JACKET && x < 23 && y > 74), { vx: -16, vy: 6, vr: -1.4 });
        this.armLost = true;
        this.cables.push({ x: 23, y: 78, rel: 'body', len: 7 }, { x: 23, y: 87, rel: 'body', len: 5 });
        this.addBlood(24, 80, 'body', 9);
      }
      if (n === 5) { this.chestOpen = true; this.coreFlash = 0.6; this.spawnParts(24, PAL.iris); }
      if (n === 6) {                                                        /* la cara se pixela y pierde estabilidad */
        this.corrupted = true;
        this.tween(1.2, (k) => { this.pixelK = 0.5 * k; this.sink = ri(4 * k); this.lean = 0.06 * k; });
      }
      if (n === 7) {                                                        /* el casco termina de romperse */
        this.shatter((x, y, z) => z === Z.HELMET || z === Z.VISOR, 4);
        this.hasHelmet = false; this.remnant = true; this.pixelK = Math.max(this.pixelK, 0.7);
        this.addBlood(44, 22, 'head', 12); this.cables.push({ x: 40, y: 60, rel: 'head', len: 5 });
      }
      if (n === 8) { this.coreBroken = true; this.coreFlash = 1; this.spawnParts(40, '#ffffff'); this.glitchBurst(1.9, 1); }
    }
    /* El cuerpo cae convertido en restos: el sprite se parte en trozos que caen y quedan en un
       montón en el suelo (más alto en el centro, como una pila de chatarra) */
    collapse() {
      const snap = this.snapshot(() => true);
      this.bodyGone = true;
      if (snap) for (const ch of this.chunks(snap, 4)) {
        const vx = (Math.random() - 0.5) * 40 + (ch.x + 2 - 48) * 0.8, land = ch.x + vx * 0.9;
        const mound = 3 + 13 * Math.max(0, 1 - Math.abs(land + 2 - 48) / 44);
        this.debris.push(Object.assign(ch, {
          y: ch.y + this.sink, vx, vy: -10 - Math.random() * 34,
          rot: 0, vr: (Math.random() - 0.5) * 7, life: 0, max: 6, floor: H - ch.h - Math.random() * mound,
        }));
      }
      this.spawnParts(30, PAL.spark);
      return this.tween(3.2, () => {});
    }
    setCalm(k) { this.calm = clamp01(k); }
    /* Ruta pacifista: la armadura se desmonta SOLA. Nada cae por daño: el casco sube y las hombreras se alejan flotando */
    dismantle(dur = 3.5) {
      this.stabilizing = true; this.setMood('soft', 0);
      return this.tween(dur, (k) => {
        const e = k * k;
        this.helmetOff = { x: ri(Math.sin(k * 6) * 2), y: ri(-6 * Math.min(1, k * 5) - 92 * e) };
        this.plateOff[0] = { x: ri(-46 * e), y: ri(-24 * e) }; this.plateOff[1] = { x: ri(46 * e), y: ri(-24 * e) };
        if (Math.random() < 0.25) this.parts.push({ x: 20 + Math.random() * 56, y: 20 + Math.random() * 60, vx: 0, vy: -12, s: 1, life: 0, max: 0.6, col: PAL.cyan, up: true });
      }).then(() => { this.hasHelmet = false; this.plateOn = [false, false]; });
    }
    /* Se deshace en fragmentos de píxeles y de código (0 = entera, 1 = no queda nada) */
    dissolveTo(k, dur = 2.5) {
      const from = this.dissolveK;
      return this.tween(dur, (e) => { this.dissolveK = from + (k - from) * e; });
    }
    glitchBurst(intensity, dur) { this.burstI = Math.max(this.burstI, intensity); this.burstT = Math.max(this.burstT, dur); }
    spawnParts(n, col) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 15 + Math.random() * 60;
        this.parts.push({
          x: W / 2 + (Math.random() - 0.5) * 40, y: H * 0.4 + (Math.random() - 0.5) * 44,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 8, s: 1 + Math.random() * 2,
          life: 0, max: 0.4 + Math.random() * 0.6, col,
        });
      }
    }

    /* ---------- Piezas que se rompen ---------- */
    /* Grieta fina: el casco aguanta, pero se nota el golpe */
    hairline() {
      let x = 34 + Math.random() * 28, y = 12 + Math.random() * 22;
      const line = [{ x, y }];
      for (let i = 0; i < 4; i++) { x += (Math.random() - 0.5) * 10; y += 2 + Math.random() * 5; line.push({ x, y }); }
      this.crackLines.push(line);
      this.spawnParts(8, PAL.spark);
    }
    /* Agujero irregular en el casco: el trozo que falta sale volando */
    breakHole(spot, vx) {
      const cx = spot.x + spot.w / 2, cy = spot.y + spot.h / 2, n = 11, pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, r = (i % 2 ? 0.55 : 1) * (0.75 + Math.random() * 0.35);
        pts.push([cx + Math.cos(a) * spot.w / 2 * r, cy + Math.sin(a) * spot.h / 2 * r]);
      }
      const hole = holeFrom(pts);
      this.shatter((x, y, z) => (z === Z.HELMET || z === Z.VISOR) && inPoly(pts, x + 0.5 - this._hx, y + 0.5 - this._hy), 3, vx);
      this.crackHoles.push(hole);
      let x = cx, y = cy;
      const line = [{ x, y }];
      for (let i = 0; i < 6; i++) { x += (Math.random() - 0.5) * 13; y += (Math.random() - 0.5) * 13; line.push({ x, y }); }
      this.crackLines.push(line);
    }
    addBlood(x, y, rel, max) { this.blood.push({ x, y, rel, len: 0, max, ph: Math.random() * 10 }); }
    /* «Fotografía» los píxeles del último fotograma que cumplen test(x, y, zona) */
    snapshot(test) {
      const L = this.L, px = this.px;
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (L[i] && px[i * 4 + 3] && test(x, y, L[i])) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return null;
      const w = x1 - x0 + 1, h = y1 - y0 + 1, c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d'), im = g.createImageData(w, h);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (L[i] && px[i * 4 + 3] && test(x, y, L[i])) { const o = ((y - y0) * w + (x - x0)) * 4; for (let k = 0; k < 4; k++) im.data[o + k] = px[i * 4 + k]; }
      }
      g.putImageData(im, 0, 0);
      return { c, im, x: x0, y: y0, w, h };
    }
    /* Parte una foto en trozos de size x size */
    chunks(snap, size) {
      const out = [];
      for (let y = 0; y < snap.h; y += size) for (let x = 0; x < snap.w; x += size) {
        const w = Math.min(size, snap.w - x), h = Math.min(size, snap.h - y);
        let any = false;
        for (let yy = 0; yy < h && !any; yy++) for (let xx = 0; xx < w; xx++) if (snap.im.data[((y + yy) * snap.w + x + xx) * 4 + 3]) { any = true; break; }
        if (!any) continue;
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(snap.c, x, y, w, h, 0, 0, w, h);
        out.push({ c, x: snap.x + x, y: snap.y + y, w, h });
      }
      return out;
    }
    /* Una pieza entera se suelta y cae */
    detach(test, v) {
      const s = this.snapshot(test);
      if (s) this.debris.push({ c: s.c, x: s.x, y: s.y + this.sink, w: s.w, h: s.h, vx: v.vx, vy: v.vy, rot: 0, vr: v.vr, life: 0, max: 4 });
      this.spawnParts(18, PAL.spark);
    }
    /* Una pieza estalla en trozos pequeños */
    shatter(test, size, vx0 = 0) {
      const s = this.snapshot(test);
      if (!s) return;
      for (const ch of this.chunks(s, size)) {
        this.debris.push(Object.assign(ch, {
          y: ch.y + this.sink, vx: vx0 + (ch.x - 48) * 1.6 + (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 45,
          rot: 0, vr: (Math.random() - 0.5) * 12, life: 0, max: 2.5,
        }));
      }
    }

    /* ---------- Bucle ---------- */
    loop(now) {
      const dt = Math.min(0.05, this._last ? (now - this._last) / 1000 : 0.016);
      this._last = now; this.time += dt;
      this.update(dt);
      if (this.freezeT <= 0 || this.bodyGone) this.render();
      this._raf = requestAnimationFrame(this.loop.bind(this));
    }

    update(dt) {
      for (let i = this.anims.length - 1; i >= 0; i--) {
        const a = this.anims[i];
        a.t += dt; const k = Math.min(1, a.t / a.dur); a.step(k);
        if (k >= 1) { this.anims.splice(i, 1); a.res(); }
      }
      if (this.talking) this.talkPhase += dt;
      if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.6);
      if (this.coreFlash > 0) this.coreFlash = Math.max(0, this.coreFlash - dt * 0.9);
      if (this.visorFlickerT > 0) this.visorFlickerT -= dt;
      if (this.burstT > 0) { this.burstT -= dt; this.burstI *= Math.pow(0.02, dt); } else this.burstI = 0;

      const presence = this.visibleK * (1 - this.dissolveK);
      const calmK = this.stabilizing ? 1 : this.calm;
      const fight = Math.min(1, (this.dmg + this.fin * 1.5) / 12);           /* cuanto más rota, más inestable */
      let base = this.dull ? 0.16 : this.corrupted ? 0.72 : this.glitchBase + fight * 0.4;
      base = base * (1 - calmK) + 0.05 * calmK;
      const target = Math.min(1, base + (this.attacking ? 0.2 * (1 - calmK) : 0) + this.burstI);
      this.glitchLevel += (target - this.glitchLevel) * Math.min(1, dt * 5);

      this._stripT -= dt;
      if (this._stripT <= 0) { this.rebuildStrips(); this._stripT = 0.07 + Math.random() * 0.12; }
      this.blankEyesT -= dt;
      if (this.blankEyesT <= 0 && Math.random() < this.glitchLevel * 0.01) this.blankEyesT = 0.05 + Math.random() * 0.07;
      /* Momentos inquietantes (más frecuentes cuanto más inestable está; nunca si está en calma) */
      const gl = this.glitchLevel, calm = calmK > 0.4 || this.dull || this.bodyGone || presence < 0.99;
      this.demonT -= dt; this.flashT -= dt; this.freezeT -= dt;
      if (!calm && this.demonT <= 0 && Math.random() < dt * gl * 0.35) this.demonT = 0.12 + Math.random() * 0.35;   /* ojos negros con pupila roja */
      if (!calm && this.flashT <= 0 && Math.random() < dt * gl * 0.18) this.flashT = 0.05 + Math.random() * 0.05;   /* su sonrisa, un instante */
      if (!calm && this.freezeT <= 0 && Math.random() < dt * gl * 0.25) this.freezeT = 0.06 + Math.random() * 0.12; /* la imagen se congela */
      /* goteo oscuro desde los ojos */
      if (!calm && Math.random() < dt * gl * 0.9) this.drips.push({ side: Math.random() < 0.5 ? -1 : 1, dx: ri((Math.random() - 0.5) * 6), len: 0, max: 6 + Math.random() * 14, life: 1 });
      for (let i = this.drips.length - 1; i >= 0; i--) {
        const d = this.drips[i];
        if (d.len < d.max) d.len += dt * 18; else d.life -= dt * 0.9;
        if (d.life <= 0) this.drips.splice(i, 1);
      }
      for (const b of this.blood) if (b.len < b.max) b.len = Math.min(b.max, b.len + dt * 7);
      /* humo oscuro que sube alrededor */
      if (Math.random() < dt * (4 + gl * 14) * presence * (1 - calmK * 0.7)) this.smoke.push({ x: 10 + Math.random() * 76, y: 70 + Math.random() * 26, vy: -(6 + Math.random() * 10), vx: (Math.random() - 0.5) * 4, s: 2 + Math.random() * 4, life: 0, max: 1.4 + Math.random() * 1.6 });
      for (let i = this.smoke.length - 1; i >= 0; i--) {
        const s = this.smoke[i];
        s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.s += dt * 2;
        if (s.life > s.max) this.smoke.splice(i, 1);
      }
      /* símbolos de código que flotan a su alrededor mientras habla */
      if (this.talking && presence > 0.5 && !this.bodyGone && Math.random() < dt * 9) {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.code.push({ x: 48 + side * (22 + Math.random() * 14) - 1, y: 14 + Math.random() * 44, vx: side * (2 + Math.random() * 4), vy: -(5 + Math.random() * 8),
          ch: CODE_CH[(Math.random() * CODE_CH.length) | 0], col: Math.random() < 0.7 ? PAL.code : PAL.cyan, life: 0, max: 1.1 + Math.random() * 0.9 });
      }
      for (let i = this.code.length - 1; i >= 0; i--) {
        const q = this.code[i];
        q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.life > q.max) this.code.splice(i, 1);
      }

      /* Estado de ánimo: la cara se acerca poco a poco a la pose objetivo */
      if (this.moodHold > 0) {
        this.moodHold -= dt;
        if (this.moodHold <= 0) this.setMood(this.baseMood(), 0);
      } else if (!this.attacking && !this.stabilizing && !this.bodyGone) {
        this._moodT -= dt;
        if (this._moodT <= 0) {                        /* vida propia: cambia de cara sin que nadie se lo pida */
          const pool = this.dull ? ['idle', 'stare'] : this.calm > 0.5 ? ['soft', 'idle', 'soft', 'cry'] : this.hasHelmet ? ['stare', 'idle', 'smirk']
            : this.wound > 0 ? ['tired', 'tired', 'soft', 'stare', 'smirk'] : ['smirk', 'stare', 'grin', 'idle', 'soft'];
          this.setMood(pool[Math.floor(Math.random() * pool.length)], 1.1 + Math.random() * 1.6);
          this._moodT = 3 + Math.random() * 4;
        }
      }
      const tgt = MOODS[this.moodName], k = Math.min(1, dt * 9);
      for (const key of MOOD_KEYS) this.pose[key] += (tgt[key] - this.pose[key]) * k;

      this.look.t -= dt;
      if (this.look.t <= 0) {
        this.look.t = 1.2 + Math.random() * 2.5;
        this.look.tx = this.attacking ? 0 : Math.round((Math.random() - 0.5) * 3);
        this.look.ty = this.attacking ? 0 : Math.round((Math.random() - 0.5) * 1.4);
      }
      this.look.x += (this.look.tx - this.look.x) * Math.min(1, dt * 10);
      this.look.y += (this.look.ty - this.look.y) * Math.min(1, dt * 10);

      this._blinkT -= dt;
      if (this._blinkT <= 0 && !this.blinking) { this.blinking = true; this._blinkDur = 0.1; this._blinkT = 2.4 + Math.random() * 3.4; }
      if (this.blinking) { this._blinkDur -= dt; if (this._blinkDur <= 0) this.blinking = false; }

      const idleTilt = Math.sin(this.time * (this.corrupted ? 0.9 : 0.4)) * (this.corrupted ? 0.05 : 0.03);
      this._tiltTarget += (idleTilt - this._tiltTarget) * Math.min(1, dt * 0.6);
      this.tilt += ((this._tiltTarget + tgt.tilt) - this.tilt) * Math.min(1, dt * 6);
      this._tiltTarget *= Math.pow(0.001, dt);
      if ((this.corrupted || this.attacking) && calmK < 0.5 && Math.random() < dt * 0.7) this._tiltTarget += (Math.random() < 0.5 ? -1 : 1) * 0.16;

      this.handK += ((this.hands ? 1 : 0) - this.handK) * Math.min(1, dt * 5);
      for (const s of ['-1', '1']) if (this.gone[s] > 0) this.gone[s] -= dt;
      this._ghostT -= dt;

      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.up) p.vy += 36 * dt; p.vx *= 0.95;
        if (p.life > p.max) this.parts.splice(i, 1);
      }
      /* restos que caen (y, al desplomarse, se amontonan abajo) */
      for (let i = this.debris.length - 1; i >= 0; i--) {
        const d = this.debris[i];
        d.life += dt;
        if (!d.rest) {
          d.vy += 170 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
          if (d.floor && d.vy > 0 && d.y >= d.floor) {                         /* llega a su sitio en el montón */
            d.y = d.floor;
            if (d.vy > 70 && !d.bounced) { d.vy *= -0.25; d.vx *= 0.5; d.bounced = true; }   /* un rebote pequeño */
            else { d.rest = true; d.rot = ri(d.rot / (Math.PI / 2)) * Math.PI / 2; }
          }
        }
        if (d.life > d.max || d.y > H + 20) this.debris.splice(i, 1);
      }
    }

    rebuildStrips() {
      const n = 5 + Math.floor(Math.random() * 5);
      this.strips = [];
      let y = 0;
      for (let i = 0; i < n && y < H; i++) {
        const h = Math.max(2, Math.round((H - y) * (0.12 + Math.random() * 0.3)));
        const active = Math.random() < this.glitchLevel * 0.9;
        const dx = active ? Math.round((Math.random() - 0.5) * 18 * this.glitchLevel) : 0;
        this.strips.push({ y, h: Math.min(h, H - y), dx });
        y += h;
      }
    }

    /* =================== 1) MAPA DE ZONAS =================== */
    inHole(x, y) {
      const px0 = x + 0.5 - this._hx, py0 = y + 0.5 - this._hy;          /* los agujeros se mueven con la cabeza */
      for (const h of this.crackHoles) {
        if (h.s <= 0.05) continue;
        const px = h.cx + (px0 - h.cx) / h.s, py = h.cy + (py0 - h.cy) / h.s;   /* s < 1: el agujero se está cerrando */
        if (px < h.x || px >= h.x + h.w || py < h.y || py >= h.y + h.h) continue;
        if (inPoly(h.pts, px, py)) return true;
      }
      return false;
    }
    /* Rellena un polígono (regla par-impar) con la zona id. dx/dy lo desplazan; skip excluye píxeles (agujeros) */
    poly(pts, id, dx, dy, skip) {
      const L = this.L;
      let y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { y0 = Math.min(y0, p[1] + dy); y1 = Math.max(y1, p[1] + dy); }
      y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(H - 1, Math.ceil(y1));
      const xs = [];
      for (let y = y0; y <= y1; y++) {
        const sy = y + 0.5; xs.length = 0;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const ax = pts[j][0] + dx, ay = pts[j][1] + dy, bx = pts[i][0] + dx, by = pts[i][1] + dy;
          if ((ay <= sy) !== (by <= sy)) xs.push(ax + (sy - ay) * (bx - ax) / (by - ay));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
          for (let x = xa; x <= xb; x++) if (!skip || !skip(x, y)) L[y * W + x] = id;
        }
      }
    }
    /* Filas con media anchura variable: hwAt(y) -> media anchura (o 0) */
    rows(cx, yA, yB, hwAt, id, skip) {
      for (let y = Math.max(0, yA); y < Math.min(H, yB); y++) {
        const hw = hwAt(y);
        if (hw <= 0) continue;
        for (let x = Math.max(0, ri(cx - hw)); x < Math.min(W, ri(cx + hw)); x++) if (!skip || !skip(x, y)) this.L[y * W + x] = id;
      }
    }

    /* =================== 2) CONTORNO Y SOMBRAS AUTOMÁTICOS =================== */
    outline() {
      const L = this.L, px = this.px;
      const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : L[y * W + x];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x, a = L[i], o = i * 4;
          if (!a) { px[o + 3] = 0; continue; }
          const ra = REG[a];
          let edge = false;
          for (const b of [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)]) {
            if (b === a) continue;
            if (!b || (REG[b].group !== ra.group && REG[b].z < ra.z)) { edge = true; break; }
          }
          let tone = 2;                                                  /* base */
          if (edge) tone = 0;                                            /* contorno */
          else if (ra.shade) {
            const s = ra.shade;
            if (at(x + s, y) !== a || at(x + 1, y + s) !== a) tone = 1;  /* cerca del borde de abajo/derecha: sombra */
            else if (at(x - s, y) !== a || at(x, y - s) !== a) tone = 3; /* cerca del de arriba/izquierda: brillo */
          }
          const c = ra.c[tone], k = this.dark[y];                     /* oscurece según la altura */
          px[o] = c[0] * k; px[o + 1] = c[1] * k; px[o + 2] = c[2] * k; px[o + 3] = 255;
        }
      }
    }

    /* =================== 3) DETALLES A MANO =================== */
    /* Pinta un píxel solo si cae sobre alguna de las zonas indicadas (así el casco tapa la cara sin más) */
    dot(x, y, c, zones, a) {
      x = ri(x); y = ri(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      if (zones && zones.indexOf(this.L[i]) < 0) return;
      const o = i * 4, al = a === undefined ? 1 : a, k = EMIT.has(c) ? 1 : this.dark[y];
      this.px[o] = ri(this.px[o] * (1 - al) + c[0] * k * al);
      this.px[o + 1] = ri(this.px[o + 1] * (1 - al) + c[1] * k * al);
      this.px[o + 2] = ri(this.px[o + 2] * (1 - al) + c[2] * k * al);
      this.px[o + 3] = 255;
    }
    line(x0, y0, x1, y1, c, zones, a) {
      x0 = ri(x0); y0 = ri(y0); x1 = ri(x1); y1 = ri(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.dot(x0, y0, c, zones, a);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    polyline(pts, c, zones, a) { for (let i = 1; i < pts.length; i++) this.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, zones, a); }

    /* ---------- Render completo ---------- */
    render() {
      const presence = this.visibleK * (1 - this.dissolveK);
      if ((presence <= 0 || this.bodyGone) && !this.parts.length && !this.debris.length && !this.code.length) { this.g.clearRect(0, 0, W, H); return; }
      const t = this.time, p = this.pose;

      if (presence > 0 && !this.bodyGone) {
        /* Movimiento de la cabeza: balanceo, respiración, ladeo y temblor (en píxeles enteros) */
        const jitter = this.corrupted ? Math.round(Math.sin(t * 7) * this.glitchLevel * 2) : 0;
        const sway = Math.round(Math.sin(t * 0.8) * 1) + jitter;
        const wd = this.wound;                                              /* herida: respira más lento y más hondo */
        const breathe = Math.sin(t * (1.7 - wd * 0.8)) > 0.4 ? 1 + ri(wd) : 0;
        const sh = p.shake > 0.05 ? p.shake : 0;
        const hx = sway + ri(this.tilt * 18) + (sh ? ri((Math.random() - 0.5) * 3 * sh) : 0);
        const hy = breathe + ri(wd * 2) + (sh ? ri((Math.random() - 0.5) * 1.5 * sh) : 0);   /* la cabeza cae un poco */
        const hairSway = ri(Math.sin(t * 1.1) * 1 + (this.attacking ? Math.sin(t * 9) : 0));

        /* --- 1) zonas, de atrás hacia delante --- */
        this.L.fill(0);
        this.poly(HAIR_BACK, Z.HAIR_B, hx + hairSway, hy);
        this.poly(this.armLost ? JACKET_NO_L : JACKET, Z.JACKET, 0, 0);
        this.rows(48, 54 + hy, 70, () => 7, Z.NECK);
        if (!this.armLost) this.poly(ARM_L, Z.ARM_L, 0, 0);
        this.poly(ARM_R, Z.ARM_R, this.armHang ? 1 : 0, this.armHang ? 3 : 0);          /* el brazo que cuelga */
        if (this.chestOpen) this.poly(CAVITY, Z.CAVITY, 0, 0);
        this.poly(COLLAR, Z.COLLAR, 0, 0);
        if (this.plateOn[0]) this.poly(PLATE_L, Z.PLATE_L, this.plateOff[0].x, this.plateOff[0].y);
        if (this.plateOn[1]) this.poly(PLATE_R, Z.PLATE_R, this.plateOff[1].x, this.plateOff[1].y + (this.armHang ? 2 : 0));
        this.rows(48 + hx, 18 + hy, 62 + hy, (y) => {                       /* cara: óvalo con mentón marcado */
          const k = (y - (18 + hy)) / 44, pp = k * 2 - 1;
          return pp < 0 ? 17 * Math.sqrt(Math.max(0, 1 - pp * pp)) : 17 * Math.pow(Math.max(0, 1 - pp * pp), 0.6);
        }, Z.FACE);
        this.poly(HAIR_FRONT, Z.HAIR_F, hx, hy);
        const mx = hx + this.helmetOff.x, my = hy + this.helmetOff.y;       /* el casco puede estar flotando */
        this._hx = mx; this._hy = my;
        if (this.hasHelmet) this.helmetZones(mx, my);
        else if (this.remnant) this.remnantZones(hx, hy);                    /* trozo de casco que sigue pegado */
        this.handZones(t);

        /* --- 2) contorno automático --- */
        this.outline();

        /* --- 3) detalles --- */
        this.bodyDetails(t);
        this.hairDetails(hx, hy, hairSway);
        this.faceDetails(hx, hy, t);
        if (this.hasHelmet) this.helmetDetails(mx, my, t);
        else if (this.remnant) this.remnantDetails(hx, hy, t);
        if (this.wound > 0) this.woundDetails(hx, hy, t);
        if (this.faceCrack) this.faceCrackDetails(hx, hy, t);
        this.bloodDetails(hx, hy, t);
        this.cableDetails(hx, hy, t);
        this.handDetails(t);
        if (this.pixelK > 0) this.pixelate(hx, hy);
        if (this.visibleK < 1 || this.dissolveK > 0) this.mask();

        this.sg.putImageData(this.img, 0, 0);
      } else this.sg.clearRect(0, 0, W, H);

      /* --- 4) montaje: aura roja detrás, sprite, fantasma, restos, partículas y código --- */
      const bg = this.bg;
      bg.clearRect(0, 0, W, H);
      if (presence > 0 && !this.bodyGone) this.drawAura(bg, W / 2, H * 0.48, t, presence);
      for (const s of this.smoke) {                                  /* humo oscuro rojizo, por detrás */
        const a = Math.sin(Math.PI * s.life / s.max) * 0.5;
        bg.globalAlpha = a * presence; bg.fillStyle = s.life / s.max < 0.5 ? '#3a0507' : '#140203';
        bg.fillRect(ri(s.x - s.s / 2), ri(s.y - s.s / 2), ri(s.s), ri(s.s));
      }
      bg.globalAlpha = 1;
      if (this.sink || this.lean) {                                  /* pierde estabilidad: se hunde y se inclina */
        bg.save(); bg.translate(48, 96); bg.rotate(this.lean); bg.translate(-48, -96 + this.sink); bg.drawImage(this.spr, 0, 0); bg.restore();
      } else bg.drawImage(this.spr, 0, 0);
      if (this.glitchLevel > 0.45 && presence > 0.9 && this._ghostT <= 0 && Math.random() < 0.15) {
        this._ghostT = 0.4 + Math.random() * 0.6; this._ghostDX = ri((Math.random() - 0.5) * 12);
      }
      if (this._ghostT > 0 && !this.bodyGone) {
        bg.globalAlpha = 0.18 * clamp01(this._ghostT * 3) * presence;
        bg.globalCompositeOperation = 'lighter';
        bg.drawImage(this.spr, this._ghostDX, 0);
        bg.globalCompositeOperation = 'source-over';
      }
      if (this.coreFlash > 0) {                                      /* el núcleo estalla en luz */
        const r = 8 + 40 * (1 - this.coreFlash), gr = bg.createRadialGradient(66, 86 + this.sink, 1, 66, 86 + this.sink, r);
        gr.addColorStop(0, 'rgba(255,255,255,' + this.coreFlash + ')'); gr.addColorStop(1, 'rgba(255,60,60,0)');
        bg.globalAlpha = 1; bg.fillStyle = gr; bg.fillRect(0, 0, W, H);
      }
      for (const d of this.debris) {
        bg.globalAlpha = d.max - d.life < 1.2 ? Math.max(0, (d.max - d.life) / 1.2) : 1;
        bg.save(); bg.translate(d.x + d.w / 2, d.y + d.h / 2); bg.rotate(d.rot); bg.drawImage(d.c, -d.w / 2, -d.h / 2); bg.restore();
      }
      for (const q of this.parts) {
        bg.globalAlpha = Math.max(0, 1 - q.life / q.max); bg.fillStyle = q.col;
        bg.fillRect(ri(q.x - q.s / 2), ri(q.y - q.s / 2), Math.max(1, ri(q.s)), Math.max(1, ri(q.s)));
      }
      for (const q of this.code) {
        bg.globalAlpha = 0.8 * Math.sin(Math.PI * Math.min(1, q.life / q.max)); bg.fillStyle = q.col;
        drawGlyph(bg, q.ch, ri(q.x), ri(q.y));
      }
      bg.globalAlpha = 1;

      this.applyGlitch(this.bodyGone ? 0 : presence);
    }

    /* Aparecer (umbral al azar) y deshacerse (de abajo arriba): los píxeles que se van sueltan partículas */
    mask() {
      const px = this.px, vk = this.visibleK, dk = this.dissolveK, pd = this._dissPrev;
      for (let i = 0; i < W * H; i++) {
        const o = i * 4;
        if (!px[o + 3]) continue;
        if (this.thrA[i] > vk) { px[o + 3] = 0; continue; }
        const th = this.thrD[i];
        if (th < dk) {
          if (th >= pd) {
            const x = i % W, y = (i / W) | 0, r = Math.random();
            if (r < 0.2) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 10, vy: -(12 + Math.random() * 26), s: 1, life: 0, max: 0.8 + Math.random() * 0.9, col: 'rgb(' + px[o] + ',' + px[o + 1] + ',' + px[o + 2] + ')', up: true });
            else if (r < 0.215) this.code.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: -(8 + Math.random() * 12), ch: CODE_CH[(Math.random() * CODE_CH.length) | 0], col: Math.random() < 0.6 ? PAL.code : PAL.cyan, life: 0, max: 1.4 + Math.random() });
          }
          px[o + 3] = 0;
        }
      }
      this._dissPrev = dk;
    }

    drawAura(g, cx, cy, t, presence) {
      const gl = this.glitchLevel * presence;
      if (gl < 0.04) return;
      const pulse = 0.45 + 0.35 * Math.sin(t * (this.attacking ? 10 : 6));
      const r = 42 + gl * 14 + (this.attacking ? 6 : 0);
      const grad = g.createRadialGradient(cx, cy, 4, cx, cy, r);
      grad.addColorStop(0, 'rgba(255,40,40,' + (0.34 * gl * pulse) + ')');
      grad.addColorStop(0.6, 'rgba(140,10,10,' + (0.18 * gl * pulse) + ')');
      grad.addColorStop(1, 'rgba(120,0,0,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      if (Math.random() < gl * 0.6) {
        const a = Math.random() * Math.PI * 2, rr = r * (0.6 + Math.random() * 0.5);
        g.fillStyle = PAL.iris; g.globalAlpha = 0.5 + 0.4 * Math.random();
        g.fillRect(ri(cx + Math.cos(a) * rr), ri(cy + Math.sin(a) * rr), 1, 1);
        g.globalAlpha = 1;
      }
    }

    /* ---------- Chaqueta: cremallera asimétrica, costuras, hombreras y núcleo rojo ---------- */
    bodyDetails(t) {
      const J = [Z.JACKET], CL = [Z.COLLAR];
      /* cremallera: sale del cuello por la derecha y baja en diagonal */
      this.line(55, 76, 43, 96, C.zip, J);
      for (let y = 78; y < 96; y += 3) { const x = 55 - (y - 76) * 0.6; this.dot(x + 1, y, C.zipHi, J); }
      this.line(55, 62, 55, 75, C.zip, CL);
      this.dot(56, 64, C.zipHi, CL); this.dot(56, 65, C.zipHi, CL);                /* tirador */
      /* costuras y pliegues */
      this.line(30, 84, 36, 96, C.seam, J); this.line(66, 82, 62, 96, C.seam, J);
      this.line(24, 88, 24, 96, C.seam, [Z.ARM_L]); this.line(72, 88, 72, 96, C.seam, [Z.ARM_R]);
      /* hombreras: franja cian (se mueven con la pieza mientras se ensambla) */
      const [a, b] = this.plateOff;
      this.line(17 + a.x, 78 + a.y, 27 + a.x, 72 + a.y, C.cyan, [Z.PLATE_L]); this.line(79 + b.x, 78 + b.y, 69 + b.x, 72 + b.y, C.cyan, [Z.PLATE_R]);
      /* núcleo del pecho: anillo metálico y luz roja que late (más rápido si está inestable) */
      const cx = 66, cy = 86;
      if (this.chestOpen) { this.cavityDetails(t, cx, cy); return; }
      const ring = [[-1, -3], [0, -3], [1, -3], [2, -2], [3, -1], [3, 0], [3, 1], [2, 2], [1, 3], [0, 3], [-1, 3], [-2, 2], [-3, 1], [-3, 0], [-3, -1], [-2, -2]];
      for (const [dx, dy] of ring) this.dot(cx + dx, cy + dy, dy < 0 ? C.zipHi : C.zip, J);
      const flicker = this.wound > 0.5 && Math.random() < 0.08 ? 0.2 : 1;           /* herida: el núcleo parpadea */
      const beat = (0.5 + 0.5 * Math.sin(t * (4 + this.glitchLevel * 8))) * (1 - this.wound * 0.45) * flicker * (this.dull ? 0.5 : 1);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) < 4) this.dot(cx + dx, cy + dy, beat > 0.3 ? C.iris : C.redDim, J);
      if (beat > 0.6) this.dot(cx - 1, cy - 1, C.irisHi, J);
      if (this.chestCracks) {                                                        /* grietas alrededor del núcleo */
        this.polyline([[cx - 3, cy - 2], [cx - 7, cy - 5], [cx - 9, cy - 4]], C.crack, J);
        this.polyline([[cx + 3, cy + 1], [cx + 7, cy + 3], [cx + 8, cy + 7]], C.crack, J);
        this.polyline([[cx, cy + 3], [cx - 1, cy + 7]], C.crack, J);
      }
      if (this.remnant) { this.line(20, 74, 25, 72, C.rivet, [Z.PLATE_L]); this.line(70, 71, 74, 74, C.rivet, [Z.PLATE_R]); }
    }
    /* Pecho abierto: hueco mecánico con el núcleo expuesto (o roto) */
    cavityDetails(t, cx, cy) {
      const CV = [Z.CAVITY];
      this.line(60, 80, 59, 95, C.pipe, CV); this.line(72, 80, 73, 95, C.pipe, CV);        /* tubos */
      this.line(58, 91, 74, 91, hex('#2c3038'), CV);                                          /* costilla */
      this.line(61, 81, 64, 84, C.cyan, CV, 0.7); this.line(71, 81, 68, 84, C.iris, CV, 0.8);  /* cables */
      if (this.coreBroken) {
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) this.dot(cx + dx, cy + dy, dx * dy > 0 ? C.crack : C.redDim, CV);
        this.polyline([[cx - 3, cy - 3], [cx, cy], [cx + 3, cy + 2]], C.zipHi, CV);
        return;
      }
      const beat = 0.6 + 0.4 * Math.sin(t * 11) * (Math.random() < 0.15 ? 0 : 1);
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= 5) this.dot(cx + dx, cy + dy, d > 4 ? C.zipHi : d > 2.6 ? C.iris : d > 1.2 ? C.irisHi : C.tooth, CV, d > 4 ? 0.9 : beat);
      }
    }

    /* ---------- Pelo: mechones y brillo ---------- */
    hairDetails(hx, hy, hs) {
      const B = [Z.HAIR_B], F = [Z.HAIR_F];
      this.polyline([[26 + hx + hs, 40 + hy], [25 + hx + hs, 52 + hy], [26 + hx + hs, 64 + hy]], C.hairDk, B);
      this.polyline([[70 + hx + hs, 40 + hy], [71 + hx + hs, 52 + hy], [70 + hx + hs, 64 + hy]], C.hairDk, B);
      this.polyline([[40 + hx + hs, 60 + hy], [36 + hx + hs, 66 + hy]], C.hairDk, B); this.polyline([[57 + hx + hs, 60 + hy], [61 + hx + hs, 66 + hy]], C.hairDk, B);
      /* raya al lado y mechones que bajan hacia el flequillo */
      this.polyline([[44 + hx, 9 + hy], [41 + hx, 18 + hy], [38 + hx, 28 + hy]], C.hairDk, F);
      this.polyline([[48 + hx, 8 + hy], [51 + hx, 18 + hy], [55 + hx, 28 + hy]], C.hairDk, F);
      this.polyline([[53 + hx, 10 + hy], [60 + hx, 20 + hy], [62 + hx, 30 + hy]], C.hairDk, F);
      this.polyline([[36 + hx, 13 + hy], [31 + hx, 22 + hy], [29 + hx, 36 + hy]], C.hairDk, F);
      this.polyline([[58 + hx, 12 + hy], [65 + hx, 22 + hy], [67 + hx, 32 + hy]], C.hairDk, F);
      this.polyline([[68 + hx, 38 + hy], [67 + hx, 52 + hy]], C.hairDk, F);
      this.polyline([[28 + hx, 40 + hy], [28 + hx, 54 + hy]], C.hairDk, F);
      /* banda de brillo (típica del pelo en pixel art) */
      this.polyline([[33 + hx, 15 + hy], [38 + hx, 11 + hy], [46 + hx, 9 + hy]], C.hairHi, F);
      this.polyline([[34 + hx, 16 + hy], [39 + hx, 12 + hy]], C.hairHi, F);
      this.polyline([[55 + hx, 10 + hy], [60 + hx, 12 + hy]], C.hairHi, F);
    }

    /* ---------- Cara ---------- */
    faceDetails(hx, hy, t) {
      const fx = 48 + hx, ey = 41 + hy, F = [Z.FACE];
      const blank = this.blankEyesT > 0;
      /* fotograma subliminal: por un instante, sonrisa desencajada y mirada fija */
      const real = this.pose;
      if (this.flashT > 0) this.pose = Object.assign({}, real, { smile: 1, arc: 0, squint: 0, open: 1, wide: 1, pupil: 0.05, brow: 0.6, mouth: 0.5 });
      /* ojeras */
      for (const s of [-1, 1]) for (let x = -5; x <= 5; x++) {
        this.dot(fx + s * 9 + x, ey + 6 - (Math.abs(x) > 3 ? 1 : 0), C.bags, F, 0.75);
        if (Math.abs(x) < 4) this.dot(fx + s * 9 + x, ey + 7, C.bags, F, 0.35);
      }
      /* los ojos rojos tiñen un poco la piel de alrededor (apenas nada con los ojos apagados) */
      const glowA = (0.14 + 0.1 * Math.sin(t * 4) + this.glitchLevel * 0.1) * (this.dull ? 0.25 : 1);
      for (const s of [-1, 1]) for (let y = -6; y <= 6; y++) for (let x = -8; x <= 8; x++) {
        const d = Math.hypot(x / 8, y / 6);
        if (d <= 1) this.dot(fx + s * 9 + x, ey + y, C.iris, F, glowA * (1 - d));
      }
      const desync = this.glitchLevel > 0.45 && Math.sin(t * 9) > 0.75;
      /* sombra del flequillo sobre la frente */
      for (let x = fx - 15; x <= fx + 15; x++) this.dot(x, 33 + hy + ((x >> 2) & 1), C.skinSh, F);
      this.eye(fx - 9, ey, -1, blank, F);
      this.eye(fx + 9, ey + (desync ? 1 : 0), 1, blank, F);
      this.brows(fx, ey, F);
      if (this.pose.cry > 0.1) this.tears(fx, ey, t, F);
      this.dot(fx + 1, ey + 6, C.skinSh, F); this.dot(fx + 1, ey + 7, C.skinSh, F);   /* nariz */
      if (this.pose.cry > 0.3 || this.pose.brow < -0.4) {                               /* rubor al llorar */
        for (const s of [-1, 1]) for (let x = 0; x < 4; x++) this.dot(fx + s * 11 + x - 2, ey + 7, hex('#e8a89c'), F, 0.7);
      }
      this.mouth(fx, 53 + hy, F);
      /* goteos oscuros que caen de los ojos */
      for (const d of this.drips) {
        const x = fx + d.side * 9 + d.dx;
        for (let k = 0; k < d.len; k++) this.dot(x, ey + 5 + k, k > d.len - 2 ? C.irisDk : C.lash, F, d.life * (k > d.len - 2 ? 1 : 0.85));
      }
      this.pose = real;
    }

    eye(ex, ey, side, blank, Z_) {
      const p = this.pose;
      const closed = this.blinking || p.open < 0.18;
      if (closed) {                                                   /* ojo cerrado: curva de pestañas */
        for (let x = -5; x <= 5; x++) this.dot(ex + x, ey + ri(Math.pow(x / 5, 2) * -1.4) + 1, C.lash, Z_);
        this.dot(ex + side * 6, ey, C.lash, Z_);
        return;
      }
      if (p.squint > 0.5) {                                           /* ojos apretados:  >  < */
        const d = side;
        this.line(ex - 4 * d, ey - 3, ex + 2 * d, ey, C.lash, Z_); this.line(ex + 2 * d, ey, ex - 4 * d, ey + 3, C.lash, Z_);
        this.line(ex - 4 * d, ey - 2, ex + 1 * d, ey, C.lash, Z_);
        return;
      }
      if (p.arc > 0.5) {                                              /* media luna: sonrisa con los ojos */
        for (let x = -5; x <= 5; x++) {
          const y = ey - ri(3 * (1 - Math.pow(x / 5, 2))) + 1;
          this.dot(ex + x, y, C.lash, Z_); this.dot(ex + x, y + 1, C.lash, Z_);
        }
        this.dot(ex + side * 6, ey - 1, C.lash, Z_);
        this.dot(ex, ey + 1, C.iris, Z_, 0.8);                         /* un brillo rojo asoma bajo el párpado */
        return;
      }
      /* ojo abierto: esclerótica clara en forma de almendra (o negra, en los momentos «demonio») */
      const demon = this.demonT > 0;
      const rw = 5 + (p.wide > 0.5 ? 1 : 0);
      const h = Math.max(3, Math.min(11, ri(3 + 5 * clamp01(p.open) * (1 - this.wound * 0.35) + 3 * p.wide)));
      const inside = new Set(), tops = [];
      for (let x = -rw; x <= rw; x++) {
        const u = x / (rw + 0.5), hh = (h / 2) * Math.sqrt(Math.max(0, 1 - u * u));
        const top = ri(ey - hh), bot = ri(ey + hh * 0.85);
        tops.push([ex + x, top, bot]);
        for (let y = top; y <= bot; y++) { this.dot(ex + x, y, demon ? C.lash : C.sclera, Z_); inside.add((ex + x) * 128 + y); }
      }
      const inEye = (x, y) => inside.has(x * 128 + y);
      if (demon) {                                                    /* solo un punto rojo que brilla */
        const cx = ex + ri(this.look.x), cy = ey;
        this.dot(cx, cy, C.iris, Z_); this.dot(cx + 1, cy, C.iris, Z_); this.dot(cx, cy - 1, C.irisHi, Z_);
      } else if (!blank) {
        /* iris rojo con pupila: se encoge con «pupil» (mirada fija) y mira hacia this.look. Apagado antes de la armadura */
        const s = Math.max(3, ri(3 + 2.2 * p.pupil)), irisC = this.dull ? C.irisDk : C.iris;
        const ix = ex + ri(this.look.x * 1.5) - Math.floor(s / 2), iy = ey + ri(this.look.y) - Math.floor(s / 2);
        for (let y = iy; y < iy + s; y++) for (let x = ix; x < ix + s; x++) if (inEye(x, y)) this.dot(x, y, y === iy ? C.irisDk : irisC, Z_);
        const pc = ix + (s >> 1);
        if (p.pupil < 0.5) { for (let y = iy; y < iy + s; y++) if (inEye(pc, y)) this.dot(pc, y, C.pupil, Z_); }
        else { this.dot(pc, iy + (s >> 1), C.pupil, Z_); if (s >= 4) this.dot(pc - 1, iy + (s >> 1), C.pupil, Z_); }
        if (inEye(ix, iy + 1) && !this.dull) this.dot(ix, iy + 1, C.irisHi, Z_);     /* brillo */
      }
      /* párpado: con rabia baja por el lado interior; con pena, por el exterior */
      const b = p.brow;
      for (const [x, top, bot] of tops) {
        const inner = side === -1 ? (x - (ex - rw)) / (2 * rw) : ((ex + rw) - x) / (2 * rw);   /* 1 = hacia la nariz */
        const cut = Math.abs(b) > 0.3 ? (b > 0 ? ri(b * inner * (h * 0.55)) : ri(-b * (1 - inner) * (h * 0.4))) : 0;
        for (let y = top; y < top + cut; y++) this.dot(x, y, C.skin, Z_);
        this.dot(x, top + cut - 1, C.lash, Z_);                          /* pestañas de arriba */
        if (Math.abs(x - ex) < rw - 1) this.dot(x, top + cut - 2, C.lash, Z_);
        this.dot(x, bot + 1, C.skinLn, Z_, 0.6);                         /* línea de abajo, suave */
      }
      this.dot(ex + side * (rw + 1), ey - ri(h / 2), C.lash, Z_);        /* pestaña alada */
      this.dot(ex + side * (rw + 2), ey - ri(h / 2) - 1, C.lash, Z_);
    }

    brows(fx, ey, Z_) {
      const p = this.pose, b = Math.max(-1, Math.min(1, p.brow + (this.talking ? 0.2 : 0)));
      const lift = ri(p.wide * 2);
      for (const side of [-1, 1]) {
        const outer = fx + side * 15, inner = fx + side * 4;
        const yo = ey - 8 - lift, yi = yo + ri(b * 3.5);
        this.line(outer, yo + (b < 0 ? 1 : 0), inner, yi, C.brow, Z_);
        this.line(outer - side, yo + 1 + (b < 0 ? 1 : 0), inner + side * 2, yi + 1, C.brow, Z_);
      }
    }

    tears(fx, ey, t, Z_) {
      const c = this.pose.cry;
      for (const side of [-1, 1]) {
        const x = fx + side * 14;
        for (let y = ey + 4; y < ey + 18; y++) this.dot(x, y, C.tear, Z_, 0.35 * c);                 /* surco húmedo */
        for (let i = 0; i < 2; i++) {
          const yy = ey + 4 + ((t * 18 + i * 8 + (side > 0 ? 4 : 0)) % 16);
          this.dot(x, yy, C.tearHi, Z_, c); this.dot(x, yy + 1, C.tear, Z_, c); this.dot(x - side, yy + 1, C.tear, Z_, c * 0.7); this.dot(x, yy + 2, C.tear, Z_, c);
        }
      }
    }

    mouth(fx, my, Z_) {
      const p = this.pose;
      const talk = this.talking ? Math.abs(Math.sin(this.talkPhase * 15)) : 0;
      const pant = this.wound > 0 ? this.wound * 0.45 * (0.5 + 0.5 * Math.sin(this.time * 5)) : 0;   /* jadeo */
      const s = clamp01(p.smile), o = clamp01(Math.max(p.mouth, talk * 0.8, pant));
      if (s > 0.62) {
        /* sonrisa ancha: dientes blancos, interior oscuro y comisuras marcadas */
        const hw = ri(5 + 7 * s);
        for (let x = -hw; x <= hw; x++) {
          const u = x / hw, top = my - 1 - ri(3.5 * s * u * u), bot = my + ri((2 + 3 * s + o * 3) * (1 - u * u));
          for (let y = top; y <= bot; y++) {
            let c = C.mouthIn;
            if (y === top || y === top + 1) c = (x + hw) % 3 === 0 ? C.toothSh : C.tooth;                 /* dientes de arriba */
            else if (y === bot && bot - top >= 3) c = (x + hw) % 3 === 0 ? C.toothSh : C.tooth;           /* y de abajo */
            this.dot(fx + x, y, c, Z_);
          }
          this.dot(fx + x, top - 1, C.lip, Z_);
        }
        for (const sd of [-1, 1]) { this.dot(fx + sd * (hw + 1), my - ri(3.5 * s) - 2, C.lip, Z_); this.dot(fx + sd * (hw + 2), my - ri(3.5 * s) - 3, C.skinSh, Z_); }
        return;
      }
      if (p.brow > 0.6 && s > 0.3) {
        /* mueca de rabia: dientes apretados */
        const hw = 6;
        for (let x = -hw; x <= hw; x++) for (let y = my - 1; y <= my + 2; y++) {
          const edge = y === my - 1 || y === my + 2 || Math.abs(x) === hw;
          this.dot(fx + x, y + (Math.abs(x) === hw ? 1 : 0), edge ? C.lip : (x % 2 === 0 ? C.toothSh : C.tooth), Z_);
        }
        return;
      }
      if (o > 0.25) {
        /* boca abierta: interior oscuro con lengua */
        const rw = 3 + ri(o * 2), rh = 1 + ri(o * 4.5), cy = my + 1;
        for (let y = -rh; y <= rh; y++) for (let x = -rw; x <= rw; x++) {
          const d = (x * x) / (rw * rw) + (y * y) / (rh * rh);
          if (d <= 1) this.dot(fx + x, cy + y, d > 0.7 ? C.lip : (y > rh * 0.3 && rh > 2 ? C.tongue : C.mouthIn), Z_);
        }
        return;
      }
      /* boca cerrada: una línea que sube con la sonrisa y baja con la pena */
      const hw = 4 + ri(s * 3), curve = s * 3.2 - (p.brow < -0.3 ? 1.6 : 0);
      for (let x = -hw; x <= hw; x++) this.dot(fx + x, my - ri(curve * Math.pow(x / hw, 2)) + ri(curve * 0.3), C.lip, Z_);
    }

    /* ---------- Trozo de casco que se queda pegado al romperse (lado derecho de la cabeza) ---------- */
    remnantZones(hx, hy) {
      const pts = [[52, 6], [64, 8], [71, 16], [73, 28], [70, 34], [66, 30], [67, 24], [61, 22], [62, 16], [56, 15], [54, 11]];
      this.poly(pts, Z.HELMET, hx, hy);
    }
    remnantDetails(hx, hy, t) {
      const HM = [Z.HELMET];
      for (let y = 7; y < 14; y++) this.dot(53 + hx, y + hy, C.redDim, HM, 0.6 + 0.4 * Math.sin(t * 3));   /* resto de la cresta */
      this.polyline([[58 + hx, 9 + hy], [63 + hx, 15 + hy], [66 + hx, 14 + hy], [70 + hx, 24 + hy]], C.crack, HM);
      if (Math.random() < 0.04) this.parts.push({ x: 66 + hx, y: 30 + hy, vx: (Math.random() - 0.5) * 30, vy: 10 + Math.random() * 20, s: 1, life: 0, max: 0.4, col: PAL.spark });
    }

    /* ---------- Herida y cansancio: aparecen poco a poco según this.wound ---------- */
    woundDetails(hx, hy, t) {
      const w = this.wound, fx = 48 + hx, ey = 41 + hy, F = [Z.FACE];
      const bruise = hex('#5b3a6e');
      /* arañazos (con sangre azul) */
      this.line(fx - 14, ey + 4, fx - 10, ey + 9, C.bloodDk, F, 0.85);
      if (w >= 0.5) { this.line(fx + 6, 26 + hy, fx + 10, 30 + hy, C.bloodDk, F, 0.8); this.line(fx + 7, 26 + hy, fx + 11, 30 + hy, C.blood, F, 0.4); }
      if (w >= 0.75) this.line(fx + 3, ey + 13, fx + 7, ey + 11, C.bloodDk, F, 0.8);
      /* moratón bajo el ojo derecho */
      if (w >= 0.5) for (let y = -1; y <= 2; y++) for (let x = -4; x <= 4; x++) if (x * x / 16 + y * y / 4 <= 1) this.dot(fx + 9 + x, ey + 6 + y, bruise, F, 0.45);
      /* gota de sudor que resbala por la sien */
      if (w >= 0.25) {
        const sy = 30 + hy + ((t * 9) % 20);
        this.dot(fx - 15, sy, C.tearHi, F); this.dot(fx - 15, sy + 1, C.tear, F); this.dot(fx - 16, sy + 1, C.tear, F, 0.7);
      }
      /* pelo despeinado: mechones que se salen del contorno */
      const flyaways = [[[31, 11], [28, 8], [28, 5]], [[45, 8], [43, 5], [45, 3]], [[62, 9], [65, 7], [65, 4]], [[71, 23], [74, 21], [76, 22]], [[24, 42], [21, 44], [21, 47]]];
      flyaways.slice(0, 2 + ri(w * 3)).forEach((pts) => this.polyline(pts.map(([a, b]) => [a + hx, b + hy]), HAIR[2], null));
      /* rotos en la chaqueta */
      const J = [Z.JACKET];
      for (let y = 80; y < 88; y++) for (let x = 24 + (y - 80) * 0.4; x < 30 + (y - 80) * 0.2; x++) this.dot(x, y, hex('#030304'), J);
      if (w >= 0.75 && this.plateOn[1]) { for (let y = 70; y < 76; y++) for (let x = 70; x < 75; x++) this.dot(x, y, hex('#030304'), [Z.PLATE_R]); this.line(71, 71, 74, 75, C.iris, [Z.PLATE_R]); }
    }
    /* Sangre azul: una mancha y un reguero que baja poco a poco, con una gota que resbala */
    bloodDetails(hx, hy, t) {
      for (const b of this.blood) {
        const x = b.rel === 'head' ? b.x + hx : b.x, y = b.rel === 'head' ? b.y + hy : b.y;
        this.dot(x, y, C.bloodDk, ALL_Z); this.dot(x + 1, y, C.blood, ALL_Z); this.dot(x, y - 1, C.blood, ALL_Z, 0.8);
        for (let k = 1; k < b.len; k++) this.dot(x + (k > b.max * 0.6 ? 1 : 0), y + k, k < 3 ? C.blood : C.bloodDk, ALL_Z, 0.9);
        const dy = (t * 10 + b.ph) % (b.len + 5);
        if (dy < b.len) this.dot(x + (dy > b.max * 0.6 ? 1 : 0), y + dy, C.bloodHi, ALL_Z);
      }
    }
    /* Cables al aire: rojo, cian y amarillo, que se balancean y echan chispas */
    cableDetails(hx, hy, t) {
      const cols = [C.iris, C.cyan, C.cable];
      for (const c of this.cables) {
        const x = c.rel === 'head' ? c.x + hx : c.x, y = c.rel === 'head' ? c.y + hy : c.y;
        for (let k = 0; k < 3; k++) {
          let cx = x + k - 1;
          for (let j = 0; j < c.len; j++) { cx += ri(Math.sin(t * 2 + j * 0.9 + k * 2) * 0.6); this.dot(cx, y + j, cols[k], null); }
        }
        if (Math.random() < 0.06) this.parts.push({ x, y: y + c.len, vx: (Math.random() - 0.5) * 40, vy: -10 - Math.random() * 30, s: 1, life: 0, max: 0.35, col: Math.random() < 0.5 ? PAL.spark : '#ffe28a' });
      }
    }
    /* Grieta digital que atraviesa su cara (brilla y parpadea) */
    faceCrackDetails(hx, hy, t) {
      const pts = FACE_CRACK.map(([x, y]) => [x + hx, y + hy]), fl = 0.6 + 0.4 * Math.sin(t * 13);
      this.polyline(pts.map(([x, y]) => [x + 1, y + 1]), C.crack, ALL_Z);
      this.polyline(pts, C.glow, ALL_Z, fl);
    }
    /* La cara se pixela: bloques de 2x2 o 3x3 con el color de su centro */
    pixelate(hx, hy) {
      const b = this.pixelK < 0.6 ? 2 : 3, L = this.L, px = this.px;
      const x0 = Math.max(0, 16 + hx), x1 = Math.min(W, 80 + hx), y0 = Math.max(0, hy), y1 = Math.min(H, 66 + hy);
      for (let by = y0; by < y1; by += b) for (let bx = x0; bx < x1; bx += b) {
        const si = Math.min(H - 1, by + (b >> 1)) * W + Math.min(W - 1, bx + (b >> 1));
        if (!HEAD_Z.has(L[si])) continue;
        const so = si * 4, r = px[so], g = px[so + 1], bl = px[so + 2];
        for (let y = by; y < Math.min(y1, by + b); y++) for (let x = bx; x < Math.min(x1, bx + b); x++) {
          const i = y * W + x;
          if (HEAD_Z.has(L[i])) { const o = i * 4; px[o] = r; px[o + 1] = g; px[o + 2] = bl; }
        }
      }
    }

    /* ---------- Casco: visor en T con cresta roja; los agujeros dejan ver la cara ---------- */
    helmetZones(hx, hy) {
      const skip = (x, y) => this.inHole(x, y);
      const cx = 48 + hx;
      this.rows(cx, 6 + hy, 62 + hy, (y) => {
        const k = (y - (6 + hy)) / 56, pp = k * 2 - 1;
        let hw = 24 * Math.sqrt(Math.max(0, 1 - pp * pp));
        if (y - hy > 50) hw += (62 + hy - y) * 0.45;
        return hw;
      }, Z.HELMET, skip);
      /* visor en T: barra a la altura de los ojos + vástago hacia la barbilla */
      for (let y = Math.max(0, 37 + hy); y < Math.min(H, 45 + hy); y++) for (let x = cx - 17; x <= cx + 17; x++) if (!skip(x, y) && x >= 0 && x < W) this.L[y * W + x] = Z.VISOR;
      for (let y = Math.max(0, 45 + hy); y < Math.min(H, 58 + hy); y++) for (let x = cx - 4; x <= cx + 4; x++) if (!skip(x, y) && x >= 0 && x < W) this.L[y * W + x] = Z.VISOR;
    }
    helmetDetails(hx, hy, t) {
      const cx = 48 + hx, HM = [Z.HELMET], V = [Z.VISOR];
      /* cresta roja central (encima y debajo del visor) */
      const glow = 0.6 + 0.4 * Math.sin(t * 3);
      for (let y = 7 + hy; y < 37 + hy; y++) for (let x = cx - 1; x <= cx + 1; x++) this.dot(x, y, x === cx - 1 ? C.red : C.redDim, HM, glow);
      for (let y = 58 + hy; y < 62 + hy; y++) for (let x = cx - 1; x <= cx + 1; x++) this.dot(x, y, C.redDim, HM, glow);
      /* placas y remaches */
      this.polyline([[cx - 21, 30 + hy], [cx - 18, 36 + hy]], C.metalLn, HM); this.polyline([[cx + 21, 30 + hy], [cx + 18, 36 + hy]], C.metalLn, HM);
      for (const dx of [-20, 20]) { this.dot(cx + dx, 44 + hy, C.rivet, HM); this.dot(cx + dx, 48 + hy, C.rivet, HM); }
      /* ojos rojos a través de la rendija: reaccionan al ánimo (apagados mientras el casco llega; parpadean tras el impacto) */
      const off = this.dull || (this.visorFlickerT > 0 && Math.random() < 0.45);
      const eg = off ? 0 : clamp01(0.55 + 0.45 * Math.sin(t * 5) + (this.attacking ? 0.3 : 0));
      const eh = this.blinking ? 1 : Math.max(1, Math.min(5, ri(1 + 3 * clamp01(this.pose.open) + this.pose.wide * 1.5 - this.pose.arc * 2)));
      if (eg > 0) for (const side of [-1, 1]) {
        const x0 = cx + (side < 0 ? -13 : 5);
        for (let y = 41 + hy - (eh >> 1); y < 41 + hy - (eh >> 1) + eh; y++) for (let x = x0; x < x0 + 8; x++) this.dot(x, y, this.blinking ? C.redDim : C.iris, V, eg);
      }
      if (this.pose.smile > 0.7 && !this.blinking && !off) for (let x = -2; x <= 2; x += 2) this.dot(cx + x, 52 + hy, C.tooth, V);   /* se adivina la sonrisa */
      /* grietas: oscuras sobre el metal, claras sobre el cristal del visor */
      for (const ln of this.crackLines) this.polyline(ln.map((q) => [q.x + hx, q.y + hy]), C.crack, HM, this.crackA);
      for (const vl of this.visorLines) {
        const pts = vl.pts.map(([x, y]) => [x + hx, y + hy]);
        this.polyline(pts, C.crack, HM, vl.k);
        this.polyline(pts, this.visorFlickerT > 1.2 ? C.glow : C.zipHi, V, vl.k * 0.85);
      }
      /* regeneración: una línea de luz cian recorre el casco de arriba abajo */
      if (this.repairK >= 0) {
        const y = 6 + hy + ri(this.repairK * 56);
        this.line(cx - 24, y, cx + 24, y, C.glow, [Z.HELMET, Z.VISOR], 0.85);
        this.line(cx - 24, y - 1, cx + 24, y - 1, C.cyan, [Z.HELMET, Z.VISOR], 0.4);
      }
    }

    /* ---------- Brazos al atacar: suben con la manga y la mano robótica sale de la muñeca ----------
       Puñetazos: puño cerrado. Blásters o gestos amables: mano abierta con el núcleo de la palma. */
    handPos(t, side) {
      const rise = side === 1 && this.armHang ? this.handK * 0.2 : this.handK, bob = Math.sin(t * 5 + (side > 0 ? 1 : 0)) * 1.5;
      return { x: 48 + side * 33 + ri(Math.sin(t * 4 + side) * 1.5), y: ri(112 - rise * 44 + bob) };
    }
    handZones(t) {
      if (this.handK < 0.03) return;
      const open = this.hands === 'open';
      for (const side of [-1, 1]) {
        if (side === -1 && this.armLost) continue;
        const { x, y } = this.handPos(t, side), wy = y + 10;
        /* manga: del borde de abajo hasta la muñeca */
        const bx = 48 + side * 38, bw = 7, ww = 6;
        this.poly([[bx - bw, 104], [bx + bw, 104], [x + ww, wy], [x - ww, wy]], side < 0 ? Z.SLEEVE_L : Z.SLEEVE_R, 0, 0);
        if (this.gone[side] > 0) continue;                                   /* la mano está volando: solo la muñeca vacía */
        const id = side < 0 ? Z.HAND_L : Z.HAND_R;
        this.poly([[x - 5, wy - 2], [x + 5, wy - 2], [x + 5, wy + 2], [x - 5, wy + 2]], id, 0, 0);          /* muñeca mecánica */
        if (open) {
          this.poly([[x - 8, y - 5], [x + 8, y - 5], [x + 7, y + 8], [x - 7, y + 8]], id, 0, 0);            /* palma */
          for (let i = 0; i < 4; i++) {                                                                       /* dedos abiertos */
            const fx = x - 7 + i * 5, lean = (i - 1.5) * 1.6;
            this.poly([[fx, y - 5], [fx + 3, y - 5], [fx + 3 + lean, y - 15], [fx + lean, y - 15]], id, 0, 0);
          }
          this.poly([[x - side * 8, y + 2], [x - side * 15, y - 3], [x - side * 16, y + 1], [x - side * 8, y + 7]], id, 0, 0);   /* pulgar */
        } else {
          this.poly([[x - 9, y - 7], [x + 9, y - 7], [x + 10, y + 9], [x - 10, y + 9]], id, 0, 0);          /* puño */
          for (let i = 0; i < 4; i++) {
            const a = x - 10 + i * 5;
            this.poly([[a, y - 8], [a + 1, y - 11], [a + 4, y - 11], [a + 5, y - 8], [a + 5, y - 6], [a, y - 6]], id, 0, 0);
          }
          this.poly([[x - side * 10, y - 2], [x - side * 14, y], [x - side * 14, y + 6], [x - side * 10, y + 7]], id, 0, 0);
        }
      }
    }
    handDetails(t) {
      if (this.handK < 0.03) return;
      const open = this.hands === 'open';
      for (const side of [-1, 1]) {
        if (side === -1 && this.armLost) continue;
        const { x, y } = this.handPos(t, side), wy = y + 10, S = [side < 0 ? Z.SLEEVE_L : Z.SLEEVE_R], Zh = [side < 0 ? Z.HAND_L : Z.HAND_R];
        /* puño de la manga: franja cian, como las hombreras */
        this.line(x - 6, wy + 3, x + 6, wy + 3, C.cyan, S); this.line(x - 6, wy + 4, x + 6, wy + 4, C.seam, S);
        if (this.gone[side] > 0) {                                           /* muñeca vacía: brilla por dentro */
          for (let dx = -3; dx <= 3; dx++) this.dot(x + dx, wy + 2, C.iris, S, 0.6 + 0.4 * Math.sin(t * 20));
          continue;
        }
        if (open) {
          for (let i = 0; i < 4; i++) { const fx = x - 7 + i * 5 + ri((i - 1.5) * 0.8); this.line(fx + 1, y - 9, fx + 2, y - 9, C.metalLn, Zh); }   /* nudillos */
          const k = 0.5 + 0.5 * Math.abs(Math.sin(t * 12)), r = 3 + ri(k);
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) this.dot(x + dx, y + 1 + dy, C.iris, Zh, 0.6 + 0.4 * k);
          this.dot(x, y, C.irisHi, Zh); this.dot(x - 1, y + 1, C.irisHi, Zh, k);
        } else {
          for (let i = 1; i < 4; i++) this.line(x - 10 + i * 5, y - 10, x - 10 + i * 5, y - 4, C.metalLn, Zh);
          this.line(x - 9, y - 4, x + 9, y - 4, C.metalLn, Zh);
          for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 1; dx++) this.dot(x + dx, y + 2 + dy, C.iris, Zh, 0.85);
        }
        this.line(x - 4, wy, x + 4, wy, C.metalLn, Zh);
      }
    }

    /* =================== 4) GLITCH =================== */
    applyGlitch(presence) {
      const g = this.g, gl = this.glitchLevel * presence;
      g.clearRect(0, 0, W, H);
      if (gl < 0.03) { g.drawImage(this.buf, 0, 0); if (presence > 0) { g.fillStyle = this.vignette; g.fillRect(0, 0, W, H); } return; }

      const dx = Math.max(1, ri(1 + gl * 5));
      this.tintInto(this.rBuf, '#ff2b2b');
      this.tintInto(this.cBuf, '#050000');
      g.drawImage(this.buf, 0, 0);
      g.globalAlpha = 0.45 * gl;                          /* sombra desplazada: ensucia en vez de iluminar */
      g.drawImage(this.cBuf, dx, 1);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.26 * gl;                          /* borde rojo desplazado (aberración cromática) */
      g.drawImage(this.rBuf, -dx, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';

      for (const s of this.strips) if (s.dx) g.drawImage(this.buf, 0, s.y, W, s.h, s.dx, s.y, W, s.h);
      /* bloques corruptos: trozos de la imagen copiados en otro sitio */
      const nBlocks = Math.random() < gl ? 1 + ri(Math.random() * gl * 4) : 0;
      for (let i = 0; i < nBlocks; i++) {
        const bw = 4 + ri(Math.random() * 12), bh = 2 + ri(Math.random() * 8);
        const sx = ri(Math.random() * (W - bw)), sy = ri(Math.random() * (H - bh));
        g.drawImage(this.buf, sx, sy, bw, bh, sx + ri((Math.random() - 0.5) * 20), sy + ri((Math.random() - 0.5) * 6), bw, bh);
      }

      if (gl > 0.3) {
        const rollY = Math.floor((this.time * 60) % (H + 16)) - 8;
        g.globalAlpha = 0.35 * gl; g.fillStyle = '#000';
        g.fillRect(0, rollY, W, 5);
        for (let i = 0; i < 10; i++) {
          g.fillStyle = Math.random() < 0.5 ? '#fff' : PAL.iris;
          g.globalAlpha = 0.4 * gl;
          g.fillRect(Math.floor(Math.random() * W), rollY + Math.floor(Math.random() * 5), 1, 1);
        }
        g.globalAlpha = 1;
      }
      if (Math.random() < gl * 0.5) {
        const bw = 6 + Math.round(Math.random() * 18), bh = 1 + Math.round(Math.random() * 4);
        g.globalAlpha = 0.55 + 0.35 * Math.random();
        g.fillStyle = Math.random() < 0.6 ? PAL.iris : '#000';
        g.fillRect(Math.round(Math.random() * (W - bw)), Math.round(Math.random() * H), bw, bh);
        g.globalAlpha = 1;
      }
      const staticN = Math.round(gl * 36);
      for (let i = 0; i < staticN; i++) {
        g.globalAlpha = 0.5 + 0.5 * Math.random();
        g.fillStyle = Math.random() < 0.5 ? '#fff' : '#000';
        g.fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * H), 1, 1);
      }
      g.globalAlpha = 1;
      if (presence >= 0.99) {                                /* destellos a pantalla completa, solo si está entera */
        if (Math.random() < gl * gl * 0.12) { g.globalAlpha = 0.7; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
        if (Math.random() < gl * gl * 0.06) {
          g.globalCompositeOperation = 'difference'; g.fillStyle = '#fff';
          g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
        }
      }
      g.globalAlpha = 0.16; g.fillStyle = '#000';
      for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);
      g.globalAlpha = 1;
      g.fillStyle = this.vignette; g.fillRect(0, 0, W, H);   /* los bordes se hunden en negro */
      if (this.hurtFlash > 0) { g.globalAlpha = this.hurtFlash * 0.45; g.fillStyle = '#ff3131'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    }

    tintInto(dst, color) {
      const d = dst.getContext('2d');
      d.clearRect(0, 0, W, H);
      d.drawImage(this.buf, 0, 0);
      d.globalCompositeOperation = 'source-atop';
      d.fillStyle = color;
      d.fillRect(0, 0, W, H);
      d.globalCompositeOperation = 'source-over';
    }
  }

  window.Boss = Boss;
})();
