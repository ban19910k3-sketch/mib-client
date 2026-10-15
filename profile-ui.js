// Ekrany profilu MiB i kosmetyków. Rozmawia z procesem głównym przez kanały prof:*.
(() => {
  const ERR = {
    nick_length: 'Nick musi mieć od 3 do 16 znaków.',
    nick_chars: 'Nick może zawierać tylko litery bez polskich znaków, cyfry i _.',
    nick_taken: 'Ten nick jest już zajęty. Wybierz inny.',
    nick_rejected: 'Ten nick jest już zajęty albo niedozwolony. Wybierz inny.',
    email_taken: 'Na ten e-mail jest już założony profil. Zaloguj się albo użyj innego adresu.',
    bad_email: 'To nie wygląda na poprawny adres e-mail.',
    weak_password: 'Hasło musi mieć co najmniej 8 znaków.',
    bad_login: 'Zły e-mail albo hasło.',
    reset_failed: 'Zły e-mail albo kod odzyskiwania.',
    reset_locked: 'Za dużo nieudanych prób. Spróbuj ponownie za 15 minut.',
    rate_limited: 'Za dużo prób naraz. Odczekaj chwilę i spróbuj ponownie.',
    offline: 'Brak połączenia z serwerem MiB. Sprawdź internet.',
    server_error: 'Serwer MiB ma chwilowy problem. Spróbuj za kilka minut.',
    code_invalid: 'Nie ma takiego kodu. Sprawdź jego pisownię.',
    code_expired: 'Ten kod już wygasł.',
    code_used_up: 'Ten kod został już wykorzystany.',
    code_already_used: 'Ten kod został już odebrany na Twoim profilu.',
    already_owned: 'Masz już ten przedmiot.',
    loader_mismatch: 'Kopia używa innego loadera (Fabric/Forge) niż ta wersja na tym komputerze. Usuń mody tej wersji albo wybierz inną wersję gry.',
    not_logged_in: 'Zaloguj się do profilu MiB.',
  };
  const msg = code => (ERR[code] ? tr(ERR[code]) : tr('Coś poszło nie tak. Spróbuj ponownie.') + ' (' + code + ')');
  const h = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
      else if (k === 'class') e.className = v;
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  const T = s => tr(s);
  const go = page => document.querySelector(`.nav[data-p="${page}"]`).click();
  const fmtDate = d => new Date(d).toLocaleDateString(LANG === 'en' ? 'en-GB' : 'pl-PL');

  let st = { loading: true }, tab = 'signup', busy = false;

  // ===== Dolny blok paska bocznego =====
  function sidebar() {
    $('plname').textContent = st.loggedIn ? st.nick : st.offline || st.loading ? T('Profil MiB') : T('Załóż profil MiB');
    $('plsub').textContent = st.loggedIn ? st.mibId : st.loading ? T('Wczytywanie…') : st.offline ? T('Brak połączenia') : T('Kosmetyki i ustawienia');
  }
  $('plbox').addEventListener('click', () => go('prof'));
  $('plbox').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('prof'); } });

  // ===== Kod odzyskiwania =====
  function showCode(code) {
    if (!code) return;
    $('rc-code').textContent = code;
    $('rc-ok').checked = false;
    $('rc-x').disabled = true;
    $('rc').classList.add('on');
  }
  $('rc-ok').onchange = () => { $('rc-x').disabled = !$('rc-ok').checked; };
  $('rc-x').onclick = () => $('rc').classList.remove('on');
  $('rc-copy').onclick = async () => { try { await navigator.clipboard.writeText($('rc-code').textContent); toast(T('Skopiowano')); } catch {} };

  // ===== Usunięcie profilu =====
  $('pdel-n').oninput = () => { $('pdel-go').disabled = $('pdel-n').value !== st.nick; };
  $('pdel-x').onclick = () => $('pdel').classList.remove('on');
  $('pdel-go').onclick = async () => {
    $('pdel-go').disabled = true;
    const r = await mib.call('prof:delete');
    $('pdel').classList.remove('on');
    if (r.error) return toast(msg(r.error), 1);
    toast(T('Profil MiB został usunięty.'));
    apply(r);
  };

  // ===== Strona Profil =====
  const field = (label, input, hint) => h('label', { class: 'sr' }, h('span', {}, T(label)), h('span', { class: 'fld' }, input, hint ? h('small', { class: 'mut' }, T(hint)) : null));
  const errBox = () => h('p', { class: 'err', role: 'alert' });

  function formSignup() {
    const nick = h('input', { id: 'pf-nick', maxlength: 16, autocomplete: 'off' }), email = h('input', { id: 'pf-email', type: 'email', autocomplete: 'email' }),
      pass = h('input', { id: 'pf-pass', type: 'password', autocomplete: 'new-password' }), err = errBox();
    nick.addEventListener('blur', async () => {
      if (!nick.value) return;
      const bad = MibProfile.validateNick(nick.value);
      if (bad) { err.textContent = msg(bad); return; }
      const r = await mib.call('prof:nickFree', { nick: nick.value });
      err.textContent = r.free === false ? msg('nick_taken') : '';
    });
    const submit = h('button', { class: 'b', id: 'pf-go', type: 'submit' }, T('Załóż profil'));
    return h('form', { class: 'pform', on: { submit: async e => {
      e.preventDefault();
      const bad = MibProfile.validateNick(nick.value);
      if (bad) { err.textContent = msg(bad); nick.focus(); return; }
      if (pass.value.length < 8) { err.textContent = msg('weak_password'); pass.focus(); return; }
      await run(submit, err, () => mib.call('prof:signup', { email: email.value, password: pass.value, nick: nick.value }), r => {
        toast(T('Profil założony. Witaj w MiB!'));
        showCode(r.recoveryCode);
        if (r.recoveryError) toast(T('Nie udało się zapisać kodu odzyskiwania. Wygeneruj nowy na stronie profilu.'), 1);
      });
    } } },
    field('Nick MiB', nick, '3–16 znaków: litery, cyfry, _'), field('E-mail', email), field('Hasło', pass, 'Co najmniej 8 znaków'), err, h('div', { class: 'row' }, submit));
  }
  function formLogin() {
    const email = h('input', { id: 'pl-email', type: 'email', autocomplete: 'email' }), pass = h('input', { id: 'pl-pass', type: 'password', autocomplete: 'current-password' }), err = errBox();
    const submit = h('button', { class: 'b', type: 'submit' }, T('Zaloguj się'));
    return h('form', { class: 'pform', on: { submit: async e => {
      e.preventDefault();
      await run(submit, err, () => mib.call('prof:login', { email: email.value, password: pass.value }), () => toast(T('Zalogowano do profilu MiB.')));
    } } },
    field('E-mail', email), field('Hasło', pass), err,
    h('div', { class: 'row' }, submit, h('button', { class: 'b ghost', type: 'button', on: { click: () => { tab = 'reset'; render(); } } }, T('Nie pamiętam hasła'))));
  }
  function formReset() {
    const email = h('input', { type: 'email', autocomplete: 'email' }), code = h('input', { autocomplete: 'off', placeholder: 'XXXX-XXXX-XXXX-XXXX', class: 'mono' }),
      pass = h('input', { type: 'password', autocomplete: 'new-password' }), err = errBox();
    const submit = h('button', { class: 'b', type: 'submit' }, T('Ustaw nowe hasło'));
    return h('form', { class: 'pform', on: { submit: async e => {
      e.preventDefault();
      if (pass.value.length < 8) { err.textContent = msg('weak_password'); return; }
      await run(submit, err, () => mib.call('prof:reset', { email: email.value, code: code.value, password: pass.value }), r => {
        toast(T('Hasło zmienione. Zapisz nowy kod odzyskiwania.'));
        showCode(r.recoveryCode);
        if (r.recoveryError) toast(T('Nie udało się zapisać kodu odzyskiwania. Wygeneruj nowy na stronie profilu.'), 1);
      });
    } } },
    h('p', { class: 'mut' }, T('Wpisz e-mail profilu i kod odzyskiwania pokazany przy zakładaniu profilu. Stary kod przestanie działać, a launcher pokaże nowy.')),
    field('E-mail', email), field('Kod odzyskiwania', code), field('Nowe hasło', pass, 'Co najmniej 8 znaków'), err,
    h('div', { class: 'row' }, submit, h('button', { class: 'b ghost', type: 'button', on: { click: () => { tab = 'login'; render(); } } }, T('Wróć do logowania'))));
  }
  async function run(btn, err, call, ok) {
    if (busy) return;
    busy = true; btn.disabled = true; err.textContent = '';
    try {
      const r = await call();
      if (r.error) { err.textContent = msg(r.error); return; }
      apply(r);
      ok(r);
    } finally { busy = false; btn.disabled = false; }
  }

  function viewOut() {
    const tabs = h('div', { class: 'seg', role: 'tablist' },
      ...[['signup', 'Załóż profil'], ['login', 'Zaloguj się']].map(([k, l]) => h('button', { class: tab === k || (k === 'login' && tab === 'reset') ? 'on' : '', role: 'tab', type: 'button', on: { click: () => { tab = k; render(); } } }, T(l))));
    return [
      h('h2', {}, T('Profil MiB')),
      h('p', { class: 'lead' }, T('Profil zapisuje Twoje kosmetyki, ustawienia launchera i kopię modów. Grać możesz też bez niego.')),
      tabs,
      tab === 'signup' ? formSignup() : tab === 'login' ? formLogin() : formReset(),
    ];
  }
  function viewOffline() {
    return [h('div', { class: 'soon' }, h('h2', {}, T('Profil MiB')),
      h('p', {}, T('Brak połączenia z serwerem MiB. Grać możesz normalnie, a profil wróci, gdy połączenie wróci.')), h('br'),
      h('button', { class: 'b', on: { click: refresh } }, T('Spróbuj ponownie')))];
  }
  function viewIn() {
    const stat = (l, v) => h('div', { class: 'sr' }, h('span', {}, T(l)), h('b', {}, v));
    const fav = MibProfile.favouriteVersion(st.versionStats);
    return [
      h('div', { class: 'phead' },
        h('h2', {}, st.nick), st.founder ? h('em', { class: 'tag founder', title: T('Jeden z pierwszych 1000 profili MiB') }, T('Założyciel')) : null),
      h('div', { class: 'idrow' }, h('span', { class: 'mono', id: 'pf-id' }, st.mibId),
        h('button', { class: 'b ghost', on: { click: async () => { try { await navigator.clipboard.writeText(st.mibId); toast(T('Skopiowano')); } catch {} } } }, T('Kopiuj ID'))),
      h('div', { class: 'sec' }, h('h3', {}, T('Statystyki')),
        stat('Czas gry przez MiB', MibProfile.formatPlaytime(st.playtimeMin || 0)),
        stat('Uruchomienia gry', String(st.launches || 0)),
        stat('Ulubiona wersja', fav || '—'),
        stat('Profil od', fmtDate(st.createdAt))),
      h('div', { class: 'sec' }, h('h3', {}, T('Kosmetyki')),
        h('div', { class: 'row', style: 'align-items:center;justify-content:space-between' },
          h('span', { class: 'mut', id: 'pf-cos' }, '…'), h('button', { class: 'b ghost', on: { click: () => go('cos') } }, T('Przejdź do kosmetyków')))),
      h('div', { class: 'sec' }, h('h3', {}, T('Konto')),
        h('p', { class: 'mut' }, T('Kod odzyskiwania pozwala ustawić nowe hasło, gdy je zapomnisz. Nowy kod unieważnia poprzedni.')),
        h('div', { class: 'row' },
          h('button', { class: 'b ghost', on: { click: async () => { const r = await mib.call('prof:newCode'); if (r.error) toast(msg(r.error), 1); else showCode(r.recoveryCode); } } }, T('Nowy kod odzyskiwania')),
          h('button', { class: 'b ghost', on: { click: async () => { apply(await mib.call('prof:logout')); toast(T('Wylogowano z profilu MiB.')); } } }, T('Wyloguj')),
          h('button', { class: 'b danger', on: { click: () => { $('pdel-n').value = ''; $('pdel-go').disabled = true; $('pdel').classList.add('on'); $('pdel-n').focus(); } } }, T('Usuń profil')))),
    ];
  }
  function render() {
    const box = $('prof-box');
    box.replaceChildren(...(st.loading ? [h('h2', {}, T('Profil MiB')), h('p', { class: 'mut' }, T('Wczytywanie…'))] : st.loggedIn ? viewIn() : st.offline ? viewOffline() : viewOut()));
    if (st.loggedIn) mib.call('prof:cosmetics').then(l => { const e = $('pf-cos'); if (e) e.textContent = Array.isArray(l) ? T('Posiadane przedmioty') + ': ' + l.length : msg(l.error); });
  }

  // ===== Strona Kosmetyki =====
  const GLYPH = { cape: '▚', hat: '▀', wings: '▞' };
  async function renderCos() {
    const box = $('cos-box');
    if (st.loading) return box.replaceChildren(h('h2', {}, T('Kosmetyki')), h('p', { class: 'mut' }, T('Wczytywanie…')));
    if (!st.loggedIn) {
      box.replaceChildren(h('h2', {}, T('Kosmetyki')), h('div', { class: 'empty-state' },
        h('p', {}, st.offline ? T('Brak połączenia z serwerem MiB. Kosmetyki pokażą się, gdy połączenie wróci.') : T('Peleryny i inne przedmioty zapisują się na profilu MiB. Załóż profil, żeby je zbierać.')),
        st.offline ? null : h('button', { class: 'b', on: { click: () => { tab = 'signup'; go('prof'); } } }, T('Załóż profil MiB'))));
      return;
    }
    const inp = h('input', { id: 'cos-code', placeholder: T('Kod prezentowy'), autocomplete: 'off', class: 'mono' }), err = errBox();
    const btn = h('button', { class: 'b', type: 'submit' }, T('Odbierz'));
    const form = h('form', { class: 'row', on: { submit: async e => {
      e.preventDefault();
      if (!inp.value.trim()) return;
      btn.disabled = true; err.textContent = '';
      const r = await mib.call('prof:redeem', { code: inp.value });
      btn.disabled = false;
      if (r.error) { err.textContent = msg(r.error); return; }
      inp.value = '';
      if (window.mibUnlock) mibUnlock(r); else toast(T('Nowy przedmiot') + ': ' + r.name);
      renderCos();
    } } }, inp, btn);
    const list = await mib.call('prof:cosmetics');
    const grid = Array.isArray(list) && list.length
      ? h('div', { class: 'cos-grid' }, ...list.map(c => h('div', { class: 'cosi' },
        c.imageUrl ? h('img', { src: c.imageUrl, alt: '' }) : h('i', { 'aria-hidden': 'true' }, GLYPH[c.type] || '◆'),
        h('b', {}, c.name), h('small', { class: 'mut' }, T('Odebrano') + ' ' + fmtDate(c.acquiredAt)))))
      : h('p', { class: 'empty' }, Array.isArray(list) ? T('Nie masz jeszcze żadnych przedmiotów. Masz kod z konkursu? Wpisz go wyżej.') : msg(list.error));
    box.replaceChildren(h('h2', {}, T('Kosmetyki')), h('p', { class: 'lead' }, T('Przedmioty przypisane do profilu') + ' ' + st.nick + '.'), form, err, grid);
  }

  // ===== Kopia modów na stronie Moje mody =====
  async function modsShown(gv) {
    const box = $('mbk');
    box.hidden = true;
    if (!st.loggedIn) return;
    const r = await mib.call('prof:modInfo', { gv });
    if (!r || r.error || !r.count || $('sel').value !== gv) return;
    const label = T(r.reviewed ? 'Przywróć brakujące mody' : 'Przywróć mody z profilu') + ' (' + r.count + ')';
    const restore = h('button', { class: r.reviewed ? 'b ghost' : 'b' }, label);
    const replace = h('button', { class: 'b ghost' }, T('Zastąp kopię modami z tego komputera'));
    restore.onclick = async () => {
      restore.disabled = replace.disabled = true; restore.textContent = T('Pobieranie…');
      const x = await mib.call('prof:modRestore', { gv });
      if (x.error) { toast(msg(x.error), 1); restore.disabled = replace.disabled = false; restore.textContent = label; return; }
      toast(T('Przywrócono mody') + ': ' + x.added + (x.skipped ? ', ' + T('już były') + ': ' + x.skipped : '') + (x.failed ? ', ' + T('nie udało się') + ': ' + x.failed : ''), x.failed > 0);
      modsLoad();
    };
    replace.onclick = async () => {
      if (!confirm(T('Zastąpić kopię na profilu modami z tego komputera?'))) return;
      const x = await mib.call('prof:modReplace', { gv });
      if (x && x.error) return toast(msg(x.error), 1);
      toast(T('Kopia modów zapisana na profilu.'));
      modsShown(gv);
    };
    const info = (r.reviewed ? T('Kopia modów na profilu') : T('Na profilu jest kopia modów dla tej wersji')) + ': ' + r.count + (r.skipped ? ' (' + T('bez plików spoza Modrinth') + ': ' + r.skipped + ')' : '') + '.';
    box.classList.toggle('quiet', !!r.reviewed);
    box.replaceChildren(h('p', {}, info), h('div', { class: 'row' }, restore, r.reviewed ? null : replace));
    box.hidden = false;
  }

  // ===== Stan =====
  function apply(r) {
    const was = st.loggedIn;
    st = r && (r.loggedIn || r.offline) ? r : { loggedIn: false };
    mibSync.profile = !!st.loggedIn;
    sidebar();
    if ($('p-prof').classList.contains('on')) render();
    if ($('p-cos').classList.contains('on')) renderCos();
    if (st.loggedIn && !was) { mibSync.pull(); if (window.mibWave) mibWave(); }
  }
  async function refresh() { apply(await mib.call('prof:state')); }
  document.querySelector('.nav[data-p="prof"]').addEventListener('click', () => { render(); refresh(); });
  document.querySelector('.nav[data-p="cos"]').addEventListener('click', renderCos);
  // Efekt odblokowania nowego kosmetyku
  window.mibUnlock = item => {
    if (document.documentElement.classList.contains('noanim')) return toast(T('Nowy przedmiot') + ': ' + item.name);
    const old = $('unlock'); if (old) old.remove();
    const o = h('div', { id: 'unlock', role: 'dialog', 'aria-label': T('Nowy przedmiot!') }, h('div', { class: 'ring' }),
      h('div', { class: 'card2' }, h('i', {}, item.imageUrl ? h('img', { src: item.imageUrl, alt: '' }) : GLYPH[item.type] || '◆'), h('small', {}, T('Nowy przedmiot!')), h('b', {}, item.name)));
    const close = () => { o.classList.add('bye'); setTimeout(() => o.remove(), 250); };
    o.onclick = close;
    document.body.append(o);
    setTimeout(() => { if (o.isConnected) close(); }, 2200);
  };
  window.mibProfileUI = { modsShown, refresh };
  sidebar();
  render();
  refresh();
})();
