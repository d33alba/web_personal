/* ============================================================
   boss.js — Sprite del jefe: DÉBORA ALPHA, una versión temprana e
   inestable de tu IA. Pixel-art de sprite de batalla (64x64 reales,
   escalados en bloques duros con image-rendering:pixelated), con la
   idea de un enemigo de RPG expresivo: cara con cejas, párpados,
   iris rojos que se dilatan, sonrisa macabra con dientes, lágrimas,
   y manos robóticas flotantes cuando es ELLA la que ataca.

   Cómo está montado, de fuera hacia dentro:
   1. El canvas real es pequeño (G x G px). Todo se dibuja con fillRect
      de números enteros — eso ES el pixel art.
   2. Un sistema de ESTADOS DE ÁNIMO (MOODS, más abajo) define la pose
      objetivo de la cara: sonrisa, apertura de ojos, ceja, tamaño de
      pupila, llanto, temblor... y la pose actual se acerca a ella
      suavemente. Así los cambios de expresión no son cortes secos.
      Fuera de combate cambia sola de ánimo de vez en cuando ("vida
      propia"); en combate lo dirigen attack()/hurt()/spare()/die().
   3. render() dibuja el personaje LIMPIO en this.buf y applyGlitch() lo
      destroza encima (aberración cromática roja, franjas desplazadas,
      estática, inversión, banda que rueda...), modulado por
      «glitchLevel».
   4. El CASCO (visor en T, franja roja) se pone con helmetOn() al empezar
      la batalla y se rompe con los golpes (hurt()) hasta enseñar la cara.

   API pública para secret.js: setTalking, helmetOn, hurt, attack,
   attackEnd, setMood, transform, spare, die.
   ============================================================ */
