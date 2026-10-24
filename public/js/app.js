/* Pathfinder app. Plain JavaScript, no build step.
   Progress is cached in this browser (localStorage, one slot per account) and saved to the
   student's account on the server. AI chat history and anonymous mentor questions stay on the
   phone only, so questions can never be tied back to an account. */
(function () {
  'use strict';

  var t = PF.t;
  var KEY = 'pf_state_v2:';
  var SESS_KEY = 'pf_session_v2';
  var LANG_KEY = 'pf_lang';

  /* ---------- small helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) {
    if (!u) return '';
    u = String(u).trim();
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
    try {
      var x = new URL(u);
      return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : '';
    } catch (e) { return ''; }
  }
  function uid() { return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  var toastTimer;
  function toast(msg) {
    var old = $('.toast'); if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, 3200);
  }

  /* ---------- state ---------- */
  var SUPPORT = [{ id: 'learn', icon: '\uD83D\uDCD8' }, { id: 'career', icon: '\uD83E\uDDED' }, { id: 'mentor', icon: '\uD83E\uDD1D' }, { id: 'oneone', icon: '\uD83D\uDCAC' }];
  var SUPPORT_IDS = SUPPORT.map(function (x) { return x.id; });
  var YEARS = ['y1', 'y2', 'y3', 'y4', 'y_other'];
  var COMFORTS = ['c0', 'c1', 'c2'];
  // Fields saved to the account. Chat history and anonymous questions are deliberately not in this list.
  var SYNC_KEYS = ['onboarded', 'year', 'comfort', 'goal', 'support', 'supportNote', 'supportSent', 'subjects', 'done', 'logs'];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  function langOk(id) { return PF.langs.some(function (l) { return l.id === id; }); }

  function defaults() {
    return { onboarded: false, year: '', comfort: '', goal: '', support: [], supportNote: '', supportSent: false,
      subjects: [], done: {}, logs: [], chat: [], myQ: [], updatedAt: 0 };
  }
  function loadFor(id) {
    var d = defaults();
    try {
      var raw = JSON.parse(lsGet(KEY + id) || '{}');
      for (var k in raw) { d[k] = raw[k]; }
    } catch (e) { /* start fresh */ }
    return d;
  }
  var S = defaults();
  var session = null;            // { uid, nick, guest }
  var auth = { configured: true };
  var lastHash = '', syncTimer = null, syncPending = false;

  function hashState() {
    var o = {}; SYNC_KEYS.forEach(function (k) { o[k] = S[k]; });
    return JSON.stringify(o);
  }
  function setState(next) { S = next; lastHash = hashState(); }
  function nick() { return (session && session.nick) || 'Friend'; }

  function save() {
    if (!session) return;
    var h = hashState();
    if (h !== lastHash) {
      lastHash = h; S.updatedAt = Date.now();
      if (!session.guest) scheduleSync();
    }
    lsSet(KEY + session.uid, JSON.stringify(S));
  }
  function scheduleSync() {
    syncPending = true; clearTimeout(syncTimer);
    syncTimer = setTimeout(pushState, 1500);
  }
  function pushState() {
    clearTimeout(syncTimer); syncPending = false;
    if (!session || session.guest || navigator.onLine === false) return Promise.resolve();
    var out = { updatedAt: S.updatedAt };
    SYNC_KEYS.forEach(function (k) { out[k] = S[k]; });
    return fetch('/api/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ state: out })
    }).then(function (r) { if (r.status === 401) handleExpired(); }, function () { /* retry on next change */ });
  }
  function handleExpired() {
    if (!session || session.guest) return;
    lsDel(SESS_KEY); session = null; ui.authErr = ''; route();
  }

  /* Take the account copy from the server when it is newer than what this phone has. */
  function adoptServer(st) {
    if (!st || typeof st !== 'object') return;
    if ((+st.updatedAt || 0) <= (S.updatedAt || 0)) return;
    var d = defaults();
    d.onboarded = st.onboarded === true;
    d.year = YEARS.indexOf(st.year) >= 0 ? st.year : '';
    d.comfort = COMFORTS.indexOf(st.comfort) >= 0 ? st.comfort : '';
    d.goal = PF.roleById(st.goal) ? st.goal : '';
    d.support = Array.isArray(st.support) ? st.support.filter(function (v) { return SUPPORT_IDS.indexOf(v) >= 0; }) : [];
    d.supportNote = typeof st.supportNote === 'string' ? st.supportNote.slice(0, 400) : '';
    d.supportSent = st.supportSent === true;
    d.subjects = Array.isArray(st.subjects) ? st.subjects.filter(function (id) { return typeof id === 'string' && PF.subjectById(id); }) : [];
    PF.roles.forEach(function (r) {
      var src = st.done && st.done[r.id];
      if (!src || typeof src !== 'object') return;
      var out = {};
      for (var i = 0; i < r.steps.length; i++) { if (+src[i] > 0) out[i] = +src[i]; }
      if (Object.keys(out).length) d.done[r.id] = out;
    });
    d.logs = Array.isArray(st.logs) ? st.logs.filter(function (l) {
      return l && PF.roleById(l.role) && +l.step >= 0 && +l.step < 20;
    }).slice(0, 200).map(function (l) {
      return { role: l.role, step: +l.step, note: String(l.note || '').slice(0, 400), link: String(l.link || '').slice(0, 300), ts: +l.ts || 0 };
    }) : [];
    d.updatedAt = +st.updatedAt;
    d.chat = S.chat; d.myQ = S.myQ;
    setState(d);
    lsSet(KEY + session.uid, JSON.stringify(S));
  }

  var ui = { matchRole: '', openFinish: false, prefill: '', busy: false,
    authMode: 'signin', authErr: '', authId: '', authName: '', stInit: false, st: null };

  function stepsDone(roleId) { return Object.keys(S.done[roleId] || {}).length; }
  function totalDone() {
    var n = 0; for (var r in S.done) { n += Object.keys(S.done[r]).length; } return n;
  }
  function nextStep(role) {
    for (var i = 0; i < role.steps.length; i++) { if (!(S.done[role.id] && S.done[role.id][i])) return i; }
    return -1;
  }
  function weekIndex(ts) { return Math.floor((ts + 5.5 * 3600e3 - 4 * 86400e3) / (7 * 86400e3)); }
  function streak() {
    var seen = {};
    for (var r in S.done) { for (var s in S.done[r]) { seen[weekIndex(S.done[r][s])] = true; } }
    var w = weekIndex(Date.now());
    if (!seen[w]) w -= 1;
    var n = 0;
    while (seen[w]) { n++; w--; }
    return n;
  }
  function speechLang() {
    var l = PF.langs.filter(function (x) { return x.id === PF.lang; })[0];
    return l ? l.speech : 'en-IN';
  }
  function fmtDate(d) {
    try {
      return new Intl.DateTimeFormat(speechLang(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(d) + ' IST';
    } catch (e) { return d.toString(); }
  }

  /* ---------- milestone stone ---------- */
  function stone(top, big, small) {
    var body = 'M14 190V70C14 30 42 12 75 12S136 30 136 70V190Z';
    return '<svg class="stone" viewBox="0 0 150 190" role="img" aria-label="' + esc(top + ': ' + big + ' ' + small) + '">' +
      '<defs><clipPath id="stoneclip"><path d="' + body + '"/></clipPath></defs>' +
      '<path d="' + body + '" fill="#fff"/>' +
      '<g clip-path="url(#stoneclip)"><rect x="0" y="0" width="150" height="76" fill="#f5b82e"/></g>' +
      '<path d="' + body + '" fill="none" stroke="#17212b" stroke-width="4"/>' +
      '<line x1="14" y1="76" x2="136" y2="76" stroke="#17212b" stroke-width="4"/>' +
      '<text x="75" y="54" text-anchor="middle" font-size="19" font-weight="800" fill="#17212b">' + esc(top) + '</text>' +
      '<text x="75" y="132" text-anchor="middle" font-size="48" font-weight="800" fill="#17212b">' + esc(big) + '</text>' +
      '<text x="75" y="160" text-anchor="middle" font-size="13" fill="#17212b">' + esc(small) + '</text>' +
      '</svg>';
  }
  function miniStone(tag) {
    var body = 'M14 190V70C14 30 42 12 75 12S136 30 136 70V190Z';
    return '<svg class="stone" viewBox="0 0 150 190" aria-hidden="true">' +
      '<path d="' + body + '" fill="#fff" stroke="#17212b" stroke-width="6"/>' +
      '<path d="M14 76V70C14 30 42 12 75 12S136 30 136 70V76Z" fill="#f5b82e" stroke="#17212b" stroke-width="6"/>' +
      '<text x="75" y="140" text-anchor="middle" font-size="34" font-weight="800" fill="#17212b">' + esc(tag.slice(0, 2)) + '</text></svg>';
  }

  /* ---------- chrome (header, nav, language) ---------- */
  function renderChrome() {
    document.documentElement.lang = PF.lang;
    $('#tagline').textContent = t('app_tagline');
    $('#lang-label').textContent = t('lang_label');
    var sel = $('#lang');
    sel.innerHTML = PF.langs.map(function (l) {
      return '<option value="' + l.id + '"' + (l.id === PF.lang ? ' selected' : '') + '>' + esc(l.label) + '</option>';
    }).join('');
    $$('[data-i]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i')); });
    $('#install').textContent = t('install');
    updateOnline();
  }
  function updateOnline() {
    var b = $('#offline');
    if (navigator.onLine === false) { b.textContent = t('offline'); b.hidden = false; } else { b.hidden = true; }
  }

  /* ---------- router ---------- */
  var routes = {
    home: viewHome, paths: viewPaths, plan: viewPlan, guide: viewGuide,
    mentors: viewMentors, curriculum: viewCurriculum
  };
  var firstRoute = true;
  function route() {
    var nav = $('#nav');
    if (!session) { nav.hidden = true; ui.stInit = false; viewAuth(); return; }
    var parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
    var name = parts[0], arg = parts[1];

    if (!S.onboarded || name === 'start') {
      nav.hidden = true;
      var again = ui.stInit;
      if (!again) initStart();
      viewStart();
      if (!again) window.scrollTo(0, 0);
      return;
    }
    ui.stInit = false;
    nav.hidden = false;
    var fn = routes[name] || viewHome;
    fn(arg);
    $$('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === (routes[name] ? (name === 'curriculum' ? 'paths' : name) : 'home')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if (!firstRoute) {
      var h = $('#view h1');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    firstRoute = false;
  }
  function view(html) { $('#view').innerHTML = html; }

  /* ---------- network helper ---------- */
  function postJson(url, body) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    return fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, ok: r.ok, body: j }; });
    }, function (e) { clearTimeout(timer); throw e; });
  }

  /* ---------- sign in and create account ---------- */
  function viewAuth() {
    var reg = ui.authMode === 'signup';
    view(
      '<h1>' + esc(t('auth_title')) + '</h1><p class="muted">' + esc(t('auth_sub')) + '</p>' +
      '<div class="seg" role="group" aria-label="' + esc(t('auth_title')) + '">' +
      '<button type="button" data-act="auth-mode" data-v="signin" aria-pressed="' + (!reg) + '">' + esc(t('tab_signin')) + '</button>' +
      '<button type="button" data-act="auth-mode" data-v="signup" aria-pressed="' + reg + '">' + esc(t('tab_signup')) + '</button></div>' +
      '<form data-form="' + (reg ? 'register' : 'login') + '" novalidate>' +
      (reg ? '<label for="a-name">' + esc(t('f_name')) + ' <span class="hint">' + esc(t('f_name_hint')) + '</span></label>' +
        '<input type="text" id="a-name" maxlength="20" autocomplete="nickname" value="' + esc(ui.authName) + '">' : '') +
      '<label for="a-id">' + esc(t('f_id')) + (reg ? ' <span class="hint">' + esc(t('f_id_hint')) + '</span>' : '') + '</label>' +
      '<input type="text" id="a-id" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="100" value="' + esc(ui.authId) + '">' +
      '<label for="a-pw">' + esc(t('f_pw')) + (reg ? ' <span class="hint">' + esc(t('f_pw_hint')) + '</span>' : '') + '</label>' +
      '<input type="password" id="a-pw" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" maxlength="200">' +
      '<div class="checkrow" style="border:0;padding:8px 0 0"><input type="checkbox" id="a-show"><label for="a-show">' + esc(t('f_pw_show')) + '</label></div>' +
      '<p class="err" id="auth-err" role="alert">' + esc(ui.authErr ? t(ui.authErr) : '') + '</p>' +
      '<button class="btn block" type="submit" id="auth-go">' + esc(reg ? t('btn_signup') : t('tab_signin')) + '</button></form>' +
      '<p class="small muted" style="margin-top:16px">' + esc(reg ? t('auth_privacy') : t('auth_forgot')) + '</p>' +
      (!auth.configured ? '<div class="card"><p>' + esc(t('auth_unconfigured')) + '</p><button class="btn ghost" type="button" data-act="guest">' + esc(t('auth_guest')) + '</button><p class="small muted" style="margin-top:8px">' + esc(t('auth_guest_note')) + '</p></div>' : '')
    );
  }
  function showAuthErr(key) {
    ui.authErr = key;
    var el = $('#auth-err'); if (el) el.textContent = t(key);
  }
  function validId(v) {
    v = String(v || '').trim().toLowerCase();
    if (/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(v)) return true;
    var d = v.replace(/[\s\-()]/g, '').replace(/^\+/, '');
    if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    else if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d);
  }
  function syncAuthInputs() {
    var a = $('#a-id'); if (a) ui.authId = a.value;
    var n = $('#a-name'); if (n) ui.authName = n.value;
  }
  function authSubmit(kind, f) {
    var reg = kind === 'register';
    var name = reg ? $('#a-name', f).value.trim() : '';
    var id = $('#a-id', f).value.trim(), pw = $('#a-pw', f).value;
    ui.authName = name; ui.authId = id;
    var err = '';
    if (reg && (name.length < 2 || name.length > 20)) err = 'err_name';
    else if (!validId(id)) err = 'err_id';
    else if (reg && pw.length < 8) err = 'err_pw';
    else if (!reg && !pw) err = 'err_credentials';
    if (err) { showAuthErr(err); return; }
    var btn = $('#auth-go'); btn.disabled = true;
    postJson('/api/auth', { action: kind, name: name, identifier: id, password: pw }).then(function (res) {
      btn.disabled = false;
      if (res.ok && res.body && res.body.user) return onAuthed(res.body);
      if (res.status === 503) { auth.configured = false; ui.authErr = ''; return viewAuth(); }
      var e = res.body && res.body.error;
      showAuthErr(res.status === 401 ? 'err_credentials' : res.status === 409 ? 'err_exists' : res.status === 429 ? 'err_slow' :
        e === 'bad_id' ? 'err_id' : e === 'bad_password' ? 'err_pw' : e === 'bad_name' ? 'err_name' : 'err_generic');
    }, function () { btn.disabled = false; showAuthErr('err_net'); });
  }
  function onAuthed(j) {
    session = { uid: String(j.user.id), nick: String(j.user.nick || '').slice(0, 20) };
    lsSet(SESS_KEY, JSON.stringify(session));
    setState(loadFor(session.uid));
    adoptServer(j.state);
    ui.authErr = ''; ui.authId = ''; ui.authName = ''; ui.authMode = 'signin'; ui.stInit = false;
    var serverAt = j.state ? (+j.state.updatedAt || 0) : 0;
    if (S.updatedAt > serverAt) pushState();
    route();
    sendSupport(true);
    flushOutbox();
  }
  function doLogout() {
    if (!session) return;
    var guest = session.guest, id = session.uid;
    if (!guest && navigator.onLine === false && !confirm(t('logout_offline'))) return;
    function done() {
      if (!guest) lsDel(KEY + id);
      lsDel(SESS_KEY); session = null; setState(defaults());
      ui.stInit = false; ui.st = null; ui.busy = false;
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
      history.replaceState(null, '', location.pathname);
      route();
    }
    if (guest) return done();
    (navigator.onLine === false ? Promise.resolve() : pushState())
      .then(function () { return postJson('/api/auth', { action: 'logout' }); })
      .then(done, done);
  }

  /* ---------- first page: support needed, level and direction ---------- */
  function initStart() {
    ui.st = {
      support: (S.support || []).slice(), note: S.supportNote || '', year: S.year || '', comfort: S.comfort || '',
      goal: S.goal || (S.onboarded ? 'none' : '')
    };
    ui.stInit = true;
  }
  function syncStartInputs() { var n = $('#st-note'); if (n && ui.st) ui.st.note = n.value; }
  function viewStart() {
    var st = ui.st;
    view(
      '<h1>' + esc(t('st_title')) + '</h1><p class="muted">' + esc(t('st_sub')) + '</p>' +
      '<form data-form="start" novalidate>' +
      '<div class="tiles" role="group" aria-label="' + esc(t('st_title')) + '">' + SUPPORT.map(function (x) {
        return '<button type="button" class="tile" data-act="st-support" data-v="' + x.id + '" aria-pressed="false"><span class="ic" aria-hidden="true">' + x.icon +
          '</span><span><b>' + esc(t('sup_' + x.id)) + '</b><span class="sub">' + esc(t('sup_' + x.id + '_d')) + '</span></span></button>';
      }).join('') + '</div>' +
      '<p class="consent" id="st-consent" hidden>' + esc(t('st_consent')) + '</p>' +
      '<label for="st-note">' + esc(t('st_note')) + '</label>' +
      '<textarea id="st-note" maxlength="400" placeholder="' + esc(t('st_note_ph')) + '">' + esc(st.note) + '</textarea>' +
      '<label id="yl">' + esc(t('ob_year')) + '</label><div class="chips" role="group" aria-labelledby="yl">' +
      YEARS.map(function (y) { return '<button type="button" class="chip" data-act="st-year" data-v="' + y + '" aria-pressed="false">' + esc(t(y)) + '</button>'; }).join('') + '</div>' +
      '<label id="cl">' + esc(t('ob_comfort')) + '</label><div class="chips" role="group" aria-labelledby="cl">' +
      COMFORTS.map(function (c) { return '<button type="button" class="chip" data-act="st-comfort" data-v="' + c + '" aria-pressed="false">' + esc(t(c)) + '</button>'; }).join('') + '</div>' +
      '<h2 class="step-h" id="dl">' + esc(t('st_dir')) + '</h2><p class="muted small" style="margin:0 0 4px">' + esc(t('ob_goal_sub')) + '</p>' +
      '<div class="tiles two" role="group" aria-labelledby="dl">' + PF.roles.map(function (r) {
        return '<button type="button" class="tile" data-act="st-goal" data-id="' + r.id + '" aria-pressed="false"><span class="ic" aria-hidden="true">' + r.icon +
          '</span><span><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.short) + '</span></span></button>';
      }).join('') +
      '<button type="button" class="tile" data-act="st-goal" data-id="none" aria-pressed="false"><span class="ic" aria-hidden="true">❓</span><span><b>' + esc(t('ob_notsure')) + '</b></span></button></div>' +
      '<p class="err" id="st-err" role="alert"></p>' +
      '<button class="btn block" type="submit">' + esc(t('st_submit')) + '</button></form>'
    );
    refreshStart();
  }
  function refreshStart() {
    var st = ui.st; if (!st) return;
    $$('[data-act="st-support"]').forEach(function (b) { b.setAttribute('aria-pressed', String(st.support.indexOf(b.dataset.v) >= 0)); });
    $$('[data-act="st-year"]').forEach(function (b) { b.setAttribute('aria-pressed', String(st.year === b.dataset.v)); });
    $$('[data-act="st-comfort"]').forEach(function (b) { b.setAttribute('aria-pressed', String(st.comfort === b.dataset.v)); });
    $$('[data-act="st-goal"]').forEach(function (b) { b.setAttribute('aria-pressed', String(st.goal === b.dataset.id)); });
    var c = $('#st-consent');
    if (c) c.hidden = !(st.support.indexOf('mentor') >= 0 || st.support.indexOf('oneone') >= 0);
  }
  function submitStart() {
    syncStartInputs();
    var st = ui.st;
    if (!st.support.length) {
      $('#st-err').textContent = t('st_err');
      var first = $('[data-act="st-support"]'); if (first) first.focus();
      return;
    }
    S.support = st.support.slice();
    S.supportNote = st.note.trim().slice(0, 400);
    S.year = st.year; S.comfort = st.comfort;
    S.goal = st.goal === 'none' ? '' : st.goal;
    S.onboarded = true; S.supportSent = false;
    save();
    ui.stInit = false;
    if (session.guest) toast(t('st_guest')); else sendSupport(false);
    if (location.hash === '#/home') route(); else location.hash = '#/home';
  }
  function sendSupport(quiet) {
    if (!session || session.guest || !S.onboarded || S.supportSent || !S.support.length) return Promise.resolve();
    return postJson('/api/support', { needs: S.support, note: S.supportNote, year: S.year, comfort: S.comfort, goal: S.goal }).then(function (res) {
      if (res.status === 401) { handleExpired(); return; }
      if (!res.ok) throw new Error('http');
      S.supportSent = true; save();
      if (!quiet) toast(t('st_sent'));
    }).catch(function () { if (!quiet) toast(t('st_queued')); });
  }

  /* ---------- home ---------- */
  function viewHome() {
    var role = PF.roleById(S.goal);
    var done = role ? stepsDone(role.id) : 0;
    var total = role ? role.steps.length : 0;
    var h = '<section class="hero"><div><h1>' + esc(t('home_hello', { nick: nick() })) + '</h1>';
    if (role) {
      h += '<p>' + esc(t('home_heading_goal', { role: role.name })) + ' ' + esc(t('home_progress', { done: done, total: total })) + '</p>';
      var st = streak();
      h += '<p class="small muted">' + esc(st > 0 ? t('streak', { n: st }) : t('streak_zero')) + '</p>';
    } else {
      h += '<p>' + esc(t('home_nogoal')) + '</p>' +
        '<p><a class="btn" href="#/paths">' + esc(t('home_explore')) + '</a></p>';
    }
    h += '</div>' + (role ? stone(role.tag, String(total - done), t('home_togo')) : stone('?', '?', t('home_pickgoal'))) + '</section>';

    if (role) {
      var ni = nextStep(role);
      if (ni >= 0) {
        var s = role.steps[ni];
        var url = safeUrl(s.r.u);
        h += '<div class="card step"><h2 style="margin-top:0">' + esc(t('home_week')) + '</h2>' +
          '<h3>' + esc(t('plan_step', { n: ni + 1 })) + ': ' + esc(s.t) + '</h3><p>' + esc(s.d) + '</p>' +
          (url ? '<p class="small"><a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(s.r.l) + '</a></p>' : '') +
          '<button class="btn go" data-act="home-finish">' + esc(t('plan_mark')) + '</button></div>';
      } else {
        h += '<div class="card done"><p>' + esc(t('home_complete')) + '</p><a class="btn" href="#/mentors">' + esc(t('nav_mentors')) + '</a></div>';
      }
    }

    if (S.support && S.support.length) {
      var dest = { learn: '#/curriculum', career: '#/paths', mentor: '#/mentors', oneone: '#/mentors' };
      h += '<h2>' + esc(t('home_support')) + '</h2><ul class="list">' + S.support.map(function (id) {
        var x = SUPPORT.filter(function (q) { return q.id === id; })[0];
        return '<li><a href="' + dest[id] + '"><span class="ic" aria-hidden="true">' + x.icon + '</span><span><b>' + esc(t('sup_' + id)) +
          '</b><span class="sub">' + esc(t('sup_' + id + '_d')) + '</span></span></a></li>';
      }).join('') + '</ul><p class="small"><a href="#/start">' + esc(t('st_edit')) + '</a></p>';
    }

    var nextW = upcomingWebinars()[0];
    h += '<h2>' + esc(t('home_more')) + '</h2><ul class="list">' +
      '<li><a href="#/guide"><span class="ic" aria-hidden="true">💬</span><span><b>' + esc(t('home_ask')) + '</b><span class="sub">' + esc(t('home_ask_sub')) + '</span></span></a></li>' +
      '<li><a href="#/curriculum"><span class="ic" aria-hidden="true">🗺️</span><span><b>' + esc(t('home_map')) + '</b><span class="sub">' + esc(t('home_map_sub')) + '</span></span></a></li>' +
      '<li><a href="#/mentors"><span class="ic" aria-hidden="true">🎥</span><span>' +
      (nextW ? '<b>' + esc(t('home_webinar')) + '</b><span class="sub">' + esc(nextW.title) + ', ' + esc(fmtDate(new Date(nextW.date))) + '</span>'
        : '<b>' + esc(t('home_webinar_none')) + '</b><span class="sub">' + esc(t('home_webinar_none_sub')) + '</span>') +
      '</span></a></li></ul>';
    h += '<p class="small muted" style="margin-top:28px">' + esc(session.guest ? t('guest_mode') : t('signed_in_as', { nick: nick() })) +
      ' <button class="btn small ghost" type="button" data-act="logout">' + esc(session.guest ? t('tab_signin') : t('logout')) + '</button></p>';
    view(h);
  }

  /* ---------- careers ---------- */
  function coverage(role) {
    var have = role.subjects.filter(function (id) { return S.subjects.indexOf(id) >= 0; });
    return { have: have, miss: role.subjects.filter(function (id) { return have.indexOf(id) < 0; }) };
  }
  function viewPaths(arg) {
    if (arg) return viewPathDetail(arg);
    view(
      '<h1>' + esc(t('paths_title')) + '</h1><p class="muted">' + esc(t('paths_sub')) + '</p>' +
      '<p><a class="btn ghost" href="#/curriculum">' + esc(t('paths_syllabus_cta')) + '</a></p>' +
      '<div class="roles">' + PF.roles.map(function (r) {
        var isGoal = S.goal === r.id;
        return '<a class="role" href="#/paths/' + r.id + '">' + miniStone(r.tag) + '<div>' +
          (isGoal ? '<span class="tag green">' + esc(t('paths_is_goal')) + '</span>' : '') +
          '<h3>' + esc(r.name) + '</h3><p>' + esc(r.short) + '</p></div></a>';
      }).join('') + '</div>'
    );
  }
  function viewPathDetail(id) {
    var r = PF.roleById(id);
    if (!r) { location.hash = '#/paths'; return; }
    var cov = coverage(r);
    var isGoal = S.goal === r.id;
    var covLine = S.subjects.length
      ? t('paths_syllabus', { n: cov.have.length, total: r.subjects.length })
      : t('paths_syllabus_none');
    view(
      '<p><a href="#/paths">&larr; ' + esc(t('back')) + '</a></p>' +
      '<h1>' + esc(r.name) + '</h1><p>' + esc(r.short) + '</p>' +
      '<div class="row">' +
      (isGoal ? '<span class="tag green">' + esc(t('paths_is_goal')) + '</span>'
        : '<button class="btn go" data-act="set-goal" data-id="' + r.id + '">' + esc(t('paths_goal_btn')) + '</button>') +
      '<button class="btn ghost" data-act="ask-about" data-id="' + r.id + '">' + esc(t('paths_ask')) + '</button></div>' +
      '<h2>' + esc(t('paths_day')) + '</h2><p>' + esc(r.day) + '</p>' +
      '<h2>' + esc(t('paths_skills')) + '</h2><ul>' + r.skills.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
      '<h2>' + esc(t('paths_entry')) + '</h2><p>' + esc(r.entry) + '</p>' +
      '<p class="small muted">' + esc(t('paths_no_promise')) + '</p>' +
      '<div class="card"><p>' + esc(covLine) + '</p><a class="btn small ghost" href="#/curriculum">' + esc(t('cur_title')) + '</a></div>' +
      '<h2>' + esc(t('paths_roadmap')) + '</h2><ol class="road" style="list-style:none">' +
      r.steps.map(function (s, i) {
        var d = S.done[r.id] && S.done[r.id][i];
        return '<li' + (d ? ' class="done"' : '') + '><b>' + esc(s.t) + '</b><span class="muted small">' + esc(s.d) + '</span></li>';
      }).join('') + '</ol>'
    );
  }

  /* ---------- syllabus map ---------- */
  function viewCurriculum() {
    if (!ui.matchRole) ui.matchRole = S.goal || PF.roles[0].id;
    view(
      '<p><a href="#/paths">&larr; ' + esc(t('back')) + '</a></p>' +
      '<h1>' + esc(t('cur_title')) + '</h1><p class="muted">' + esc(t('cur_sub')) + '</p>' +
      '<div>' + PF.subjects.map(function (s) {
        var on = S.subjects.indexOf(s.id) >= 0;
        return '<div class="checkrow"><input type="checkbox" id="sub-' + s.id + '" data-subj="' + s.id + '"' + (on ? ' checked' : '') + '>' +
          '<div><label for="sub-' + s.id + '">' + esc(s.name) + '</label>' +
          '<details><summary>' + esc(t('cur_why')) + '</summary><p><b>' + esc(t('cur_why')) + ':</b> ' + esc(s.why) + '<br><b>' + esc(t('cur_used')) + ':</b> ' + esc(s.used) + '</p></details></div></div>';
      }).join('') + '</div>' +
      '<h2>' + esc(t('cur_match')) + '</h2>' +
      '<div class="pill-row" role="group" aria-label="' + esc(t('cur_match')) + '">' + PF.roles.map(function (r) {
        return '<button class="chip" data-act="match-role" data-id="' + r.id + '" aria-pressed="' + (ui.matchRole === r.id) + '">' + esc(r.name) + '</button>';
      }).join('') + '</div>' +
      '<div id="match"></div>'
    );
    renderMatch();
  }
  function renderMatch() {
    var box = $('#match'); if (!box) return;
    var r = PF.roleById(ui.matchRole); if (!r) return;
    $$('[data-act="match-role"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-id') === r.id)); });
    if (!S.subjects.length) { box.innerHTML = '<p class="muted">' + esc(t('cur_empty')) + '</p>'; return; }
    var cov = coverage(r);
    var pct = Math.round(100 * cov.have.length / r.subjects.length);
    box.innerHTML =
      '<p><b>' + esc(t('paths_syllabus', { n: cov.have.length, total: r.subjects.length })) + '</b></p>' +
      '<div class="bar" role="img" aria-label="' + pct + '%"><i style="width:' + pct + '%"></i></div>' +
      (cov.have.length ? '<h3>' + esc(t('cur_covered')) + '</h3><ul class="gap-list">' + cov.have.map(function (id) {
        return '<li class="ok">' + esc(PF.subjectById(id).name) + '</li>';
      }).join('') + '</ul>' : '') +
      (cov.miss.length ? '<h3>' + esc(t('cur_gaps')) + '</h3><ul class="gap-list">' + cov.miss.map(function (id) {
        var s = PF.subjectById(id); var u = safeUrl(s.bridge.u);
        return '<li>' + esc(s.name) + '<br><span class="small muted">' + esc(t('cur_bridge')) + ': ' +
          (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(s.bridge.l) + '</a>' : esc(s.bridge.l)) + '</span></li>';
      }).join('') + '</ul>' : '') +
      '<button class="btn ghost" data-act="explain-syllabus">' + esc(t('cur_explain')) + '</button>';
  }

  /* ---------- plan ---------- */
  function viewPlan() {
    var role = PF.roleById(S.goal);
    if (!role) {
      view('<h1>' + esc(t('plan_title')) + '</h1><div class="card"><p>' + esc(t('plan_nogoal')) + '</p><a class="btn" href="#/paths">' + esc(t('home_explore')) + '</a></div>');
      return;
    }
    var done = stepsDone(role.id), total = role.steps.length, ni = nextStep(role);
    var pct = Math.round(100 * done / total);
    var h = '<h1>' + esc(t('plan_title')) + '</h1><p><b>' + esc(role.name) + '</b> &middot; ' + esc(t('home_progress', { done: done, total: total })) + '</p>' +
      '<div class="bar" role="img" aria-label="' + pct + '%"><i style="width:' + pct + '%"></i></div>' +
      '<p class="small muted">' + esc(streak() > 0 ? t('streak', { n: streak() }) : t('streak_zero')) + '</p>';

    role.steps.forEach(function (s, i) {
      var d = S.done[role.id] && S.done[role.id][i];
      var url = safeUrl(s.r.u);
      var res = url ? '<p class="small">' + esc(t('plan_resource')) + ': <a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(s.r.l) + '</a></p>' : '';
      if (d) {
        var log = S.logs.filter(function (l) { return l.role === role.id && l.step === i; })[0];
        var lu = log && safeUrl(log.link);
        h += '<div class="card done"><h3>&#10003; ' + esc(t('plan_step', { n: i + 1 })) + ': ' + esc(s.t) + '</h3>' +
          (log && log.note ? '<p>' + esc(log.note) + '</p>' : '') +
          (lu ? '<p class="small"><a href="' + esc(lu) + '" target="_blank" rel="noopener">' + esc(log.link) + '</a></p>' : '') +
          '<button class="btn small ghost" data-act="undo-step" data-i="' + i + '">' + esc(t('plan_undo')) + '</button></div>';
      } else if (i === ni) {
        h += '<div class="card step"><span class="tag">' + esc(t('plan_next')) + '</span><h3>' + esc(t('plan_step', { n: i + 1 })) + ': ' + esc(s.t) + '</h3><p>' + esc(s.d) + '</p>' + res +
          '<button class="btn go" data-act="finish-open"' + (ui.openFinish ? ' hidden' : '') + '>' + esc(t('plan_mark')) + '</button>' +
          '<form data-form="finish" data-i="' + i + '"' + (ui.openFinish ? '' : ' hidden') + '>' +
          '<label for="f-note">' + esc(t('plan_what')) + '</label><textarea id="f-note" maxlength="400" placeholder="' + esc(t('plan_what_ph')) + '"></textarea>' +
          '<label for="f-link">' + esc(t('plan_link')) + '</label><input type="text" id="f-link" inputmode="url" maxlength="300">' +
          '<div class="row" style="margin-top:14px"><button class="btn go" type="submit">' + esc(t('plan_save')) + '</button>' +
          '<button class="btn ghost" type="button" data-act="finish-cancel">' + esc(t('plan_cancel')) + '</button></div></form></div>';
      } else {
        h += '<details class="step-d"><summary>' + esc(t('plan_step', { n: i + 1 })) + ': ' + esc(s.t) + '</summary><p>' + esc(s.d) + '</p>' + res + '</details>';
      }
    });
    ui.openFinish = false;

    if (ni < 0) h += '<div class="card done"><p>' + esc(t('home_complete')) + '</p></div>';

    h += '<p style="margin-top:20px"><a class="btn ghost" href="#/paths">' + esc(t('plan_change')) + '</a></p>';

    var logs = S.logs.slice().sort(function (a, b) { return b.ts - a.ts; });
    h += '<h2>' + esc(t('plan_portfolio')) + '</h2>';
    if (!logs.length) h += '<p class="muted">' + esc(t('plan_portfolio_empty')) + '</p>';
    else {
      h += '<ul class="list">' + logs.map(function (l) {
        var r = PF.roleById(l.role); var step = r && r.steps[l.step]; var lu = safeUrl(l.link);
        return '<li style="padding:12px 4px"><b>' + esc(step ? step.t : '') + '</b> <span class="tag">' + esc(r ? r.tag : '') + '</span>' +
          (l.note ? '<span class="sub">' + esc(l.note) + '</span>' : '') +
          (lu ? '<span class="sub"><a href="' + esc(lu) + '" target="_blank" rel="noopener">' + esc(l.link) + '</a></span>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    view(h);
    if (ui.openFinish === false && $('[data-form="finish"]:not([hidden]) textarea')) $('[data-form="finish"] textarea').focus();
  }

  /* ---------- AI guide ---------- */
  var chatPrefill = '';
  function viewGuide() {
    view(
      '<h1>' + esc(t('guide_title')) + '</h1><p class="muted">' + esc(t('guide_sub')) + '</p>' +
      '<div class="chat" id="chat" aria-live="polite"></div>' +
      '<div class="pill-row" id="chips">' +
      ['guide_chip1', 'guide_chip2', 'guide_chip3'].map(function (k) { return '<button class="chip" data-act="chip" data-k="' + k + '">' + esc(t(k)) + '</button>'; }).join('') + '</div>' +
      '<form class="composer" data-form="chat">' +
      '<button class="mic" type="button" data-act="mic" aria-label="' + esc(t('guide_mic')) + '">&#127908;</button>' +
      '<textarea id="chat-in" rows="1" maxlength="800" placeholder="' + esc(t('guide_ph')) + '" aria-label="' + esc(t('guide_ph')) + '"></textarea>' +
      '<button class="btn" type="submit" id="chat-send">' + esc(t('guide_send')) + '</button></form>' +
      '<p class="small muted">' + esc(t('guide_note')) + ' <button class="btn small ghost" data-act="clear-chat" type="button">' + esc(t('guide_clear')) + '</button></p>'
    );
    renderChat();
    if (chatPrefill) { $('#chat-in').value = chatPrefill; chatPrefill = ''; $('#chat-in').focus(); }
  }
  function md(s) {
    var lines = esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').split('\n');
    var out = '', inList = false;
    lines.forEach(function (ln) {
      var m = ln.match(/^\s*(?:[-*]|\u2022)\s+(.*)/);
      if (m) { if (!inList) { out += '<ul>'; inList = true; } out += '<li>' + m[1] + '</li>'; }
      else { if (inList) { out += '</ul>'; inList = false; } if (ln.trim()) out += '<p>' + ln + '</p>'; }
    });
    if (inList) out += '</ul>';
    return out;
  }
  function renderChat() {
    var box = $('#chat'); if (!box) return;
    var items = S.chat.length ? S.chat : [{ r: 'ai', t: t('guide_hello'), hello: true }];
    box.innerHTML = items.map(function (m, i) {
      return '<div class="msg ' + (m.r === 'user' ? 'user' : 'ai') + '">' + md(m.t) +
        (m.r === 'ai' ? '<div class="tools"><button class="btn small ghost" type="button" data-act="speak" data-i="' + i + '">&#128266; ' + esc(t('guide_listen')) + '</button></div>' : '') + '</div>';
    }).join('') + (ui.busy ? '<div class="msg ai typing">' + esc(t('guide_thinking')) + '...</div>' : '');
    if (S.chat.length) { var last = box.lastElementChild; if (last) last.scrollIntoView({ block: 'nearest' }); }
  }
  function aiContext() {
    var role = PF.roleById(S.goal), ni = role ? nextStep(role) : -1;
    return {
      year: S.year, comfort: S.comfort,
      goalName: role ? role.name : '',
      nextStep: role && ni >= 0 ? role.steps[ni].t : '',
      subjectNames: S.subjects.map(function (id) { return PF.subjectById(id).name; }).join(', ')
    };
  }
  function sendChat(text) {
    text = (text || '').trim();
    if (!text || ui.busy) return;
    S.chat.push({ r: 'user', t: text.slice(0, 800), ts: Date.now() });
    S.chat = S.chat.slice(-40);
    ui.busy = true; save(); renderChat();
    var history = S.chat.slice(-8).map(function (m) { return { role: m.r === 'user' ? 'user' : 'assistant', content: m.t }; });
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 30000);
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, lang: PF.lang, profile: aiContext() }),
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || !j.reply) throw new Error('empty');
      S.chat.push({ r: 'ai', t: j.reply, ts: Date.now() });
    }).catch(function () {
      S.chat.push({ r: 'ai', t: localGuide(text) + '\n\n' + t('guide_offline'), ts: Date.now() });
    }).then(function () {
      clearTimeout(timer);
      ui.busy = false; S.chat = S.chat.slice(-40); save(); renderChat();
    });
  }
  /* Built-in fallback so the guide still helps with no connection or no AI key. */
  function localGuide(text) {
    var q = text.toLowerCase(), best = null, score = 0;
    PF.roles.forEach(function (r) {
      var s = 0; r.keywords.forEach(function (k) { if (q.indexOf(k) >= 0) s++; });
      if (s > score) { score = s; best = r; }
    });
    if (!best && S.goal) best = PF.roleById(S.goal);
    if (best) {
      var ni = nextStep(best);
      var step = best.steps[ni >= 0 ? ni : 0];
      return '**' + best.name + '**\n' + best.short + '\n\n' + best.day + '\n\n**Skills to build**\n' +
        best.skills.map(function (s) { return '- ' + s; }).join('\n') + '\n\n**A good next step**\n' + step.t + '. ' + step.d;
    }
    return 'Here is a good way to begin: open the Careers tab, read two paths that sound interesting, and choose one to follow. Each path has eight small steps. If you are stuck, send an anonymous question to a mentor.';
  }
  var recog = null;
  function startMic(btn) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast(t('guide_nomic')); return; }
    if (recog) { try { recog.stop(); } catch (e) { /* ignore */ } return; }
    recog = new SR(); recog.lang = speechLang(); recog.interimResults = false; recog.maxAlternatives = 1;
    recog.onresult = function (e) {
      var inp = $('#chat-in'); if (inp) inp.value = ((inp.value || '') + ' ' + e.results[0][0].transcript).trim();
    };
    recog.onend = recog.onerror = function () { btn.classList.remove('on'); recog = null; };
    btn.classList.add('on');
    try { recog.start(); } catch (e) { btn.classList.remove('on'); recog = null; }
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ''));
    u.lang = speechLang();
    window.speechSynthesis.speak(u);
  }

  /* ---------- mentors, webinars, questions ---------- */
  function upcomingWebinars() {
    var now = Date.now();
    return PF.config.webinars.filter(function (w) { return new Date(w.date).getTime() + (w.minutes || 60) * 60000 > now; })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
  }
  function pastWebinars() {
    var now = Date.now();
    return PF.config.webinars.filter(function (w) { return new Date(w.date).getTime() + (w.minutes || 60) * 60000 <= now && w.recording; });
  }
  function nextOccurrence(dow, hhmm) {
    var p = hhmm.split(':'), h = +p[0], m = +p[1], IST = 5.5 * 3600e3;
    var nowIst = new Date(Date.now() + IST);
    var d = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate(), h, m));
    d = new Date(d.getTime() + ((dow - d.getUTCDay() + 7) % 7) * 86400000);
    if (d <= nowIst) d = new Date(d.getTime() + 7 * 86400000);
    return new Date(d.getTime() - IST);
  }
  function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsDate(d) { return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; }
  function downloadIcs(o) {
    var end = new Date(o.start.getTime() + (o.minutes || 60) * 60000);
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pathfinder//EN', 'BEGIN:VEVENT',
      'UID:' + uid() + '@pathfinder', 'DTSTAMP:' + icsDate(new Date()), 'DTSTART:' + icsDate(o.start), 'DTEND:' + icsDate(end),
      'SUMMARY:' + icsEscape(o.title), 'DESCRIPTION:' + icsEscape(o.description || ''), 'URL:' + (safeUrl(o.url) || '')];
    if (o.weekly) lines.push('RRULE:FREQ=WEEKLY');
    lines.push('END:VEVENT', 'END:VCALENDAR');
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'pathfinder-event.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function viewMentors() {
    var oh = PF.config.officeHours, need = PF.config.oneToOneUnlock, done = totalDone();
    var unlocked = done >= need;
    var ohUrl = safeUrl(oh.link);
    var h = '<h1>' + esc(t('mentors_title')) + '</h1>' +
      '<div class="card step"><h3>' + esc(t('oh_title')) + '</h3>' +
      '<p><b>' + esc(t('oh_when', { day: PF.dayName(oh.day), time: oh.time })) + '</b></p><p>' + esc(oh.topic) + '</p>' +
      '<div class="row">' + (ohUrl ? '<a class="btn go small" href="' + esc(ohUrl) + '" target="_blank" rel="noopener">' + esc(t('oh_join')) + '</a>' : '') +
      '<button class="btn ghost small" data-act="ics-oh">' + esc(t('ics_btn')) + '</button></div></div>';

    h += '<h2>' + esc(t('wb_title')) + '</h2>';
    var up = upcomingWebinars(), past = pastWebinars();
    if (!up.length && !past.length) h += '<p class="muted">' + esc(t('wb_none')) + '</p>';
    up.forEach(function (w) {
      var i = PF.config.webinars.indexOf(w), u = safeUrl(w.link);
      h += '<div class="card"><h3>' + esc(w.title) + '</h3><p class="small muted">' + esc(fmtDate(new Date(w.date))) + ' &middot; ' + esc(w.speaker) + '</p><p>' + esc(w.about) + '</p>' +
        '<div class="row">' + (u ? '<a class="btn go small" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t('wb_join')) + '</a>' : '') +
        '<button class="btn ghost small" data-act="ics-wb" data-i="' + i + '">' + esc(t('ics_btn')) + '</button></div></div>';
    });
    past.forEach(function (w) {
      var u = safeUrl(w.recording);
      if (u) h += '<div class="card"><h3>' + esc(w.title) + '</h3><a class="btn ghost small" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t('wb_recording')) + '</a></div>';
    });

    h += '<h2>' + esc(t('ask_title')) + '</h2><p class="muted">' + esc(t('ask_sub')) + '</p>' +
      '<form data-form="ask"><label class="sr" for="q-text">' + esc(t('ask_ph')) + '</label>' +
      '<textarea id="q-text" maxlength="600" placeholder="' + esc(t('ask_ph')) + '"></textarea>' +
      '<p style="margin-top:12px"><button class="btn" type="submit">' + esc(t('ask_send')) + '</button></p></form>' +
      '<div id="myq"></div>' +
      '<h2>' + esc(t('board_title')) + '</h2><div id="board"><p class="muted">&hellip;</p></div>';

    h += '<h2>' + esc(t('one_title')) + '</h2><div class="card' + (unlocked ? ' done' : '') + '"><div class="lock"><span class="ic" aria-hidden="true">' + (unlocked ? '&#128275;' : '&#128274;') + '</span><div>' +
      (unlocked
        ? '<p>' + esc(t('one_open')) + '</p><a class="btn go" href="' + esc(PF.config.oneToOneUrl) + '" target="_blank" rel="noopener">' + esc(t('one_request')) + '</a>'
        : '<p>' + esc(t('one_locked', { n: need, done: done })) + '</p><div class="bar"><i style="width:' + Math.round(100 * Math.min(done, need) / need) + '%"></i></div><a class="btn small ghost" href="#/plan">' + esc(t('nav_plan')) + '</a>') +
      '</div></div></div>';

    h += '<h2>' + esc(t('mentors_list')) + '</h2><ul class="list">' + PF.config.mentors.map(function (m) {
      return '<li style="padding:12px 4px"><b>' + esc(m.name) + '</b><span class="sub">' + esc(m.role) + '</span><span class="sub">' + esc(m.topics) + ' &middot; ' + esc(m.langs) + '</span></li>';
    }).join('') + '</ul>';

    view(h);
    renderMyQuestions();
    loadBoard();
  }
  function renderMyQuestions() {
    var box = $('#myq'); if (!box) return;
    if (!S.myQ.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<h3 style="margin-top:20px">' + esc(t('my_q')) + '</h3>' + S.myQ.slice(0, 10).map(function (q) {
      var st = q.answer ? t('answered') : (q.status === 'queued' ? t('queued') : t('waiting'));
      return '<div class="qa"><div class="q">' + esc(q.text) + '</div><div class="status">' + esc(st) + '</div>' +
        (q.answer ? '<div class="a"><b>' + esc(t('mentor_says')) + (q.mentor ? ' (' + esc(q.mentor) + ')' : '') + ':</b><br>' + esc(q.answer) + '</div>' : '') + '</div>';
    }).join('');
  }
  function loadBoard() {
    fetch('/api/questions').then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (j) {
      var items = (j && j.items) || [];
      var changed = false;
      S.myQ.forEach(function (q) {
        var hit = items.filter(function (x) { return x.id === q.id; })[0];
        if (hit && !q.answer) { q.answer = hit.answer; q.mentor = hit.mentor; changed = true; }
      });
      if (changed) { save(); renderMyQuestions(); }
      var box = $('#board'); if (!box) return;
      box.innerHTML = items.length ? items.slice(0, 20).map(function (x) {
        return '<div class="qa"><div class="q">' + esc(x.text) + '</div><div class="a"><b>' + esc(t('mentor_says')) + (x.mentor ? ' (' + esc(x.mentor) + ')' : '') + ':</b><br>' + esc(x.answer) + '</div></div>';
      }).join('') : '<p class="muted">' + esc(t('board_empty')) + '</p>';
    }).catch(function () {
      var box = $('#board'); if (box) box.innerHTML = '<p class="muted">' + esc(t('board_empty')) + '</p>';
    });
  }
  function postQuestion(q) {
    return fetch('/api/questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: q.text, role: S.goal || '' })
    }).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (j) {
      if (j && j.id) { q.id = j.id; q.status = 'sent'; }
    });
  }
  function flushOutbox() {
    if (navigator.onLine === false) return;
    S.myQ.filter(function (q) { return q.status === 'queued'; }).forEach(function (q) {
      postQuestion(q).then(function () { save(); renderMyQuestions(); }).catch(function () { /* try again later */ });
    });
  }

  /* ---------- events ---------- */
  var A = {
    'auth-mode': function (el) { syncAuthInputs(); ui.authMode = el.dataset.v; ui.authErr = ''; viewAuth(); },
    'guest': function () {
      session = { uid: 'guest', nick: 'Friend', guest: true };
      lsSet(SESS_KEY, JSON.stringify(session));
      setState(loadFor('guest')); route();
    },
    'logout': function () { doLogout(); },
    'st-support': function (el) {
      var i = ui.st.support.indexOf(el.dataset.v);
      if (i >= 0) ui.st.support.splice(i, 1); else ui.st.support.push(el.dataset.v);
      var e = $('#st-err'); if (e) e.textContent = '';
      refreshStart();
    },
    'st-year': function (el) { ui.st.year = el.dataset.v; refreshStart(); },
    'st-comfort': function (el) { ui.st.comfort = el.dataset.v; refreshStart(); },
    'st-goal': function (el) { ui.st.goal = el.dataset.id; refreshStart(); },
    'set-goal': function (el) { S.goal = el.dataset.id; save(); location.hash = '#/plan'; },
    'ask-about': function (el) {
      var r = PF.roleById(el.dataset.id);
      chatPrefill = 'Tell me more about being a ' + r.name.toLowerCase() + '. What does the first month of learning look like?';
      location.hash = '#/guide';
    },
    'home-finish': function () {
      ui.openFinish = true;
      if (location.hash === '#/plan') route(); else location.hash = '#/plan';
    },
    'finish-open': function (el) {
      el.hidden = true;
      var f = $('[data-form="finish"]'); f.hidden = false; $('textarea', f).focus();
    },
    'finish-cancel': function () { var f = $('[data-form="finish"]'); f.hidden = true; var b = $('[data-act="finish-open"]'); if (b) b.hidden = false; },
    'undo-step': function (el) {
      var id = S.goal, i = el.dataset.i;
      if (S.done[id]) delete S.done[id][i];
      S.logs = S.logs.filter(function (l) { return !(l.role === id && String(l.step) === String(i)); });
      save(); route();
    },
    'match-role': function (el) { ui.matchRole = el.dataset.id; renderMatch(); },
    'explain-syllabus': function () {
      var r = PF.roleById(ui.matchRole);
      var names = S.subjects.map(function (id) { return PF.subjectById(id).name; }).join(', ');
      chatPrefill = 'I study these subjects: ' + names + '. Explain in simple words how they connect to becoming a ' + r.name.toLowerCase() + ', and which one to focus on first.';
      location.hash = '#/guide';
    },
    'chip': function (el) { sendChat(t(el.dataset.k)); },
    'mic': function (el) { startMic(el); },
    'speak': function (el) { var m = S.chat[+el.dataset.i]; speak(m ? m.t : t('guide_hello')); },
    'clear-chat': function () { S.chat = []; save(); renderChat(); },
    'ics-oh': function () {
      var oh = PF.config.officeHours;
      downloadIcs({ title: oh.title, start: nextOccurrence(oh.day, oh.time), minutes: oh.minutes, description: oh.topic, url: oh.link, weekly: true });
    },
    'ics-wb': function (el) {
      var w = PF.config.webinars[+el.dataset.i];
      downloadIcs({ title: w.title, start: new Date(w.date), minutes: w.minutes, description: w.about, url: w.link });
    }
  };
  
  var F = {
    login: function (f) { authSubmit('login', f); },
    register: function (f) { authSubmit('register', f); },
    start: function () { submitStart(); },
    finish: function (f) {
      var role = PF.roleById(S.goal); if (!role) return;
      var i = +f.dataset.i;
      var note = $('#f-note', f).value.trim();
      var link = $('#f-link', f).value.trim();
      S.done[role.id] = S.done[role.id] || {};
      S.done[role.id][i] = Date.now();
      S.logs = S.logs.filter(function (l) { return !(l.role === role.id && l.step === i); });
      if (note || link) S.logs.push({ role: role.id, step: i, note: note, link: safeUrl(link) ? link : '', ts: Date.now() });
      save(); route();
      toast('\u2713 ' + t('plan_done_label'));
    },
    chat: function () {
      var inp = $('#chat-in'); var v = inp.value; inp.value = ''; sendChat(v);
    },
    ask: function (f) {
      var ta = $('#q-text', f); var text = ta.value.trim();
      if (!text) { toast(t('ask_empty')); return; }
      if (text.length > 600) { toast(t('ask_too_long')); return; }
      var q = { id: uid(), text: text, ts: Date.now(), status: 'queued' };
      S.myQ.unshift(q); save(); ta.value = ''; renderMyQuestions();
      postQuestion(q).then(function () { toast(t('ask_sent')); }).catch(function () { toast(t('ask_queued')); }).then(function () { save(); renderMyQuestions(); });
    }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || !A[el.dataset.act]) return;
    e.preventDefault();
    A[el.dataset.act](el, e);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-form]');
    if (!f || !F[f.dataset.form]) return;
    e.preventDefault();
    F[f.dataset.form](f);
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'a-show') { var pw = $('#a-pw'); if (pw) pw.type = e.target.checked ? 'text' : 'password'; return; }
    var cb = e.target.closest('[data-subj]');
    if (!cb) return;
    var id = cb.getAttribute('data-subj'), i = S.subjects.indexOf(id);
    if (cb.checked && i < 0) S.subjects.push(id);
    if (!cb.checked && i >= 0) S.subjects.splice(i, 1);
    save(); renderMatch();
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'chat-in' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); F.chat();
    }
  });
  $('#lang').addEventListener('change', function (e) {
    syncAuthInputs(); syncStartInputs();
    PF.lang = e.target.value; lsSet(LANG_KEY, PF.lang);
    renderChrome(); route();
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('online', function () { updateOnline(); flushOutbox(); pushState(); sendSupport(true); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && syncPending) pushState(); });
  window.addEventListener('offline', updateOnline);

  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferredInstall = e; $('#install').hidden = false;
  });
  $('#install').addEventListener('click', function () {
    if (!deferredInstall) return;
    deferredInstall.prompt(); deferredInstall = null; $('#install').hidden = true;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () { /* optional */ }); });
  }

  /* ---------- start ---------- */
  function resume(saved) {
    session = saved; setState(loadFor(saved.uid));
    route(); flushOutbox();
  }
  function boot() {
    var stored = lsGet(LANG_KEY);
    PF.lang = langOk(stored) ? stored : 'en';
    renderChrome();
    var saved = null;
    try { saved = JSON.parse(lsGet(SESS_KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && !(typeof saved.uid === 'string' && /^[a-z0-9]{1,24}$/i.test(saved.uid))) saved = null;
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    fetch('/api/auth', { cache: 'no-store', signal: ctl ? ctl.signal : undefined }).then(function (r) {
      clearTimeout(timer);
      if (r.ok) return r.json().then(onAuthed);
      if (r.status === 503) { auth.configured = false; if (saved && saved.guest) return resume(saved); lsDel(SESS_KEY); return route(); }
      if (r.status === 401) { lsDel(SESS_KEY); return route(); }
      if (saved) return resume(saved);
      ui.authErr = 'err_net'; route();
    }, function () {
      clearTimeout(timer);
      if (saved) return resume(saved);
      ui.authErr = 'err_net'; route();
    });
  }
  boot();
})();
