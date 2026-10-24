/* Mentor console. The passcode is kept in sessionStorage only, so closing the tab signs you out. */
(function () {
  'use strict';
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var pass = '', who = '';
  try { pass = sessionStorage.getItem('pf_mp') || ''; who = sessionStorage.getItem('pf_mn') || ''; } catch (e) { /* ignore */ }

  var NEEDS = { learn: 'Learn a topic', career: 'Career help', mentor: 'Mentorship', oneone: 'One-on-one session' };
  var YEARS = { y1: 'First year', y2: 'Second year', y3: 'Third year', y4: 'Final year', y_other: 'Other year' };
  var COMFORT = { c0: 'Never coded', c1: 'Knows the basics', c2: 'Has built small things' };
  var GOALS = { web: 'Web developer', data: 'Data analyst', ml: 'AI and machine learning', cloud: 'Cloud and DevOps', cyber: 'Cybersecurity', qa: 'Software testing' };

  function api(body) {
    body.passcode = pass;
    return fetch('/api/mentor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }); });
  }
  function when(ts) { try { return new Date(ts).toLocaleString(); } catch (e) { return ''; } }
  function contact(c) {
    if (!c) return '';
    if (c.indexOf('m:') === 0) return 'Mobile: +91 ' + c.slice(2);
    if (c.indexOf('e:') === 0) return 'Email: ' + c.slice(2);
    return c;
  }

  function reqCard(r) {
    var tags = (r.needs || []).map(function (n) { return '<span class="tag">' + esc(NEEDS[n] || n) + '</span> '; }).join('');
    var facts = [YEARS[r.year], COMFORT[r.comfort], GOALS[r.goal] ? 'Interested in ' + GOALS[r.goal] : ''].filter(Boolean).join(' · ');
    return '<div class="card' + (r.handled ? ' done' : '') + '" data-id="' + esc(r.id) + '" data-kind="r">' +
      '<p>' + tags + '</p><p><b>' + esc(r.nick || 'Student') + '</b>' + (facts ? ' <span class="muted small">' + esc(facts) + '</span>' : '') + '</p>' +
      (r.note ? '<p>' + esc(r.note) + '</p>' : '') +
      (r.contact ? '<p><b>' + esc(contact(r.contact)) + '</b></p>' : '<p class="small muted">No contact details shared. Answer through the app instead.</p>') +
      '<p class="small muted">' + esc(when(r.createdAt)) + (r.handled ? ' · handled' + (r.handledBy ? ' by ' + esc(r.handledBy) : '') : '') + '</p>' +
      '<div class="row">' + (r.handled ? '' : '<button class="btn go small" data-act="handle">Mark handled</button>') +
      '<button class="btn ghost small" data-act="delete">Delete</button></div></div>';
  }

  function render(data) {
    $('#login').hidden = true; $('#console').hidden = false;
    var open = data.requests.filter(function (r) { return !r.handled; });
    var closed = data.requests.filter(function (r) { return r.handled; });
    $('#rcount').textContent = String(open.length);
    $('#requests').innerHTML = (open.length ? open.map(reqCard).join('') : '<p class="muted">No open requests.</p>') +
      (closed.length ? '<details><summary class="small">Handled (' + closed.length + ')</summary>' + closed.map(reqCard).join('') + '</details>' : '');

    $('#pcount').textContent = String(data.pending.length);
    $('#pending').innerHTML = data.pending.length ? data.pending.map(function (q) {
      return '<div class="card" data-id="' + esc(q.id) + '" data-kind="q"><p><b>' + esc(q.text) + '</b></p>' +
        '<p class="small muted">' + esc(when(q.createdAt)) + (q.role ? ' &middot; goal: ' + esc(GOALS[q.role] || q.role) : '') + '</p>' +
        '<label class="sr" for="a-' + esc(q.id) + '">Your answer</label>' +
        '<textarea id="a-' + esc(q.id) + '" maxlength="1500" placeholder="Write your answer"></textarea>' +
        '<div class="row" style="margin-top:10px"><button class="btn go small" data-act="answer">Publish answer</button>' +
        '<button class="btn ghost small" data-act="delete">Delete</button></div></div>';
    }).join('') : '<p class="muted">No questions waiting. Nicely done.</p>';
    $('#answered').innerHTML = data.answered.length ? data.answered.map(function (q) {
      return '<div class="qa" data-id="' + esc(q.id) + '" data-kind="a"><div class="q">' + esc(q.text) + '</div><div class="a">' + esc(q.answer) +
        '<br><span class="small muted">' + esc(q.mentor || '') + '</span></div>' +
        '<p style="margin-top:8px"><button class="btn ghost small" data-act="delete">Remove from board</button></p></div>';
    }).join('') : '<p class="muted">Nothing yet.</p>';
  }

  function refresh() {
    return api({ action: 'list' }).then(function (j) {
      if (j._status === 401) { signOut(); $('#login-msg').textContent = 'That passcode did not work.'; return; }
      if (j._status === 429) { $('#login-msg').textContent = 'Too many tries. Wait a few minutes.'; return; }
      if (j._status === 503) { $('#login-msg').textContent = 'The mentor console is not set up yet. Add the PF_KV binding and MENTOR_PASSCODE secret.'; return; }
      if (!j.pending) { $('#login-msg').textContent = 'Something went wrong. Try again.'; return; }
      render(j);
    }).catch(function () { $('#login-msg').textContent = 'Could not reach the server.'; });
  }
  function signOut() {
    pass = '';
    try { sessionStorage.removeItem('pf_mp'); } catch (e) { /* ignore */ }
    $('#login').hidden = false; $('#console').hidden = true;
  }

  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    pass = $('#pass').value; who = $('#who').value.trim();
    try { sessionStorage.setItem('pf_mp', pass); sessionStorage.setItem('pf_mn', who); } catch (err) { /* ignore */ }
    $('#login-msg').textContent = '';
    refresh();
  });
  $('#refresh').addEventListener('click', refresh);
  $('#signout').addEventListener('click', signOut);

  $('#reset-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('#reset-msg'); msg.textContent = '';
    api({ action: 'reset', identifier: $('#r-id').value.trim(), newPassword: $('#r-pw').value }).then(function (j) {
      if (j.ok) { msg.textContent = 'Password reset. Tell the student their temporary password and ask them to sign in.'; $('#r-pw').value = ''; }
      else msg.textContent = j.error === 'not_found' ? 'No student account with that email or mobile.' : j.error === 'bad_id' ? 'That is not a valid email or mobile number.' : j.error === 'bad_password' ? 'Use at least 8 characters.' : 'Could not reset: ' + (j.error || 'unknown error');
    });
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var box = b.closest('[data-id]'); if (!box) return;
    var id = box.getAttribute('data-id'), kind = box.getAttribute('data-kind');
    if (b.dataset.act === 'answer') {
      var text = box.querySelector('textarea').value.trim();
      if (text.length < 2) return;
      b.disabled = true;
      api({ action: 'answer', id: id, answer: text, mentor: who }).then(function (j) {
        if (j.ok) refresh(); else { b.disabled = false; alert('Could not save: ' + (j.error || 'unknown error')); }
      });
    }
    if (b.dataset.act === 'handle') {
      b.disabled = true;
      api({ action: 'handle', id: id, mentor: who }).then(function (j) {
        if (j.ok) refresh(); else { b.disabled = false; alert('Could not save: ' + (j.error || 'unknown error')); }
      });
    }
    if (b.dataset.act === 'delete') {
      if (!confirm('Delete this permanently?')) return;
      api({ action: 'delete', id: id, kind: kind }).then(function () { refresh(); });
    }
  });

  if (pass) { $('#who').value = who; refresh(); }
})();
