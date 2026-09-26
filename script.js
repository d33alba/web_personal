/* ============================================================
   David Abraham Alba Rivero — interacciones
   Incluye: reveal, título, topbar, nav, pestañas,
   copiar correo, reloj, MODO OSCURO, halo del cursor e IDIOMA ES/EN.
   (Las manchas «The Spot» están en spots.js.)
   ============================================================ */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  /* Textos que escribe el propio JS (los del HTML están en el diccionario EN de la sección 10) */
  const UI = {
    es: { themeToLight: 'Activar modo claro', themeToDark: 'Activar modo oscuro', themeTitle: 'Cambiar tema', copyHint: 'clic para copiar', copied: '¡copiado!', langBtn: 'Traducir al inglés' },
    en: { themeToLight: 'Switch to light mode', themeToDark: 'Switch to dark mode', themeTitle: 'Change theme', copyHint: 'click to copy', copied: 'copied!', langBtn: 'Translate to Spanish' }
  };
  let lang = 'es';
  const t = (k) => UI[lang][k];

  /* ---------- 1. Reveal al entrar en pantalla ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal, .mask, .section__head, .split__aside, .project').forEach((el, i) => {
    el.style.transitionDelay = (Math.min(i, 6) * 60) + 'ms';
    io.observe(el);
  });

  /* ---------- 2. Título con decodificación ---------- */
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&/§∆░▒▓';
  function scramble(el) {
    const final = el.textContent.trim(), len = final.length; let frame = 0;
    const queue = final.split('').map((ch, i) => ({ ch, start: Math.floor(i * 1.6), end: Math.floor(i * 1.6) + 14 + Math.random() * 16 }));
    (function tick() {
      let out = '', done = 0;
      queue.forEach((q) => {
        if (frame >= q.end) { out += q.ch; done++; }
        else if (frame >= q.start) out += (q.ch === ' ') ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        else out += ' ';
      });
      el.textContent = out; frame++;
      if (done < len) requestAnimationFrame(tick); else el.textContent = final;
    })();
  }
  if (!reduce) $$('[data-scramble]').forEach((el, i) => setTimeout(() => scramble(el), 180 + i * 320));

  /* ---------- 3. Topbar + barra de progreso ---------- */
  const topbar = $('#topbar'), bar = $('#progressBar');
  function onScroll() {
    const y = window.scrollY;
    topbar.classList.toggle('is-stuck', y > 24);
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
  }
  let raf = false;
  window.addEventListener('scroll', () => { if (raf) return; raf = true; requestAnimationFrame(() => { onScroll(); raf = false; }); }, { passive: true });

  /* ---------- 4. Enlace activo en la navegación ---------- */
  const links = $$('.nav__link');
  const navObs = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['proyectos', 'historia', 'datos', 'ambiciones'].forEach((id) => { const s = document.getElementById(id); if (s) navObs.observe(s); });

  /* ---------- 5. Pestañas ---------- */
  const tabs = $$('.tab');
  function activate(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) { panel.hidden = !on; panel.classList.toggle('is-active', on); }
    });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => activate(t));
    t.addEventListener('keydown', (ev) => {
      let n = null;
      if (ev.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
      if (ev.key === 'ArrowLeft')  n = tabs[(i - 1 + tabs.length) % tabs.length];
      if (n) { n.focus(); activate(n); ev.preventDefault(); }
    });
  });

  /* ---------- 6. Copiar correo ---------- */
  const mailBtn = $('#copyMail'), hint = $('#copyHint');
  if (mailBtn) mailBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(mailBtn.dataset.mail); hint.textContent = t('copied'); }
    catch (e) { hint.textContent = mailBtn.dataset.mail; }
    setTimeout(() => (hint.textContent = t('copyHint')), 2200);
  });

  /* ---------- 7. Reloj + año ---------- */
  function clock() {
    let t = '--:--';
    try { t = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); } catch (e) {}
    ['#clock', '#clock2'].forEach((s) => { const n = $(s); if (n) n.textContent = t; });
  }
  clock(); setInterval(clock, 30000);
  const yearEl = $('#year'); if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ============================================================
   8. MODO OSCURO (con memoria + transición de gota)
   ============================================================ */
const themeBtn = $('#themeBtn'), root = document.documentElement, KEY = 'daar-theme';