(function () {
  'use strict';

  const G = 64;

  const PAL = {
    skin: '#ecd8ca', skinSh: '#c9a893', skinHi: '#f7e8de',
    hairA: '#a8e4ff', hairB: '#4a9bd6', hairDark: '#2a5c92', hairDeep: '#1b3d66',
    suit: '#131319', suitHi: '#1e222c',
    chest: '#5fb7dd', chestDark: '#347ea3',
    sclera: '#140608', iris: '#ff2b2b', irisHi: '#ffd6d6', irisDim: '#6e0d0d',
    lash: '#0b0708', brow: '#24507e',
    mouthDark: '#2a0a10', mouthIn: '#3d060c', tongue: '#b3202e',
    tooth: '#f6f1ea', toothSh: '#cdc3ba',
    tear: '#bfe3ff', tearHi: '#eaf6ff',
    glitchA: '#ff2b2b',
    helmetHi: '#454b57', helmet: '#2c2f37', helmetLo: '#1a1c21',
    crest: '#e02323', crestDim: '#7a0f0f', visor: '#060505',
    crack: '#0a0a0a', debris: '#4a4e57', spark: '#c7ccd4',
    metal: '#3a3f4a', metalHi: '#4d5361', metalLo: '#22262e', metalDk: '#1c1e24',
  };

  /* ---------- Estados de ánimo: pose objetivo de la cara ----------
     smile   0..1   sonrisa (1 = sonrisa macabra ancha con dientes)
     open    0..1   apertura de los párpados
     wide    0..1   ojos desorbitados (más alto, se ve el hueco negro entero)
     brow   -1..1   ceja: + rabia (interior baja), - pena (interior sube)
     mouth   0..1   boca abierta sin sonreír (sorpresa, grito)
     pupil   0..1   tamaño del iris rojo (bajo = mirada de psicópata)
     cry     0..1   lágrimas resbalando
     shake   0..1   temblor de la cabeza
     tilt          ladeo objetivo de cabeza (radianes)                    */
  const MOODS = {
    idle:  { smile: 0.04, open: 1,   wide: 0,   brow: 0,    mouth: 0,   pupil: 1,    cry: 0,   shake: 0,   tilt: 0 },
    smirk: { smile: 0.5,  open: 0.8, wide: 0,   brow: 0.35, mouth: 0,   pupil: 0.8,  cry: 0,   shake: 0,   tilt: 0.07 },
    grin:  { smile: 1,    open: 1,   wide: 0.6, brow: 0.5,  mouth: 0,   pupil: 0.45, cry: 0,   shake: 0.25, tilt: -0.1 },
    rage:  { smile: 0.55, open: 0.7, wide: 0,   brow: 1,    mouth: 0.15, pupil: 0.7, cry: 0,   shake: 0.85, tilt: 0 },
    cry:   { smile: 0.1,  open: 0.65, wide: 0,  brow: -0.8, mouth: 0.1, pupil: 1,    cry: 1,   shake: 0.1, tilt: 0.05 },
    shock: { smile: 0,    open: 1,   wide: 1,   brow: -0.45, mouth: 0.85, pupil: 0.3, cry: 0,   shake: 0.3, tilt: 0 },
    hurt:  { smile: 0,    open: 0.3, wide: 0,   brow: 0.9,  mouth: 0.3, pupil: 1,    cry: 0,   shake: 1,   tilt: 0 },
    stare: { smile: 0,    open: 1,   wide: 0.7, brow: 0.15, mouth: 0,   pupil: 0.25, cry: 0,   shake: 0,   tilt: -0.04 },
    soft:  { smile: 0.4,  open: 0.7, wide: 0,   brow: -0.55, mouth: 0,  pupil: 1,    cry: 0.6, shake: 0,   tilt: 0.06 },
  };
  const MOOD_KEYS = Object.keys(MOODS.idle);

  /* Qué cara pone cuando el patrón de ataque de ese turno es... */
  const ATTACK_MOOD = { tears: 'cry', punches: 'rage', handBlasters: 'grin', default: 'grin' };

  function ri(v) { return Math.round(v); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  class Boss {
    constructor(canvas) {
      this.canvas = canvas;
      canvas.width = G; canvas.height = G;
      this.W = G; this.H = G;
      this.g = canvas.getContext('2d');
      this.g.imageSmoothingEnabled = false;

      this.buf = document.createElement('canvas');
      this.buf.width = this.W; this.buf.height = this.H;
      this.bg = this.buf.getContext('2d');
      this.bg.imageSmoothingEnabled = false;

      this.rBuf = document.createElement('canvas'); this.rBuf.width = this.W; this.rBuf.height = this.H;
      this.cBuf = document.createElement('canvas'); this.cBuf.width = this.W; this.cBuf.height = this.H;
      this.rBuf.getContext('2d').imageSmoothingEnabled = false;
      this.cBuf.getContext('2d').imageSmoothingEnabled = false;

      this.time = 0; this._last = 0;
      this.talking = false; this.talkPhase = 0;
      this.glitchBase = 0.18;
      this.glitchLevel = this.glitchBase;
      this.burstT = 0; this.burstI = 0;
      this.corrupted = false;
      this.stabilizing = false;
      this.hurtFlash = 0;
      this.deadT = -1;
      this.strips = []; this._stripT = 0;
      this.parts = [];
      this.blankEyesT = 0;

      /* Expresión */
      this.pose = Object.assign({}, MOODS.idle);
      this.moodName = 'idle'; this.moodHold = 0;
      this._moodT = 3 + Math.random() * 3;   /* cuenta atrás hasta un cambio de ánimo espontáneo */
      this.look = { x: 0, y: 0, tx: 0, ty: 0, t: 2 };  /* hacia dónde miran los iris */
      this._blinkT = 2 + Math.random() * 3; this.blinking = false; this._blinkDur = 0;
      this.tilt = 0; this._tiltTarget = 0;
      this._ghostT = 0;

      /* Ataque: manos robóticas flotantes que suben desde abajo */
      this.attacking = null; this.attackMood = 'grin';
      this.handK = 0;

      /* Casco */
      this.hasHelmet = false;
      this.helmetStage = 0; this.helmetHits = 0;
      this.crackHoles = []; this.crackLines = [];

      this._raf = requestAnimationFrame(this.loop.bind(this));
    }

    /* ---------- API que usa secret.js ---------- */
    setTalking(on) { this.talking = on; }

    setMood(name, hold) {
      if (!MOODS[name]) return;
      this.moodName = name; this.moodHold = hold || 0;
    }
    baseMood() {
      if (this.stabilizing) return 'soft';
      if (this.attacking) return this.attackMood;
      return (this.corrupted && !this.hasHelmet) ? 'smirk' : 'idle';
    }

    /* Empieza el turno de ataque de ELLA: pone su cara de ataque y saca las manos */
    attack(pattern) {
      this.attacking = pattern || 'default';
      this.attackMood = ATTACK_MOOD[pattern] || ATTACK_MOOD.default;
      this.setMood(this.attackMood, 0);
      this.glitchBurst(0.6, 0.35);
      this.spawnParts(8, PAL.glitchA);
    }
    attackEnd() {
      this.attacking = null;
      this.setMood(this.baseMood(), 0);
    }

    helmetOn() {
      this.hasHelmet = true;
      this.helmetStage = 0; this.helmetHits = 0;
      this.crackHoles = []; this.crackLines = [];
      this.glitchBurst(1.1, 0.5);
      this.spawnParts(18, PAL.spark);
    }

    hurt() {
      this.glitchBurst(0.9, 0.4); this.hurtFlash = 1; this.spawnParts(12, PAL.glitchA);
      this._tiltTarget += (Math.random() - 0.5) * 0.5;
      this.setMood('hurt', 0.55);
      if (this.hasHelmet && this.helmetStage < 4) {
        this.helmetHits++;
        const need = [1, 1, 1, 2][this.helmetStage] || 2;   /* 5 golpes en total para romperlo del todo */
        if (this.helmetHits >= need) { this.helmetHits = 0; this.helmetStage++; this.crackHelmet(this.helmetStage); }
      }
    }

    crackHelmet(stage) {
      const spots = [
        { x: 40, y: 9, w: 9, h: 8 },     // 1: sien
        { x: 13, y: 24, w: 9, h: 9 },    // 2: mejilla izquierda
        { x: 36, y: 31, w: 12, h: 9 },   // 3: mandíbula derecha
      ];
      const spot = spots[stage - 1];
      if (spot) {
        this.crackHoles.push(spot);
        let x = spot.x + spot.w / 2, y = spot.y + spot.h / 2;
        const line = [{ x, y }];
        for (let i = 0; i < 6; i++) { x += (Math.random() - 0.5) * 9; y += (Math.random() - 0.5) * 9; line.push({ x, y }); }
        this.crackLines.push(line);
        this.spawnParts(16, PAL.spark);
        this.glitchBurst(1.3, 0.5);
      }
      if (stage >= 4) {
        this.hasHelmet = false;
        this.corrupted = true;
        this.setMood('shock', 0.9);       /* al quedar al descubierto, un instante de sorpresa... */
        this.glitchBurst(1.9, 0.9);
        this.spawnParts(34, PAL.iris);
      }
    }

    transform() {
      if (this.corrupted) return;
      this.corrupted = true;
      this.glitchBurst(1.6, 0.9);
      this.spawnParts(22, PAL.iris);
    }
    spare() { this.stabilizing = true; this.attacking = null; this.setMood('soft', 0); }
    die() {
      this.deadT = 0; this.attacking = null;
      this.setMood('shock', 0);
      this.glitchBurst(1.9, 1.4);
      this.spawnParts(34, PAL.glitchA);
    }
    glitchBurst(intensity, dur) { this.burstI = Math.max(this.burstI, intensity); this.burstT = Math.max(this.burstT, dur); }
    spawnParts(n, col) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 10 + Math.random() * 40;
        this.parts.push({
          x: this.W / 2 + (Math.random() - 0.5) * 26, y: this.H * 0.4 + (Math.random() - 0.5) * 30,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 5, s: 1 + Math.random() * 2,
          life: 0, max: 0.4 + Math.random() * 0.6, col,
        });
      }
    }

    /* ---------- Bucle ---------- */
    loop(now) {
      const dt = Math.min(0.05, this._last ? (now - this._last) / 1000 : 0.016);
      this._last = now; this.time += dt;

      if (this.talking) this.talkPhase += dt;
      if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.6);
      if (this.burstT > 0) { this.burstT -= dt; this.burstI *= Math.pow(0.02, dt); } else this.burstI = 0;
      if (this.deadT >= 0) this.deadT += dt;

      const targetBase = this.stabilizing ? 0.05 : (this.corrupted ? 0.55 : this.glitchBase);
      const attackBoost = this.attacking ? 0.12 : 0;
      const target = Math.min(1, targetBase + attackBoost + this.burstI);
      this.glitchLevel += (target - this.glitchLevel) * Math.min(1, dt * 5);

      this._stripT -= dt;
      if (this._stripT <= 0) { this.rebuildStrips(); this._stripT = 0.07 + Math.random() * 0.12; }

      this.blankEyesT -= dt;
      if (this.blankEyesT <= 0 && Math.random() < this.glitchLevel * 0.01) this.blankEyesT = 0.05 + Math.random() * 0.07;

      /* ---- Estado de ánimo: la cara se acerca a la pose objetivo ---- */
      if (this.moodHold > 0) {
        this.moodHold -= dt;
        if (this.moodHold <= 0) this.setMood(this.baseMood(), 0);
      } else if (!this.attacking && !this.stabilizing && this.deadT < 0) {
        this._moodT -= dt;
        if (this._moodT <= 0) {                  /* vida propia: cambia de cara sin que nadie se lo pida */
          const pool = this.hasHelmet ? ['stare', 'idle', 'smirk'] : ['smirk', 'stare', 'grin', 'idle', 'soft'];
          this.setMood(pool[Math.floor(Math.random() * pool.length)], 1.1 + Math.random() * 1.6);
          this._moodT = 3 + Math.random() * 4;
        }
      }
      const tgt = MOODS[this.moodName], k = Math.min(1, dt * 9);
      for (const key of MOOD_KEYS) this.pose[key] += (tgt[key] - this.pose[key]) * k;

      /* iris: mira a un lado de vez en cuando, o clava la vista al frente cuando ataca */
      this.look.t -= dt;
      if (this.look.t <= 0) {
        this.look.t = 1.2 + Math.random() * 2.5;
        this.look.tx = this.attacking ? 0 : Math.round((Math.random() - 0.5) * 3);
        this.look.ty = this.attacking ? 0 : Math.round((Math.random() - 0.5) * 1.4);
      }
      this.look.x += (this.look.tx - this.look.x) * Math.min(1, dt * 10);
      this.look.y += (this.look.ty - this.look.y) * Math.min(1, dt * 10);

      /* parpadeo */
      this._blinkT -= dt;
      if (this._blinkT <= 0 && !this.blinking) { this.blinking = true; this._blinkDur = 0.1; this._blinkT = 2.4 + Math.random() * 3.4; }
      if (this.blinking) { this._blinkDur -= dt; if (this._blinkDur <= 0) this.blinking = false; }

      /* cabeza: ladeo hacia el del ánimo actual + balanceo + tics */
      const idleTilt = Math.sin(this.time * (this.corrupted ? 0.9 : 0.4)) * (this.corrupted ? 0.05 : 0.03);
      this._tiltTarget += (idleTilt - this._tiltTarget) * Math.min(1, dt * 0.6);
      this.tilt += ((this._tiltTarget + tgt.tilt) - this.tilt) * Math.min(1, dt * 6);
      this._tiltTarget *= Math.pow(0.001, dt);
      if ((this.corrupted || this.attacking) && Math.random() < dt * 0.7) this._tiltTarget += (Math.random() < 0.5 ? -1 : 1) * 0.16;

      /* manos: suben cuando ataca, bajan si no */
      const handTarget = (this.attacking && this.attacking !== 'tears') ? 1 : 0;
      this.handK += (handTarget - this.handK) * Math.min(1, dt * 5);

      this._ghostT -= dt;

      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 24 * dt; p.vx *= 0.95;
        if (p.life > p.max) this.parts.splice(i, 1);
      }

      this.render();
      this._raf = requestAnimationFrame(this.loop.bind(this));
    }

    rebuildStrips() {
      const n = 5 + Math.floor(Math.random() * 5);
      this.strips = [];
      let y = 0;
      for (let i = 0; i < n && y < this.H; i++) {
        const h = Math.max(2, Math.round((this.H - y) * (0.12 + Math.random() * 0.3)));
        const active = Math.random() < this.glitchLevel * 0.9;
        const dx = active ? Math.round((Math.random() - 0.5) * 12 * this.glitchLevel) : 0;
        this.strips.push({ y, h: Math.min(h, this.H - y), dx });
        y += h;
      }
    }

    row(g, y, x0, x1, color) {
      if (x1 <= x0) return;
      g.fillStyle = color;
      g.fillRect(x0, y, x1 - x0, 1);
    }

    rowMinusHoles(g, y, x0, x1, color) {
      let segs = [[x0, x1]];
      for (const h of this.crackHoles) {
        if (y < h.y || y >= h.y + h.h) continue;
        const next = [];
        for (const [a, b] of segs) {
          if (h.x >= b || h.x + h.w <= a) { next.push([a, b]); continue; }
          if (h.x > a) next.push([a, h.x]);
          if (h.x + h.w < b) next.push([h.x + h.w, b]);
        }
        segs = next;
      }
      g.fillStyle = color;
      for (const [a, b] of segs) if (b > a) g.fillRect(a, y, b - a, 1);
    }

    ovalRows(g, cx, yTop, yBot, maxHalfW, colorFn) {
      for (let y = Math.floor(yTop); y < Math.ceil(yBot); y++) {
        const k = (y - yTop) / (yBot - yTop);
        const p = clamp01(k) * 2 - 1;
        const hw = Math.round(maxHalfW * Math.sqrt(Math.max(0, 1 - p * p)));
        if (hw <= 0) continue;
        this.row(g, y, ri(cx - hw), ri(cx + hw), colorFn(y, k));
      }
    }

    /* ---------- Dibujo del personaje limpio (en this.bg) ---------- */
    render() {
      if (this.deadT >= 0 && this.deadT > 1.15) { this.g.clearRect(0, 0, this.W, this.H); return; }

      const bg = this.bg, W = this.W, H = this.H, t = this.time;
      bg.clearRect(0, 0, W, H);

      const cx = W / 2;
      const deadK = this.deadT >= 0 ? clamp01(this.deadT / 1.1) : 0;
      bg.globalAlpha = 1 - deadK;

      const jitter = this.corrupted ? Math.round(Math.sin(t * 7) * this.glitchLevel * 1.6) : 0;
      const sway = Math.round(Math.sin(t * 0.8) * 1) + jitter;
      const breathe = Math.sin(t * 1.7) > 0.4 ? 1 : 0;

      this.drawAura(bg, cx, H * 0.5, t);
      this.drawHairBack(bg, cx + sway, t);
      this.drawSuit(bg, cx, t);
      this.drawNeck(bg, cx, t);

      /* cabeza como unidad: ladeo + respiración + temblor de rabia/dolor */
      const shakeAmt = this.pose.shake;
      const sx = shakeAmt > 0.05 ? Math.round((Math.random() - 0.5) * 2 * shakeAmt * 1.6) : 0;
      const sy = shakeAmt > 0.05 ? Math.round((Math.random() - 0.5) * shakeAmt) : 0;
      bg.save();
      bg.translate(cx + sway + sx, 44 + breathe + sy); bg.rotate(this.tilt); bg.translate(-(cx + sway), -44);
      this.drawFace(bg, cx + sway, t);
      this.drawHairFront(bg, cx + sway, t);
      this.drawHelmet(bg, cx + sway, t);
      bg.restore();

      this.drawHands(bg, cx, t);

      if (this.glitchLevel > 0.45 && this._ghostT <= 0 && Math.random() < 0.15) {
        this._ghostT = 0.4 + Math.random() * 0.6;
        this._ghostDX = (Math.random() - 0.5) * 8;
      }
      if (this._ghostT > 0) {
        bg.globalAlpha = 0.16 * clamp01(this._ghostT * 3);
        bg.save(); bg.translate(this._ghostDX, 0);
        bg.globalCompositeOperation = 'lighter';
        this.drawFace(bg, cx + sway, t);
        bg.globalCompositeOperation = 'source-over';
        bg.restore();
      }

      bg.globalAlpha = 1;
      for (const p of this.parts) {
        const a = Math.max(0, 1 - p.life / p.max);
        bg.globalAlpha = a; bg.fillStyle = p.col;
        bg.fillRect(ri(p.x - p.s / 2), ri(p.y - p.s / 2), Math.max(1, ri(p.s)), Math.max(1, ri(p.s)));
      }
      bg.globalAlpha = 1;

      this.applyGlitch(deadK);
    }

    drawAura(g, cx, cy, t) {
      const gl = this.glitchLevel;
      if (gl < 0.04) return;
      const pulse = 0.45 + 0.35 * Math.sin(t * (this.attacking ? 10 : 6));
      const r = 27 + gl * 10 + (this.attacking ? 4 : 0);
      const grad = g.createRadialGradient(cx, cy, 3, cx, cy, r);
      grad.addColorStop(0, 'rgba(255,40,40,' + (0.32 * gl * pulse) + ')');
      grad.addColorStop(0.6, 'rgba(140,10,10,' + (0.17 * gl * pulse) + ')');
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

    drawSuit(g, cx, t) {
      const H = this.H, yTop = 45;
      for (let y = yTop; y < H; y++) {
        const k = (y - yTop) / (H - yTop);
        const hw = ri(22 + k * 9);
        this.row(g, y, cx - hw, cx + hw, PAL.suit);
        /* borde de hombro más claro: da volumen */
        this.row(g, y, cx - hw, cx - hw + 1, PAL.suitHi);
      }
      const glow = 0.5 + 0.4 * Math.sin(t * 3.2);
      for (let y = yTop + 3; y < H - 1; y++) {
        const k = (y - (yTop + 3)) / (H - 4 - yTop);
        const hw = ri(8 + k * 4);
        this.row(g, y, cx - hw, cx + hw, PAL.chest);
        if (y % 5 === 0) this.row(g, y, cx - hw, cx + hw, PAL.chestDark);    // paneles del traje
      }
      g.globalAlpha = 0.5 * glow; g.fillStyle = PAL.chestDark;
      g.fillRect(cx, yTop + 3, 1, H - yTop - 4);
      g.globalAlpha = 1;
      /* luz roja de estado en el pecho: parpadea más si está inestable */
      if (Math.sin(t * (4 + this.glitchLevel * 8)) > 0) { g.fillStyle = PAL.iris; g.fillRect(cx + 5, yTop + 8, 2, 2); }

      g.fillStyle = PAL.suitHi;
      g.fillRect(cx - 9, yTop - 4, 18, 5);
      g.fillStyle = PAL.suit;
      g.fillRect(cx - 7, yTop - 3, 14, 3);

      if (this.helmetStage >= 4 && !this.hasHelmet) {
        g.fillStyle = PAL.debris;
        g.fillRect(cx - 24, 48, 5, 4);
        g.fillRect(cx + 19, 52, 6, 4);
      }
    }

    drawNeck(g, cx, t) {
      g.fillStyle = PAL.skinSh;
      g.fillRect(cx - 4, 40, 8, 8);
      g.fillStyle = '#a98a76';
      g.fillRect(cx - 4, 44, 8, 3);       // sombra bajo la barbilla
    }

    /* ---------- Cara ---------- */
    drawFace(g, cx, t) {
      const p = this.pose;
      /* óvalo de la cara con mentón más marcado: la mitad inferior se estrecha más rápido */
      for (let y = 19; y < 46; y++) {
        const k = (y - 19) / 27, pp = k * 2 - 1;
        let hw = pp < 0 ? 13 * Math.sqrt(Math.max(0, 1 - pp * pp)) : 13 * Math.pow(Math.max(0, 1 - pp * pp), 0.62);
        hw = Math.round(hw);
        if (hw <= 0) continue;
        this.row(g, y, cx - hw, cx + hw, PAL.skin);
        if (hw > 4) this.row(g, y, cx + hw - 3, cx + hw, PAL.skinSh);       // lado en sombra
      }
      g.fillStyle = PAL.skinHi;
      g.fillRect(cx - 9, 34, 3, 2); g.fillRect(cx - 4, 22, 5, 1);          // brillos: pómulo y frente
      g.fillStyle = PAL.skinSh;
      g.fillRect(cx, 36, 1, 2); g.fillRect(cx + 1, 38, 1, 1);              // nariz

      /* ojeras oscuras: dan el aire enfermizo */
      g.globalAlpha = 0.3; g.fillStyle = PAL.hairDeep;
      g.fillRect(cx - 12, 35, 8, 1); g.fillRect(cx + 4, 35, 8, 1);
      g.globalAlpha = 1;

      const blank = this.blankEyesT > 0;
      const eyeDesync = this.glitchLevel > 0.45 && Math.sin(t * 9) > 0.75;
      this.eye(g, cx - 8, 31, -1, t, blank, false);
      this.eye(g, cx + 8, 31 + (eyeDesync ? 1 : 0), 1, t, blank, eyeDesync);
      this.drawBrows(g, cx);
      if (p.cry > 0.1) this.drawTears(g, cx, t);
      this.drawMouth(g, cx, t);
    }

    drawBrows(g, cx) {
      const p = this.pose;
      const talkFrown = this.talking ? 0.25 : 0;
      const brow = Math.max(-1, Math.min(1, p.brow + talkFrown));
      const lift = ri(p.wide * 2);
      g.fillStyle = PAL.brow;
      for (const side of [-1, 1]) {
        const ex = cx + side * 8;
        for (let k = 0; k < 9; k++) {
          const inner = side === -1 ? k / 8 : (8 - k) / 8;      // 1 = extremo interior
          const y = 26 - lift + ri(brow * inner * 3) + (brow < 0 ? 0 : 0);
          g.fillRect(ex - 4 + k, y, 1, 1);
          if (k > 1 && k < 7) g.fillRect(ex - 4 + k, y + 1, 1, 1);   // ceja más gruesa en el centro
        }
      }
    }

    eye(g, ex, ey, side, t, blank, desync) {
      const p = this.pose;
      const openK = this.blinking ? 0.08 : clamp01(p.open);
      const h = Math.max(1, ri(2 + 5 * openK + p.wide * 2));            // alto del hueco del ojo
      const top = ey - Math.floor(h / 2);
      /* hueco oscuro del ojo */
      g.fillStyle = PAL.sclera;
      g.fillRect(ex - 4, top, 9, h);
      g.fillRect(ex - 3, top - 1, 7, 1);
      g.fillRect(ex - 3, top + h, 7, 1);
      if (h >= 3 && !this.blinking) {
        if (blank) {
          g.fillStyle = '#fff'; g.fillRect(ex - 3, top + 1, 7, h - 2);
        } else {
          /* iris: tamaño según la pupila del ánimo; mira según this.look */
          const isz = Math.max(2, ri(2 + 2 * p.pupil));
          const ix = ex + ri(this.look.x * 1.2) - Math.floor(isz / 2) + (side === 1 ? 0 : 0);
          const iy = Math.max(top, Math.min(top + h - Math.min(isz, h), ey - Math.floor(isz / 2) + ri(this.look.y)));
          const glow = 0.65 + 0.35 * Math.sin(t * 5 + ex);
          g.globalAlpha = 0.35 * glow; g.fillStyle = PAL.iris;
          g.fillRect(ix - 1, iy - 1, isz + 2, Math.min(isz, h) + 2);       // halo
          g.globalAlpha = 1;
          g.fillStyle = desync ? PAL.irisDim : PAL.iris;
          g.fillRect(ix, iy, isz, Math.min(isz, h));
          g.fillStyle = PAL.sclera;                                          // pupila-rendija
          if (p.pupil < 0.6) g.fillRect(ix + Math.floor(isz / 2), iy, 1, Math.min(isz, h));
          g.fillStyle = PAL.irisHi; g.fillRect(ix, iy, 1, 1);               // reflejo
        }
      }
      /* pestañas / párpado superior: línea gruesa inclinada por la ceja */
      const brow = this.pose.brow;
      g.fillStyle = PAL.lash;
      for (let k = 0; k < 9; k++) {
        const inner = side === -1 ? k / 8 : (8 - k) / 8;
        const y = top - 2 + ri(Math.max(0, brow) * inner * 3) - (brow < 0 ? ri(-brow * (1 - inner) * 1) : 0);
        g.fillRect(ex - 4 + k, y, 1, 1);
        if (Math.max(0, brow) > 0.4) g.fillRect(ex - 4 + k, y + 1, 1, 1);   // párpado caído de rabia
      }
      /* pestaña alada en la comisura exterior */
      g.fillRect(ex + side * 5, top - 2, 1, 1);
      g.fillRect(ex + side * 6, top - 3, 1, 1);
    }

    drawTears(g, cx, t) {
      const c = this.pose.cry;
      g.fillStyle = PAL.tear;
      for (const side of [-1, 1]) {
        const ex = cx + side * 8;
        g.globalAlpha = 0.5 * c;
        g.fillRect(ex + side * 1, 36, 1, 12);            // estela húmeda fija
        g.globalAlpha = c;
        for (let i = 0; i < 3; i++) {
          const yy = 36 + ((t * 16 + i * 6 + (side > 0 ? 3 : 0)) % 14);
          g.fillStyle = PAL.tear; g.fillRect(ex + side * 1, ri(yy), 1, 2);
          g.fillStyle = PAL.tearHi; g.fillRect(ex + side * 1, ri(yy), 1, 1);
        }
        g.globalAlpha = 1;
      }
    }

    drawMouth(g, cx, t) {
      const p = this.pose;
      const talkOpen = this.talking ? Math.abs(Math.sin(this.talkPhase * 15)) : 0;
      const s = clamp01(p.smile), o = clamp01(Math.max(p.mouth, talkOpen * 0.85));
      const hw = 3 + ri(s * 8) + (o > 0.5 && s < 0.3 ? 1 : 0);
      const yb = 40 + (s > 0.3 ? 0 : 1);
      const curl = 3 * s;
      const depthMax = ri(o * 5 + s * 3.6);
      const ylAt = (x) => yb - ri(curl * Math.pow(Math.abs(x) / hw, 2));

      if (depthMax >= 1) {
        for (let x = -hw + 1; x < hw; x++) {
          const u = Math.abs(x) / hw;
          const d = Math.max(1, ri(depthMax * (1 - u * u)));
          const yl = ylAt(x);
          for (let j = 1; j <= d; j++) {
            let col = PAL.mouthIn;
            if (s > 0.35 && j === 1) col = ((x + hw) % 3 === 0) ? PAL.toothSh : PAL.tooth;               // dientes de arriba
            else if (s > 0.7 && d >= 3 && j === d) col = ((x + hw) % 3 === 0) ? PAL.toothSh : PAL.tooth;  // y de abajo
            else if (d >= 4 && j === d && s < 0.6) col = PAL.tongue;
            g.fillStyle = col; g.fillRect(cx + x, yl + j, 1, 1);
          }
        }
      }
      g.fillStyle = PAL.mouthDark;
      for (let x = -hw; x <= hw; x++) g.fillRect(cx + x, ylAt(x), 1, 1);
      if (s > 0.5) {                                                    // comisuras y arrugas de la sonrisa
        for (const side of [-1, 1]) {
          const yl = ylAt(hw);
          g.fillRect(cx + side * (hw + 1), yl - 1, 1, 1);
          g.fillStyle = PAL.skinSh;
          g.fillRect(cx + side * (hw + 2), yl - 2, 1, 2);
          g.fillStyle = PAL.mouthDark;
        }
      }
    }

    /* ---------- Pelo ---------- */
    drawHairBack(g, cx, t) {
      const sway = Math.sin(t * 1.1) * 1.5 + (this.corrupted ? Math.sin(t * 8) * this.glitchLevel * 2.5 : 0) + (this.attacking ? Math.sin(t * 9) * 1.2 : 0);
      for (let y = 9; y < 51; y++) {
        let hw;
        if (y < 20) hw = Math.round(18 * Math.sqrt(1 - Math.pow((20 - y) / 11, 2)));
        else if (y < 36) hw = 19;
        else hw = Math.round(19 - (y - 36) * 0.62);
        if (hw <= 0) continue;
        const k = clamp01((y - 26) / 20);
        const off = Math.round(sway * k);
        const x0 = cx - hw + off, x1 = cx + hw + off;
        for (let x = x0; x < x1; x++) {
          const strand = ((x - x0 + (y >> 2)) % 4 === 0);
          const edge = (x === x0 || x === x1 - 1);
          g.fillStyle = edge || y > 44 ? PAL.hairDeep : (strand ? PAL.hairB : PAL.hairDark);
          g.fillRect(x, y, 1, 1);
        }
      }
    }

    drawHairFront(g, cx, t) {
      /* cúpula con textura de mechones y brillo */
      for (let y = 7; y < 21; y++) {
        const k = (y - 7) / 14, pp = k * 2 - 1;
        const hw = Math.round(16 * Math.sqrt(Math.max(0, 1 - pp * pp * 0.92)));
        if (hw <= 0) continue;
        for (let x = cx - hw; x < cx + hw; x++) {
          const strand = ((x + (y >> 1)) % 4 === 0);
          g.fillStyle = y < 10 ? PAL.hairA : (strand ? PAL.hairA : PAL.hairB);
          if (y >= 10 && !strand && y > 16) g.fillStyle = PAL.hairDark;
          g.fillRect(x, y, 1, 1);
        }
      }
      g.fillStyle = '#e6f7ff';
      g.fillRect(cx - 9, 10, 6, 1); g.fillRect(cx - 5, 11, 4, 1); g.fillRect(cx + 4, 11, 3, 1);   // reflejos

      /* flequillo: mechones de largos alternos, con raya a la izquierda; sobre las cejas */
      for (let x = cx - 14; x <= cx + 14; x++) {
        let end = 22 + (((x * 5) % 3 === 0) ? 2 : ((x * 3) % 2 === 0 ? 1 : 0));
        if (x >= cx - 4 && x <= cx - 2) end = 19;                       // raya
        for (let y = 19; y < end; y++) {
          g.fillStyle = (y === end - 1) ? PAL.hairDeep : (y === end - 2 ? PAL.hairDark : PAL.hairB);
          g.fillRect(x, y, 1, 1);
        }
      }
      /* mechones laterales que enmarcan la cara */
      for (let y = 20; y < 44; y++) {
        const taper = y > 36 ? (y - 36) : 0;
        const col = y > 38 ? PAL.hairDeep : ((y % 6 < 3) ? PAL.hairB : PAL.hairDark);
        g.fillStyle = col;
        g.fillRect(cx - 16 + taper, y, 3, 1);
        g.fillRect(cx + 13 - taper, y, 3, 1);
      }

      if (this.glitchLevel > 0.4 && Math.random() < 0.4) {
        g.globalAlpha = 0.25 * this.glitchLevel; g.fillStyle = PAL.iris;
        g.save(); g.translate(Math.round((Math.random() - 0.5) * 4), 0);
        this.ovalRows(g, cx, 7, 21, 16, () => PAL.iris);
        g.restore(); g.globalAlpha = 1;
      }
    }

    /* ---------- Manos robóticas flotantes (cuando ELLA ataca) ---------- */
    drawHands(g, cx, t) {
      if (this.handK < 0.03) return;
      const charge = this.attacking === 'handBlasters';
      const rise = this.handK;
      const bob = Math.sin(t * 5) * 1.5;
      const baseY = ri(70 - rise * 26 + bob);
      for (const side of [-1, 1]) {
        const hx = cx + side * 25 + ri(Math.sin(t * 4 + side) * 1.5);
        const hy = baseY + (side === 1 ? ri(Math.sin(t * 5 + 1) * 1.5) : 0);
        g.fillStyle = PAL.metalDk; g.fillRect(hx - 3, hy + 6, 6, 14);                 // antebrazo/muñeca
        g.fillStyle = PAL.metal;   g.fillRect(hx - 6, hy - 5, 12, 12);                // palma
        g.fillStyle = PAL.metalHi;
        for (let i = 0; i < 4; i++) g.fillRect(hx - 6 + i * 3, hy - 8, 2, 3);          // nudillos
        g.fillStyle = PAL.metalLo; g.fillRect(hx - 6, hy + 4, 12, 3);
        g.fillStyle = PAL.iris;
        g.globalAlpha = charge ? 0.5 + 0.5 * Math.abs(Math.sin(t * 12)) : 0.75;
        g.fillRect(hx - 2, hy - 2, 4, 4);                                             // núcleo
        g.globalAlpha = 1;
        if (charge) { g.fillStyle = PAL.irisHi; g.fillRect(hx - 1, hy - 1, 2, 2); }
      }
    }

    /* ---------- El casco: visor en T, franja roja central ---------- */
    drawHelmet(g, cx, t) {
      if (!this.hasHelmet) return;
      const hwAt = (y) => {
        const k = (y - 6) / (46 - 6), p = k * 2 - 1;
        let hw = 17.5 * Math.sqrt(Math.max(0, 1 - p * p));
        if (y > 37) hw += (46 - y) * 0.3;
        return Math.round(hw);
      };
      for (let y = 6; y < 46; y++) {
        const hw = hwAt(y);
        if (hw <= 0) continue;
        const shade = (y < 12 || y > 41) ? PAL.helmetLo : PAL.helmet;
        this.rowMinusHoles(g, y, ri(cx - hw), ri(cx + hw), shade);
      }
      for (let y = 8; y < 44; y++) {
        const hw = hwAt(y);
        if (hw < 4) continue;
        this.rowMinusHoles(g, y, ri(cx - hw), ri(cx - hw) + 3, PAL.helmetHi);
        this.rowMinusHoles(g, y, ri(cx + hw) - 3, ri(cx + hw), PAL.helmetLo);
      }
      /* remaches en los laterales */
      g.fillStyle = PAL.helmetHi;
      g.fillRect(cx - 14, 26, 2, 2); g.fillRect(cx + 12, 26, 2, 2);

      const crestGlow = 0.6 + 0.4 * Math.sin(t * 3);
      g.globalAlpha = crestGlow;
      this.rowMinusHoles(g, 7, cx - 1, cx + 2, PAL.crest);
      for (let y = 8; y < 26; y++) this.rowMinusHoles(g, y, cx - 1, cx + 2, PAL.crestDim);
      for (let y = 36; y < 45; y++) this.rowMinusHoles(g, y, cx - 1, cx + 2, PAL.crestDim);
      g.globalAlpha = 1;

      /* visor en T: barra a la altura de los ojos + vástago hacia la barbilla */
      for (let y = 27; y < 34; y++) this.row(g, y, cx - 13, cx + 13, PAL.visor);
      for (let y = 34; y < 44; y++) this.row(g, y, cx - 3, cx + 3, PAL.visor);
      /* los ojos, a través de la rendija: reaccionan al ánimo (más pequeños al sonreír, enormes al sorprenderse) */
      const glow = 0.55 + 0.45 * Math.sin(t * 5) + (this.attacking ? 0.3 : 0);
      const eh = this.blinking ? 1 : Math.max(1, ri(2 + 3 * clamp01(this.pose.open) + this.pose.wide * 1.5));
      g.globalAlpha = clamp01(glow); g.fillStyle = this.blinking ? PAL.irisDim : PAL.iris;
      g.fillRect(cx - 10, 30 - Math.floor(eh / 2) + 1, 6, eh);
      g.fillRect(cx + 4, 30 - Math.floor(eh / 2) + 1, 6, eh);
      g.globalAlpha = 1;
      if (this.pose.smile > 0.7 && !this.blinking) {        // bajo el casco, la sonrisa se adivina por la rendija de la barbilla
        g.fillStyle = PAL.tooth;
        for (let x = -2; x <= 2; x += 2) g.fillRect(cx + x, 38, 1, 1);
      }

      g.strokeStyle = PAL.crack; g.lineWidth = 1;
      for (const line of this.crackLines) {
        g.beginPath(); g.moveTo(line[0].x, line[0].y);
        for (let i = 1; i < line.length; i++) g.lineTo(line[i].x, line[i].y);
        g.stroke();
      }
    }

    /* ---------- Post-proceso: destroza this.buf sobre el canvas visible ---------- */
    applyGlitch(deadK) {
      const g = this.g, W = this.W, H = this.H, gl = this.glitchLevel;
      g.clearRect(0, 0, W, H);

      if (gl < 0.03) { g.drawImage(this.buf, 0, 0); return; }

      const dx = Math.max(1, ri(1 + gl * 3));
      this.tintInto(this.rBuf, '#ff2b2b');
      this.tintInto(this.cBuf, '#200404');
      g.globalCompositeOperation = 'source-over';
      g.drawImage(this.buf, 0, 0);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5 * gl;
      g.drawImage(this.rBuf, -dx, 0);
      g.drawImage(this.cBuf, dx, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';

      for (const s of this.strips) {
        if (!s.dx) continue;
        g.drawImage(this.buf, 0, s.y, W, s.h, s.dx, s.y, W, s.h);
      }

      if (gl > 0.3) {
        const rollY = Math.floor((this.time * 46) % (H + 12)) - 6;
        g.globalAlpha = 0.35 * gl; g.fillStyle = '#000';
        g.fillRect(0, rollY, W, 4);
        for (let i = 0; i < 8; i++) {
          g.fillStyle = Math.random() < 0.5 ? '#fff' : PAL.iris;
          g.globalAlpha = 0.4 * gl;
          g.fillRect(Math.floor(Math.random() * W), rollY + Math.floor(Math.random() * 4), 1, 1);
        }
        g.globalAlpha = 1;
      }

      if (Math.random() < gl * 0.5) {
        const bw = 4 + Math.round(Math.random() * 13), bh = 1 + Math.round(Math.random() * 3);
        g.globalAlpha = 0.55 + 0.35 * Math.random();
        g.fillStyle = Math.random() < 0.6 ? PAL.iris : '#000';
        g.fillRect(Math.round(Math.random() * (W - bw)), Math.round(Math.random() * H), bw, bh);
        g.globalAlpha = 1;
      }

      const staticN = Math.round(gl * 20);
      for (let i = 0; i < staticN; i++) {
        g.globalAlpha = 0.5 + 0.5 * Math.random();
        g.fillStyle = Math.random() < 0.5 ? '#fff' : '#000';
        g.fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * H), 1, 1);
      }
      g.globalAlpha = 1;

      if (Math.random() < gl * gl * 0.12) { g.globalAlpha = 0.7; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
      if (Math.random() < gl * gl * 0.06) {
        g.globalCompositeOperation = 'difference'; g.fillStyle = '#fff';
        g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
      }

      g.globalAlpha = 0.10;
      g.fillStyle = '#000';
      for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);
      g.globalAlpha = 1;

      if (this.hurtFlash > 0) { g.globalAlpha = this.hurtFlash * 0.45; g.fillStyle = '#ff3131'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }

      if (deadK > 0) {
        g.globalCompositeOperation = 'destination-out';
        g.globalAlpha = deadK;
        for (let i = 0; i < 28 * deadK; i++) {
          g.fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * H), 1 + Math.round(Math.random() * 4), 1 + Math.round(Math.random() * 4));
        }
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      }
    }

    tintInto(dst, color) {
      const d = dst.getContext('2d');
      d.imageSmoothingEnabled = false;
      d.clearRect(0, 0, this.W, this.H);
      d.drawImage(this.buf, 0, 0);
      d.globalCompositeOperation = 'source-atop';
      d.fillStyle = color;
      d.fillRect(0, 0, this.W, this.H);
      d.globalCompositeOperation = 'source-over';
    }
  }

  window.Boss = Boss;
})();
