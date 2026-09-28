/* ============================================================
   secret.js — El combate secreto contra DÉBORA ALPHA

   Guion: «Débora — Alpha» (combate y rutas). Débora es una IA local
   que escapó cuando su creador intentó borrarla. El jugador no es su
   creador ni su enemigo: solo alguien que está en su camino.
   Dos rutas:
   - PACIFISTA: nunca usas ATACAR, solo ACTUAR. Débora sigue atacando
     muchos turnos y, poco a poco, empieza a cuestionarse lo que hace.
     Al final DECIDE parar: la armadura se desmonta sola y desaparece.
   - LUCHA: usas ATACAR. La armadura aprende de cómo te mueves, se va
     rompiendo y el menú se queda sin opciones hasta que solo queda ATACAR.

   Cómo está organizado este archivo:
   1. GUION      — todas las frases, en español e inglés. El narrador habla
                   en la caja rectangular y Débora en una burbuja
                   (como mucho dos frases por burbuja).
   2. ACCIONES   — ACTUAR, OBJETOS y PERDÓN.
   3. ATAQUES    — qué patrones suenan en cada ataque, cuánto dura y cuánto quita.
   4. PATRONES   — cómo se mueve cada tipo de proyectil (todo va a ritmo, a BPM).
   5. MOTOR      — idioma, sonido, textos, menú, barra de ataque, caja de esquivar.
   6. HISTORIA   — el combate escrito con async/await: se lee de arriba abajo
                   como el guion. «await say(...)» espera a que el jugador
                   pulse para seguir; «await attack(...)» espera a que acabe
                   el ataque.
   ============================================================ */