/* Aplica el tema de verdad (esto corre DENTRO de la transición) */
function applyTheme(dark) {
  root.classList.toggle('dark', dark);
  if (themeBtn) {
    themeBtn.setAttribute('aria-pressed', String(dark));
    themeBtn.setAttribute('aria-label', t(dark ? 'themeToLight' : 'themeToDark'));
    themeBtn.setAttribute('title', t('themeTitle'));
  }
  try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch (e) {}
}

/* Cambia el tema ANIMANDO una gota que nace en el botón */
async function toggleTheme(dark, evt) {
  /* Sin soporte de View Transitions o con «menos movimiento» → cambio directo */
  if (!document.startViewTransition || reduce) { applyTheme(dark); return; }

  /* Centro del botón (origen de la gota). Si viene de teclado, centro pantalla. */
  let x = innerWidth / 2, y = innerHeight / 2;
  if (themeBtn) { const r = themeBtn.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }

  /* Radio máximo: hasta la esquina opuesta más lejana (cubre toda la pantalla) */
  const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  const vt = document.startViewTransition(() => applyTheme(dark));
  try { await vt.ready; } catch (e) { return; }

  /* Animamos el recorte circular del snapshot NUEVO → efecto gota */
  document.documentElement.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
    { duration: 620, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
  );
}

