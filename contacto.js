/* ============================================================
   contacto.js — formulario de contacto (contacto.html)
   El mensaje LLEGA de verdad a tu correo, sin que tu correo aparezca en la web:
   se envía a Web3Forms (gratis, ~250 mensajes/mes) y ellos te lo reenvían al
   correo con el que creaste la clave. La clave (access key) es pública por diseño.

   PARA ACTIVARLO (2 minutos, una sola vez):
     1. Entra en https://web3forms.com y escribe TU correo real en "Create your Access Key".
     2. Te llega la clave al correo. Pégala abajo, en ACCESS_KEY.
     3. Listo. Prueba a enviarte un mensaje desde la página.
   Mientras ACCESS_KEY sea el texto de ejemplo, el formulario avisa de que aún
   no está conectado en lugar de fingir que ha enviado algo.

   Además: temas rápidos que rellenan asunto y arranque, borrador que se guarda
   solo, contador, Ctrl+Enter para enviar, y un hilo final con una respuesta
   automática de Débora (marcada como simulada). ES/EN con su propio diccionario M
   (cambia al vuelo cuando script.js cambia <html lang>). Lo que escribe el
   usuario se inserta SIEMPRE con textContent, nunca como HTML.
   ============================================================ */
(function () {
  'use strict';

  const ACCESS_KEY = 'PEGA_AQUI_TU_CLAVE_DE_WEB3FORMS';
  const ENDPOINT = 'https://api.web3forms.com/submit';

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const root = $('#mailer');
  if (!root) return;

  const form = $('#mailForm'), thread = $('#mThread'), statusEl = $('#mStatus');
  const fName = $('#mName'), fFrom = $('#mFrom'), fSubject = $('#mSubject'), fBody = $('#mBody'), fBot = $('#mBot');
  const sendBtn = $('#mSend'), countEl = $('#mCount');
  const DRAFT_KEY = 'daar-draft', MAX = 1000, MIN = 10, COOLDOWN_MS = 30000;

  /* ---------- Todos los textos de la página (ES/EN) ---------- */
  const M = {
    es: {
      eyebrow: 'Contacto', h1a: 'Hablemos', h1b: 'de lo que quieras',
      lead: 'Cuéntame qué tienes en mente. El mensaje me llega directamente y te respondo al correo que dejes.',
      respK: 'Respuesta', respV: 'En 24 h', timeK: 'Málaga ahora',
      title: 'Nuevo mensaje', stepTopic: '1 · ¿De qué va?', stepMsg: '2 · Tu mensaje',
      name: 'Nombre', from: 'Tu correo', subject: 'Asunto', bodyLbl: 'Mensaje',
      namePh: 'Cómo te llamas', fromPh: 'Para poder responderte', subjectPh: 'Asunto', bodyPh: 'Escribe tu mensaje…',
      privacy: 'Tu correo solo se usa para responderte.', send: 'Enviar', back: '← Volver a la portada',
      't.jobs': 'Prácticas o empleo', 't.collab': 'Proyecto o colaboración', 't.debora': 'Sobre Débora IA', 't.feedback': 'Opinión sobre la web', 't.other': 'Otra cosa',
      subj: { jobs: 'Oportunidad de prácticas o empleo', collab: 'Propuesta de proyecto o colaboración', debora: 'Sobre Débora IA', feedback: 'Opinión sobre tu web', other: 'Un mensaje para ti' },
      start: {
        jobs: 'Hola David, te escribo porque hay una oportunidad que podría interesarte: ',
        collab: 'Hola David, me gustaría proponerte colaborar en ',
        debora: 'Hola David, he visto Débora IA y me gustaría preguntarte ',
        feedback: 'Hola David, he visto tu web y mi opinión es que ',
        other: 'Hola David, ',
      },
      saved: 'Borrador guardado', short: 'Escribe al menos 10 caracteres', noName: 'Dime cómo te llamas', badMail: 'Ese correo no parece válido',
      wait: 'Espera un momento antes de enviar otro', sending: 'Enviando…', sent: 'Enviado',
      noKey: 'Formulario sin conectar: falta la clave de Web3Forms (ver contacto.js)', fail: 'No se pudo enviar. Inténtalo de nuevo en un rato.',
      you: 'Tú', toName: 'David', now: 'ahora', noSubject: '(sin asunto)',
      okTitle: 'Mensaje entregado', okNote: 'Le ha llegado a David. Te responderá al correo que dejaste.',
      replyName: 'Débora IA', replyTag: 'Respuesta automática · simulada',
      hi: (n) => (n ? '¡Hola, ' + n + '!' : '¡Hola!'),
      reply: 'Soy Débora, la IA de David. Esto es una respuesta automática de cortesía: tu mensaje ya está en su bandeja de entrada.',
      again: 'Escribir otro',
    },
    en: {
      eyebrow: 'Contact', h1a: "Let's talk", h1b: 'about anything',
      lead: "Tell me what's on your mind. The message reaches me directly and I'll reply to the email you leave.",
      respK: 'Reply time', respV: 'Within 24 h', timeK: 'Málaga now',
      title: 'New message', stepTopic: "1 · What's it about?", stepMsg: '2 · Your message',
      name: 'Name', from: 'Your email', subject: 'Subject', bodyLbl: 'Message',
      namePh: "What's your name", fromPh: 'So I can reply', subjectPh: 'Subject', bodyPh: 'Write your message…',
      privacy: 'Your email is only used to reply to you.', send: 'Send', back: '← Back to the home page',
      't.jobs': 'Internship or job', 't.collab': 'Project or collaboration', 't.debora': 'About Débora IA', 't.feedback': 'Feedback on the site', 't.other': 'Something else',
      subj: { jobs: 'Internship or job opportunity', collab: 'Project or collaboration proposal', debora: 'About Débora IA', feedback: 'Feedback on your website', other: 'A message for you' },
      start: {
        jobs: "Hi David, I'm writing because there's an opportunity that might interest you: ",
        collab: "Hi David, I'd like to propose collaborating on ",
        debora: "Hi David, I've seen Débora IA and I'd like to ask you ",
        feedback: "Hi David, I've seen your website and my feedback is that ",
        other: 'Hi David, ',
      },
      saved: 'Draft saved', short: 'Write at least 10 characters', noName: 'Tell me your name', badMail: "That email doesn't look valid",
      wait: 'Wait a moment before sending another', sending: 'Sending…', sent: 'Sent',
      noKey: 'Form not connected: the Web3Forms key is missing (see contacto.js)', fail: 'Could not send. Please try again in a while.',
      you: 'You', toName: 'David', now: 'now', noSubject: '(no subject)',
      okTitle: 'Message delivered', okNote: "It reached David. He'll reply to the email you left.",
      replyName: 'Débora IA', replyTag: 'Automatic reply · simulated',
      hi: (n) => (n ? 'Hi, ' + n + '!' : 'Hi!'),
      reply: "I'm Débora, David's AI. This is a courtesy automatic reply: your message is already in his inbox.",
      again: 'Write another',
    },
  };
  const L = () => (document.documentElement.lang === 'en' ? 'en' : 'es');
  const T = () => M[L()];

  function applyText() {
    const t = T();
    $$('[data-m]').forEach((el) => { const v = t[el.dataset.m]; if (typeof v === 'string') el.textContent = v; });
    $$('[data-m-ph]').forEach((el) => { el.placeholder = t[el.dataset.mPh]; });
    if (state) renderThread();
  }

  /* ---------- Estado en la barra de la ventana ---------- */
  let statusTimer = 0;
  function say(msg, kind, keep) {
    clearTimeout(statusTimer);
    statusEl.textContent = msg; statusEl.dataset.kind = kind || '';
    if (msg && !keep) statusTimer = setTimeout(() => { statusEl.textContent = ''; statusEl.dataset.kind = ''; }, 2600);
  }

  /* ---------- Borrador ---------- */
  let saveTimer = 0;
  function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const d = { name: fName.value, from: fFrom.value, subject: fSubject.value, body: fBody.value };
        if (d.name || d.from || d.subject || d.body) { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); say(T().saved, 'ok'); }
        else localStorage.removeItem(DRAFT_KEY);
      } catch (e) {}
    }, 500);
  }
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (d) { fName.value = d.name || ''; fFrom.value = d.from || ''; fSubject.value = d.subject || ''; fBody.value = (d.body || '').slice(0, MAX); }
  } catch (e) {}

  /* ---------- Contador, botón, auto-altura ---------- */
  const okMail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  function refresh() {
    const n = fBody.value.length;
    countEl.textContent = n + '/' + MAX;
    countEl.classList.toggle('is-warn', n > MAX * 0.9);
    sendBtn.disabled = fBody.value.trim().length < MIN;
    fBody.style.height = 'auto';
    fBody.style.height = Math.min(Math.max(fBody.scrollHeight, 130), 340) + 'px';
  }
  [fName, fFrom, fSubject, fBody].forEach((el) => el.addEventListener('input', () => { refresh(); saveDraft(); }));

  /* ---------- Temas ---------- */
  let lastStart = '', topic = '';
  $$('.topic', root).forEach((b) => b.addEventListener('click', () => {
    const k = topic = b.dataset.topic, t = T();
    $$('.topic', root).forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on); });
    fSubject.value = t.subj[k];
    const cur = fBody.value;
    if (!cur.trim() || cur === lastStart) fBody.value = lastStart = t.start[k];
    fBody.focus(); fBody.setSelectionRange(fBody.value.length, fBody.value.length);
    refresh(); saveDraft();
  }));

  /* ---------- Envío real ---------- */
  let state = null, lastSent = 0;
  async function deliver(s) {
    if (ACCESS_KEY.indexOf('PEGA_AQUI') === 0) return { ok: false, reason: 'nokey' };
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: '[Web] ' + (s.subject || T().noSubject),
          from_name: s.name,
          name: s.name,
          email: s.from,                       /* Web3Forms lo usa como "responder a" */
          message: s.body,
          tema: topic || '-',
          idioma: L(),
          botcheck: fBot.checked ? 'true' : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok && data.success === true };
    } catch (e) { return { ok: false, reason: 'net' }; }
  }

  async function submit() {
    const t = T();
    if (sendBtn.disabled) { say(t.short, 'err'); fBody.focus(); return; }
    if (!fName.value.trim()) { say(t.noName, 'err'); fName.focus(); return; }
    if (!okMail(fFrom.value.trim())) { say(t.badMail, 'err'); fFrom.focus(); return; }
    if (Date.now() - lastSent < COOLDOWN_MS) { say(t.wait, 'err'); return; }
    const s = {
      name: fName.value.trim(), from: fFrom.value.trim(), subject: fSubject.value.trim(), body: fBody.value.trim(),
      time: new Intl.DateTimeFormat(L() === 'en' ? 'en-GB' : 'es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
      reply: false, typing: false,
    };
    say(t.sending, 'ok', true);
    root.classList.add('is-sending'); sendBtn.disabled = true;
    const r = await deliver(s);
    root.classList.remove('is-sending');
    if (!r.ok) {
      sendBtn.disabled = false;
      say(r.reason === 'nokey' ? T().noKey : T().fail, 'err', true);
      return;
    }
    lastSent = Date.now();
    state = s;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    form.hidden = true; thread.hidden = false;
    renderThread();
    say(T().sent, 'ok', true);
    thread.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => { if (state) { state.typing = true; renderThread(); } }, 900);
    setTimeout(() => { if (state) { state.typing = false; state.reply = true; renderThread(); } }, 2300);
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  fBody.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(); } });

  /* ---------- Hilo final ---------- */
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function card(kind, name, tag, time, subject, paragraphs) {
    const c = el('article', 'msg msg--' + kind);
    const head = el('header', 'msg__head');
    head.appendChild(el('span', 'msg__av', name.charAt(0).toUpperCase()));
    const who = el('div', 'msg__who');
    who.appendChild(el('strong', '', name));
    if (tag) who.appendChild(el('span', 'msg__tag', tag));
    head.appendChild(who); head.appendChild(el('time', 'msg__time', time));
    c.appendChild(head);
    if (subject) c.appendChild(el('h3', 'msg__subj', subject));
    paragraphs.forEach((p) => c.appendChild(el('p', 'msg__body', p)));
    return c;
  }
  function renderThread() {
    if (!state) return;
    const t = T();
    thread.textContent = '';
    const ok = el('div', 'mok');
    ok.appendChild(el('span', 'mok__tick', '✓'));
    const okTxt = el('div', 'mok__txt'); okTxt.appendChild(el('strong', '', t.okTitle)); okTxt.appendChild(el('span', '', t.okNote));
    ok.appendChild(okTxt); thread.appendChild(ok);
    thread.appendChild(card('me', state.name, t.you + ' → ' + t.toName, state.time, state.subject || t.noSubject, [state.body]));
    if (state.typing) {
      const ty = el('div', 'msg msg--typing'); ty.setAttribute('aria-hidden', 'true');
      ty.appendChild(el('i')); ty.appendChild(el('i')); ty.appendChild(el('i'));
      thread.appendChild(ty);
    }
    if (state.reply) thread.appendChild(card('bot', t.replyName, t.replyTag, t.now, '', [t.hi(state.name), t.reply]));
    const acts = el('div', 'mailer__acts');
    const again = el('button', 'macts', t.again); again.type = 'button';
    again.addEventListener('click', reset);
    acts.appendChild(again); thread.appendChild(acts);
  }
  function reset() {
    state = null; thread.textContent = ''; thread.hidden = true; form.hidden = false;
    [fName, fFrom, fSubject, fBody].forEach((x) => { x.value = ''; });
    lastStart = ''; topic = ''; $$('.topic', root).forEach((x) => { x.classList.remove('is-on'); x.setAttribute('aria-pressed', 'false'); });
    say(''); refresh(); fName.focus();
  }

  new MutationObserver(applyText).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  applyText(); refresh();
})();