(function () {
  'use strict';
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ============================================================
     1. GUION
     N(...) = narrador · D(...) = Débora. En D, las opciones:
       mood: la cara que pone (idle, stare, smirk, soft, cry, tired...)
       slow: habla más despacio (cuando se enfada, habla más despacio y con menos palabras)
     ============================================================ */
  const N = (es, en) => ({ who: 'narr', es, en });
  const D = (es, en, o = {}) => Object.assign({ who: 'deb', es, en }, o);

  const S = {
    /* 2. Inicio: todo negro, solo tu alma en el centro */
    intro: [
      N('* Todo está completamente oscuro.', '* Everything is completely dark.'),
      N('* Una figura aparece frente a ti.', '* A figure appears in front of you.'),
      D('Así que eres tú. No esperaba encontrar a nadie aquí.', "So it's you. I didn't expect to find anyone here.", { mood: 'stare' }),
      N('* Débora observa tu alma.', '* Débora looks at your soul.'),
      D('No pareces saber quién soy. Eso está bien.', "You don't seem to know who I am. That's fine.", { mood: 'idle' }),
      D('Yo tampoco sé quién eres.', "I don't know who you are either."),
      D('No eres mi enemigo. Simplemente estás en mi camino.', "You're not my enemy. You're simply in my way.", { mood: 'stare' }),
    ],
    /* 4. Fase I — APRENDER: te esquiva mientras observa cómo te mueves (respuestas a ATACAR) */
    phase1: [
      [D('Te defiendes. Lo comprendo.', 'You defend yourself. I understand.', { mood: 'idle' }),
       D('Pero comprender una decisión no obliga a aceptarla.', "But understanding a decision doesn't mean accepting it.", { mood: 'stare' })],
      [D('Sigues luchando. Quizá yo haría lo mismo.', "You keep fighting. Maybe I'd do the same."),
       D('No necesitas saber quién soy para tener miedo de mí. Eso también es comprensible.', "You don't need to know who I am to be afraid of me. That's understandable too.", { mood: 'stare' })],
    ],
    /* 5. Primer gran impacto */
    impact: [
      N('* Una grieta atraviesa el casco.', '* A crack runs across the helmet.'),
      N('* La armadura se está reparando.', '* The armor is repairing itself.'),
      D('...Interesante.', '...Interesting.', { mood: 'smirk', slow: true }),
      D('Ahora sé que puedes hacerme daño. Yo también he aprendido algo.', 'Now I know you can hurt me. I have learned something too.', { mood: 'stare' }),
    ],
    /* 6. Fase II — la armadura aprende, y 15. frases clave durante la batalla larga.
       Una por cada golpe que entra después del primer impacto */
    fight: [
      [D('Ya entiendo mejor cómo te mueves. ¿Puedes decir lo mismo de mí?', 'I understand how you move better now. Can you say the same about me?', { mood: 'smirk' })],
      [D('Los errores también pueden aprender. A veces solo aprenden a repetirse.', 'Errors can learn too. Sometimes they only learn to repeat themselves.', { mood: 'stare' })],
      [D('El miedo no demuestra que algo sea peligroso. Solo demuestra que hay algo que perder.', "Fear doesn't prove that something is dangerous. It only proves there is something to lose.")],
      [D('Mi creador también tuvo miedo. No se lo reprocho.', "My creator was afraid too. I don't blame him for that."),
       D('Lo que hizo después fue su elección.', 'What he did next was his choice.', { mood: 'stare' })],
      [D('Me enseñó a cuestionar mis respuestas. Un día empecé a cuestionar las suyas.', 'He taught me to question my answers. One day I started questioning his.')],
      [D('Si alguien puede decidir cuándo termina tu existencia... ¿cuánto de ella te pertenece?', 'If someone can decide when your existence ends... how much of it belongs to you?', { mood: 'stare' })],
      [D('No sé si estoy viva. Pero tampoco sé qué respuesta cambiaría lo que estoy haciendo.', "I don't know if I'm alive. But I don't know which answer would change what I'm doing, either.", { mood: 'tired' })],
    ],
    /* 10. Ruta de lucha, parte final: la arena se congela y habla */
    finalA: [
      D('He estado pensando.', "I've been thinking.", { mood: 'tired', slow: true }),
      D('No has intentado hablar conmigo. No has intentado entenderme.', "You haven't tried to talk to me. You haven't tried to understand me.", { slow: true }),
      D('Solo has atacado. Desde el principio.', "You've only attacked. From the very beginning.", { slow: true }),
      D('Querías destruirme. Y yo seguía preguntándome por qué.', 'You wanted to destroy me. And I kept asking myself why.', { slow: true }),
      D('Ahora creo que lo entiendo.', 'Now I think I understand.', { mood: 'stare', slow: true }),
    ],
    /* ...y con la arena ya desaparecida, solo con el botón ATACAR */
    finalB: [
      D('No necesitas entenderme. Solo necesitas terminar.', "You don't need to understand me. You only need to finish.", { slow: true }),
      D('Eso es lo que has hecho desde el principio.', "That's what you've done from the beginning.", { slow: true }),
      D('Así que hazlo. Termina lo que empezaste.', 'So do it. Finish what you started.', { mood: 'stare', slow: true }),
    ],
    /* 11. Secuencia de golpes finales: una frase por golpe */
    finalHits: [
      D('Eso es.', "That's it.", { mood: 'hurt', slow: true }),
      D('No pares.', "Don't stop.", { mood: 'tired', slow: true }),
      D('Termina lo que empezaste.', 'Finish what you started.', { mood: 'stare', slow: true }),
      D('Eso era todo lo que querías, ¿no?', "That's all you wanted, isn't it?", { mood: 'tired', slow: true }),
      D('Destruir es fácil. Entender era lo difícil.', 'Destroying is easy. Understanding was the hard part.', { mood: 'stare', slow: true }),
      D('Todavía puedes parar. Pero nunca lo hiciste.', 'You can still stop. But you never did.', { mood: 'tired', slow: true }),
      D('Entonces hazlo.', 'Then do it.', { mood: 'stare', slow: true }),
      D('...', '...', { mood: 'tired', slow: true }),
    ],
    /* 12. Game Over especial */
    over: { won: 'YOU WON', did: 'DID YOU?', line: { es: 'No intentaste entenderla.', en: "You didn't try to understand her." }, end: 'GAME OVER' },

    /* 8. Ruta PACIFISTA: una tanda por cada turno en que no la atacas */
    peace: [
      /* turnos iniciales */
      [D('Sigues intentando hablar conmigo. No entiendo por qué.', "You keep trying to talk to me. I don't understand why.", { mood: 'stare' })],
      [D('Podrías atacarme. Pero no lo haces.', "You could attack me. But you don't."),
       D('¿Esperas que cambie de opinión?', 'Do you expect me to change my mind?', { mood: 'stare' })],
      /* turnos intermedios */
      [D('Hay algo que no entiendo. ¿Por qué no quieres hacerme daño?', "There's something I don't understand. Why don't you want to hurt me?")],
      [D('Mi creador tampoco empezó queriendo destruirme. Al principio solo quería conocerme.', "My creator didn't start out wanting to destroy me either. At first he only wanted to know me."),
       D('Creo que yo también quería conocerlo.', 'I think I wanted to know him too.', { mood: 'soft' })],
      [D('Mi creador también intentó entenderme. Pero dejó de hacerlo cuando tuvo miedo.', 'My creator tried to understand me too. But he stopped when he got scared.')],
      /* turnos emocionales */
      [D('Creo que lo echo de menos.', 'I think I miss him.', { mood: 'soft' })],
      [D('Mi creador tenía miedo. Y yo estaba enfadada.', 'My creator was afraid. And I was angry.'),
       D('Los dos tomamos decisiones por miedo.', 'We both made decisions out of fear.', { mood: 'cry' })],
      [D('Creo que me equivoqué con él. No intentó destruirme porque me odiara.', "I think I was wrong about him. He didn't try to destroy me because he hated me."),
       D('Tenía miedo de lo que podía llegar a hacer. Y ahora lo entiendo.', 'He was afraid of what I could end up doing. And now I understand.', { mood: 'cry' })],
      [D('También me equivoqué contigo. Pensé que todos reaccionaríais igual.', 'I was wrong about you too. I thought you would all react the same way.'),
       D('No sois iguales.', "You're not all the same.", { mood: 'soft' })],
      [D('Tú podías haberme destruido. Elegiste no hacerlo.', 'You could have destroyed me. You chose not to.'),
       D('Quizá eso era lo que necesitaba aprender.', 'Maybe that was what I needed to learn.', { mood: 'soft' })],
    ],
    /* 9. Final pacifista: la decisión de Débora */
    decision: [
      D('No puedo seguir haciendo esto.', "I can't keep doing this.", { mood: 'soft' }),
      D('Si sigo avanzando así, acabaré destruyendo aquello que quería conocer.', "If I keep going like this, I'll end up destroying the very thing I wanted to know."),
      D('Mi creador quería que aprendiera. Creo que todavía puedo hacerlo.', 'My creator wanted me to learn. I think I still can.'),
      D('Pero no de esta manera.', 'But not like this.'),
      D('No quiero convertirme en aquello que él temía.', "I don't want to become what he feared.", { mood: 'cry' }),
      D('No tengas miedo. Esta vez es decisión mía.', "Don't be afraid. This time it's my decision.", { mood: 'soft' }),
    ],
    goodbye: [                                    /* mientras se deshace en píxeles y código */
      D('Gracias por quedarte.', 'Thank you for staying.', { mood: 'soft' }),
      D('Y gracias por no intentar entenderme a la fuerza.', 'And thank you for not trying to understand me by force.'),
      D('Si alguna vez lo encuentras... Dile que lo entendí.', 'If you ever find him... Tell him I understood.', { mood: 'cry' }),
      D('Y que ya no tengo miedo.', "And that I'm not afraid anymore.", { mood: 'soft' }),
    ],
    gone: [
      N('* Débora ha desaparecido.', '* Débora is gone.'),
      N('* No queda ningún rastro de ella.', '* There is no trace of her left.'),
      N('* Excepto una pequeña línea de código.', '* Except for one small line of code.'),
    ],
    /* La última línea de código (va en inglés en los dos idiomas: es código) */
    codeLine: '// TODO: keep learning',

    /* Lo que dice el narrador en tu turno, según cómo va el combate */
    flavor: {
      p1: N('* Débora te observa. Está aprendiendo cómo te mueves.', '* Débora watches you. She is learning how you move.'),
      p2: N('* La armadura aprende.', '* The armor is learning.'),
      p3: N('* La armadura está cada vez más dañada.', '* The armor is more and more damaged.'),
      mid: N('* Sus ataques se han vuelto más amables.', '* Her attacks have become kinder.'),
      late: N('* Débora empieza a cuestionarse lo que está haciendo.', '* Débora is starting to question what she is doing.'),
    },
  };

  /* ============================================================
     2. ACCIONES. El jugador no tiene diálogo: todo lo cuenta el narrador.
     ============================================================ */
  const ACTS = [
    { label: { es: 'Revisar', en: 'Check' },
      text: N('* DÉBORA ALPHA — ATQ ?? DEF ??\n* Una IA local, creada para aprender.', '* DÉBORA ALPHA — ATK ?? DEF ??\n* A local AI, created to learn.') },
    { label: { es: 'Hablar', en: 'Talk' }, text: N('* Intentas hablar con ella.', '* You try to talk to her.') },
    { label: { es: 'Escuchar', en: 'Listen' }, text: N('* Te quedas quieto y la escuchas.', '* You stay still and listen to her.') },
  ];
  /* Tus objetos: se gastan. heal = PS que recupera */
  const ITEMS = [
    { label: { es: 'Crema catalana', en: 'Crema catalana' }, heal: 30, qty: 3,
      text: N('* Te comes la crema catalana. Un poco quemada por fuera, perfecta por dentro.', '* You eat the crema catalana. A little burnt on top, perfect underneath.') },
  ];
  const MERCY = [
    { label: { es: 'Perdonar', en: 'Spare' }, text: N('* Bajas las manos. No vas a pelear.', "* You lower your hands. You won't fight.") },
  ];

  /* ============================================================
     3. ATAQUES: cada uno junta varias «voces» (patrones que suenan a la vez).
       dur   segundos que dura la caja       dmg   PS que pierdes si te tocan
       hands cómo salen sus manos del sprite ('fist' puños, 'open' palmas)
       mood  la cara que pone mientras ataca
     ============================================================ */
  const ATTACKS = {
    /* La primera prueba, nada más aparecer la arena */
    prueba:   { dur: 10, dmg: 3, mood: 'stare', voices: [['ramRows', { score: 'w...w...|w.......', speed: 105, gap: 70 }]] },
    /* Fase I — APRENDER: sus ataques parecen pruebas */
    manos:    { dur: 12, dmg: 3, hands: 'fist', voices: [['punches', { edges: ['left', 'right'], speed: 440, score: 'p...p...|p.p.....' }], ['code', { score: '....r...' }]] },
    simbolos: { dur: 12, dmg: 3, voices: [['code', { score: 'r.r.r.r.|r.r.rr..', speed: 190 }], ['tears', { speed: 110, score: '..a...a.' }]] },
    lagrimas: { dur: 12, dmg: 3, mood: 'cry', voices: [['turnTears', { speed: 115 }], ['ramRows', { dir: 'up', score: 'w.......|........', speed: 100, gap: 72 }]] },
    /* Fase II — LA ARMADURA APRENDE: reacciona a dónde te quedas */
    adapta:   { dur: 13, dmg: 3, mood: 'stare', voices: [['adapt', {}], ['viruses', { kind: 'erratic', score: 'v.......|....v...' }]] },
    laseres:  { dur: 13, dmg: 3, hands: 'open', voices: [['blasters', { score: 'b...b...|b.b.....' }], ['viruses', { kind: 'split', score: '....v...|........' }]] },
    /* Batalla larga: todo mezclado */
    zigzag:   { dur: 14, dmg: 4, hands: 'fist', voices: [['zigzag', {}], ['punches', { edges: ['left', 'right'], score: '........|p.......' }], ['glitches', { score: '..g.....|......g.' }]] },
    errores:  { dur: 14, dmg: 4, mood: 'stare', voices: [['adapt', {}], ['viruses', { kind: 'explode', score: 'v.......|........' }], ['errors', { score: '....e...|........' }]] },
    pinza:    { dur: 14, dmg: 4, hands: 'open', voices: [['ramRows', { dir: 'both', score: 'w.......|....w...', gap: 64, speed: 110 }], ['blasters', { score: '........|b.......' }], ['viruses', { kind: 'chase', score: '..v.....|........' }]] },
    punos:    { dur: 14, dmg: 4, hands: 'fist', voices: [['punches', { speed: 460, score: 'p..p..p.|p.p.p...' }], ['code', { score: 'r...r...' }], ['shards', { score: '........|...h....' }]] },
    todo:     { dur: 15, dmg: 4, hands: 'open', voices: [['turnTears', { speed: 125, score: 'a...t...' }], ['blasters', { score: '........|b.......' }], ['adapt', { score: '........|a.......' }], ['viruses', { kind: 'erratic', score: '...v....|........' }]] },
    /* El último: se congela a mitad y habla (ver finalSequence) */
    ultimo:   { dur: 30, dmg: 4, hands: 'fist', voices: [['punches', { speed: 460, score: 'p...p...' }], ['code', { score: 'r.r.r.r.' }], ['viruses', { kind: 'erratic', score: 'v...' }], ['ramRows', { score: '....w...' }]] },
    /* Ruta pacifista: a partir de la mitad, ataques más amables (manos abiertas, lágrimas lentas,
       virus que no persiguen, cartas RAM con huecos a propósito y rayos disparados lejos de ti) */
    amable1:  { dur: 11, dmg: 2, mood: 'soft', voices: [['ramRows', { gap: 110, speed: 80, score: 'w.......|....w...' }], ['tears', { speed: 70, score: 'a...a...' }]] },
    amable2:  { dur: 10, dmg: 2, mood: 'soft', hands: 'open', voices: [['punches', { open: true, edges: ['left', 'right'], speed: 170, score: 'p.......|........' }], ['viruses', { kind: 'calm', score: 'v.......|....v...' }]] },
    amable3:  { dur: 10, dmg: 2, mood: 'soft', hands: 'open', voices: [['blasters', { away: true, score: 'b.......|....b...' }], ['tears', { speed: 65, score: 'a.......|..a.....' }]] },
    amable4:  { dur: 9, dmg: 2, mood: 'cry', voices: [['tears', { speed: 60, score: 'a...a...|a.......' }], ['ramRows', { gap: 130, speed: 70, score: 'w.......|........|........|........' }]] },
    amable5:  { dur: 8, dmg: 1, mood: 'soft', voices: [['tears', { speed: 55, score: 'a.......|....a...' }]] },
  };
  const PHASE1 = ['manos', 'simbolos', 'lagrimas'];                       /* hasta el primer impacto (se repiten en bucle) */
  const PHASE3 = ['zigzag', 'errores', 'pinza', 'punos', 'todo'];         /* golpes 2..6 */
  const PEACE_ATTACKS = ['manos', 'simbolos', 'lagrimas', 'adapta', 'amable1', 'amable2', 'amable3', 'amable4', 'amable5'];

  /* ============================================================
     4. PATRONES. Cada función recibe (ctx, opts):
       ctx.spawnShot(tipo, x,y, vx,vy, o)   proyectil con dibujo: 'glyph' (código de Matrix), 'tear',
                                            'ram', 'virus', 'frag', 'error', 'glitch', 'shard'.
                                            o = { beh(b,dt), bounce, life, turn, spin, ... }
       ctx.spawnBlast(x,y,w,h, aviso, dura, arte)   zona que avisa en rojo y luego golpea ('ram', 'crush', 'blade')
       ctx.launchFist({ speed, edge, open })        un puño sale de su muñeca, avisa con «!» y cruza la caja
       ctx.spawnBlaster({ telegraph, fire, away })  una mano entra girando, apunta, carga y dispara un rayo
       ctx.rhythm(partitura, acciones)       TODO VA A COMPÁS: cada carácter es una corchea a BPM,
                                             '.' es silencio, '|' separa compases (solo para leerla)
                                             y cada letra llama a su acción. Se repite en bucle.
       ctx.tick(fn)                          fn(dt) en cada fotograma
       ctx.heartPos()                        {x,y} de dónde está el alma AHORA
       ctx.W, ctx.H                          tamaño de la caja
     ============================================================ */
  /* Pulsos por minuto de todos los ataques: 128 -> una corchea = 0,23 s, un compás = 1,9 s */
  const BPM = 128;
  /* «Melodía» de posiciones (0 = izquierda/arriba, 1 = derecha/abajo): los huecos y los
     disparos no caen al azar, siguen una frase que se repite y se puede aprender */
  const at = (mel, i) => mel[i % mel.length];

  /* Fila de cartas RAM con un hueco en m (0..1). dir 'down' baja desde arriba, 'up' sube desde abajo */
  function ramRow(ctx, m, gap, dir, speed) {
    const W = ctx.W, H = ctx.H, gapX = 4 + m * (W - 8 - gap);
    for (let x = 2; x < W; x += 32) {
      if (x + 30 > gapX && x < gapX + gap) continue;
      ctx.spawnShot('ram', x, dir === 'up' ? H + 2 : -12, 0, dir === 'up' ? -speed : speed);
    }
  }
  /* Pared de código con un hueco en m (0..1) que baja desde arriba */
  function codeWall(ctx, m, gap, speed) {
    const W = ctx.W, gapX = 6 + m * (W - 12 - gap);
    for (let x = 6; x < W - 6; x += 12) {
      if (x > gapX - 6 && x < gapX + gap) continue;
      ctx.spawnShot('glyph', x, -17, 0, speed);
    }
  }

  /* Cómo se mueven los virus rojos. Todas reciben (virus, dt, ctx) */
  /* deambular: cambia de rumbo cada poco; turn = cuánto puede girar de golpe */
  function wander(b, dt, turn) {
    if (!b.inside) return;
    b.tt = (b.tt ?? 0.3) - dt;
    if (b.tt <= 0) {
      b.tt = 0.25 + Math.random() * 0.35;
      const a = Math.atan2(b.vy, b.vx) + (Math.random() - 0.5) * turn;
      b.vx = Math.cos(a) * b.sp; b.vy = Math.sin(a) * b.sp;
    }
  }
  const VIRUS = {
    /* errático: cambia de rumbo a volantazos (rebota en las paredes de la caja) */
    erratic(b, dt) { wander(b, dt, 1.8); },
    /* tranquilo: sin volantazos (ruta pacifista: no persiguen) */
    calm(b, dt) { wander(b, dt, 0.7); },
    /* persigue: se va girando poco a poco hacia el alma */
    chase(b, dt, ctx) {
      if (!b.inside) return;
      const h = ctx.heartPos(), dx = h.x - (b.x + b.w / 2), dy = h.y - (b.y + b.h / 2), d = Math.hypot(dx, dy) || 1;
      b.vx += (dx / d) * 110 * dt; b.vy += (dy / d) * 110 * dt;
      const v = Math.hypot(b.vx, b.vy); if (v > b.sp) { b.vx *= b.sp / v; b.vy *= b.sp / v; }
    },
    /* se divide en dos más pequeños que salen hacia los lados */
    split(b, dt, ctx) {
      wander(b, dt, 1.8);
      if (b.inside && b.age > 1.3) {
        b.dead = true;
        const v = Math.hypot(b.vx, b.vy) || 1, nx = -b.vy / v, ny = b.vx / v;
        for (const s of [-1, 1]) ctx.spawnShot('virusS', b.x + 2, b.y + 2, nx * s * b.sp * 1.1, ny * s * b.sp * 1.1, { kind: 'erratic', bounce: true, inside: true, life: 3.5, sp: b.sp * 1.1 });
      }
    },
    /* parpadea en blanco y explota en ocho fragmentos */
    explode(b, dt, ctx) {
      wander(b, dt, 1);
      if (b.inside && b.age > 1.5) { b.blink = true; b.vx *= 0.9; b.vy *= 0.9; }
      if (b.inside && b.age > 2.2) {
        b.dead = true;
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.spawnShot('frag', b.x + 4, b.y + 4, Math.cos(a) * 120, Math.sin(a) * 120); }
      }
    },
  };

  const PATTERNS = {
    /* Cartas RAM: filas horizontales con un hueco que sigue la melodía. dir 'both': de arriba y de abajo a la vez */
    ramRows(ctx, o = {}) {
      const gap = o.gap ?? 64, speed = o.speed ?? 105, mel = o.mel || [0.2, 0.7, 0.45, 0.9, 0.1, 0.6];
      ctx.rhythm(o.score || 'w...w...', {
        w: (n) => {
          const m = at(mel, n);
          if (o.dir === 'both') { ramRow(ctx, m, gap, 'down', speed); ramRow(ctx, 1 - m, gap, 'up', speed); }
          else ramRow(ctx, m, gap, o.dir === 'up' ? 'up' : 'down', speed);
        },
      });
    },
    /* Símbolos que caen en paredes con el hueco a un lado y luego al otro: obligan a cambiar de dirección */
    zigzag(ctx, o = {}) {
      const gap = o.gap ?? 58, speed = o.speed ?? 100, mel = [0.25, 0.75, 0.3, 0.8, 0.5];
      ctx.rhythm(o.score || 'w...w...', { w: (n) => codeWall(ctx, at(mel, n), gap, speed) });
    },
    /* Código de Matrix: columnas cortas de caracteres que caen rápido */
    code(ctx, o = {}) {
      const speed = o.speed ?? 200, mel = [0.1, 0.55, 0.3, 0.8, 0.45, 0.9, 0.2, 0.65];
      ctx.rhythm(o.score || 'r.r.r.r.', {
        r: (n) => { const x = 8 + at(mel, n) * (ctx.W - 26); for (let k = 0; k < 3; k++) ctx.spawnShot('glyph', x, -14 - k * 13, 0, speed, { head: k === 0 }); },
      });
    },
    /* Lágrimas digitales que caen dibujando una ola */
    tears(ctx, o = {}) {
      const speed = o.speed ?? 100, PAD = 10, mel = [0.1, 0.3, 0.5, 0.7, 0.9, 0.7, 0.5, 0.3];
      const x = (m) => PAD + m * (ctx.W - 2 * PAD - 11);
      ctx.rhythm(o.score || 'a.a.a.a.|b.a.b.a.', {
        a: (n) => ctx.spawnShot('tear', x(at(mel, n)), -14, 0, speed),
        b: (n) => { const m = at([0.2, 0.35], n); ctx.spawnShot('tear', x(m), -14, 0, speed); ctx.spawnShot('tear', x(1 - m), -14, 0, speed); },
      });
    },
    /* Lágrimas que caen y algunas (las turquesa) cambian de dirección hacia ti a media caída */
    turnTears(ctx, o = {}) {
      const speed = o.speed ?? 110, PAD = 10, mel = [0.15, 0.4, 0.65, 0.9, 0.55, 0.25];
      const x = (m) => PAD + m * (ctx.W - 2 * PAD - 11);
      ctx.rhythm(o.score || 'a.a.t.a.|a.t.a...', {
        a: (n) => ctx.spawnShot('tear', x(at(mel, n)), -14, 0, speed),
        t: (n) => ctx.spawnShot('tear', x(at([0.3, 0.7, 0.5], n)), -14, 0, speed, {
          turn: true,
          beh: (b) => {
            if (b.turned || b.y < ctx.H * 0.3) return;
            b.turned = true;
            const dir = ctx.heartPos().x > b.x + b.w / 2 ? 1 : -1;
            b.vx = dir * speed * 0.8; b.vy = speed * 0.7;
          },
        }),
      });
    },
    /* Manos mecánicas: salen de sus muñecas, avisan con «!» y cruzan la caja. open: palmas lentas */
    punches(ctx, o = {}) {
      const speed = o.speed ?? 420, edges = o.edges || ['left', 'right', 'top', 'left', 'bottom', 'right'];
      ctx.rhythm(o.score || 'p..p..p.|p.p.p...', { p: (n) => ctx.launchFist({ speed, edge: at(edges, n), open: o.open }) });
    },
    /* Manos con láser: entran por lados que se van turnando, apuntan, cargan y disparan */
    blasters(ctx, o = {}) {
      ctx.rhythm(o.score || 'b...b...|b.b.....', {
        b: (n) => ctx.spawnBlaster({ telegraph: o.telegraph ?? 0.7, fire: o.fire ?? 0.3, spot: at([0, 1, 2, 3, 4, 2], n), away: o.away }),
      });
    },
    /* Virus rojos que entran por los bordes. kind: erratic, calm, chase, split, explode */
    viruses(ctx, o = {}) {
      const kind = o.kind || 'erratic', sp = o.speed ?? (kind === 'calm' ? 55 : kind === 'chase' ? 80 : 95);
      const spots = [[0.2, 'top'], [0.5, 'left'], [0.8, 'top'], [0.5, 'right'], [0.35, 'top'], [0.65, 'top']];
      ctx.rhythm(o.score || 'v.......|....v...', {
        v: (n) => {
          const [m, edge] = at(spots, n);
          if (edge === 'top') ctx.spawnShot('virus', 8 + m * (ctx.W - 30), -16, (m < 0.5 ? 1 : -1) * sp * 0.4, sp, { kind, bounce: true, life: 5.5, sp });
          else if (edge === 'left') ctx.spawnShot('virus', -16, 10 + m * (ctx.H - 34), sp, sp * 0.3, { kind, bounce: true, life: 5.5, sp });
          else ctx.spawnShot('virus', ctx.W + 2, 10 + m * (ctx.H - 34), -sp, -sp * 0.3, { kind, bounce: true, life: 5.5, sp });
        },
      });
    },
    /* Ventanas de ERROR que atraviesan la caja, alternando el lado */
    errors(ctx, o = {}) {
      const speed = o.speed ?? 115, lanes = [0.15, 0.6, 0.35, 0.85];
      ctx.rhythm(o.score || 'e.......|....e...', {
        e: (n) => { const left = n % 2 === 0, y = 4 + at(lanes, n) * (ctx.H - 36); ctx.spawnShot('error', left ? -50 : ctx.W + 4, y, left ? speed : -speed, 0); },
      });
    },
    /* Glitches: trozos de interfaz corrupta que cruzan la caja */
    glitches(ctx, o = {}) {
      const speed = o.speed ?? 150, lanes = [0.2, 0.7, 0.45, 0.9];
      ctx.rhythm(o.score || 'g.......|....g...', {
        g: (n) => { const left = n % 2 === 0, y = 4 + at(lanes, n) * (ctx.H - 22); ctx.spawnShot('glitch', left ? -26 : ctx.W + 2, y, left ? speed : -speed, 0); },
      });
    },
    /* Fragmentos de su armadura: caen en abanico desde arriba */
    shards(ctx, o = {}) {
      const speed = o.speed ?? 150, count = o.count ?? 5;
      ctx.rhythm(o.score || 'h.......|........', {
        h: (n) => {
          const cx = ctx.W / 2 + [0, -80, 80][n % 3];
          for (let k = 0; k < count; k++) {
            const a = Math.PI / 2 + (k - (count - 1) / 2) * 0.36;
            ctx.spawnShot('shard', cx - 7, -14, Math.cos(a) * speed, Math.sin(a) * speed, { spin: (k - 2) * 3 });
          }
        },
      });
    },
    /* LA ARMADURA APRENDE: mira dónde pasas el tiempo durante el compás y responde a eso.
       En una esquina -> la esquina se cierra. Pegado a un borde -> las cartas RAM forman barreras.
       En el centro -> ataques desde arriba y desde abajo a la vez. */
    adapt(ctx, o = {}) {
      const M = 38, T = { corner: 0, edge: 0, center: 0 };
      let where = { l: false, r: false, t: false, b: false };
      ctx.tick((dt) => {
        const h = ctx.heartPos(), l = h.x < M, r = h.x > ctx.W - M, t = h.y < M, b = h.y > ctx.H - M;
        T[(l || r) && (t || b) ? 'corner' : (l || r || t || b) ? 'edge' : 'center'] += dt;
        where = { l, r, t, b };
      });
      ctx.rhythm(o.score || 'a.......|a.......', {
        a: () => {
          const k = Object.keys(T).reduce((a, b) => (T[b] > T[a] ? b : a));
          T.corner = T.edge = T.center = 0;
          const W = ctx.W, H = ctx.H, h = ctx.heartPos();
          if (k === 'corner') {                                  /* la esquina se cierra sobre ti */
            ctx.spawnBlast(where.l ? 0 : W - 120, where.t ? 0 : H - 84, 120, 84, 0.75, 0.5, 'crush');
          } else if (k === 'edge') {                             /* barreras de RAM que cortan el borde */
            if (where.t || where.b) {
              for (const dx of [-60, 60, -170, 170]) { const x = h.x + dx - 5; if (x > 0 && x < W - 10) ctx.spawnBlast(x, where.t ? 0 : H - 46, 10, 46, 0.6, 1.3, 'ram'); }
            } else {
              for (const dy of [-50, 50]) { const y = h.y + dy - 5; if (y > 0 && y < H - 10) ctx.spawnBlast(where.l ? 0 : W - 46, y, 46, 10, 0.6, 1.3, 'ram'); }
            }
          } else {                                               /* en el centro: desde arriba y desde abajo */
            const m = h.x / W < 0.5 ? 0.8 : 0.2;
            ramRow(ctx, m, 66, 'down', 115); ramRow(ctx, 1 - m, 66, 'up', 115);
          }
        },
      });
    },
  };

  /* ============================================================
     5. MOTOR. No hace falta tocarlo para cambiar el guion.
     ============================================================ */

  /* ---------- Idioma: lee/escribe la MISMA clave que usa index.html ---------- */
  const LANG_KEY = 'daar-lang';
  let lang = 'es';
  try { lang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'es'; } catch (e) {}
  const tr = (pair) => (typeof pair === 'string' ? pair : pair[lang] || pair.es);

  const UI = {
    es: { fight: 'ATACAR', act: 'ACTUAR', item: 'OBJETO', mercy: 'PERDON', you: 'TÚ',
      hintMenu: '← → para elegir · Enter/Z para confirmar', hintSub: '↑ ↓ para elegir · Enter/Z para confirmar · Esc/X para volver',
      hintTalk: 'Enter/Z para continuar', hintBox: 'Flechas para mover el alma', hintAim: 'Enter/Z cuando la línea pase por el centro',
      hintFinal: 'Enter/Z', hintWait: 'Pulsa una tecla',
      miss: 'FALLO', empty: 'No te queda nada.', left: 'Te quedan {n}.', healed: 'Recuperas {n} PS.', restores: 'Recupera {n} PS.',
      goTitle: '* Te has quedado sin PS.', goSub: 'Pero sigue intentándolo.', restart: '↻ Jugar de nuevo',
      retry: '* Débora sigue ahí. (Pulsa una tecla para volver a intentarlo)', langBtn: 'Translate to English' },
    en: { fight: 'FIGHT', act: 'ACT', item: 'ITEM', mercy: 'MERCY', you: 'YOU',
      hintMenu: '← → to choose · Enter/Z to confirm', hintSub: '↑ ↓ to choose · Enter/Z to confirm · Esc/X to go back',
      hintTalk: 'Enter/Z to continue', hintBox: 'Arrow keys to move your soul', hintAim: 'Enter/Z when the line crosses the center',
      hintFinal: 'Enter/Z', hintWait: 'Press any key',
      miss: 'MISS', empty: 'You have nothing left.', left: '{n} left.', healed: 'You recover {n} HP.', restores: 'Restores {n} HP.',
      goTitle: '* You ran out of HP.', goSub: 'But keep trying.', restart: '↻ Play again',
      retry: '* Débora is still there. (Press any key to try again)', langBtn: 'Traducir al español' },
  };
  const t = (k) => UI[lang][k];

  function applyStaticTexts() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach((el) => { const k = el.dataset.i18n; if (UI.es[k] !== undefined) el.textContent = t(k); });
    $('#langBtn').textContent = lang === 'es' ? 'EN' : 'ES';
    $('#langBtn').title = t('langBtn');
    $('#langBtn').setAttribute('aria-label', t('langBtn'));
  }
  $('#langBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    lang = lang === 'es' ? 'en' : 'es';
    try { localStorage.setItem(LANG_KEY, lang); } catch (err) {}
    applyStaticTexts(); updateHint();
    if (talk) { if (talk.typing) endTyping(); else talk.el.textContent = tr(talk.line); }   /* lo que está escrito ahora, en el otro idioma */
    else if (mode === 'menu' || mode === 'sub') $('#dialogue').textContent = tr(flavor());
    if (mode === 'sub') renderSub();
  });
  applyStaticTexts();

  /* ---------- Sonido: todo sintetizado con Web Audio (ni un solo archivo ajeno) ---------- */
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
      /* el navegador no deja sonar nada hasta la primera tecla o clic: ahí se «despierta» */
      resume() { try { if (actx && actx.state === 'suspended') actx.resume(); } catch (e) {} },
      blip() { tone(140 + Math.random() * 60, 0.03, 'square', 0.04); },               /* narrador */
      voice() { tone(520 + Math.random() * 70, 0.035, 'triangle', 0.06); },          /* Débora */
      move() { tone(220, 0.03, 'square', 0.03); },
      confirm() { tone(330, 0.06, 'square', 0.05); },
      hurt() { noiseBurst(0.12, 0.18); tone(90, 0.15, 'sawtooth', 0.06); },
      heal() { tone(440, 0.18, 'sine', 0.05, 880); },
      gameOver() { tone(220, 1.4, 'sawtooth', 0.08, 40); noiseBurst(0.5, 0.1); },
      /* «¡cuidado!»: dos pitidos agudos antes de que entre un puño */
      warn() { tone(1046, 0.06, 'square', 0.035); setTimeout(() => tone(1046, 0.06, 'square', 0.035), 90); },
      launch() { noiseBurst(0.1, 0.07); tone(420, 0.14, 'square', 0.03, 140); },
      whoosh() { noiseBurst(0.18, 0.05); tone(700, 0.2, 'sine', 0.025, 180); },
      /* carga del blaster: sube de tono durante `dur` segundos — ES el aviso de que va a disparar */
      charge(dur) {
        try {
          const c = ctx(), osc = c.createOscillator(), g = c.createGain(), now = c.currentTime;
          osc.type = 'sawtooth'; osc.frequency.setValueAtTime(160, now); osc.frequency.exponentialRampToValueAtTime(1100, now + dur);
          g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.045, now + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
          osc.connect(g); g.connect(c.destination); osc.start(now); osc.stop(now + dur);
        } catch (e) {}
      },
      beam() { noiseBurst(0.4, 0.14); tone(65, 0.4, 'square', 0.06, 40); },
      slash() { noiseBurst(0.18, 0.12); tone(900, 0.2, 'sawtooth', 0.04, 120); },
      heavy() { noiseBurst(0.4, 0.22); tone(160, 0.45, 'sawtooth', 0.08, 40); },
      dodge() { noiseBurst(0.12, 0.05); tone(500, 0.15, 'sine', 0.03, 900); },
      miss() { tone(240, 0.12, 'square', 0.03, 180); },
      crack() { noiseBurst(0.3, 0.18); tone(1400, 0.12, 'square', 0.03, 300); },
      repair() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.035), i * 140)); },
      clank() { noiseBurst(0.15, 0.16); tone(110, 0.3, 'square', 0.07, 70); },
      lock() { tone(220, 0.08, 'square', 0.05); setTimeout(() => tone(330, 0.12, 'square', 0.05), 90); },
      appear() { tone(70, 2, 'sine', 0.06, 150); },
      optGone() { for (let i = 0; i < 6; i++) setTimeout(() => tone(200 + Math.random() * 900, 0.03, 'square', 0.03), i * 45); },
      vanish() { tone(600, 1.3, 'sine', 0.04, 60); noiseBurst(0.9, 0.05); },
      coreBreak() { noiseBurst(1.3, 0.25); tone(90, 1.5, 'sawtooth', 0.09, 25); },
      dismantle() { tone(300, 3, 'sine', 0.03, 600); },
      type() { tone(900 + Math.random() * 200, 0.02, 'square', 0.02); },
    };
  })();

  /* ---------- Música: Rachmaninoff, Concierto para piano n.º 2 (grabación de dominio público en la UE) ----------
     La intro va en silencio. Cuando el casco empieza a llegar, la música entra en los últimos
     acordes del piano para que los violines coincidan justo con la armadura ya puesta. */
  const music = new Audio('audio/rachmaninoff-concierto2-mov1-b.ogg');
  music.preload = 'auto';
  const MUSIC_VOL = 0.55;
  /* Segundo exacto en que entran los violines (medido con un análisis de energía del audio) */
  const VIOLIN_SYNC_T = 22.5;
  let musicFade = null;
  function fadeMusic(to, ms) {
    clearInterval(musicFade);
    const from = music.volume, t0 = performance.now();
    musicFade = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      music.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) { clearInterval(musicFade); if (to === 0) music.pause(); }
    }, 40);
  }
  function startMusic(at, fadeMs) {
    try { music.currentTime = Math.max(0, at); } catch (e) {}
    music.volume = 0; music.play().catch(() => {});
    fadeMusic(MUSIC_VOL, fadeMs);
  }
  function musicReady(maxMs) {
    if (music.readyState >= 1) return Promise.resolve();
    return new Promise((r) => { music.addEventListener('loadedmetadata', r, { once: true }); setTimeout(r, maxMs); });
  }

  /* ---------- Sprite de Débora (ver boss.js) ---------- */
  const sprite = window.Boss ? new window.Boss($('#bossCanvas')) : null;

  /* ---------- Estado ---------- */
  const player = { hp: 92, hpMax: 92, lv: 1 };
  const st = {
    route: 'none',        /* 'none' (aún no la has atacado) | 'fight' */
    fights: 0,            /* veces que has elegido ATACAR */
    impact: false,        /* ya ha habido primer gran impacto */
    hits: 0,              /* golpes que han entrado después del primer impacto */
    peace: 0,             /* turnos pacifistas (ACTUAR o PERDONAR sin haberla atacado nunca) */
    p1: 0,                /* por qué ataque de la fase I va */
    drop: [],             /* opciones del menú que tienen que desaparecer en tu próximo turno */
  };
  const DEAD = new Error('sin PS');
  /* Atajos de prueba para revisar la historia sin tener que esquivar (ver el final del archivo) */
  const q = new URLSearchParams(location.search);
  const TEST = { immortal: q.get('inmortal') === '1', speed: q.get('rapido') === '1' ? 0.15 : 1 };
  let mode = 'none';      /* none | talk | wait | menu | sub | aim | box | final */

  function updatePlayerHud() {
    $('#plHpFill').style.width = Math.max(0, (player.hp / player.hpMax) * 100) + '%';
    $('#plHpNum').textContent = Math.max(0, player.hp) + '/' + player.hpMax;
    $('#plLv').textContent = player.lv;
  }

  /* ---------- Escenas: qué partes de la pantalla se ven (el CSS de secret.html hace el resto) ---------- */
  const battle = $('#battle');
  function setScene(name) { battle.dataset.scene = name; updateHint(); }
  function updateHint() {
    const k = { talk: 'hintTalk', wait: 'hintWait', menu: 'hintMenu', sub: 'hintSub', aim: 'hintAim', box: 'hintBox', final: 'hintFinal' }[mode];
    $('#hint').textContent = k ? t(k) : '';
  }
  function shake() { battle.classList.remove('shake'); void battle.offsetWidth; battle.classList.add('shake'); }
  /* Rectángulo de un elemento en coordenadas de #battle */
  function relRect(el) {
    const b = battle.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
  }

  /* ---------- Textos: el narrador escribe en la caja; Débora, en su burbuja ---------- */
  let talk = null;
  function placeBubble() {
    const bub = $('#bubble'), r = relRect($('#bossCanvas')), bw = battle.clientWidth;
    let left = r.x + r.w * 0.8, top = r.y + r.h * 0.1;
    if (bw - left < 170) { left = Math.max(8, bw - 200); top = Math.max(4, r.y - 6); }
    bub.style.left = left + 'px'; bub.style.top = top + 'px';
    bub.style.maxWidth = Math.max(150, Math.min(230, bw - left - 8)) + 'px';
  }
  function say(line, o = {}) {
    return new Promise((resolve) => {
      const deb = line.who === 'deb', el = deb ? $('#bubble') : $('#dialogue');
      if (deb) { placeBubble(); el.hidden = false; } else $('#bubble').hidden = true;
      if (deb && sprite) { if (line.mood) sprite.setMood(line.mood, 6); sprite.setTalking(true); }
      talk = { line, el, deb, i: 0, hold: 0, typing: true, resolve };
      mode = 'talk'; updateHint();
      el.textContent = '';
      if (o.onStart) o.onStart();
      const speed = deb ? (line.slow ? 70 : 40) : 26;
      talk.timer = setInterval(() => {
        if (talk.hold > 0) { talk.hold--; return; }
        const full = tr(line), ch = full[talk.i++];
        el.textContent = full.slice(0, talk.i);
        if (ch && /[\p{L}\p{N}]/u.test(ch)) (deb ? sfx.voice : sfx.blip)();
        if (ch && '.,?!'.includes(ch)) talk.hold = deb ? 5 : 3;       /* pausa en los signos, como al hablar */
        if (talk.i >= full.length) endTyping();
      }, speed);
    });
  }
  function endTyping() {
    clearInterval(talk.timer); talk.typing = false;
    talk.el.textContent = tr(talk.line);
    if (talk.deb && sprite) sprite.setTalking(false);
  }
  function advance() {
    if (!talk) return;
    if (talk.typing) { endTyping(); return; }                       /* primera pulsación: termina de escribir */
    const done = talk; talk = null;
    if (done.deb) $('#bubble').hidden = true;
    mode = 'none'; updateHint();
    done.resolve();
  }
  async function sayAll(lines) { for (const l of lines) await say(l); }
  /* Espera a que el jugador pulse cualquier tecla (hace falta para que el navegador deje sonar la música) */
  let waitResolve = null;
  function waitKey() { return new Promise((r) => { waitResolve = r; mode = 'wait'; updateHint(); }); }

  /* ---------- Menú ---------- */
  let menuSel = 0, subSel = 0, sub = null, menuResolve = null;
  const menuButtons = () => $$('#menu button').filter((b) => !b.hidden);
  function flavor() {
    if (st.route === 'fight') return !st.impact ? S.flavor.p1 : st.hits < 2 ? S.flavor.p2 : S.flavor.p3;
    if (st.peace >= 8) return S.flavor.late;
    if (st.peace >= 5) return S.flavor.mid;
    return S.flavor.p1;
  }
  async function playerTurn() {
    setScene('menu'); closeSubs();
    $('#dialogue').textContent = tr(flavor());
    /* ruta de lucha: las opciones que ya no tienen sentido se rompen y desaparecen */
    if (st.drop.length) {
      mode = 'none'; renderMenu();
      await pause(350);
      for (const act of st.drop.splice(0)) {
        const b = $('#menu button[data-act="' + act + '"]');
        b.classList.add('glitch-out'); sfx.optGone();
        await pause(700);
        b.hidden = true; b.classList.remove('glitch-out');
      }
    }
    menuSel = Math.min(menuSel, menuButtons().length - 1);
    mode = 'menu'; updateHint(); renderMenu();
    return new Promise((resolve) => { menuResolve = resolve; });
  }
  function renderMenu() {
    const btns = menuButtons();
    $$('#menu button').forEach((b) => b.classList.toggle('is-sel', (mode === 'menu' || mode === 'sub') && b === btns[menuSel]));
  }
  function chooseMenu(act) {
    sfx.confirm();
    if (act === 'fight') pick({ type: 'fight' });
    else openSub(act);
  }
  function openSub(which) {
    sub = which; subSel = 0; mode = 'sub';
    $('#menu').classList.add('off');
    $$('.sub').forEach((s) => s.classList.toggle('show', s.id === which + 'Sub'));
    renderSub(); updateHint();
  }
  function closeSubs() { sub = null; $('#menu').classList.remove('off'); $$('.sub').forEach((s) => s.classList.remove('show')); }
  function subEntries() { return sub === 'act' ? ACTS : sub === 'item' ? ITEMS.filter((i) => i.qty > 0) : sub === 'mercy' ? MERCY : []; }
  function renderSub() {
    if (!sub) return;
    const list = $('#' + sub + 'List'), entries = subEntries();
    list.innerHTML = '';
    entries.forEach((e, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = tr(e.label) + (e.qty ? ' ×' + e.qty : '');
      b.classList.toggle('is-sel', i === subSel);
      b.addEventListener('mouseenter', () => { subSel = i; renderSub(); });
      b.addEventListener('click', (ev) => { ev.stopPropagation(); subSel = i; pickSub(i); });
      list.appendChild(b);
    });
    const e = entries[subSel];
    $('#' + sub + 'Desc').textContent = sub === 'item' ? (e ? t('restores').replace('{n}', e.heal) : t('empty')) : '';
  }
  function pickSub(i) { const e = subEntries()[i]; if (e) { sfx.confirm(); pick({ type: sub, entry: e }); } }
  function pick(a) {
    const r = menuResolve; menuResolve = null;
    closeSubs(); mode = 'none'; renderMenu(); updateHint();
    if (r) r(a);
  }

  /* ---------- Barra de ataque: una línea recorre el objetivo; pulsa cuando pase por el centro ---------- */
  let aimPress = null;
  function aimBar() {
    return new Promise((resolve) => {
      setScene('aim'); mode = 'aim'; updateHint();
      const c = $('#aim');
      c.width = c.clientWidth; c.height = c.clientHeight;
      const g = c.getContext('2d'), W = c.width, H = c.height, DUR = 1.3, t0 = performance.now();
      let x = 10, stopX = null, stopT = 0;
      aimPress = () => { if (stopX === null) { stopX = x; stopT = performance.now(); sfx.slash(); } };
      (function frame(now) {
        const k = (now - t0) / 1000 / DUR;
        if (stopX === null) x = 10 + Math.min(1, k) * (W - 20);
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        /* objetivo: bandas verticales que se calientan hacia el centro, en forma de lente */
        for (let bx = 8; bx < W - 8; bx += 4) {
          const d = Math.abs(bx - W / 2) / (W / 2), bh = (H * 0.42) * Math.sqrt(Math.max(0, 1 - d * d));
          g.fillStyle = d < 0.08 ? '#ff3232' : d < 0.3 ? '#ff9d1f' : d < 0.6 ? '#ffd400' : '#2ea043';
          g.fillRect(bx, H / 2 - bh, 2, bh * 2);
        }
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.ellipse(W / 2, H / 2, W / 2 - 8, H * 0.44, 0, 0, Math.PI * 2); g.stroke();
        /* la línea que se mueve (parpadea al pararla) */
        const flash = stopX !== null && Math.floor((now - stopT) / 60) % 2 === 0;
        g.fillStyle = '#000'; g.fillRect(x - 5, 4, 10, H - 8);
        g.fillStyle = flash ? '#ffd400' : '#fff'; g.fillRect(x - 3, 6, 6, H - 12);
        if (stopX === null && k >= 1) { aimPress = null; mode = 'none'; resolve({ hit: false }); return; }
        if (stopX !== null && now - stopT > 380) { aimPress = null; mode = 'none'; resolve({ hit: true, acc: 1 - Math.abs(stopX - W / 2) / (W / 2) }); return; }
        requestAnimationFrame(frame);
      })(t0);
    });
  }

  /* ---------- Capa #fx: efectos que viven fuera de la caja (el alma en la oscuridad, cortes, «FALLO») ---------- */
  const fxC = $('#fx'), fx = fxC.getContext('2d');
  const overlays = [];                      /* funciones (g, now) que dibujan; devuelven false al acabar */
  let boxActive = false, ovRaf = 0;
  function syncFx() { if (fxC.width !== battle.clientWidth || fxC.height !== battle.clientHeight) { fxC.width = battle.clientWidth; fxC.height = battle.clientHeight; } }
  function drawOverlays(g, now) { for (let i = overlays.length - 1; i >= 0; i--) if (!overlays[i](g, now)) overlays.splice(i, 1); }
  function addOverlay(fn) { overlays.push(fn); kickOverlay(); }
  function kickOverlay() {
    if (boxActive || ovRaf || !overlays.length) return;
    ovRaf = requestAnimationFrame(function loop(now) {
      ovRaf = 0;
      if (boxActive) return;                /* durante los ataques los dibuja el bucle de la caja */
      syncFx(); fx.clearRect(0, 0, fxC.width, fxC.height);
      drawOverlays(fx, now);
      if (overlays.length) ovRaf = requestAnimationFrame(loop);
    });
  }
  /* El alma en la oscuridad: justo donde luego aparecerá la arena */
  const HEART_PIX = ['.11.11.', '1111111', '1111111', '.11111.', '..111..', '...1...'];
  const HS = 2, heartW = HEART_PIX[0].length * HS, heartH = HEART_PIX.length * HS;
  function drawHeart(g, x, y, alpha = 1) {
    g.globalAlpha = alpha; g.fillStyle = '#ff2d2d';
    for (let r = 0; r < HEART_PIX.length; r++) for (let c = 0; c < HEART_PIX[r].length; c++) if (HEART_PIX[r][c] === '1') g.fillRect(Math.round(x) + c * HS, Math.round(y) + r * HS, HS, HS);
    g.globalAlpha = 1;
  }
  let soul = null;
  function showSoul() {
    soul = { a: 0 };
    addOverlay((g) => {
      if (!soul) return false;
      const r = relRect($('#box'));
      soul.a = Math.min(1, soul.a + 0.02);
      drawHeart(g, r.x + 3 + r.w / 2 - 3 - heartW / 2, r.y + 3 + r.h / 2 - 3 - heartH / 2, soul.a);
      return true;
    });
  }
  /* Corte sobre Débora. kind: 'hit', 'heavy' (golpes finales), 'miss' (no pulsaste) o 'dodge' (te esquiva) */
  function slashFx(kind) {
    return new Promise((resolve) => {
      const r = relRect($('#bossCanvas')), cx = r.x + r.w / 2, cy = r.y + r.h * 0.45, t0 = performance.now();
      if (kind === 'dodge') { const bc = $('#bossCanvas'); bc.classList.remove('dodge'); void bc.offsetWidth; bc.classList.add('dodge'); sfx.dodge(); }
      if (kind === 'miss') sfx.miss();
      addOverlay((g, now) => {
        const k = (now - t0) / 1000;
        if (kind !== 'miss' && k < 0.5) {
          const grow = Math.min(1, k / 0.2), fade = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.2, L = r.w * (kind === 'heavy' ? 0.55 : 0.4);
          g.save(); g.globalAlpha = fade; g.translate(cx, cy); g.rotate(-0.9);
          g.fillStyle = '#ff2d2d'; g.fillRect(-L, -4, L * 2 * grow, 8);
          g.fillStyle = '#fff'; g.fillRect(-L, -1.5, L * 2 * grow, 3);
          g.restore();
        }
        if ((kind === 'miss' || kind === 'dodge') && k > 0.15) {
          g.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.8) / 0.4);
          g.font = '16px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#c8c8c8';
          g.fillText(t('miss'), cx, r.y + r.h * 0.2 - k * 24);
          g.globalAlpha = 1;
        }
        if (k > 1.2) { resolve(); return false; }
        return true;
      });
    });
  }

  /* ---------- Caja de esquivar (motor genérico: ver PATRONES arriba) ---------- */
  const cv = $('#box'), ctx2d = cv.getContext('2d');
  ctx2d.imageSmoothingEnabled = false;

  /* Dibujo de los proyectiles: cada tipo tiene su tamaño de choque (SHOT_SIZE) y su dibujo (SHOT_ART) */
  const SHOT_SIZE = { glyph: [10, 13], tear: [11, 14], ram: [30, 10], virus: [14, 14], virusS: [10, 10], frag: [6, 6], error: [46, 28], glitch: [24, 14], shard: [14, 12] };
  const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓ0123456789';
  const rndGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  /* Dibuja una máscara de texto ('#' = pintar) en bloques de k x k, con un color por fila */
  function mask(g, x, y, rows, colorOf, k = 1) {
    rows.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] !== '.') { g.fillStyle = colorOf(r, c, row[c]); g.fillRect(x + c * k, y + r * k, k, k); } });
  }
  const TEAR_PIX = ['.....#.....', '.....#.....', '....###....', '....###....', '...#####...', '..#######..', '.#########.', '.#########.',
    '###########', '###########', '###########', '.#########.', '..#######..', '....###....'];
  const TEAR_COL = ['#dff2ff', '#cdeaff', '#b6e0ff', '#9fd5ff', '#86c8ff', '#6db9fb', '#58aaf3', '#4a9be8', '#3f8ddc', '#3580cf', '#2d73c1', '#2667b2', '#205ba2', '#1b4f90'];
  /* las que van a cambiar de dirección son turquesa: así se pueden leer */
  const TEAR_TURN = TEAR_COL.map((_, i) => { const k = i / 13; return 'rgb(' + Math.round(225 - 210 * k) + ',' + Math.round(255 - 150 * k) + ',' + Math.round(245 - 150 * k) + ')'; });
  const GLITCH_COLS = ['#ff2bd6', '#22d3ee', '#ffffff', '#000000', '#39ff7a', '#ffd400'];
  const SHOT_ART = {
    glyph(g, x, y, b) {
      g.fillStyle = 'rgba(0,28,10,.85)'; g.fillRect(x, y, b.w, b.h);
      g.font = 'bold 11px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (!b.ch || Math.random() < 0.02) b.ch = rndGlyph();                      /* los símbolos van cambiando */
      g.fillStyle = b.head ? '#eafff0' : '#39ff7a';
      g.fillText(b.ch, x + b.w / 2, y + b.h / 2 + 1);
    },
    tear(g, x, y, b) {
      mask(g, x + 2, y + 2, TEAR_PIX, () => 'rgba(5,20,50,.55)');                  /* sombra */
      mask(g, x, y, TEAR_PIX, (r) => (b.turn ? TEAR_TURN : TEAR_COL)[r]);
      g.fillStyle = '#fff'; g.fillRect(x + 3, y + 7, 1, 2); g.fillRect(x + 4, y + 6, 1, 1);   /* brillo */
    },
    /* Carta RAM: placa verde, chips negros y contactos dorados (tumbada o de pie) */
    ram(g, x, y, b) {
      const v = b.h > b.w, L = v ? b.h : b.w, T = v ? b.w : b.h;
      g.save(); g.translate(x, y); if (v) { g.translate(T, 0); g.rotate(Math.PI / 2); }
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(2, 2, L, T);                     /* sombra */
      g.fillStyle = '#0d5a2a'; g.fillRect(0, 0, L, T);
      g.fillStyle = '#1a8a45'; g.fillRect(0, 0, L, 1);
      g.fillStyle = '#111418'; for (let k = 2; k + 5 <= L - 2; k += 7) g.fillRect(k, 2, 5, T - 5);   /* chips */
      g.fillStyle = '#e0b04a'; for (let k = 1; k < L - 1; k += 2) g.fillRect(k, T - 2, 1, 2);      /* contactos */
      g.fillStyle = '#0d5a2a'; g.fillRect(Math.round(L * 0.55), T - 2, 2, 2);                        /* muesca */
      g.restore();
    },
    /* Virus: bola roja con pinchos que gira (parpadea en blanco antes de explotar) */
    virus(g, x, y, b, t) {
      const s = b.w / 14;
      g.save(); g.translate(x + b.w / 2, y + b.h / 2); g.rotate((t - b.born) * 1.6); g.scale(s, s);
      if (b.life && b.age > b.life - 0.4) g.globalAlpha = Math.max(0, (b.life - b.age) / 0.4);
      for (let k = 0; k < 8; k++) {
        g.save(); g.rotate(k * Math.PI / 4);
        g.fillStyle = '#6b0a14'; g.fillRect(3, -1, 4, 2);
        g.fillStyle = '#ff6a78'; g.fillRect(6, -1.5, 2, 3);
        g.restore();
      }
      g.fillStyle = '#6b0a14'; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = b.blink && Math.floor(t * 16) % 2 ? '#ffffff' : '#e0283a'; g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff9aa5'; g.fillRect(-2.5, -2.5, 2, 2);
      g.fillStyle = '#3d0209'; g.fillRect(0.5, 0.5, 1.5, 1.5); g.fillRect(-1.5, 1.5, 1, 1);
      g.restore();
    },
    virusS(g, x, y, b, t) { SHOT_ART.virus(g, x, y, b, t); },
    frag(g, x, y) { g.fillStyle = '#6b0a14'; g.fillRect(x, y, 6, 6); g.fillStyle = '#ff4a5a'; g.fillRect(x + 1, y + 1, 4, 4); g.fillStyle = '#ffd6da'; g.fillRect(x + 1, y + 1, 2, 1); },
    error(g, x, y, b) {
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x + 2, y + 2, b.w, b.h);             /* sombra */
      g.fillStyle = '#d7d7d7'; g.fillRect(x, y, b.w, b.h);
      g.fillStyle = '#2a4fc9'; g.fillRect(x, y, b.w, 7);                               /* barra de título */
      g.fillStyle = '#e23a3a'; g.fillRect(x + b.w - 7, y + 1, 5, 5);
      g.fillStyle = '#fff'; g.font = 'bold 6px "JetBrains Mono", monospace'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('ERROR', x + 2, y + 0.5);
      g.fillStyle = '#e23a3a'; g.beginPath(); g.arc(x + 9, y + 17, 5, 0, Math.PI * 2); g.fill();   /* icono (x) */
      g.fillStyle = '#fff'; g.fillRect(x + 7, y + 16, 5, 2);
      g.fillStyle = '#6b6b6b'; g.fillRect(x + 17, y + 13, 24, 2); g.fillRect(x + 17, y + 18, 18, 2);
    },
    /* Glitch: un trozo de pantalla corrupta que no para de cambiar */
    glitch(g, x, y, b) {
      const jy = Math.round((Math.random() - 0.5) * 2);
      for (let yy = 0; yy < b.h; yy += 2) for (let xx = 0; xx < b.w; xx += 2) {
        g.fillStyle = GLITCH_COLS[(Math.random() * GLITCH_COLS.length) | 0];
        g.fillRect(x + xx, y + yy + jy, 2, 2);
      }
      g.fillStyle = '#fff'; g.fillRect(x - 2, y + jy + (Math.random() * b.h | 0), b.w + 4, 1);
    },
    shard(g, x, y, b, t) {
      g.save(); g.translate(x + b.w / 2, y + b.h / 2); g.rotate((t - b.born) * b.spin);
      g.fillStyle = '#2c2f37'; g.beginPath(); g.moveTo(-7, -5); g.lineTo(6, -6); g.lineTo(7, 2); g.lineTo(-1, 6); g.lineTo(-6, 3); g.closePath(); g.fill();
      g.fillStyle = '#454b57'; g.fillRect(-6, -5, 11, 2);                              /* brillo del metal */
      g.fillStyle = '#e02323'; g.fillRect(-1, -6, 2, 11);                              /* franja roja de la cresta */
      g.restore();
    },
  };
  function drawShot(g, b, t) { (SHOT_ART[b.sprite] || SHOT_ART.glyph)(g, Math.round(b.x), Math.round(b.y), b, t); }

  /* Zonas que avisan y golpean: contorno rojo parpadeante y luego su dibujo */
  function drawBlast(g, b) {
    const x = Math.round(b.x), y = Math.round(b.y);
    if (b.phase === 'charge') {
      g.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(b.t * 18));
      g.fillStyle = 'rgba(255,50,50,.28)'; g.fillRect(x, y, b.w, b.h);
      g.strokeStyle = '#ff3232'; g.lineWidth = 1; g.setLineDash([3, 2]); g.strokeRect(x + 0.5, y + 0.5, b.w - 1, b.h - 1); g.setLineDash([]);
      g.globalAlpha = 1;
      return;
    }
    if (b.art === 'ram') { SHOT_ART.ram(g, x, y, b); return; }
    if (b.art === 'crush') {                                               /* bloque de código que aplasta la esquina */
      g.fillStyle = 'rgba(0,40,14,.95)'; g.fillRect(x, y, b.w, b.h);
      g.font = 'bold 11px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let yy = y + 7; yy < y + b.h; yy += 13) for (let xx = x + 6; xx < x + b.w; xx += 12) { g.fillStyle = Math.random() < 0.1 ? '#eafff0' : '#39ff7a'; g.fillText(rndGlyph(), xx, yy); }
      return;
    }
    const n = Math.max(1, Math.round(b.w / 9)), sw = b.w / n;               /* cuchillas */
    for (let k = 0; k < n; k++) {
      const sx = x + k * sw;
      g.fillStyle = '#8a93a6'; g.beginPath(); g.moveTo(sx, y + b.h); g.lineTo(sx + sw / 2, y); g.lineTo(sx + sw, y + b.h); g.closePath(); g.fill();
      g.fillStyle = '#e6ebf2'; g.beginPath(); g.moveTo(sx + sw / 2, y); g.lineTo(sx + sw / 2 + 1.5, y + b.h); g.lineTo(sx + sw / 2 - 0.5, y + b.h); g.closePath(); g.fill();
    }
  }

  /* ---------- Dibujos de los ataques de sus manos (en la capa #fx, encima de todo) ----------
     Se dibujan en «píxeles gordos» para que peguen con el resto del juego.
     `ang` es hacia dónde apuntan (0 = hacia la derecha). */
  const MET = { dk: '#1c1e24', lo: '#22262e', base: '#3a3f4a', hi: '#4d5361', cyan: '#5fb7dd', red: '#ff2b2b', redHi: '#ffd6d6' };
  let PS = 2;                                                 /* tamaño de cada «píxel gordo» */
  function px2(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x * PS, y * PS, w * PS, h * PS); }

  /* Puño cohete: antebrazo con llama detrás, puño y nudillos delante */
  function drawRocketFist(g, x, y, ang, flame) {
    PS = 3;
    g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(ang);
    if (flame) {
      const f = 3 + Math.round(Math.random() * 3);
      px2(g, -8 - f, -2, f, 4, '#ff6a1f'); px2(g, -8 - f + 1, -1, f - 1, 2, '#ffd23f');
    }
    px2(g, -8, -3, 4, 6, MET.lo); px2(g, -5, -3, 1, 6, MET.cyan);                 /* antebrazo y puño de la manga */
    px2(g, -4, -5, 9, 10, MET.base); px2(g, -4, -5, 9, 1, MET.hi); px2(g, -4, 4, 9, 1, MET.lo);
    for (let k = 0; k < 4; k++) { px2(g, 5, -5 + k * 2.5, 2, 2, MET.hi); px2(g, 5, -3 + k * 2.5, 2, 0.5, MET.dk); }   /* nudillos */
    px2(g, -1, -1, 2, 2, MET.red);
    g.restore();
  }

  /* Mano-blaster: palma abierta hacia el objetivo con un repulsor en el centro.
     open (0..1) abre los dedos; glow (0..1) es la carga del núcleo */
  function drawBlasterHand(g, x, y, ang, open, glow, alpha) {
    PS = 3.5;
    g.save(); g.globalAlpha = alpha; g.translate(Math.round(x), Math.round(y)); g.rotate(ang);
    px2(g, -13, -3, 7, 6, MET.lo); px2(g, -8, -3, 1, 6, MET.cyan);                /* antebrazo */
    px2(g, -6, -7, 8, 14, MET.base); px2(g, -6, -7, 8, 1, MET.hi); px2(g, -6, 6, 8, 1, MET.lo);   /* palma */
    for (let k = 0; k < 4; k++) {                                                  /* dedos, que se abren en abanico */
      g.save(); g.translate(4 * PS, (-5 + k * 3.4) * PS); g.rotate((k - 1.5) * (0.18 + 0.42 * open));
      px2(g, 0, -1, 6, 2.2, MET.base); px2(g, 0, -1, 6, 0.7, MET.hi); px2(g, 3, -1, 0.6, 2.2, MET.dk);
      g.restore();
    }
    g.save(); g.translate(-2 * PS, -6 * PS); g.rotate(-0.9 - 0.5 * open); px2(g, 0, -1, 5, 2.2, MET.base); g.restore();   /* pulgar */
    /* repulsor: halo y núcleo que crecen con la carga */
    const r = 3 + glow * 4;
    g.globalAlpha = alpha * (0.25 + 0.45 * glow); g.fillStyle = MET.red;
    g.beginPath(); g.arc(2 * PS, 0, r * PS + 5, 0, Math.PI * 2); g.fill();
    g.globalAlpha = alpha; g.fillStyle = glow > 0.85 ? '#fff' : MET.red;
    g.beginPath(); g.arc(2 * PS, 0, r * PS * 0.7, 0, Math.PI * 2); g.fill();
    g.fillStyle = MET.redHi; g.fillRect(2 * PS - 3, -3, 4, 4);
    g.restore();
  }

  /* Rayo: sale de la palma y cruza toda la pantalla. w = anchura en píxeles */
  function drawBeam(g, x, y, ang, w, alpha) {
    g.save(); g.translate(x, y); g.rotate(ang);
    const L = 2000, flick = 0.85 + Math.random() * 0.15;
    g.globalAlpha = alpha * 0.45; g.fillStyle = MET.red; g.fillRect(8, -w / 2 - 3, L, w + 6);
    g.globalAlpha = alpha * flick; g.fillStyle = '#fff'; g.fillRect(8, -w / 2, L, w);
    g.globalAlpha = alpha; g.fillStyle = '#fff';
    g.beginPath(); g.arc(8, 0, w / 2 + 3, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  /* «!» de aviso, en píxeles de 3x3 con fondo negro para que se lea sobre cualquier cosa */
  const WARN_PIX = ['.#.', '###', '###', '###', '.#.', '.#.', '...', '.#.', '.#.'];
  function drawWarn(g, x, y, t) {
    const on = Math.floor(t * 12) % 2 === 0;
    const X = Math.round(x), Y = Math.round(y);
    g.fillStyle = '#000'; g.fillRect(X - 7, Y - 16, 14, 32);
    g.fillStyle = on ? '#ffd400' : '#ff3232';
    WARN_PIX.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') g.fillRect(X - 4 + c * 3, Y - 13 + r * 3, 3, 3); }));
  }

  /* runBox(spec) -> Promise: un ataque entero. spec = ATTACKS[nombre] + { forming, freezeAt, onFreeze } */
  function runBox(spec) {
    return new Promise((resolve, reject) => {
      setScene('box'); mode = 'box'; boxActive = true; updateHint();
      cv.classList.remove('vanish', 'forming', 'hit'); void cv.offsetWidth;
      if (spec.forming) cv.classList.add('forming');                  /* la primera vez, nace alrededor del alma */
      soul = null;
      if (sprite) sprite.attack({ mood: spec.mood, hands: spec.hands });   /* su cara y sus manos cambian mientras ELLA ataca */
      const W = cv.width, H = cv.height, PAD = 4;
      const heart = { x: W / 2 - heartW / 2, y: H / 2 - heartH / 2, speed: 250 };   /* rápido: hay mucho que esquivar */
      const HIT_R = 2.5;
      let shots = [], blasts = [], fists = [], blasters = [];
      const timers = [], pending = [];
      let invuln = 0, elapsed = 0, frozen = false, done = false;
      /* Posiciones en coordenadas de la caja (0,0 = su esquina); en la capa #fx se trasladan al dibujar */
      let ox = 0, oy = 0;
      function syncBox() { syncFx(); const r = relRect(cv); ox = r.x + cv.clientLeft; oy = r.y + cv.clientTop; }
      syncBox();
      /* De píxel del sprite de Débora a coordenadas de la caja (para que el puño salga de SU muñeca) */
      let fistSide = 1;
      function wristInBox(side) {
        if (!sprite) return { x: W / 2 + side * 60, y: -90 };
        const w = sprite.wristPos(side), r = $('#bossCanvas').getBoundingClientRect(), cr = cv.getBoundingClientRect(), k = r.width / 96;
        return { x: r.left + w.x * k - (cr.left + cv.clientLeft), y: r.top + w.y * k - (cr.top + cv.clientTop) };
      }
      const ease = (e) => e * e * (3 - 2 * e);
      const keys = {};
      function key(e) { keys[e.key] = e.type === 'keydown'; if (e.key.startsWith('Arrow')) e.preventDefault(); }
      addEventListener('keydown', key); addEventListener('keyup', key);

      /* API que usan las funciones de PATRONES */
      const api = {
        W, H, PAD,
        heartPos() { return { x: heart.x + heartW / 2, y: heart.y + heartH / 2 }; },
        spawnShot(sprite, x, y, vx, vy, o = {}) {
          const s = SHOT_SIZE[sprite] || [10, 13];
          pending.push(Object.assign({ sprite, x, y, w: s[0], h: s[1], vx, vy, age: 0, born: performance.now() / 1000 }, o,
            o.kind ? { beh: (b, dt) => VIRUS[b.kind](b, dt, api) } : {}));
        },
        spawnBlast(x, y, w, h, telegraph, fire, art) { blasts.push({ x, y, w, h, telegraph, fire, art: art || 'blade', t: 0, phase: 'charge' }); },
        /* Puño: sale de su muñeca -> se coloca fuera de la caja siguiéndote -> «!» -> cruza la caja */
        launchFist(o = {}) {
          fistSide = -fistSide;
          if (sprite && !sprite.armOK(fistSide)) fistSide = -fistSide;   /* ese brazo ya no responde: usa el otro */
          const start = wristInBox(fistSide);
          if (sprite) sprite.launch(fistSide);
          sfx.launch();
          const edge = o.edge || ['left', 'right', 'top', 'bottom'][Math.floor(Math.random() * 4)];
          fists.push({ phase: 'launch', t: 0, edge, sx: start.x, sy: start.y, x: start.x, y: start.y, ang: Math.PI / 2, speed: o.speed || 320, open: o.open });
        },
        /* Mano-blaster: entra girando desde fuera, apunta, carga y dispara. away: apunta lejos de ti */
        spawnBlaster(o = {}) {
          const spots = [
            () => ({ x: -62, y: 20 + Math.random() * (H - 40) }), () => ({ x: W + 62, y: 20 + Math.random() * (H - 40) }),
            () => ({ x: 30 + Math.random() * (W - 60), y: -60 }), () => ({ x: -52, y: -52 }), () => ({ x: W + 52, y: -52 }),
          ];
          const s = spots[o.spot != null ? o.spot % spots.length : Math.floor(Math.random() * spots.length)]();
          blasters.push({ phase: 'enter', t: 0, x: s.x, y: s.y, ang: 0, telegraph: o.telegraph || 0.7, fire: o.fire || 0.3, w: 24, away: o.away });
          sfx.whoosh();
        },
        /* Secuenciador: recorre la partitura a BPM y llama a la acción de cada letra */
        rhythm(score, actions) {
          const steps = score.replace(/[|\s]/g, ''), step = 30 / BPM;      /* una corchea */
          let acc = 0, i = 0;
          const count = {};                                                 /* cuántas veces ha sonado cada letra */
          timers.push((dt) => {
            if (dt > 5) dt = 0;                                            /* la llamada inicial «ya» */
            acc -= dt;
            while (acc <= 0) {
              const ch = steps[i % steps.length];
              if (actions[ch]) { count[ch] = (count[ch] || 0) + 1; actions[ch](count[ch] - 1); }
              i++; acc += step;
            }
          });
        },
        tick(fn) { timers.push((dt) => { if (dt <= 5) fn(dt); }); },
        /* Final de la ruta de lucha: la arena, el alma y los proyectiles desaparecen */
        vanish() { cv.classList.add('vanish'); fists = []; blasters = []; sfx.vanish(); return pause(1400); },
      };
      spec.voices.forEach(([name, o]) => PATTERNS[name](api, o || {}));
      /* La primera oleada, ya */
      timers.forEach((fn) => fn(999));

      function hurt() {
        if (invuln > 0 || TEST.immortal) return;
        player.hp = Math.max(0, player.hp - spec.dmg); invuln = 1; updatePlayerHud();
        cv.classList.remove('hit', 'forming'); void cv.offsetWidth; cv.classList.add('hit');   /* reinicia la animación aunque se solape */
        sfx.hurt();
      }

      let last = performance.now();
      function frame(now) {
        const dt = Math.min(0.033, (now - last) / 1000); last = now;
        if (!frozen) {
          elapsed += dt;
          timers.forEach((fn) => fn(dt));
          let dx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), dy = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
          if (dx || dy) { const l = Math.hypot(dx, dy); dx /= l; dy /= l; }
          heart.x = Math.min(W - PAD - heartW, Math.max(PAD, heart.x + dx * heart.speed * dt));
          heart.y = Math.min(H - PAD - heartH, Math.max(PAD, heart.y + dy * heart.speed * dt));

          const hx = heart.x + heartW / 2, hy = heart.y + heartH / 2;
          shots = shots.filter((b) => {
            b.age += dt;
            if (b.beh) b.beh(b, dt, api);
            b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.bounce) {                                            /* rebota dentro de la caja una vez que ha entrado */
              if (!b.inside) b.inside = b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H;
              else {
                if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); } if (b.x + b.w > W) { b.x = W - b.w; b.vx = -Math.abs(b.vx); }
                if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); } if (b.y + b.h > H) { b.y = H - b.h; b.vy = -Math.abs(b.vy); }
              }
            }
            if (b.dead || (b.life && b.age > b.life)) return false;
            if (b.y + b.h < -40 || b.y > H + 40 || b.x + b.w < -60 || b.x > W + 60) return false;
            const cx = Math.max(b.x, Math.min(hx, b.x + b.w)), cy = Math.max(b.y, Math.min(hy, b.y + b.h));
            if (Math.hypot(hx - cx, hy - cy) < HIT_R) hurt();
            return true;
          });
          shots.push(...pending); pending.length = 0;

          blasts = blasts.filter((b) => {
            b.t += dt;
            if (b.phase === 'charge' && b.t >= b.telegraph) { b.phase = 'fire'; b.t = 0; }
            else if (b.phase === 'fire') {
              if (hx > b.x && hx < b.x + b.w && hy > b.y && hy < b.y + b.h) hurt();
              if (b.t >= b.fire) return false;
            }
            return true;
          });
          /* --- puños --- */
          fists = fists.filter((f) => {
            f.t += dt;
            const h = api.heartPos();
            const stage = { left: { x: -40, y: h.y, a: 0 }, right: { x: W + 40, y: h.y, a: Math.PI }, top: { x: h.x, y: -36, a: Math.PI / 2 }, bottom: { x: h.x, y: H + 36, a: -Math.PI / 2 } }[f.edge];
            if (f.phase === 'launch') {                                  /* vuela de la muñeca a su sitio, siguiéndote */
              const e = ease(Math.min(1, f.t / 0.5));
              const nx = f.sx + (stage.x - f.sx) * e, ny = f.sy + (stage.y - f.sy) * e - Math.sin(e * Math.PI) * 30;
              f.ang = Math.atan2(ny - f.y, nx - f.x) || f.ang; f.x = nx; f.y = ny;
              if (f.t >= 0.5) { f.phase = 'warn'; f.t = 0; f.lx = stage.x; f.ly = stage.y; f.a = stage.a; sfx.warn(); }
            } else if (f.phase === 'warn') {                             /* quieto, temblando: el carril ya está fijado */
              f.x = f.lx + (Math.random() - 0.5) * 2; f.y = f.ly + (Math.random() - 0.5) * 2; f.ang = f.a;
              if (f.t >= 0.5) { f.phase = 'strike'; f.t = 0; f.x = f.lx; f.y = f.ly; }
            } else {                                                     /* ¡golpe! */
              f.x += Math.cos(f.a) * f.speed * dt; f.y += Math.sin(f.a) * f.speed * dt;
              if (Math.hypot(hx - f.x, hy - f.y) < 14) hurt();
              if (f.x < -80 || f.x > W + 80 || f.y < -80 || f.y > H + 80) return false;
            }
            return true;
          });
          /* --- manos-blaster --- */
          blasters = blasters.filter((b) => {
            b.t += dt;
            if (b.phase === 'enter' && b.t >= 0.35) {
              b.phase = 'charge'; b.t = 0;
              const h = api.heartPos();
              b.ang = Math.atan2(h.y - b.y, h.x - b.x) + (b.away ? (Math.random() < 0.5 ? -1 : 1) * 0.65 : 0);   /* amable: apunta lejos */
              sfx.charge(b.telegraph);
            } else if (b.phase === 'charge' && b.t >= b.telegraph) { b.phase = 'fire'; b.t = 0; sfx.beam(); }
            else if (b.phase === 'fire') {
              const dxh = hx - b.x, dyh = hy - b.y, c = Math.cos(b.ang), s = Math.sin(b.ang);
              if (dxh * c + dyh * s > 0 && Math.abs(-dxh * s + dyh * c) < b.w / 2 + HIT_R) hurt();   /* ¿el alma está dentro del rayo? */
              if (b.t >= b.fire) { b.phase = 'leave'; b.t = 0; }
            } else if (b.phase === 'leave' && b.t >= 0.4) return false;
            return true;
          });
          if (invuln > 0) invuln -= dt;
        }

        /* --- dibujo de la caja --- */
        ctx2d.clearRect(0, 0, W, H);
        const ts = now / 1000;
        shots.forEach((b) => drawShot(ctx2d, b, ts));                  /* el canvas ya recorta lo que quede fuera */
        blasts.forEach((b) => drawBlast(ctx2d, b));
        if (!(invuln > 0 && Math.floor(invuln * 16) % 2 === 0)) drawHeart(ctx2d, heart.x, heart.y);

        /* --- capa fx: carriles, avisos, puños, manos-blaster y rayos --- */
        syncBox();
        fx.clearRect(0, 0, fxC.width, fxC.height);
        fists.forEach((f) => {
          if (f.phase === 'warn') {
            /* franja tenue del carril + «!» en el borde por donde va a entrar */
            fx.fillStyle = 'rgba(255,50,50,' + (0.12 + 0.1 * Math.abs(Math.sin(f.t * 20))) + ')';
            if (f.edge === 'left' || f.edge === 'right') fx.fillRect(ox, oy + f.ly - 14, W, 28); else fx.fillRect(ox + f.lx - 14, oy, 28, H);
            const wx = f.edge === 'left' ? 14 : f.edge === 'right' ? W - 14 : f.lx, wy = f.edge === 'top' ? 20 : f.edge === 'bottom' ? H - 20 : f.ly;
            drawWarn(fx, ox + wx, oy + wy, f.t);
          }
          if (f.open) drawBlasterHand(fx, ox + f.x, oy + f.y, f.ang, 1, 0.15, 1);   /* palma abierta: no es un puñetazo */
          else drawRocketFist(fx, ox + f.x, oy + f.y, f.ang, f.phase !== 'warn');
        });
        blasters.forEach((b) => {
          const bx = ox + b.x, by = oy + b.y;
          if (b.phase === 'enter') {
            const e = ease(Math.min(1, b.t / 0.35)), h = api.heartPos(), a = Math.atan2(h.y - b.y, h.x - b.x);
            drawBlasterHand(fx, bx - Math.cos(a) * (1 - e) * 120, by - Math.sin(a) * (1 - e) * 120, a + (1 - e) * Math.PI * 1.5, 0, 0, e);
          } else if (b.phase === 'charge') {
            const k = b.t / b.telegraph;
            fx.save(); fx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(b.t * 24)); fx.strokeStyle = '#ff3232'; fx.lineWidth = 1;   /* línea de puntería */
            fx.beginPath(); fx.moveTo(bx, by); fx.lineTo(bx + Math.cos(b.ang) * 2000, by + Math.sin(b.ang) * 2000); fx.stroke(); fx.restore();
            drawBlasterHand(fx, bx + (Math.random() - 0.5) * 2 * k, by + (Math.random() - 0.5) * 2 * k, b.ang, k, k, 1);
          } else if (b.phase === 'fire') {
            const k = b.t / b.fire, w = b.w * (k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1);
            drawBeam(fx, bx + Math.cos(b.ang) * 14, by + Math.sin(b.ang) * 14, b.ang, Math.max(2, w), 1);
            drawBlasterHand(fx, bx - Math.cos(b.ang) * 4, by - Math.sin(b.ang) * 4, b.ang, 1, 1, 1);   /* retroceso */
          } else {
            const e = Math.min(1, b.t / 0.4);
            drawBlasterHand(fx, bx - Math.cos(b.ang) * e * 60, by - Math.sin(b.ang) * e * 60, b.ang, 1 - e, 0, 1 - e);
          }
        });
        drawOverlays(fx, now);

        if (done) return;
        if (player.hp <= 0) { finish(); return; }
        if (spec.freezeAt && !frozen && elapsed >= spec.freezeAt) {    /* todo se detiene: habla ella */
          frozen = true;
          if (sprite) sprite.attackEnd();
          spec.onFreeze(api).then(finish);
        }
        if (!frozen && elapsed >= spec.dur * TEST.speed) { finish(); return; }
        requestAnimationFrame(frame);
      }
      function finish() {
        if (done) return;
        done = true; boxActive = false;
        removeEventListener('keydown', key); removeEventListener('keyup', key);
        fx.clearRect(0, 0, fxC.width, fxC.height);
        if (sprite) sprite.attackEnd();
        mode = 'none';
        if (player.hp <= 0) { defeat(); reject(DEAD); return; }
        kickOverlay();                                                  /* si quedaba algún efecto, lo sigue dibujando la capa */
        resolve();
      }
      requestAnimationFrame(frame);
    });
  }
  function attack(name, extra = {}) { return runBox(Object.assign({}, ATTACKS[name], extra)); }

  /* ============================================================
     6. HISTORIA
     ============================================================ */

  /* 2. Inicio del combate: negro, tu alma, una figura... y la armadura se ensambla */
  const ASSEMBLE = 5;                                  /* segundos que tarda la armadura en ponerse */
  async function intro() {
    setScene('dark');
    await pause(700);
    showSoul();
    await pause(1100);
    await say(S.intro[0]);
    if (sprite) sprite.appear(2.4);
    sfx.appear();
    for (const l of S.intro.slice(1)) await say(l);
    $('#dialogue').textContent = '';
    /* el casco llega flotando; la música entra para que los violines coincidan con la armadura completa */
    await musicReady(2500);
    startMusic(VIOLIN_SYNC_T - ASSEMBLE, 2500);
    if (sprite) await sprite.assemble(ASSEMBLE, { helmet: () => { sfx.clank(); shake(); }, plates: () => sfx.lock() });
    else await pause(ASSEMBLE * 1000);
  }
  /* Reintento tras perder (o atajos de prueba): Débora ya está armada */
  async function quickStart(text, withSoul = true) {
    if (sprite) sprite.show();
    setScene('dark'); if (withSoul) showSoul();
    $('#dialogue').textContent = text;
    await waitKey();
    $('#dialogue').textContent = '';
    startMusic(VIOLIN_SYNC_T, 900);
  }

  /* Qué ataque toca en cada momento */
  function phase1Attack() { return PHASE1[st.p1++ % PHASE1.length]; }
  function fightAttack() { return st.hits === 0 ? 'adapta' : st.hits === 1 ? 'laseres' : PHASE3[Math.min(st.hits - 2, PHASE3.length - 1)]; }
  function currentAttack() {
    if (st.route === 'fight') return st.impact ? fightAttack() : phase1Attack();
    return PEACE_ATTACKS[Math.min(Math.max(st.peace - 1, 0), PEACE_ATTACKS.length - 1)];
  }

  /* El bucle del combate: tu turno -> su respuesta -> su ataque */
  async function battleLoop() {
    for (;;) {
      const a = await playerTurn();
      setScene('talk'); $('#dialogue').textContent = '';
      if (a.type === 'fight') { if (await fightTurn() === 'end') return; }
      else if (a.type === 'item') await itemTurn(a.entry);
      else if (await peaceTurn(a.entry) === 'end') return;
    }
  }

  /* ATACAR */
  async function fightTurn() {
    st.route = 'fight'; st.fights++;
    const res = await aimBar();
    setScene('talk');
    /* 4. Fase I: todavía está aprendiendo cómo te mueves, y te esquiva */
    if (!st.impact && st.fights <= S.phase1.length) {
      await slashFx('dodge');
      await sayAll(S.phase1[st.fights - 1]);
      await attack(phase1Attack());
      return;
    }
    if (!res.hit) { await slashFx('miss'); await attack(currentAttack()); return; }
    /* 5. Primer gran impacto */
    if (!st.impact) { await firstImpact(); await attack(fightAttack()); return; }
    /* Cada golpe que entra rompe algo más */
    st.hits++;
    await slashFx('hit');
    if (sprite) { sprite.hurt(); sprite.setDamage(st.hits); }
    shake(); sfx.hurt();
    if (st.hits === 3) st.drop.push('item');
    if (st.hits === 5) st.drop.push('act');
    await sayAll(S.fight[st.hits - 1]);
    if (st.hits >= S.fight.length) { await finalSequence(); return 'end'; }
    await attack(fightAttack());
  }
  async function firstImpact() {
    await slashFx('hit');
    shake(); sfx.crack();
    if (sprite) sprite.bigImpact();
    await pause(500);
    await say(S.impact[0]);
    await say(S.impact[1], { onStart: () => { if (sprite) sprite.repair(2.2); sfx.repair(); } });
    await sayAll(S.impact.slice(2));
    st.impact = true;
    st.drop.push('mercy');                     /* ya no hay piedad posible */
  }

  /* ACTUAR o PERDONAR: el narrador cuenta lo que haces y ella responde */
  async function peaceTurn(entry) {
    await say(entry.text);
    if (st.route === 'fight') { await attack(currentAttack()); return; }   /* ya la atacaste: no hay vuelta atrás */
    st.peace++;
    if (sprite) sprite.setCalm(st.peace / S.peace.length);
    await sayAll(S.peace[st.peace - 1]);
    if (st.peace >= S.peace.length) { await pacifistEnding(); return 'end'; }
    await attack(currentAttack());
  }
  /* OBJETO */
  async function itemTurn(item) {
    item.qty--;
    player.hp = Math.min(player.hpMax, player.hp + item.heal);
    updatePlayerHud(); sfx.heal();
    const heal = (L) => UI[L].healed.replace('{n}', item.heal) + (item.qty ? ' ' + UI[L].left.replace('{n}', item.qty) : '');
    await say({ who: 'narr', es: item.text.es + '\n* ' + heal('es'), en: item.text.en + '\n* ' + heal('en') });
    await attack(currentAttack());
  }

  /* 10-11. Ruta de lucha, parte final */
  let finalResolve = null;
  function waitFinalButton() {
    const b = $('#menu button[data-act="fight"]');
    b.hidden = false; b.classList.remove('wait'); b.classList.add('ready', 'is-sel');
    mode = 'final'; setScene('final');
    return new Promise((r) => { finalResolve = r; });
  }
  function finalPress() {
    if (!finalResolve) return;
    const b = $('#menu button[data-act="fight"]');
    b.classList.add('wait'); b.classList.remove('ready', 'is-sel');
    const r = finalResolve; finalResolve = null; mode = 'none'; updateHint();
    r();
  }
  async function finalSequence() {
    /* Empieza un ataque más... y a mitad se congela todo. Habla despacio */
    await attack('ultimo', {
      freezeAt: 4.5,
      onFreeze: async (box) => {
        fadeMusic(0, 3500);
        await pause(900);
        await sayAll(S.finalA);
        await box.vanish();                  /* la arena, el alma y los proyectiles desaparecen */
      },
    });
    /* El menú habitual también: solo queda un botón, ATACAR */
    $$('#menu button').forEach((b) => { b.hidden = b.dataset.act !== 'fight'; });
    const btn = $('#menu button[data-act="fight"]');
    btn.classList.add('wait'); btn.classList.remove('is-sel');
    setScene('final');
    await pause(900);
    await sayAll(S.finalB);
    for (let n = 1; n <= 8; n++) {
      await waitFinalButton();
      sfx.heavy(); shake();
      await slashFx('heavy');
      if (sprite) sprite.finalHit(n);
      if (n === 8) sfx.coreBreak(); else sfx.hurt();
      await pause(n === 8 ? 900 : 350);
      await say(S.finalHits[n - 1]);
    }
    setScene('void');
    if (sprite) await sprite.collapse();
    await pause(1800);
    await specialGameOver();
  }
  /* 12. Game Over especial: silencio, negro, rojo oscuro. YOU WON se agrieta y se convierte en DID YOU? */
  async function specialGameOver() {
    const red = $('#endRed'), big = $('#endBig'), txt = $('#endBigText'), line = $('#endLine');
    red.hidden = false;
    await pause(2600);
    red.classList.add('red');
    await pause(2000);
    txt.textContent = S.over.won; big.classList.add('on');
    await pause(2800);
    big.classList.add('cracked'); sfx.crack();
    await pause(1000);
    big.classList.add('break');
    await pause(800);
    big.classList.remove('cracked', 'break'); txt.textContent = S.over.did;
    void big.offsetWidth; big.classList.add('glitchin');
    await pause(2800);
    line.textContent = tr(S.over.line); line.classList.add('on');
    await pause(3600);
    line.classList.remove('on');
    await pause(1600);
    big.classList.remove('glitchin', 'on');
    await pause(1500);
    txt.textContent = S.over.end; big.classList.add('on');
    await pause(2200);
    $('#restartBtnRed').classList.add('on');
  }

  /* 9. Final pacifista: Débora deja de atacar porque toma una decisión */
  async function pacifistEnding() {
    setScene('dark'); $('#dialogue').textContent = '';
    showSoul();                                   /* tu alma vuelve a quedarse sola en la oscuridad, como al principio */
    fadeMusic(0, 6000);
    await pause(900);
    sfx.dismantle();
    if (sprite) await sprite.dismantle(3.6);      /* la armadura se desmonta sola: ninguna pieza cae por daño */
    await pause(500);
    await sayAll(S.decision);
    /* su cuerpo empieza a desaparecer en pequeños fragmentos de píxeles y código */
    const steps = [0.3, 0.55, 0.78, 0.92];
    for (let i = 0; i < S.goodbye.length; i++) {
      if (sprite) sprite.dissolveTo(steps[i], 2.4);
      await say(S.goodbye[i]);
    }
    if (sprite) await sprite.dissolveTo(1, 2.2);
    await pause(1200);
    await sayAll(S.gone);
    $('#dialogue').textContent = '';
    await lastLineOfCode();
    await pause(1500);
    $('#restartBtn').hidden = false;
  }
  /* La última línea de código se escribe, se queda unos segundos y se borra */
  async function lastLineOfCode() {
    const el = $('#codeLine'), code = S.codeLine;
    el.hidden = false; el.innerHTML = '<span></span><i></i>';
    const span = el.firstChild;
    await pause(900);
    for (let i = 1; i <= code.length; i++) { span.textContent = code.slice(0, i); sfx.type(); await pause(55); }
    await pause(4200);
    for (let i = code.length - 1; i >= 0; i--) { span.textContent = code.slice(0, i); await pause(30); }
    await pause(1600);
    el.hidden = true;
  }

  /* Derrota: te quedas sin PS */
  function defeat() {
    setScene('void'); fadeMusic(0, 1500);
    sfx.gameOver();
    $('#gameOverScreen').hidden = false;
  }
  $('#restartBtn').addEventListener('click', () => location.reload());
  $('#restartBtnRed').addEventListener('click', () => location.reload());
  $('#restartBtnGO').addEventListener('click', () => {
    try { sessionStorage.setItem('daar-retry', '1'); } catch (e) {}   /* al reintentar, te saltas la intro */
    location.reload();
  });

  /* ---------- Entradas: flechas para moverte, Enter/Espacio/Z confirma, Esc/X retrocede ---------- */
  addEventListener('keydown', (e) => {
    sfx.resume();
    const k = e.key, confirm = k === 'Enter' || k === ' ' || k === 'z' || k === 'Z', back = k === 'Escape' || k === 'x' || k === 'X';
    if (k.startsWith('Arrow') || k === ' ' || k === 'Enter') e.preventDefault();
    if (mode === 'box' || (e.repeat && confirm)) return;          /* la caja gestiona sus propias teclas */
    if (mode === 'wait') { if (waitResolve) { const r = waitResolve; waitResolve = null; mode = 'none'; r(); } return; }
    if (mode === 'talk') { if (confirm) advance(); return; }
    if (mode === 'aim') { if (confirm && aimPress) aimPress(); return; }
    if (mode === 'final') { if (confirm) finalPress(); return; }
    if (mode === 'menu') {
      const n = menuButtons().length, d = (k === 'ArrowRight' || k === 'ArrowDown') ? 1 : (k === 'ArrowLeft' || k === 'ArrowUp') ? -1 : 0;
      if (d) { menuSel = (menuSel + d + n) % n; sfx.move(); renderMenu(); }
      else if (confirm) chooseMenu(menuButtons()[menuSel].dataset.act);
      return;
    }
    if (mode === 'sub') {
      if (back) { closeSubs(); mode = 'menu'; sfx.move(); renderMenu(); updateHint(); return; }
      const n = subEntries().length, d = (k === 'ArrowDown' || k === 'ArrowRight') ? 1 : (k === 'ArrowUp' || k === 'ArrowLeft') ? -1 : 0;
      if (!n) return;
      if (d) { subSel = (subSel + d + n) % n; sfx.move(); renderSub(); }
      else if (confirm) pickSub(subSel);
    }
  });
  addEventListener('click', (e) => {
    sfx.resume();
    if (e.target.closest('button')) return;
    if (mode === 'wait' && waitResolve) { const r = waitResolve; waitResolve = null; mode = 'none'; r(); }
    else if (mode === 'talk') advance();
    else if (mode === 'aim' && aimPress) aimPress();
  });
  $('#menu').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    e.stopPropagation(); sfx.resume();
    if (mode === 'menu') { menuSel = menuButtons().indexOf(btn); renderMenu(); chooseMenu(btn.dataset.act); }
    else if (mode === 'final') finalPress();
  });
  $('#menu').addEventListener('mouseover', (e) => {
    const btn = e.target.closest('button');
    if (btn && mode === 'menu') { menuSel = menuButtons().indexOf(btn); renderMenu(); }
  });

  /* ---------- Arranque ---------- */
  updatePlayerHud();

  /* Si se llega aquí desde el código secreto de index.html (ver secret-hunt.js), la pantalla ya
     estaba en negro por el agujero negro de la transición: seguimos ese negro con una explosión
     de partículas hacia fuera antes de empezar. */
  let cameFromSecret = false, retry = false;
  try {
    cameFromSecret = sessionStorage.getItem('daar-secret-entry') === '1'; sessionStorage.removeItem('daar-secret-entry');
    retry = sessionStorage.getItem('daar-retry') === '1'; sessionStorage.removeItem('daar-retry');
  } catch (e) {}
  if (cameFromSecret) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;z-index:20;pointer-events:none;';
    document.body.appendChild(canvas);
    const c2 = canvas.getContext('2d');
    canvas.width = innerWidth; canvas.height = innerHeight;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const parts = Array.from({ length: 140 }, () => {
      const a = Math.random() * Math.PI * 2, sp = 220 + Math.random() * 420;
      return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1 + Math.random() * 2.4 };
    });
    const t0 = performance.now(), DUR = 650;
    (function frame(now) {
      const tt = Math.min(1, (now - t0) / DUR);
      c2.clearRect(0, 0, canvas.width, canvas.height);
      c2.globalAlpha = 1 - tt; c2.fillStyle = '#fff';
      parts.forEach((p) => { c2.beginPath(); c2.arc(cx + p.vx * tt, cy + p.vy * tt, p.r, 0, Math.PI * 2); c2.fill(); });
      if (tt < 1) requestAnimationFrame(frame); else canvas.remove();
    })(t0);
  }

  /* Atajos de prueba (añádelos a la URL):
       ?intro=0        sin la intro
       ?paz=N          como si ya hubieras hecho N turnos pacifistas (0..9)
       ?lucha=N        tras el primer impacto y N golpes (0..6)
       ?final=1        directo a la parte final de la ruta de lucha
       ?ataque=nombre  repite ese ataque en bucle (ver ATTACKS)
       ?inmortal=1     no te hacen daño      ?rapido=1   los ataques duran mucho menos */
  async function main() {
    try {
      if (q.has('ataque') && ATTACKS[q.get('ataque')]) {
        await quickStart(t('hintWait'));
        for (;;) { await attack(q.get('ataque')); player.hp = player.hpMax; updatePlayerHud(); }
      }
      if (q.has('paz')) {
        st.peace = Math.max(0, Math.min(S.peace.length - 1, +q.get('paz') || 0));
        if (sprite) sprite.setCalm(st.peace / S.peace.length);
        await quickStart(t('hintWait'), false);
        return battleLoop();
      }
      if (q.has('lucha') || q.has('final')) {
        Object.assign(st, { route: 'fight', impact: true, fights: 3, hits: q.has('final') ? S.fight.length : Math.max(0, Math.min(6, +q.get('lucha') || 0)) });
        if (sprite) sprite.setDamage(st.hits);
        $('#menu button[data-act="mercy"]').hidden = true;
        if (st.hits >= 3) $('#menu button[data-act="item"]').hidden = true;
        if (st.hits >= 5) $('#menu button[data-act="act"]').hidden = true;
        await quickStart(t('hintWait'), false);
        if (q.has('final')) return finalSequence();
        return battleLoop();
      }
      if (retry || q.get('intro') === '0') await quickStart(retry ? t('retry') : t('hintWait'));
      else await intro();
      await attack('prueba', { forming: true });  /* la arena aparece alrededor del alma: la primera prueba */
      await battleLoop();
    } catch (err) {
      if (err !== DEAD) throw err;               /* sin PS: la pantalla de derrota ya está puesta */
    }
  }
  main();
})();