if (themeBtn) {
  applyTheme(root.classList.contains('dark'));                       /* sincroniza el estado inicial */
  themeBtn.addEventListener('click', (e) => toggleTheme(!root.classList.contains('dark'), e));
}
  /* ============================================================
     9. HALO DEL CURSOR (un solo bucle rAF)
     - Las manchas «The Spot» viven ahora en spots.js.
     ============================================================ */
  const glow = $('.glow');

  /* Seguimos al ratón */
  let px = 0, py = 0, gx = 0, gy = 0, active = false;
  window.addEventListener('pointermove', (e) => {
    px = e.clientX; py = e.clientY;
    if (!active) { active = true; gx = px; gy = py; if (glow) glow.style.opacity = 1; }
  }, { passive: true });

  /* Bucle: el halo sigue al cursor con inercia */
  function frame() {
    if (glow) { gx += (px - gx) * .07; gy += (py - gy) * .07; glow.style.transform = 'translate3d(' + gx + 'px,' + gy + 'px,0)'; }
    requestAnimationFrame(frame);
  }
  if (!reduce && matchMedia('(hover: hover)').matches) requestAnimationFrame(frame);   /* sin cursor (móvil) no hace falta */

  /* ============================================================
     10. IDIOMA ES/EN (el español vive en el HTML; el inglés, aquí)
     - Cada elemento con data-i18n="clave" cambia su contenido.
     - data-i18n-aria-label / data-i18n-alt hacen lo mismo con atributos.
     - Si falta una clave en EN, se queda el texto en español.
     ============================================================ */
  const EN = {
    'doc.title': `David Abraham Alba Rivero — 1st-year DAM · IES Simarro`,
    'doc.desc': `Personal website of David Abraham Alba Rivero, first-year DAM student at IES Simarro. Personal projects, Débora IA, story, hobbies and ambitions.`,
    'skip': `Skip to content`,
    'nav.aria': `Main navigation`, 'nav.projects': `Projects`, 'nav.story': `Story`, 'nav.hobbies': `Hobbies`, 'nav.ambitions': `Ambitions`, 'nav.contact': `Contact`,

    'hero.eyebrow': `Personal profile`,
    'hero.role': `First-year student of the <strong>DAM</strong> program (Cross-Platform App Development) at IES Simarro`,
    'hero.statement': `I build software and learn out of curiosity. Right now I'm developing my own conversational agent with the help of AI, and collecting hobbies I never quite gave up.`,
    'hero.cta.projects': `See projects`,
    'hero.cta.cv': `Download CV <span aria-hidden="true">↓</span>`,
    'hero.cta.contact': `Get in touch <span aria-hidden="true">→</span>`,
    'hero.scroll': `<span></span> scroll`,

    'ficha.aria': `Quick facts`, 'ficha.title': `Profile`,
    'dt.studies': `Studies`, 'dt.project': `Project`, 'dt.model': `Model`, 'dt.voice': `Voice`, 'dt.instruments': `Instruments`, 'dt.status': `Status`,
    'dt.actions': `Actions`, 'dt.interface': `Interface`, 'dt.next': `Next milestone`,
    'ficha.instruments': `Drums · Piano · Guitar · Percussion · Ukulele`,
    'ficha.status': `Open to learning`,

    'proj.title': `Personal projects`,
    'proj.note': `Everything I build on my own, with no class in between, from the idea to working code.`,
    'learn.title': `Learning now`,
    'learn.dt.lang': `Language`, 'learn.lang': `English C1`, 'learn.dt.course': `Course`, 'learn.dt.cert': `Certification`, 'learn.dt.dam': `DAM program`,
    'proj.img.alt': `Chat interface of the Débora AI agent`,
    'proj.badge': `In active development`,
    'proj.h3': `Personal AI agent — <em>Débora IA</em>`,
    'proj.meta.gui': `Custom GUI`,
    'proj.body1': `AI-powered development using the <strong>Qwen 3.6 14B</strong> model. Débora was tuned and built with one clear goal: to imitate <em>Jarvis</em>, Tony Stark's AI.`,
    'proj.body2': `Its <strong>System Prompt</strong> is tuned to answer with more emotional intelligence than its base model allows, and it has its own configured personality, with defined tastes and opinions. It recently got its own avatar too.`,
    'm1.t': `Voice recognition`, 'm1.p': `Listens through the free ElevenLabs API; the conversation doesn't go through the keyboard.`,
    'm2.t': `Speech module`, 'm2.p': `Answers out loud with ElevenLabs. Tone and cadence adjusted to its personality.`,
    'm3.t': `Custom chat interface`, 'm3.p': `A dedicated UI to talk to it outside the terminal, with history and states.`,
    'm4.p': `Controls the computer to search on Google and to play YouTube videos or YouTube Music songs.`,
    'm5.t': `Mobile linking`, 'm5.p': `A new model for connecting with mobile devices: <strong>in development</strong>.`,
    'spec.prompt': `Tuned for emotional intelligence`, 'spec.interface': `Custom chat`, 'spec.next': `Mobile bridge`,

    'hist.title': `My story`,
    'hist.intro': `The curiosity that brought me here.`,
    'hist.p1': `The story of how I fell in love with computing is no fairy tale. Like most kids, I idolised the superheroes from the movies. My dad and I were huge Avengers fans, and I remember that after watching <em>Avengers: Age of Ultron</em> I became obsessed with Iron Man and his technology.`,
    'hist.p2': `When I got home from school I ran around the house pretending I was Iron Man, talking to Jarvis so he would bring me different suits. I always dreamed about AIs, and about turning household appliances into smart ones.`,
    'hist.pull': `“Jarvis, open the fridge” — and I opened it myself, by hand.`,
    'hist.p3': `For a long time I admired robotics YouTubers, trying to imitate Iron Man's technology — an obsession that faded as I grew up. After <em>Avengers: Endgame</em> I stopped dreaming of building my own technology, at least until I was 17.`,
    'hist.p4': `One of my most persistent hobbies has been keeping up with new technologies. I was one of those who swallowed the fake 2016 videos of flying-car prototypes or iPhones that levitated when they hit the floor, but I was also the first in my class to use ChatGPT for an assignment, back when it wasn't even a public OpenAI product.`,
    'hist.p5': `I started getting interested in computing by playing around with every image-generation model to make memes about my school teachers. ChatGPT had become my new irreplaceable best friend — or at least until I saw the first video about a local AI agent. The obsession was reborn and I couldn't wait to have my own AI. By the time I reached bachillerato (Spanish upper secondary school), ChatGPT had already become my go-to tool for almost everything.`,
    'hist.p6': `By luck, my computer had a graphics card with 12&nbsp;GB of VRAM — I only had to find the best AI to vibecode with. <strong>Claude</strong> accompanied me throughout the development of my own personal agent, which, after a long brainstorming session, I ended up naming <em>Débora IA</em>. I've paused that project to learn software and AI development in depth. What started as a tingle of “maybe I could do this for a living” ended up being a “yes, I really want to.”`,

    'hob.title': `Hobbies`,
    'hob.note': `I like to spend my free time learning new hobbies. I've picked up many, from very different fields.`,
    'hob.tabs.aria': `Areas`,
    'tab.music': `Music`, 'tab.sport': `Sport`, 'tab.games': `Video games`, 'tab.av': `Film & TV`,
    'music.h3': `My sister's piano`,
    'music.p': `From a very young age I played my sister's piano, and eventually I managed to get myself into an after-school <strong>drum class at 11</strong>. With my insatiable curiosity I ended up jumping to other instruments:`,
    'music.chips': `<li>Drums</li><li>General percussion</li><li>Guitar</li><li>Piano</li><li class="chip--new">Ukulele · the latest arrival</li>`,
    'sport.h3': `Sport, without much conviction at first`,
    'sport.p1': `As a kid I was never good at sports: my parents scared me with the idea that I could break my bones, and I never asked to join any club. The first one I practised was <strong>chess, in the school club at 6</strong>. Much later, at 14, I discovered how much fun it was to play a rondo (a football keep-away passing game) right after school with my friends, and my curiosity moved from music to sport.`,
    'sport.p2': `I started signing up for friendly football matches and then basketball, and practising with my dad the sports we did in PE. Today I've cooled off that obsession and only routinely do <strong>running and gym</strong>.`,
    'games.h3': `Competitive, relaxing or 100 hours long`,
    'games.p': `I also leave free moments for things with less return: competitive video games like <strong>LoL</strong> or more relaxing ones like <strong>Minecraft</strong>. And when I have a lot of time to burn, I finish a <strong>Final Fantasy</strong>.`,
    'av.h3': `What I always end up debating with friends`,
    'av.p1': `Something I often talk about and debate is audiovisual taste. Personally, I like <strong>psychological series with great character development</strong>, to binge on a Sunday season marathon. An example of that style is my favourite show: <em>The Lost</em>.`,
    'av.p2': `With films I'm a bit different: I love romantic ones in the style of <em>Notting Hill</em>, or those with a consistent romantic plot like <em>The Wild Hunting</em>.`,
    'av.chips': `<li>Psychological series</li><li>The Lost</li><li>Notting Hill</li><li>The Wild Hunting</li>`,

    'amb.title': `Future ambitions`,
    'amb.lead': `Right now I'm working through the <strong>DAM</strong> program, which I want to complete with the specialisation course in <em>Big Data and AI</em> — so that I can finally offer solutions to the world through automation and artificial intelligence.`,
    'amb.l1': `<span class="ambition__mark">01</span> Expand Débora IA`,
    'amb.l3': `<span class="ambition__mark">03</span> My startup`,

    'foot.eyebrow': `<span class="eyebrow__tick" aria-hidden="true"></span> Contact`,
    'foot.title': `Let's talk about<br><em>projects</em>`,
    'foot.text': `Available to talk about AI, code, drums, or which series is on this Sunday.`,
    'foot.nav.aria': `Contact links`, 'foot.links': `Links`, 'foot.meta': `Details`,
    'meta.school': `School`, 'meta.course': `Program`, 'meta.zone': `Time zone`,
    'foot.status': `<span class="pulse"></span> Replies within 24 h`,
    'foot.made': `made with plain HTML, CSS and JS.`,
    'foot.top': `Back to top <span aria-hidden="true">↑</span>`,

    'secret.hint': `We all have secrets — even this page has one&hellip;`
  };
  /* La cinta de intereses repite la lista dos veces para el bucle infinito */
  const tickerItems = ['Artificial intelligence', 'Python', 'Drums', 'Chess', 'Running', 'Psychological series', 'Notting Hill', 'LoL', 'Minecraft', 'Final Fantasy'];
  const tickerHtml = tickerItems.map((s) => '<span>' + s + '</span><i>◇</i>').join('');
  EN.ticker = tickerHtml + tickerHtml;

  /* Cada página puede tener su propio título/descripción en inglés: 'doc.title.<data-page>' */
  const PAGE = document.documentElement.dataset.page || '';
  EN['doc.title.contact'] = `Contact — David Abraham Alba Rivero`;
  EN['doc.desc.contact'] = `Get in touch: internships, projects, collaborations or questions about Débora IA. The message reaches me directly.`;

  const LANG_KEY = 'daar-lang';
  const langBtn = $('#langBtn'), metaDesc = $('meta[name="description"]');
  const ES_TITLE = document.title, ES_DESC = metaDesc.content;
  /* Guardamos el español original de cada elemento para poder volver a él */
  const textNodes = $$('[data-i18n]').map((el) => ({ el, key: el.dataset.i18n, es: el.innerHTML }));
  const attrNodes = [];
  ['aria-label', 'alt'].forEach((a) => $$('[data-i18n-' + a + ']').forEach((el) => {
    attrNodes.push({ el, a, key: el.getAttribute('data-i18n-' + a), es: el.getAttribute(a) });
  }));

  /* Glitch al cambiar de idioma: cada letra pasa por caracteres raros hasta «resolverse».
     Solo se animan los textos visibles; un único bucle rAF mueve todos. */
  const GLITCH_CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789';
  const isGlyph = (ch) => /[\p{L}\p{N}]/u.test(ch);
  let glitchJobs = [], glitchRaf = 0, lastGlitch = 0;

  const nearViewport = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > -80 && r.top < innerHeight + 80 && r.right > 0 && r.left < innerWidth;
  };

  function scrambleParts(parts, elapsed) {
    let pending = false;
    parts.forEach((p) => {
      let out = '';
      for (let i = 0; i < p.text.length; i++) {
        if (elapsed >= p.settle[i]) out += p.text[i];
        else { out += GLITCH_CHARS[(Math.random() * GLITCH_CHARS.length) | 0]; pending = true; }
      }
      p.node.nodeValue = out;
    });
    return pending;
  }

  function startGlitch(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const parts = []; let total = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode, text = node.nodeValue;
      if (!text.trim()) continue;
      parts.push({ node, text, offset: total });
      total += text.length;
    }
    if (!parts.length) return;
    parts.forEach((p) => {
      /* Instante (ms) en que se resuelve cada letra: de izquierda a derecha, con algo de azar */
      p.settle = p.text.split('').map((ch, i) => isGlyph(ch) ? 200 + ((p.offset + i) / total) * 450 + Math.random() * 250 : 0);
    });
    el.classList.add('glitching');
    scrambleParts(parts, 0);
    glitchJobs.push({ el, parts, start: performance.now() });
  }

  function glitchTick(now) {
    if (now - lastGlitch >= 45) {                       /* ~20 fps: parpadeo legible, no un borrón */
      lastGlitch = now;
      glitchJobs = glitchJobs.filter((job) => {
        const pending = scrambleParts(job.parts, now - job.start);
        if (!pending) job.el.classList.remove('glitching');
        return pending;
      });
    }
    glitchRaf = glitchJobs.length ? requestAnimationFrame(glitchTick) : 0;
  }

  function stopGlitch() {
    glitchJobs.forEach((job) => job.el.classList.remove('glitching'));
    glitchJobs = [];
  }

  function applyLang(next, animate = true) {
    lang = next;
    const en = next === 'en';
    stopGlitch();
    document.documentElement.lang = next;
    textNodes.forEach(({ el, key, es }) => { el.innerHTML = en ? (EN[key] ?? es) : es; });
    attrNodes.forEach(({ el, a, key, es }) => el.setAttribute(a, en ? (EN[key] ?? es) : es));
    document.title = en ? (EN['doc.title.' + PAGE] || EN['doc.title']) : ES_TITLE;
    metaDesc.content = en ? (EN['doc.desc.' + PAGE] || EN['doc.desc']) : ES_DESC;
    if (hint) hint.textContent = t('copyHint');
    langBtn.setAttribute('aria-label', t('langBtn'));
    langBtn.setAttribute('title', t('langBtn'));
    applyTheme(root.classList.contains('dark'));      /* refresca las etiquetas del botón de tema */
    try { localStorage.setItem(LANG_KEY, next); } catch (e) {}
    if (animate && !reduce) {
      textNodes.forEach(({ el }) => { if (nearViewport(el)) startGlitch(el); });
      if (glitchJobs.length && !glitchRaf) glitchRaf = requestAnimationFrame(glitchTick);
    }
  }

  if (langBtn) {
    langBtn.addEventListener('click', () => applyLang(lang === 'es' ? 'en' : 'es'));
    let saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch (e) {}
    if (saved === 'en') applyLang('en', false);        /* al cargar la página no se anima */
  }

  onScroll();
})();
