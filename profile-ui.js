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
    not_owned: 'Nie masz tego przedmiotu.',
    code_expired: 'Ten kod już wygasł.',
    code_used_up: 'Ten kod został już wykorzystany.',
    code_already_used: 'Ten kod został już odebrany na Twoim profilu.',
    already_owned: 'Masz już ten przedmiot.',
    loader_mismatch: 'Kopia używa innego loadera (Fabric/Forge) niż ta wersja na tym komputerze. Usuń mody tej wersji albo wybierz inną wersję gry.',
    not_logged_in: 'Zaloguj się do profilu MiB.',
    email_confirm_required: 'Serwer MiB wymaga potwierdzenia e-maila, którego launcher nie obsługuje. Administrator musi wyłączyć „Confirm email” w Supabase (Authentication → Sign In / Providers).',
    signup_disabled: 'Zakładanie profili jest teraz wyłączone na serwerze MiB.',
    no_profile: 'Konto istnieje, ale w bazie nie ma profilu. Administrator musi uruchomić plik schema.sql w Supabase.',
    admin_cannot_delete: 'Konta admina nie można usunąć w launcherze. Zrób to w Supabase (Authentication → Users).',
    schema_outdated: 'Baza serwera MiB jest nieaktualna. Administrator musi ponownie uruchomić plik schema.sql w Supabase.',
    nick_invalid: 'Nick może zawierać tylko litery bez polskich znaków, cyfry i _.',
    idea_short: 'Pomysł musi mieć co najmniej 10 znaków.',
    idea_long: 'Pomysł może mieć najwyżej 1000 znaków.',
    idea_category: 'Wybierz, czego dotyczy pomysł.',
    idea_limit: 'Na dziś to już 5 pomysłów. Następne wyślesz jutro.',
    friend_not_found: 'Nie ma gracza z takim nickiem albo ID MiB.',
    friend_self: 'To Twój własny profil.',
    friend_exists: 'Ten gracz jest już Twoim znajomym albo czeka na zaproszenie.',
    friend_limit: 'Za dużo zaproszeń. Spróbuj jutro.',
    friend_missing: 'To zaproszenie jest już nieaktualne.',
    invite_not_friend: 'Zaprosić do gry możesz tylko znajomego.',
    invite_no_server: 'Najpierw wejdź w grze na serwer. Zaproszenie prowadzi na serwer, na którym grasz.',
    invite_limit: 'Za dużo zaproszeń do gry. Spróbuj za godzinę.',
    gift_missing: 'Ten prezent został już odebrany.',
    banned: 'Twoje konto MiB jest zablokowane. Nie możesz tego zrobić.',
    friend_blocked: 'Nie możesz zaprosić tego gracza.',
    block_limit: 'Masz już za dużo zablokowanych graczy.',
    player_missing: 'Tego gracza już nie ma w MiB.',
    report_reason: 'Wybierz powód zgłoszenia.',
    report_long: 'Opis może mieć najwyżej 300 znaków.',
    report_limit: 'Na dziś to już 10 zgłoszeń. Następne wyślesz jutro.',
    report_exists: 'Ta wiadomość jest już zgłoszona.',
    report_message_missing: 'Tej wiadomości już nie ma.',
    not_friend: 'Kartę gracza widzą tylko jego znajomi.',
    crash_long: 'Raport jest za długi.',
    idea_own: 'Na własny pomysł nie można głosować.',
    idea_missing: 'Tego pomysłu nie ma już na liście.',
    message_not_friend: 'Pisać możesz tylko do znajomych.',
    message_empty: 'Wiadomość jest pusta.',
    message_long: 'Wiadomość może mieć najwyżej 500 znaków.',
    message_limit: 'Za dużo wiadomości naraz. Odczekaj chwilę.',
    skin_no_account: 'Zaloguj się kontem Microsoft (przycisk u góry), żeby zmienić skina.',
    skin_not_png: 'To nie jest plik PNG.',
    skin_size: 'Skin musi mieć 64×64 piksele (albo stary format 64×32).',
    skin_too_big: 'Plik jest za duży jak na skina.',
    skin_auth: 'Sesja Microsoft wygasła. Zaloguj się ponownie kontem Microsoft.',
    skin_rate: 'Mojang pozwala zmienić skina tylko kilka razy na minutę. Spróbuj za chwilę.',
    skin_failed: 'Mojang nie przyjął skina. Spróbuj ponownie później.',
  };
  // Przy nieznanym błędzie pokazujemy też komunikat serwera, żeby dało się go przekazać
  const msg = (code, detail) => (ERR[code] ? tr(ERR[code]) : tr('Coś poszło nie tak. Spróbuj ponownie.') + ' (' + code + (detail && detail !== code ? ': ' + detail : '') + ')');
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
  // filtr wulgaryzmów w tekstach innych graczy (Ustawienia, domyślnie włączony)
  const clean = t => (typeof S !== 'undefined' && S && S.chatFilter === false ? String(t == null ? '' : t) : MibProfile.cleanText(t));

  let st = { loading: true }, tab = 'signup', busy = false;

  // ===== Dolny blok paska bocznego =====
  function sidebar() {
    $('plname').textContent = st.loggedIn ? st.nick : st.needsProfile ? T('Dokończ profil MiB') : st.offline || st.loading ? T('Profil MiB') : T('Załóż profil MiB');
    $('plsub').textContent = st.loggedIn ? st.mibId : st.needsProfile ? T('Wybierz nick') : st.loading ? T('Wczytywanie…') : st.offline ? T('Brak połączenia') : T('Kosmetyki i ustawienia');
  }
  $('plbox').addEventListener('click', () => go('prof'));
  $('plbox').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('prof'); } });

  // ===== Kod odzyskiwania =====
  // created: okno po założeniu konta — najpierw potwierdzenie sukcesu, potem kod
  function showCode(code, created) {
    $('rc-t').textContent = T(created ? 'Konto założone!' : 'Zapisz kod odzyskiwania');
    $('rc-done').hidden = !created;
    if (created) $('rc-done').textContent = T('Profil MiB został pomyślnie założony. Twoje ID:') + ' ' + created;
    if (!code) {
      if (created) toast(T('Profil MiB został pomyślnie założony. Twoje ID:') + ' ' + created);
      return;
    }
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
        showCode(r.recoveryCode, r.mibId);
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
      // Konto bez profilu: przechodzimy do wyboru nicku
      if (r.needsProfile) { apply(r); return; }
      // Sukces tylko wtedy, gdy gracz naprawdę jest zalogowany
      if (r.error || !r.loggedIn) { err.textContent = msg(r.error || 'unknown', r.detail); return; }
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
  function viewComplete() {
    const nick = h('input', { id: 'pc-nick', maxlength: 16, autocomplete: 'off' }), err = errBox();
    const submit = h('button', { class: 'b', id: 'pc-go', type: 'submit' }, T('Utwórz profil'));
    return [
      h('h2', {}, T('Dokończ profil MiB')),
      h('p', { class: 'lead' }, T('Twoje konto istnieje, ale nie ma jeszcze profilu MiB. Wybierz nick, a launcher dokończy zakładanie.')),
      h('form', { class: 'pform', on: { submit: async e => {
        e.preventDefault();
        const bad = MibProfile.validateNick(nick.value);
        if (bad) { err.textContent = msg(bad); nick.focus(); return; }
        await run(submit, err, () => mib.call('prof:createProfile', { nick: nick.value }), r => showCode(r.recoveryCode, r.mibId));
      } } }, field('Nick MiB', nick, '3–16 znaków: litery, cyfry, _'), err,
      h('div', { class: 'row' }, submit, h('button', { class: 'b ghost', type: 'button', on: { click: async () => apply(await mib.call('prof:logout')) } }, T('Wyloguj')))),
    ];
  }
  function viewOffline() {
    return [h('div', { class: 'soon' }, h('h2', {}, T('Profil MiB')),
      h('p', {}, st.error === 'no_profile' ? msg('no_profile') : T('Brak połączenia z serwerem MiB. Grać możesz normalnie, a profil wróci, gdy połączenie wróci.')), h('br'),
      h('button', { class: 'b', on: { click: refresh } }, T('Spróbuj ponownie')))];
  }
  function viewIn() {
    const stat = (l, v) => h('div', { class: 'stat' }, h('b', {}, v), h('span', {}, T(l)));
    const fav = MibProfile.favouriteVersion(st.versionStats);
    return [
      h('div', { class: 'phead' },
        h('h2', {}, st.nick), st.founder ? h('em', { class: 'tag founder', title: T('Jeden z pierwszych 1000 profili MiB') }, T('Założyciel')) : null,
        st.bugsFound ? h('em', { class: 'tag hunter', id: 'pf-hunter', title: T('Nagrodzone zgłoszenia błędów') }, T('Łowca błędów') + (st.bugsFound > 1 ? ' ×' + st.bugsFound : '')) : null),
      st.banned ? h('div', { class: 'card ban', id: 'pf-ban', role: 'alert' }, h('b', {}, T('Konto MiB zablokowane')),
        h('p', {}, T('Twórca MiB Client zablokował to konto za łamanie zasad.') + (st.banReason ? ' ' + T('Powód:') + ' ' + st.banReason : '')),
        h('p', { class: 'mut' }, T('Grać możesz dalej, ale nie napiszesz do znajomych, nie zaprosisz nikogo i nie wyślesz pomysłu, a w grze nie widać Twojego logo MiB i kosmetyków.')))
        : st.warnings ? h('p', { class: 'warnline', id: 'pf-warn' }, T('Ostrzeżenia od twórcy MiB Client') + ': ' + st.warnings + '/4') : null,
      h('div', { class: 'idrow' }, h('span', { class: 'mono', id: 'pf-id' }, st.mibId),
        h('button', { class: 'b ghost', on: { click: async () => { try { await navigator.clipboard.writeText(st.mibId); toast(T('Skopiowano')); } catch {} } } }, T('Kopiuj ID'))),
      h('div', { class: 'sec' }, h('h3', {}, T('Statystyki')), h('div', { class: 'stats' },
        stat('Czas gry przez MiB', MibProfile.formatPlaytime(st.playtimeMin || 0)),
        stat('Uruchomienia gry', String(st.launches || 0)),
        stat('Ulubiona wersja', fav || '—'),
        stat('Profil od', fmtDate(st.createdAt)))),
      h('div', { class: 'sec', id: 'pf-ach' }, h('h3', {}, T('Osiągnięcia')), h('p', { class: 'mut' }, T('Wczytywanie…'))),
      h('div', { class: 'sec' }, h('h3', {}, T('Kosmetyki')),
        h('div', { class: 'row', style: 'align-items:center;justify-content:space-between' },
          h('span', { class: 'mut', id: 'pf-cos' }, '…'), h('button', { class: 'b ghost', on: { click: () => go('cos') } }, T('Przejdź do kosmetyków')))),
      h('div', { class: 'sec' }, h('h3', {}, T('Konto')),
        h('p', { class: 'mut' }, T('Kod odzyskiwania pozwala ustawić nowe hasło, gdy je zapomnisz. Nowy kod unieważnia poprzedni.')),
        h('div', { class: 'row' },
          h('button', { class: 'b ghost', on: { click: async () => { const r = await mib.call('prof:newCode'); if (r.error) toast(msg(r.error, r.detail), 1); else showCode(r.recoveryCode); } } }, T('Nowy kod odzyskiwania')),
          h('button', { class: 'b ghost', on: { click: async () => { apply(await mib.call('prof:logout')); toast(T('Wylogowano z profilu MiB.')); } } }, T('Wyloguj')),
          h('button', { class: 'b danger', on: { click: () => { $('pdel-n').value = ''; $('pdel-go').disabled = true; $('pdel').classList.add('on'); $('pdel-n').focus(); } } }, T('Usuń profil')))),
    ];
  }
  function render() {
    const box = $('prof-box');
    box.replaceChildren(...(st.loading ? [h('h2', {}, T('Profil MiB')), h('p', { class: 'mut' }, T('Wczytywanie…'))] : st.loggedIn ? viewIn() : st.needsProfile ? viewComplete() : st.offline ? viewOffline() : viewOut()).filter(Boolean));
    if (st.loggedIn) mib.call('prof:cosmetics').then(l => { const e = $('pf-cos'); if (e) e.textContent = Array.isArray(l) ? T('Posiadane przedmioty') + ': ' + l.length : msg(l.error); });
    if (st.loggedIn) achievementsCheck(true);
  }

  // ===== Osiągnięcia: odznaki z liczb profilu (lib/profile.js), nowe zdobyte z efektem odblokowania =====
  const TROPHY = 'M6 3h12v2H6zM6 5h2v6H6zM16 5h2v6h-2zM8 11h2v2H8zM14 11h2v2h-2zM10 13h4v2h-4zM11 15h2v3h-2zM8 18h8v3H8zM2 5h4v2H2zM2 7h2v3H2zM4 10h2v2H4zM18 5h4v2h-4zM20 7h2v3h-2zM18 10h2v2h-2z';
  const trophy = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<path fill="currentColor" d="' + TROPHY + '"/>'; return s; };
  const progress = a => (a.id === 'hours_10' || a.id === 'veteran' ? Math.floor(a.value / 60) + '/' + a.goal / 60 + ' h' : a.value + '/' + a.goal);
  function achGrid(list) {
    return h('div', { class: 'ach-grid' }, ...list.map(a => h('div', { class: 'ach' + (a.done ? ' on' : ''), 'data-id': a.id, title: T(a.desc) },
      trophy(), h('b', {}, T(a.name)), h('small', {}, a.done ? T('Zdobyte') : progress(a)))));
  }
  async function achievementsCheck(show) {
    if (!st.loggedIn) return;
    const c = await mib.call('prof:card');
    if (!c || c.error) { const b = $('pf-ach'); if (show && b) b.replaceChildren(h('h3', {}, T('Osiągnięcia')), h('p', { class: 'mut' }, msg(c ? c.error : 'unknown'))); return; }
    const list = MibProfile.achievements(c), done = list.filter(a => a.done);
    const box = $('pf-ach');
    if (box) box.replaceChildren(h('h3', {}, T('Osiągnięcia') + ' (' + done.length + '/' + list.length + ')'), achGrid(list));
    // zdobyte od ostatniego razu (pierwszy raz na tym komputerze: bez efektu)
    const key = 'mib-ach-' + st.mibId;
    let seen = null; try { seen = JSON.parse(localStorage.getItem(key)); } catch {}
    const fresh = Array.isArray(seen) ? done.filter(a => !seen.includes(a.id)) : [];
    try { localStorage.setItem(key, JSON.stringify(done.map(a => a.id))); } catch {}
    // gdy otwarte jest inne okno (ostrzeżenie, prezent, aktualność), bez efektu na nim: tylko dymek
    if (fresh.length) await new Promise(r => setTimeout(r, 1200));
    const busy = document.querySelector('#warn, #gift, #news-pop, #wn, #fcard');
    for (const a of fresh.slice(0, 3)) {
      if (busy || !window.mibUnlock) toast(T('Nowe osiągnięcie!') + ' ' + T(a.name));
      else mibUnlock({ name: T(a.name), label: T('Nowe osiągnięcie!'), glyph: trophy() });
    }
  }

  // ===== Strona Kosmetyki =====
  const GLYPH = { cape: '▚', hat: '▀', wings: '▞', aura: '✺' };
  // Miniatura peleryny: zewnętrzna strona z tekstury Minecrafta (pole 10×16 od piksela 1,1), powiększona k razy
  // (animowana tekstura: klatki jedna pod drugą przewijane animacją capeanim ze style.css)
  function capeThumb(url, k) {
    const el = h('span', { class: 'capeth', style: `width:${10 * k}px;height:${16 * k}px;background-image:url("${url}");background-size:${64 * k}px ${32 * k}px;background-position:-${k}px -${k}px` });
    loadImg(url).then(img => {
      const n = MibProfile.capeFrames(img.width, img.height);
      if (n < 2) return;
      el.style.backgroundSize = `${64 * k}px ${32 * n * k}px`;
      el.style.setProperty('--k', k); el.style.setProperty('--n', n);
      el.style.animation = `capeanim ${(n * MibProfile.CAPE_FRAME_MS) / 1000}s steps(${n}) infinite`;
      el.classList.add('anim');
    }, () => {});
    return el;
  }
  const imgCache = new Map();
  function loadImg(url) {
    if (!imgCache.has(url)) imgCache.set(url, new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; }));
    return imgCache.get(url);
  }
  // Miniatura aury: pierwszy obrazek cząsteczki (komórka 8×8 z pierwszego rzędu tekstury)
  function auraThumb(url, k) {
    const c = h('canvas', { width: 8 * k, height: 8 * k, class: 'aurath' }), x = c.getContext('2d');
    loadImg(url).then(img => { x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, img.width / 8, img.width / 8, 0, 0, 8 * k, 8 * k); }, () => {});
    return c;
  }
  // Miniatura skrzydeł: wróżki — oba skrzydła z pierwszej klatki (tył skrzydła po lewej, przód po prawej), elytra — sama tekstura
  function wingsThumb(url) {
    const c = h('canvas', { width: 64, height: 40, class: 'wingth' }), x = c.getContext('2d');
    loadImg(url).then(img => {
      x.imageSmoothingEnabled = false;
      if (MibProfile.wingsModel(img.width) !== 'fairy') return c.replaceWith(h('img', { src: url, alt: '' }));
      const u = img.width / 128;
      x.drawImage(img, 32 * u, 0, 32 * u, 40 * u, 0, 0, 32, 40);
      x.drawImage(img, 0, 0, 32 * u, 40 * u, 32, 0, 32, 40);
    }, () => {});
    return c;
  }
  const itemImage = (c, k) => {
    const png = c.imageUrl && c.imageUrl.startsWith('data:image/png');
    if (png && c.type === 'cape') return capeThumb(c.imageUrl, k);
    if (png && c.type === 'aura') return auraThumb(c.imageUrl, k);
    if (png && c.type === 'wings') return wingsThumb(c.imageUrl);
    return c.imageUrl ? h('img', { src: c.imageUrl, alt: '' }) : GLYPH[c.type] || '◆';
  };
  // ===== Skin konta Minecraft (na górze strony Kosmetyki; wystarczy konto Microsoft) =====
  let skinViewer = null;
  const skinCanvas = h('canvas', { width: 200, height: 260, class: 'skin3d', id: 'skin3d' });
  // Twarz ze skina (z nakładką) do listy ostatnio używanych
  function face(dataUrl) {
    const c = h('canvas', { width: 32, height: 32, class: 'skface' }), x = c.getContext('2d'), img = new Image();
    x.imageSmoothingEnabled = false;
    img.onload = () => { x.drawImage(img, 8, 8, 8, 8, 0, 0, 32, 32); x.drawImage(img, 40, 8, 8, 8, 0, 0, 32, 32); };
    img.src = dataUrl;
    return c;
  }
  async function skinSection() {
    const err = errBox(), sec = h('div', { class: 'sec skinsec' }, h('h3', {}, T('Skin')));
    const cur = await mib.call('skin:current');
    try { if (!skinViewer) { skinViewer = new skinview3d.SkinViewer({ canvas: skinCanvas, width: 200, height: 260 }); skinViewer.autoRotate = true; skinViewer.autoRotateSpeed = 0.7; skinViewer.controls.enableZoom = false; } } catch {}
    // bez konta Microsoft: postać Steve (na niej też da się przymierzać kosmetyki), bez zmiany skina
    if (cur.error === 'skin_no_account') {
      try { if (skinViewer) await skinViewer.loadSkin(await mib.call('skin', 'MHF_Steve')); } catch {}
      sec.append(h('div', { class: 'skinbox' }, skinCanvas, h('div', { class: 'skinside' }, h('p', { class: 'mut' }, msg('skin_no_account')))));
      return sec;
    }
    let picked = null;
    const variant = h('select', { id: 'skin-var' }, h('option', { value: 'classic' }, T('Klasyczny (szersze ręce)')), h('option', { value: 'slim' }, T('Smukły (węższe ręce)')));
    variant.value = cur.variant || 'classic';
    const show = async (dataUrl, model) => { try { if (skinViewer) await skinViewer.loadSkin(dataUrl || await mib.call('skin', 'MHF_Steve'), { model: model === 'slim' ? 'slim' : 'default' }); } catch {} };
    const setBtn = h('button', { class: 'b', id: 'skin-set', type: 'button', disabled: true }, T('Ustaw skina'));
    const hist = h('div', { class: 'skhist', id: 'skin-hist' });
    variant.onchange = () => show(picked || cur.dataUrl, variant.value);
    const pick = h('button', { class: 'b ghost', id: 'skin-pick', type: 'button', on: { click: async () => {
      const r = await mib.call('skin:pick');
      if (!r) return;
      if (r.error) { err.textContent = msg(r.error); return; }
      err.textContent = ''; picked = r.dataUrl; variant.value = r.variant; setBtn.disabled = false;
      show(picked, variant.value);
    } } }, T('Wybierz plik PNG…'));
    async function apply(dataUrl, model) {
      setBtn.disabled = true; err.textContent = '';
      const r = await mib.call('skin:set', { dataUrl, variant: model });
      if (r.error) { err.textContent = msg(r.error); setBtn.disabled = !picked; return; }
      toast(T('Skin zmieniony. W grze zobaczysz go po ponownym wejściu na świat lub serwer.'));
      picked = null; cur.dataUrl = dataUrl; cur.variant = model;
      if (typeof loadSkin === 'function' && logged) loadSkin($('nick').textContent);
      loadHist();
    }
    setBtn.onclick = () => picked && apply(picked, variant.value);
    const reset = h('button', { class: 'b ghost', type: 'button', on: { click: async () => {
      if (!confirm(T('Wrócić do domyślnego skina Minecrafta?'))) return;
      const r = await mib.call('skin:reset');
      if (r.error) { err.textContent = msg(r.error); return; }
      toast(T('Przywrócono domyślny skin.')); picked = null; cur.dataUrl = null; setBtn.disabled = true; show(null, 'classic');
      if (typeof loadSkin === 'function' && logged) loadSkin($('nick').textContent);
    } } }, T('Przywróć domyślny'));
    async function loadHist() {
      const l = await mib.call('skin:history');
      hist.replaceChildren(...(Array.isArray(l) && l.length ? [h('small', { class: 'mut' }, T('Ostatnio używane')), h('div', { class: 'row' },
        ...l.map(x => h('button', { class: 'skh', type: 'button', title: T('Ustaw ten skin'), on: { click: () => { variant.value = x.variant; show(x.dataUrl, x.variant); apply(x.dataUrl, x.variant); } } }, face(x.dataUrl))))] : []));
    }
    if (cur.error) err.textContent = msg(cur.error);
    show(cur.dataUrl, variant.value);
    loadHist();
    sec.append(h('div', { class: 'skinbox' }, skinCanvas, h('div', { class: 'skinside' },
      h('p', { class: 'mut' }, T('Skin Twojego konta Minecraft. Widzą go wszyscy gracze, na każdym serwerze.')),
      h('label', { class: 'sr' }, h('span', {}, T('Model postaci')), variant),
      h('div', { class: 'row' }, pick, setBtn, reset), err, hist)));
    return sec;
  }

  // ===== Kosmetyki na postaci 3D (skinview3d): peleryna, skrzydła (jak u wróżki albo jak elytra), czapka (jak hełm) i aura =====
  // Animowana tekstura ma klatki jedna pod drugą; klatki zmieniają się co CAPE_FRAME_MS, tak jak w grze.
  async function frames(url) {
    const img = await loadImg(url), n = MibProfile.capeFrames(img.width, img.height);
    if (!n) return null;
    const fh = img.width / 2;
    return Array.from({ length: n }, (_, i) => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = fh;
      c.getContext('2d').drawImage(img, 0, i * fh, img.width, fh, 0, 0, img.width, fh);
      return c;
    });
  }
  const dressed = new WeakMap();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Klasa tekstury z samego skinview3d; skin ładuje się osobno, więc chwilę na nią czekamy (null = nie ma)
  async function texClass(viewer, st, my) {
    for (let i = 0; i < 20 && !(viewer.skinTexture || viewer.capeTexture); i++) { await new Promise(r => setTimeout(r, 100)); if (st.gen !== my) return null; }
    return (viewer.skinTexture || viewer.capeTexture || {}).constructor || null;
  }
  function newTex(viewer, Tex, canvas) {
    const t = new Tex(canvas);
    t.magFilter = t.minFilter = 1003;
    if (viewer.skinTexture) t.colorSpace = viewer.skinTexture.colorSpace;
    return t;
  }
  // cape, wings, hat: tekstury albo null; aura: { texture, id } albo null. Skrzydła jak elytra zastępują pelerynę,
  // skrzydła wróżki są razem z nią. Zwraca, co widać.
  async function dress(viewer, { cape = null, wings = null, hat = null, aura = null } = {}) {
    const st = dressed.get(viewer) || {};
    dressed.set(viewer, st);
    const my = st.gen = (st.gen || 0) + 1;
    const load = u => (u ? frames(u).catch(() => null) : null);
    const [cf, wf, hf, af] = await Promise.all([load(cape), load(wings), load(hat), load(aura && aura.texture)]);
    if (st.gen !== my) return null;
    clearInterval(st.timer); st.timer = null;
    const fairy = wf && MibProfile.wingsModel(wf[0].width) === 'fairy' ? wf : null;
    const bf = cf || (wf && !fairy ? wf : null), kind = cf ? 'cape' : bf ? 'elytra' : '';
    try { if (bf) viewer.loadCape(bf[0], { backEquipment: kind }); else viewer.resetCape(); } catch {}
    await putHat(viewer, st, hf, my);
    if (st.gen !== my) return null;
    await putWings(viewer, st, fairy, my);
    if (st.gen !== my) return null;
    const style = af && MibProfile.auraStyle(aura.id);
    await putAura(viewer, st, style ? af : null, style, my);
    if (st.gen !== my) return null;
    const n = Math.max(bf ? bf.length : 1, hf ? hf.length : 1, fairy ? fairy.length : 1);
    if (n > 1) {
      let i = 0;
      st.timer = setInterval(() => {
        if (!viewer.canvas || !viewer.canvas.isConnected) { clearInterval(st.timer); st.timer = null; return; }
        i++;
        if (bf && bf.length > 1 && viewer.capeTexture) draw(viewer.capeCanvas, bf[i % bf.length], 0, viewer.capeTexture);
        if (hf && hf.length > 1 && st.hatTex) draw(st.hatCanvas, hf[i % hf.length], 0, st.hatTex);
        if (fairy && fairy.length > 1 && st.wingTex) draw(st.wingCanvas, fairy[i % fairy.length], 0, st.wingTex);
      }, MibProfile.CAPE_FRAME_MS);
    }
    if (st.wings || st.aura) animate(viewer, st);
    return { back: kind, fairy: !!st.wings, hat: !!(hf && st.hat), aura: st.aura ? style : '', frames: n };
  }
  function draw(canvas, frame, y, tex) {
    const x = canvas.getContext('2d');
    x.clearRect(0, y, canvas.width, frame.height * canvas.width / frame.width);
    x.drawImage(frame, 0, y, canvas.width, frame.height * canvas.width / frame.width);
    tex.needsUpdate = true;
  }
  // Czapka: kopia głowy postaci powiększona jak hełm (10 i 11 pikseli zamiast 8), z teksturą czapki w górnej połowie
  // płótna 64×64 — tak samo leżą głowa i nakładka na skinie, więc pasują współrzędne tekstury
  async function putHat(viewer, st, hf, my) {
    const head = viewer.playerObject && viewer.playerObject.skin && viewer.playerObject.skin.head;
    if (st.hat) { for (const m of st.hat) { if (m.parent) m.parent.remove(m); m.material.dispose(); } st.hat = null; }
    if (st.hatTex) { st.hatTex.dispose(); st.hatTex = null; }
    if (!hf || !head || !head.innerLayer || !head.outerLayer) return;
    const Tex = await texClass(viewer, st, my);
    if (!Tex) return;
    st.hatCanvas = document.createElement('canvas');
    st.hatCanvas.width = st.hatCanvas.height = hf[0].width;
    st.hatTex = newTex(viewer, Tex, st.hatCanvas);
    draw(st.hatCanvas, hf[0], 0, st.hatTex);
    st.hat = [[head.innerLayer, 10], [head.outerLayer, 11]].map(([src, size]) => {
      const m = src.clone();
      m.material = head.outerLayer.material.clone();
      m.material.map = st.hatTex;
      const w = (src.geometry && src.geometry.parameters && src.geometry.parameters.width) || 8;
      m.scale.multiplyScalar(size / w);
      head.add(m);
      return m;
    });
  }
  // Skrzydła wróżki: dwie płaszczyzny 16×20 przy łopatkach, odchylone do tyłu i machające (tak samo w grze: FairyWingsLayer).
  // Na przodzie płaszczyzny tył skrzydła z tekstury, z tyłu jego przód; drugie skrzydło to lustro pierwszego.
  async function putWings(viewer, st, wf, my) {
    const skin = viewer.playerObject && viewer.playerObject.skin, src = skin && skin.head && skin.head.innerLayer;
    if (st.wings) { for (const [m] of st.wings) { if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); } st.wings = null; }
    if (st.wingTex) { st.wingTex.dispose(); st.wingTex = null; }
    if (!wf || !src || !skin.body) return;
    const Tex = await texClass(viewer, st, my);
    if (!Tex) return;
    st.wingCanvas = document.createElement('canvas');
    st.wingCanvas.width = wf[0].width; st.wingCanvas.height = wf[0].height;
    st.wingTex = newTex(viewer, Tex, st.wingCanvas);
    draw(st.wingCanvas, wf[0], 0, st.wingTex);
    const Geo = src.geometry.constructor, Mesh = src.constructor, Mat = src.material.constructor;
    st.wings = [1, -1].map(sign => {
      const g = new Geo(16, 20, 0);
      g.translate(8, -7, 0);
      const uv = g.attributes.uv;
      const face = (f, x0, y0, x1, y1) => { for (let k = 0; k < 4; k++) uv.setXY(f * 4 + k, (k % 2 ? x1 : x0) / 64, 1 - (k < 2 ? y0 : y1) / 32); };
      for (let f = 0; f < 4; f++) face(f, 63, 31, 64, 32);
      face(4, 16, 0, 32, 20); face(5, 16, 0, 0, 20);
      uv.needsUpdate = true;
      const m = new Mesh(g, new Mat({ map: st.wingTex, alphaTest: 0.5 }));
      m.scale.set(sign * 0.8, 0.8, 1); m.position.set(sign * 0.8, 5.2, -2.2);
      skin.body.add(m);
      return [m, sign];
    });
  }
  // Aura: cząsteczki z MibProfile.auraParticles jako małe obrazki zwrócone do kamery, z własnym światłem (jak w grze: AuraLayer)
  async function putAura(viewer, st, af, style, my) {
    const skin = viewer.playerObject && viewer.playerObject.skin, src = skin && skin.head && skin.head.innerLayer;
    if (st.aura) { for (const m of st.aura.pool) { if (m.parent) m.parent.remove(m); m.material.dispose(); } st.aura.group.parent && st.aura.group.parent.remove(st.aura.group); st.aura.geo.dispose(); for (const t of st.aura.cells) t.dispose(); st.aura = null; }
    if (!af || !src || !skin.leftLeg) return;
    const Tex = await texClass(viewer, st, my);
    if (!Tex) return;
    const img = af[0], cs = img.width / 8;
    const cells = [0, 1, 2].map(k => { const c = document.createElement('canvas'); c.width = c.height = cs; c.getContext('2d').drawImage(img, k * cs, 0, cs, cs, 0, 0, cs, cs); const t = newTex(viewer, Tex, c); t.needsUpdate = true; return t; });
    const group = new viewer.playerWrapper.constructor();
    skin.add(group);
    st.aura = { style, cells, group, pool: [], geo: new src.geometry.constructor(1, 1, 0), Mesh: src.constructor, Mat: src.material.constructor, seed: 7 };
  }
  // Machanie skrzydłami i ruch aury w każdej klatce, dopóki podgląd jest na stronie
  function animate(viewer, st) {
    if (st.raf) return;
    let q = null;
    const tick = now => {
      st.raf = 0;
      if (!viewer.canvas || !viewer.canvas.isConnected || !(st.wings || st.aura)) return;
      if (st.wings) { const a = 0.8 + (reduceMotion.matches ? 0 : Math.sin(now / 1000 * 4.2) * 0.22); for (const [m, sign] of st.wings) m.rotation.y = sign * a; }
      const au = st.aura;
      if (au) {
        const feet = viewer.playerObject.skin.leftLeg.position.y - 12, list = MibProfile.auraParticles(au.style, (Date.now() % 3600000) / 1000, au.seed);
        if (!q) q = viewer.camera.quaternion.clone();
        au.group.getWorldQuaternion(q);
        q.invert().multiply(viewer.camera.quaternion);
        while (au.pool.length < list.length) {
          const mat = new au.Mat({ transparent: true, depthWrite: false, alphaTest: 0.02 });
          mat.color.setRGB(0, 0, 0); mat.emissive.setRGB(1, 1, 1);
          const m = new au.Mesh(au.geo, mat);
          au.group.add(m); au.pool.push(m);
        }
        au.pool.forEach((m, i) => {
          const p = list[i];
          m.visible = !!p;
          if (!p) return;
          m.position.set(p.x, feet + p.y, p.z);
          m.scale.setScalar(8 * p.size);
          m.quaternion.copy(q);
          const map = au.cells[p.cell] || au.cells[0];
          if (m.material.emissiveMap !== map) { m.material.map = m.material.emissiveMap = map; m.material.needsUpdate = true; }
          m.material.opacity = p.alpha;
        });
      }
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
  }
  window.mibDress = dress;
  // Strój do dress() z listy przedmiotów { type, id, texture } (np. założone u znajomego albo prezent)
  function outfit(list) {
    const o = {};
    for (const c of list) if (c && c.texture && ['cape', 'wings', 'hat', 'aura'].includes(c.type) && !o[c.type]) o[c.type] = c.type === 'aura' ? { texture: c.texture, id: c.id } : c.texture;
    return o;
  }
  window.mibOutfit = outfit;

  // Strona Kosmetyki: na postaci założone przedmioty, a klik w przedmiot to przymiarka (bez zakładania).
  // data-back i data-hat na płótnie mówią, co widać.
  let trying = {};
  async function dressPage(list) {
    if (!skinViewer) return;
    const on = t => trying[t] || list.find(c => c.equipped && c.type === t && c.texture);
    const tried = trying.wings && !trying.cape ? 'wings' : null;
    const r = await dress(skinViewer, outfit([tried ? null : on('cape'), on('wings'), on('hat'), on('aura')]));
    if (r) Object.assign(skinCanvas.dataset, { back: r.back, hat: r.hat ? '1' : '', fairy: r.fairy ? '1' : '', aura: r.aura, frames: r.frames });
  }

  async function renderCos() {
    const box = $('cos-box');
    if (st.loading) return box.replaceChildren(h('h2', {}, T('Kosmetyki')), h('p', { class: 'mut' }, T('Wczytywanie…')));
    const skin = await skinSection();
    if (!st.loggedIn) {
      trying = {};
      dressPage([]);
      box.replaceChildren(h('h2', {}, T('Kosmetyki')), skin, h('div', { class: 'empty-state' },
        h('p', {}, st.offline ? T('Brak połączenia z serwerem MiB. Kosmetyki pokażą się, gdy połączenie wróci.') : T('Peleryny i inne przedmioty zapisują się na profilu MiB. Załóż profil, żeby je zbierać.')),
        st.offline ? null : h('button', { class: 'b', on: { click: () => { tab = 'signup'; go('prof'); } } }, T(st.needsProfile ? 'Dokończ profil MiB' : 'Załóż profil MiB'))));
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
    const items = Array.isArray(list) ? list : [];
    // przymiarka tylko przedmiotów, które gracz dalej ma i które nie są już założone
    for (const t of Object.keys(trying)) { const x = trying[t] && items.find(c => c.id === trying[t].id); if (!x || x.equipped) delete trying[t]; }
    dressPage(items);
    const tryToggle = c => {
      if (!c.texture || c.equipped) return;
      trying[c.type] = trying[c.type] && trying[c.type].id === c.id ? null : c;
      if (!trying[c.type]) delete trying[c.type];
      for (const el of document.querySelectorAll('#cos-box .cosi')) el.classList.toggle('try', Object.values(trying).some(t => t.id === el.dataset.id));
      dressPage(items);
    };
    const grid = Array.isArray(list) && list.length
      ? h('div', { class: 'cos-grid' }, ...list.map(c => h('div', { class: 'cosi' + (c.equipped ? ' on' : '') + (trying[c.type] && trying[c.type].id === c.id ? ' try' : ''),
          'data-id': c.id, title: c.texture && !c.equipped ? T('Kliknij, żeby przymierzyć') : null, on: { click: e => { if (!e.target.closest('button')) tryToggle(c); } } },
        h('i', { 'aria-hidden': 'true' }, itemImage(c, 5)),
        h('b', {}, c.name), h('small', { class: 'mut' }, c.equipped ? '✓ ' + T('Założona — widać ją w grze') : T('Odebrano') + ' ' + fmtDate(c.acquiredAt)),
        h('button', { class: c.equipped ? 'b ghost' : 'b', type: 'button', on: { click: async e => {
          e.currentTarget.disabled = true;
          const r = await mib.call('prof:equip', { type: c.type, id: c.equipped ? null : c.id });
          if (r.error) toast(msg(r.error), 1);
          renderCos();
        } } }, T(c.equipped ? 'Zdejmij' : 'Załóż')))))
      : h('p', { class: 'empty' }, Array.isArray(list) ? T('Nie masz jeszcze żadnych przedmiotów. Masz kod z konkursu? Wpisz go wyżej.') : msg(list.error));
    const gift = giftCount ? h('div', { class: 'card reward gift-banner', id: 'cos-gift' }, h('b', {}, T('Masz prezent do odebrania!')),
      h('button', { class: 'b', type: 'button', on: { click: () => giftsCheck(true) } }, T('Odbierz'))) : null;
    box.replaceChildren(h('h2', {}, T('Kosmetyki')), gift, skin, h('div', { class: 'sec' }, h('h3', {}, T('Przedmioty MiB')), h('p', { class: 'lead' }, T('Przedmioty przypisane do profilu') + ' ' + st.nick + '.'), form, err,
      items.length ? h('p', { class: 'mut' }, T('Kliknij przedmiot, żeby przymierzyć go na postaci. „Załóż” zakłada go w grze.')) : null, grid));
  }

  // ===== Prezenty od MiB: okno „Masz prezent!” z podglądem na postaci, Odbierz i Załóż od razu =====
  let giftOpen = false, giftCount = 0;
  const KIND = { cape: 'Peleryna', hat: 'Czapka', wings: 'Skrzydła', aura: 'Aura' };
  // licznik przy pozycji paska bocznego (Kosmetyki: prezenty, Pomysły: odpowiedzi)
  function navCount(page, n) {
    const nav = document.querySelector(`.nav[data-p="${page}"]`);
    let b = nav.querySelector('.cnt');
    if (!b) { b = h('em', { class: 'cnt' }); nav.append(b); }
    b.textContent = String(n); b.hidden = !n;
  }
  async function giftsCheck(open) {
    if (!st.loggedIn) { giftCount = 0; navCount('cos', 0); return; }
    const l = await mib.call('prof:gifts');
    if (!Array.isArray(l)) return;
    const was = giftCount;
    giftCount = l.length; navCount('cos', l.length);
    if (was !== giftCount && $('p-cos').classList.contains('on') && !giftOpen) renderCos();
    if (open && l.length && !giftOpen) showGift(l[0], l.length);
  }
  async function ideasBadge() {
    if (!st.loggedIn) return navCount('ideas', 0);
    const u = await mib.call('prof:ideaUpdates');
    if (Array.isArray(u)) navCount('ideas', u.length);
  }
  async function showGift(g, total) {
    giftOpen = true;
    const canvas = h('canvas', { width: 200, height: 230, class: 'gift3d' });
    let viewer = null;
    const actions = h('div', { class: 'row gift-act' });
    const ov = h('div', { class: 'ov on', id: 'gift' }, h('div', { class: 'm gift-m', role: 'dialog', 'aria-label': T('Masz prezent!') },
      h('small', { class: 'gift-kicker' }, T(g.bug ? 'Nagroda za znalezienie błędu' : 'Prezent od MiB') + (total > 1 ? ' · 1/' + total : '')),
      h('h3', {}, T('Masz prezent!')), canvas,
      h('b', { class: 'gift-name' }, g.name), h('span', { class: 'mut' }, T(KIND[g.type] || 'Kosmetyk')),
      g.message ? h('blockquote', { class: 'gift-msg' }, '„' + g.message + '”', h('small', {}, '— ' + T('twórca MiB Client'))) : null,
      actions));
    const close = () => { try { if (viewer) viewer.dispose(); } catch {} ov.remove(); giftOpen = false; if ($('p-cos').classList.contains('on')) renderCos(); giftsCheck(true); };
    const claim = h('button', { class: 'b', id: 'gift-claim', type: 'button', on: { click: async () => {
      claim.disabled = true;
      const r = await mib.call('prof:claimGift', { id: g.id });
      if (r.error) { claim.disabled = false; toast(msg(r.error, r.detail), 1); return; }
      if (window.mibUnlock) mibUnlock({ name: g.name, type: g.type, imageUrl: g.texture });
      actions.replaceChildren(
        h('button', { class: 'b', id: 'gift-equip', type: 'button', on: { click: async e => {
          e.currentTarget.disabled = true;
          const x = await mib.call('prof:equip', { type: g.type, id: g.cosmetic_id });
          toast(x.error ? msg(x.error) : T('Założone. Widać to w grze.'), !!x.error);
          close();
        } } }, T('Załóż od razu')),
        h('button', { class: 'b ghost', id: 'gift-later', type: 'button', on: { click: close } }, T('Później')));
    } } }, T('Odbierz'));
    actions.append(claim);
    document.body.append(ov);
    try {
      viewer = new skinview3d.SkinViewer({ canvas, width: 200, height: 230 }); viewer.autoRotate = true; viewer.autoRotateSpeed = 0.9; viewer.controls.enableZoom = false;
      const cur = await mib.call('skin:current');
      await viewer.loadSkin(cur && cur.dataUrl ? cur.dataUrl : await mib.call('skin', 'MHF_Steve'), { model: cur && cur.variant === 'slim' ? 'slim' : 'default' });
      if (g.texture) window.mibDress(viewer, outfit([{ type: g.type, id: g.cosmetic_id, texture: g.texture }]));
    } catch {}
  }
  // launcher sprawdza prezenty i odpowiedzi co minutę (main.js); kliknięte powiadomienie otwiera okno albo Pomysły
  mib.on('gifts:changed', n => { if (st.loggedIn && (n !== giftCount || (n && !giftOpen))) giftsCheck(true); });
  mib.on('gifts:open', () => giftsCheck(true));
  mib.on('ideas:changed', n => { if (!st.loggedIn) return; if ($('p-ideas').classList.contains('on')) renderIdeas(); else navCount('ideas', n); });
  mib.on('ideas:open', () => go('ideas'));

  // ===== Strona Pomysły =====
  const IDEA_CAT = { feature: 'Nowa funkcja', cosmetic: 'Kosmetyk', bug: 'Błąd do naprawy', other: 'Inne' };
  const IDEA_ST = { new: 'Wysłany', seen: 'Przeczytany', planned: 'W planach', done: 'Zrobione', rejected: 'Odrzucony' };
  async function renderIdeas() {
    const box = $('ideas-box');
    const head = [h('h2', {}, T('Pomysły')), h('p', { class: 'lead' }, T('Masz pomysł, co dodać albo poprawić w MiB Client? Napisz go tutaj, a trafi prosto do twórcy launchera.')),
      h('div', { class: 'card reward', id: 'id-reward' }, h('b', {}, T('Nagroda za znalezienie błędu')),
        h('p', {}, T('Zgłoś błąd w MiB Client (wybierz „Błąd do naprawy”), a dostaniesz nagrodę: ekskluzywny kosmetyk. Błąd musi naprawdę występować — sprawdzimy go, zanim przyznamy nagrodę.')))];
    if (st.loading) return box.replaceChildren(...head, h('p', { class: 'mut' }, T('Wczytywanie…')));
    if (!st.loggedIn) {
      box.replaceChildren(...head, h('div', { class: 'empty-state' },
        h('p', {}, st.offline ? T('Brak połączenia z serwerem MiB. Pomysł wyślesz, gdy połączenie wróci.') : T('Pomysły wysyła się z profilu MiB, dzięki temu nie ma spamu. Załóż profil, żeby napisać swój.')),
        st.offline ? null : h('button', { class: 'b', on: { click: () => { tab = 'signup'; go('prof'); } } }, T(st.needsProfile ? 'Dokończ profil MiB' : 'Załóż profil MiB'))));
      return;
    }
    const cat = h('select', { id: 'id-cat' }, ...Object.entries(IDEA_CAT).map(([k, v]) => h('option', { value: k }, T(v))));
    const body = h('textarea', { id: 'id-body', maxlength: 1000, placeholder: T('Opisz swój pomysł…') });
    const count = h('small', { class: 'mut' }, '0 / 1000');
    body.addEventListener('input', () => { count.textContent = body.value.trim().length + ' / 1000'; });
    const err = errBox(), send = h('button', { class: 'b', id: 'id-send', type: 'submit' }, T('Wyślij pomysł'));
    const list = h('div', { id: 'id-list' }, h('p', { class: 'mut' }, T('Wczytywanie…')));
    // Pomysły innych graczy: głos jednym kliknięciem (nie na własny), najpopularniejsze albo najnowsze
    const pub = h('div', { id: 'ip-list' }, h('p', { class: 'mut' }, T('Wczytywanie…')));
    const sortSeg = h('div', { class: 'seg', role: 'tablist', id: 'ip-sort' }, ...[['top', 'Najpopularniejsze'], ['new', 'Najnowsze']].map(([k, l]) =>
      h('button', { type: 'button', role: 'tab', class: ideaSort === k ? 'on' : '', 'data-sort': k, on: { click: () => {
        ideaSort = k; pubShown = 20;
        for (const b of sortSeg.children) b.classList.toggle('on', b.dataset.sort === k);
        loadPublic();
      } } }, T(l))));
    let pubAll = [], pubShown = 20;
    async function loadPublic() {
      const l = await mib.call('prof:ideasPublic', { sort: ideaSort });
      if (!Array.isArray(l)) { pub.replaceChildren(h('p', { class: 'err' }, msg(l.error, l.detail))); return; }
      pubAll = l; showPublic();
    }
    function voteBtn(i) {
      const cnt = h('b', {}, String(i.votes));
      const b = h('button', { class: 'vote' + (i.voted ? ' on' : ''), type: 'button', 'aria-pressed': String(!!i.voted), disabled: !!i.mine,
        title: T(i.mine ? 'To Twój pomysł' : i.voted ? 'Cofnij głos' : 'Daj głos'), on: { click: async () => {
          b.disabled = true;
          const r = await mib.call('prof:ideaVote', { id: i.id, on: !i.voted });
          b.disabled = false;
          if (r.error) return toast(msg(r.error, r.detail), 1);
          i.voted = !i.voted; i.votes = r.votes;
          b.classList.toggle('on', i.voted); b.setAttribute('aria-pressed', String(i.voted)); b.title = T(i.voted ? 'Cofnij głos' : 'Daj głos'); cnt.textContent = String(i.votes);
        } } }, voteIcon(), cnt);
      return b;
    }
    function showPublic() {
      const l = pubAll.slice(0, pubShown);
      pub.replaceChildren(...(l.length ? l.map(i => h('div', { class: 'card idea pub' + (i.mine ? ' mine' : ''), 'data-id': i.id }, voteBtn(i),
        h('div', { class: 'ibody' },
          h('div', { class: 'ihead' }, h('b', {}, i.mine ? T('Twój pomysł') : i.nick), h('em', { class: 'tag' }, T(IDEA_CAT[i.category] || i.category)),
            i.status !== 'new' ? h('em', { class: 'tag st-' + i.status }, T(IDEA_ST[i.status] || i.status)) : null, h('span', { class: 'mut' }, fmtDate(i.created_at))),
          h('p', {}, i.mine ? i.body : clean(i.body)),
          i.reply ? h('div', { class: 'ireply' }, h('small', {}, T('Odpowiedź twórcy MiB Client')), h('p', {}, i.reply)) : null)))
        : [h('p', { class: 'empty' }, T('Nikt jeszcze nie wysłał pomysłu do głosowania. Bądź pierwszy!'))]),
        ...(pubAll.length > pubShown ? [h('button', { class: 'b ghost', type: 'button', on: { click: () => { pubShown += 20; showPublic(); } } }, T('Pokaż więcej'))] : []));
    }
    async function loadMine() {
      const l = await mib.call('prof:myIdeas');
      if (!Array.isArray(l)) return list.replaceChildren(h('p', { class: 'err' }, msg(l.error, l.detail)));
      const votes = {};
      for (const x of pubAll) votes[x.id] = x.votes;
      list.replaceChildren(...(l.length ? l.map(i => h('div', { class: 'card idea' },
        h('div', { class: 'ihead' }, h('em', { class: 'tag' }, T(IDEA_CAT[i.category] || i.category)), h('span', { class: 'mut' }, fmtDate(i.created_at)),
          i.rewarded ? h('em', { class: 'tag hunter' }, T('Nagrodzony')) : null,
          votes[i.id] ? h('em', { class: 'tag votes' }, T('Głosy') + ': ' + votes[i.id]) : null,
          h('em', { class: 'tag st-' + i.status }, T(IDEA_ST[i.status] || i.status))),
        h('p', {}, i.body),
        i.reply ? h('div', { class: 'ireply' }, h('small', {}, T('Odpowiedź twórcy MiB Client')), h('p', {}, i.reply)) : null))
        : [h('p', { class: 'empty' }, T('Nie masz jeszcze wysłanych pomysłów.'))]));
      // zmiany statusu i odpowiedzi są teraz obejrzane: znika kropka przy „Pomysły”
      if (l.length) { await mib.call('prof:ideasSeen'); navCount('ideas', 0); }
    }
    const form = h('form', { class: 'pform', on: { submit: async e => {
      e.preventDefault();
      const bad = MibProfile.validateIdea({ category: cat.value, body: body.value });
      if (bad) { err.textContent = msg(bad); body.focus(); return; }
      send.disabled = true; err.textContent = '';
      const r = await mib.call('prof:submitIdea', { category: cat.value, body: body.value });
      send.disabled = false;
      if (r.error) { err.textContent = msg(r.error, r.detail); return; }
      body.value = ''; count.textContent = '0 / 1000';
      toast(T('Dzięki, pomysł wysłany.'));
      await loadPublic(); loadMine();
    } } },
    field('Czego dotyczy', cat), field('Pomysł', body, 'Od 10 do 1000 znaków. Najwyżej 5 pomysłów dziennie.'), err,
    h('div', { class: 'row', style: 'align-items:center;justify-content:space-between' }, send, count));
    box.replaceChildren(...head, form, h('div', { class: 'sec' }, h('h3', {}, T('Twoje pomysły')), list),
      h('div', { class: 'sec', id: 'ip' }, h('div', { class: 'row', style: 'align-items:center;justify-content:space-between' }, h('h3', {}, T('Pomysły graczy')), sortSeg),
        h('p', { class: 'mut' }, T('Daj głos pomysłom, które chcesz zobaczyć w MiB Client. Twórca widzi, które są najpopularniejsze.')), pub));
    await loadPublic();
    loadMine();
  }
  let ideaSort = 'top';
  const voteIcon = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<path fill="currentColor" d="M11 4h2v2h-2zM9 6h6v2H9zM7 8h10v2H7zM5 10h14v2H5zM10 12h4v8h-4z"/>'; return s; };

  // ===== Strona Znajomi =====
  // Status znajomego: w grze (serwer, wersja), w launcherze albo offline z czasem ostatniej obecności
  const when = d => new Date(d).toLocaleString(LANG === 'en' ? 'en-GB' : 'pl-PL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  function statusText(f) {
    if (f.status === 'game') return T('W grze') + (f.server ? ' · ' + f.server : '') + (f.version ? ' · ' + f.version : '');
    if (f.status === 'launcher') return T('W launcherze');
    return T('Offline') + (f.seen_at ? ' · ' + T('ostatnio') + ' ' + when(f.seen_at) : '');
  }
  let friendsTimer = null, friendsReload = null; // friendsReload: odświeżenie listy bez czyszczenia pola z nickiem
  async function friendsBadge() {
    const nav = document.querySelector('.nav[data-p="friends"]');
    let b = nav.querySelector('.cnt');
    if (!st.loggedIn) { if (b) b.hidden = true; return; }
    const [l, inv, un] = await Promise.all([mib.call('prof:friends'), mib.call('prof:invites'), mib.call('prof:chatUnread')]);
    if (!Array.isArray(l)) return;
    const n = l.filter(f => f.state === 'incoming').length + (Array.isArray(inv) ? inv.length : 0)
      + (Array.isArray(un) ? un.reduce((a, u) => a + Number(u.unread || 0), 0) : 0);
    if (!b) { b = h('em', { class: 'cnt' }); nav.append(b); }
    b.textContent = String(n); b.hidden = !n;
  }
  setInterval(() => { if (st.loggedIn) friendsBadge(); }, 2 * 60 * 1000);
  // Launcher sprawdza znajomych co 30 s (main.js): nowe zaproszenie do gry albo kliknięte powiadomienie
  mib.on('friends:changed', () => { if (!st.loggedIn) return; if ($('p-friends').classList.contains('on') && friendsReload) friendsReload(); else friendsBadge(); });
  mib.on('friends:open', () => go('friends'));
  // Wiadomości (main.js sprawdza co 10 s): licznik, dymek, gdy rozmowa z tą osobą nie jest otwarta
  mib.on('chat:unread', () => { if (!st.loggedIn) return; if ($('p-friends').classList.contains('on') && friendsReload) friendsReload(); else friendsBadge(); });
  mib.on('chat:new', rows => {
    for (const u of rows || []) {
      if (chatWith && chatWith.id === u.from_id) { if (chatReload) chatReload(); continue; }
      if (document.hasFocus()) toast(T('Nowa wiadomość od') + ' ' + u.nick + ': ' + clean(u.last_body).slice(0, 80));
    }
  });
  mib.on('chat:open', async id => {
    go('friends');
    const l = await mib.call('prof:friends');
    const f = Array.isArray(l) && l.find(x => x.id === id && x.state === 'friend');
    if (f) openChat(f);
  });

  // ===== Rozmowa ze znajomym (okno nad stroną Znajomi) =====
  let chatWith = null, chatTimer = null, chatReload = null;
  const timeOf = d => {
    const x = new Date(d), today = x.toDateString() === new Date().toDateString();
    return x.toLocaleString(LANG === 'en' ? 'en-GB' : 'pl-PL', today ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  function closeChat() {
    clearTimeout(chatTimer);
    const was = chatWith;
    chatWith = null; chatReload = null;
    const o = $('chat'); if (o) o.remove();
    if (was && friendsReload && $('p-friends').classList.contains('on')) friendsReload();
  }
  function openChat(f) {
    closeChat();
    chatWith = f;
    let shown = '', first = true;
    const list = h('div', { class: 'chat-list', id: 'chat-list' }, h('p', { class: 'mut' }, T('Wczytywanie…')));
    const input = h('input', { id: 'chat-in', maxlength: 500, autocomplete: 'off', placeholder: T('Napisz wiadomość…') });
    const sendB = h('button', { class: 'b', id: 'chat-send', type: 'submit' }, T('Wyślij'));
    const err = h('p', { class: 'err', id: 'chat-err' });
    const form = h('form', { class: 'row chat-form', on: { submit: async e => {
      e.preventDefault();
      const body = input.value.trim();
      if (!body || sendB.disabled) return;
      sendB.disabled = true; err.textContent = '';
      const r = await mib.call('prof:chatSend', { id: f.id, body });
      sendB.disabled = false;
      if (r.error) { err.textContent = msg(r.error, r.detail); return; }
      input.value = '';
      first = true;
      load();
      input.focus();
    } } }, input, sendB);
    const ov = h('div', { class: 'ov on', id: 'chat' }, h('div', { class: 'm chat-m', role: 'dialog', 'aria-label': T('Rozmowa z') + ' ' + f.nick },
      h('div', { class: 'frow chat-head st-' + f.status },
        h('i', { class: 'dot', 'aria-hidden': 'true' }),
        h('div', { class: 'fi' }, h('b', {}, f.nick), h('span', { class: 'mut' }, statusText(f))),
        h('button', { class: 'b ghost', id: 'chat-block', type: 'button', on: { click: () => blockUser(f, closeChat) } }, T('Zablokuj')),
        h('button', { class: 'b ghost', id: 'chat-x', type: 'button', on: { click: closeChat } }, T('Zamknij'))),
      list, err, form));
    ov.addEventListener('mousedown', e => { if (e.target === ov) closeChat(); });
    ov.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('report')) closeChat(); });
    document.body.append(ov);
    input.focus();
    async function load() {
      clearTimeout(chatTimer);
      if (chatWith !== f) return;
      const l = await mib.call('prof:chat', { id: f.id });
      if (chatWith !== f) return;
      if (!Array.isArray(l)) list.replaceChildren(h('p', { class: 'err' }, msg(l.error, l.detail)));
      else {
        const key = l.map(m => m.id + (m.read ? 'r' : '')).join(',');
        if (key !== shown) {
          shown = key;
          const bottom = first || list.scrollHeight - list.scrollTop - list.clientHeight < 40;
          const lastMine = l.reduce((a, m, i) => (m.mine ? i : a), -1);
          list.replaceChildren(...(l.length ? l.map((m, i) => h('div', { class: 'msg' + (m.mine ? ' me' : '') },
            h('span', { class: 'tx' }, m.mine ? m.body : clean(m.body)),
            h('small', {}, timeOf(m.created_at) + (i === lastMine && m.read ? ' · ' + T('przeczytana') : ''),
              m.mine ? null : h('button', { class: 'rep-b', type: 'button', title: T('Zgłoś wiadomość'), on: { click: () => openReport(f, m, b => { if (b) closeChat(); }) } }, T('Zgłoś')))))
            : [h('p', { class: 'empty' }, T('Napisz pierwszą wiadomość do') + ' ' + f.nick + '.')]));
          if (bottom) list.scrollTop = list.scrollHeight;
          first = false;
        }
        if (l.some(m => !m.mine && !m.read)) { await mib.call('prof:chatRead', { id: f.id }); friendsBadge(); }
      }
      chatTimer = setTimeout(load, 4000);
    }
    chatReload = load;
    load();
  }
  async function renderFriends() {
    const box = $('friends-box');
    clearTimeout(friendsTimer);
    const head = [h('h2', {}, T('Znajomi')), h('p', { class: 'lead' }, T('Zobacz, kto z Twoich znajomych gra teraz w MiB Client i na jakim serwerze, i dołącz do niego jednym kliknięciem.'))];
    if (st.loading) return box.replaceChildren(...head, h('p', { class: 'mut' }, T('Wczytywanie…')));
    if (!st.loggedIn) {
      box.replaceChildren(...head, h('div', { class: 'empty-state' },
        h('p', {}, st.offline ? T('Brak połączenia z serwerem MiB. Znajomi pokażą się, gdy połączenie wróci.') : T('Znajomych dodaje się z profilu MiB. Załóż profil, żeby zaprosić znajomych.')),
        st.offline ? null : h('button', { class: 'b', on: { click: () => { tab = 'signup'; go('prof'); } } }, T(st.needsProfile ? 'Dokończ profil MiB' : 'Załóż profil MiB'))));
      return;
    }
    const who = h('input', { id: 'fr-who', maxlength: 20, autocomplete: 'off', placeholder: T('Nick albo ID MiB, np. MIB-000123') }), err = errBox();
    const add = h('button', { class: 'b', id: 'fr-add', type: 'submit' }, T('Zaproś'));
    const form = h('form', { class: 'row', on: { submit: async e => {
      e.preventDefault();
      if (!who.value.trim()) return;
      add.disabled = true; err.textContent = '';
      const r = await mib.call('prof:friendRequest', { who: who.value });
      add.disabled = false;
      if (r.error) { err.textContent = msg(r.error, r.detail); return; }
      who.value = '';
      toast(T(r.result === 'accepted' ? 'Jesteście teraz znajomymi.' : 'Zaproszenie wysłane.'));
      load();
    } } }, who, add);
    const list = h('div', { id: 'fr-list' }, h('p', { class: 'mut' }, T('Wczytywanie…')));
    const act = (label, cls, fn) => h('button', { class: 'b ' + cls, type: 'button', on: { click: async e => { e.currentTarget.disabled = true; const r = await fn(); if (r && r.error) toast(msg(r.error, r.detail), 1); load(); } } }, T(label));
    const row = (f, ...buttons) => h('div', { class: 'card frow' + (f.status ? ' st-' + f.status : '') },
      h('i', { class: 'dot', 'aria-hidden': 'true' }),
      h('div', { class: 'fi' }, f.state === 'friend' ? h('button', { class: 'linkb fr-name', type: 'button', title: T('Pokaż kartę gracza'), on: { click: () => openCard(f) } }, f.nick) : h('b', {}, f.nick),
        h('span', { class: 'mut' }, f.state === 'friend' ? statusText(f) : f.num ? MibProfile.formatMibId(f.num) : '')),
      ...buttons);
    async function load() {
      clearTimeout(friendsTimer);
      const [l, inv, me, un, bl] = await Promise.all([mib.call('prof:friends'), mib.call('prof:invites'), mib.call('prof:nowPlaying'), mib.call('prof:chatUnread'), mib.call('prof:blocked')]);
      if (!box.isConnected || !$('p-friends').classList.contains('on')) return;
      if (!Array.isArray(l)) return list.replaceChildren(h('p', { class: 'err' }, msg(l.error, l.detail)));
      const unread = {};
      for (const u of Array.isArray(un) ? un : []) unread[u.from_id] = Number(u.unread) || 0;
      const write = f => h('button', { class: 'b' + (unread[f.id] ? '' : ' ghost') + ' chat-b', type: 'button', on: { click: () => openChat(f) } },
        T('Napisz') + (unread[f.id] ? ' (' + unread[f.id] + ')' : ''));
      const games = Array.isArray(inv) ? inv : [], here = me && me.server;
      // Zaproś do gry: gdy grasz na serwerze, znajomych w launcherze albo w grze (nie tych na tym samym serwerze)
      const canInvite = f => here && (f.status === 'launcher' || (f.status === 'game' && f.server !== here));
      const invite = f => act('Zaproś do gry', 'ghost', async () => {
        const r = await mib.call('prof:inviteFriend', { id: f.id });
        if (!r.error) toast(T('Zaproszenie do gry wysłane do') + ' ' + f.nick + '.');
        return r;
      });
      const inc = l.filter(f => f.state === 'incoming'), out = l.filter(f => f.state === 'outgoing');
      const order = { game: 0, launcher: 1, offline: 2 };
      const fr = l.filter(f => f.state === 'friend').sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.nick.localeCompare(b.nick));
      const sec = (title, items) => items.length ? h('div', { class: 'sec' }, h('h3', {}, T(title) + ' (' + items.length + ')'), ...items) : null;
      list.replaceChildren(...[
        sec('Zaproszenia do gry', games.map(i => h('div', { class: 'card frow st-game ginv' },
          h('i', { class: 'dot', 'aria-hidden': 'true' }),
          h('div', { class: 'fi' }, h('b', {}, i.nick), h('span', { class: 'mut' }, T('Zaprasza na') + ' ' + i.server + ' · ' + i.version)),
          act('Dołącz', '', async () => { await mib.call('prof:inviteDismiss', { id: i.from_id }); window.mibJoin(i.version, i.server); }),
          act('Odrzuć', 'ghost', () => mib.call('prof:inviteDismiss', { id: i.from_id }))))),
        sec('Zaproszenia do Ciebie', inc.map(f => row(f,
          act('Przyjmij', '', () => mib.call('prof:friendAnswer', { id: f.id, accept: true })),
          act('Odrzuć', 'ghost', () => mib.call('prof:friendAnswer', { id: f.id, accept: false })),
          h('button', { class: 'b ghost', type: 'button', on: { click: () => blockUser(f, load) } }, T('Zablokuj'))))),
        fr.length ? sec('Twoi znajomi', fr.map(f => row(f,
          f.status === 'game' && f.server && f.version && f.server !== here ? act('Dołącz', '', async () => { window.mibJoin(f.version, f.server); }) : null,
          canInvite(f) ? invite(f) : null,
          write(f),
          act('Usuń', 'ghost', () => confirm(T('Usunąć') + ' ' + f.nick + ' ' + T('ze znajomych?')) ? mib.call('prof:friendRemove', { id: f.id }) : null))))
          : h('p', { class: 'empty' }, T('Nie masz jeszcze znajomych. Wpisz nick albo ID MiB kolegi i kliknij „Zaproś”.')),
        sec('Wysłane zaproszenia', out.map(f => row(f, act('Anuluj', 'ghost', () => mib.call('prof:friendRemove', { id: f.id }))))),
        sec('Zablokowani', (Array.isArray(bl) ? bl : []).map(b => h('div', { class: 'card frow blocked' }, h('i', { class: 'dot', 'aria-hidden': 'true' }),
          h('div', { class: 'fi' }, h('b', {}, b.nick), h('span', { class: 'mut' }, MibProfile.formatMibId(b.num))),
          act('Odblokuj', 'ghost', () => mib.call('prof:unblock', { id: b.id }))))),
      ].filter(Boolean));
      friendsBadge();
      friendsTimer = setTimeout(load, 30000);
    }
    box.replaceChildren(...head, ...(st.banned ? [h('p', { class: 'card ban' }, T('Twoje konto MiB jest zablokowane: nie możesz pisać ani zapraszać znajomych.'))] : []), form, err, list);
    friendsReload = load;
    load();
  }

  // ===== Zgłoszenie gracza (z wiadomością albo samego gracza) i blokowanie =====
  const REASONS = [['insult', 'Wyzwiska albo obrażanie'], ['spam', 'Spam'], ['scam', 'Oszustwo (np. kradzież konta albo przedmiotów)'], ['other', 'Inne']];
  // after(blocked): po wysłaniu; blocked = gracz od razu zablokowany
  function openReport(f, m, after) {
    const old = $('report'); if (old) old.remove();
    const reason = h('select', { id: 'rp-reason' }, ...REASONS.map(([v, l]) => h('option', { value: v }, T(l))));
    const note = h('textarea', { id: 'rp-note', maxlength: 300, rows: 3, placeholder: T('Co się stało? (nieobowiązkowe)') });
    const blk = h('input', { type: 'checkbox', id: 'rp-block' }), err = errBox();
    const sendB = h('button', { class: 'b', id: 'rp-send', type: 'submit' }, T('Wyślij zgłoszenie'));
    const close = () => ov.remove();
    const ov = h('div', { class: 'ov on', id: 'report' }, h('form', { class: 'm', role: 'dialog', 'aria-label': T('Zgłoś gracza'), on: { submit: async e => {
      e.preventDefault();
      sendB.disabled = true; err.textContent = '';
      const r = await mib.call('prof:report', { id: f.id, message: m ? m.id : null, reason: reason.value, note: note.value });
      if (r.error) { sendB.disabled = false; err.textContent = msg(r.error, r.detail); return; }
      if (blk.checked) await mib.call('prof:block', { id: f.id });
      toast(T('Zgłoszenie wysłane. Twórca MiB Client je sprawdzi.'));
      close();
      if (after) after(blk.checked);
      if (blk.checked && friendsReload) friendsReload();
    } } },
      h('h3', {}, T('Zgłoś gracza') + ' ' + f.nick),
      m ? h('blockquote', { class: 'rp-msg' }, clean(m.body)) : null,
      h('p', { class: 'mut' }, T(m ? 'Twórca MiB Client zobaczy tę wiadomość i kilka poprzednich z tej rozmowy.' : 'Twórca MiB Client zobaczy Twoje zgłoszenie i sprawdzi tego gracza.')),
      field('Powód', reason), field('Opis', note), h('label', { class: 'ck' }, blk, T('Zablokuj też tego gracza')), err,
      h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'b ghost', type: 'button', on: { click: close } }, T('Anuluj')), sendB)));
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    document.body.append(ov);
    reason.focus();
  }
  async function blockUser(f, after) {
    if (!confirm(T('Zablokować') + ' ' + f.nick + '? ' + T('Znajomość, zaproszenia i rozmowa znikną, a ten gracz nie zaprosi Cię ponownie. Jeśli ktoś Cię obraża, najpierw zgłoś wiadomość.'))) return;
    const r = await mib.call('prof:block', { id: f.id });
    if (r.error) return toast(msg(r.error, r.detail), 1);
    toast(f.nick + ' ' + T('zablokowany.'));
    if (after) after();
    if (friendsReload && $('p-friends').classList.contains('on')) friendsReload();
    friendsBadge();
  }

  // ===== Karta znajomego: postać 3D w jego kosmetykach, odznaki, czas gry, osiągnięcia =====
  async function openCard(f) {
    const old = $('fcard'); if (old) old.remove();
    const canvas = h('canvas', { width: 170, height: 210, class: 'fc3d' });
    const body = h('div', { class: 'fc-body' }, h('h3', {}, f.nick), h('p', { class: 'mut' }, T('Wczytywanie…')));
    let viewer = null;
    const close = () => { try { if (viewer) viewer.dispose(); } catch {} ov.remove(); };
    const ov = h('div', { class: 'ov on', id: 'fcard' }, h('div', { class: 'm fc-m', role: 'dialog', 'aria-label': f.nick },
      h('div', { class: 'fc-top' }, canvas, body),
      h('div', { class: 'row', style: 'justify-content:flex-end' },
        h('button', { class: 'b ghost', id: 'fc-report', type: 'button', on: { click: () => openReport(f, null, b => { if (b) close(); }) } }, T('Zgłoś')),
        h('button', { class: 'b ghost', id: 'fc-block', type: 'button', on: { click: () => blockUser(f, close) } }, T('Zablokuj')),
        h('button', { class: 'b', id: 'fc-chat', type: 'button', on: { click: () => { close(); openChat(f); } } }, T('Napisz')),
        h('button', { class: 'b ghost', id: 'fc-x', type: 'button', on: { click: close } }, T('Zamknij')))));
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    ov.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('report')) close(); });
    document.body.append(ov);
    const c = await mib.call('prof:card', { id: f.id });
    if (!ov.isConnected) return;
    if (!c || c.error) return body.replaceChildren(h('h3', {}, f.nick), h('p', { class: 'err' }, msg(c ? c.error : 'unknown', c && c.detail)));
    const list = MibProfile.achievements(c), done = list.filter(a => a.done).length, eq = Array.isArray(c.equipped) ? c.equipped : [];
    const line = (l, v) => h('div', { class: 'sr' }, h('span', {}, T(l)), h('b', {}, v));
    body.replaceChildren(
      h('div', { class: 'phead' }, h('h3', {}, c.nick), c.founder ? h('em', { class: 'tag founder' }, T('Założyciel')) : null,
        c.bugs_found ? h('em', { class: 'tag hunter' }, T('Łowca błędów') + (c.bugs_found > 1 ? ' ×' + c.bugs_found : '')) : null),
      h('span', { class: 'mono mut' }, MibProfile.formatMibId(c.num) + ' · ' + statusText(f)),
      line('Czas gry przez MiB', MibProfile.formatPlaytime(c.playtime_min || 0)), line('Profil od', fmtDate(c.created_at)),
      line('Założone', eq.length ? eq.map(x => x.name).join(', ') : '—'),
      h('h4', {}, T('Osiągnięcia') + ' (' + done + '/' + list.length + ')'), achGrid(list));
    try {
      viewer = new skinview3d.SkinViewer({ canvas, width: 170, height: 210 }); viewer.autoRotate = true; viewer.autoRotateSpeed = 0.8; viewer.controls.enableZoom = false;
      await viewer.loadSkin(await mib.call('skin', c.mc_name || 'MHF_Steve'));
      if (ov.isConnected) window.mibDress(viewer, outfit(eq));
      canvas.dataset.dressed = eq.map(x => x.type).sort().join(',');
    } catch {}
  }

  // ===== Ostrzeżenie od twórcy (4. = ban) i ważna aktualność: okna, które gracz potwierdza =====
  function showWarnings(list) {
    if (!Array.isArray(list) || !list.length || $('warn')) return;
    const fx = $('unlock'); if (fx) fx.remove(); // ostrzeżenie jest ważniejsze niż efekt nowego przedmiotu
    const w = list[list.length - 1], ban = w.num >= 4;
    const ok = h('button', { class: 'b', id: 'warn-ok', type: 'button', on: { click: async () => {
      ok.disabled = true;
      await mib.call('prof:warningsSeen');
      ov.remove();
      refresh();
    } } }, T('Rozumiem'));
    const ov = h('div', { class: 'ov on', id: 'warn' }, h('div', { class: 'm warn-m', role: 'alertdialog', 'aria-label': T('Ostrzeżenie') },
      h('small', { class: 'gift-kicker' }, T('Od twórcy MiB Client')),
      h('h3', {}, ban ? T('Konto MiB zablokowane') : T('Ostrzeżenie') + ' ' + w.num + '/4'),
      h('p', { class: 'lg' }, T('Powód:') + ' ' + w.reason),
      h('p', { class: 'mut' }, ban ? T('To było czwarte ostrzeżenie. Grać możesz dalej, ale nie napiszesz do znajomych, nie zaprosisz nikogo i nie wyślesz pomysłu, a w grze nie widać Twojego logo MiB i kosmetyków.')
        : T('Przy 4. ostrzeżeniu konto MiB zostanie zablokowane: bez wiadomości, znajomych, pomysłów i kosmetyków w grze.')),
      h('div', { class: 'row', style: 'justify-content:flex-end' }, ok)));
    document.body.append(ov);
    ok.focus();
  }
  mib.on('warnings:new', l => { if (st.loggedIn) showWarnings(l); });
  function showNews(a) {
    if (!a || !a.title) return;
    const old = $('news-pop'); if (old) old.remove();
    const close = () => ov.remove();
    const ov = h('div', { class: 'ov on', id: 'news-pop' }, h('div', { class: 'm news-m', role: 'dialog', 'aria-label': T('Ważna aktualność') },
      h('small', { class: 'gift-kicker' }, T('Ważna aktualność') + (a.created_at ? ' · ' + fmtDate(a.created_at) : '')),
      h('h3', {}, a.title), a.body ? h('p', { class: 'lg' }, a.body) : null,
      h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'b', id: 'news-ok', type: 'button', on: { click: close } }, T('OK')))));
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    document.body.append(ov);
    $('news-ok').focus();
  }
  mib.on('news:popup', showNews);

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
    st = r && (r.loggedIn || r.offline || r.needsProfile) ? r : { loggedIn: false };
    mibSync.profile = !!st.loggedIn;
    // Panel admina tylko dla konta admina (i tak pilnuje tego baza)
    document.querySelector('.nav[data-p="admin"]').hidden = !st.admin;
    if (!st.admin && $('p-admin').classList.contains('on')) go('home');
    if (st.admin && window.mibAdminBadge) mibAdminBadge();
    sidebar();
    if ($('p-prof').classList.contains('on')) render();
    if ($('p-cos').classList.contains('on')) renderCos();
    if ($('p-ideas').classList.contains('on')) renderIdeas();
    if ($('p-friends').classList.contains('on')) renderFriends();
    friendsBadge();
    giftsCheck(!!st.loggedIn); ideasBadge();
    if (st.loggedIn) mib.call('prof:warnings').then(showWarnings);
    if (st.loggedIn && !was) { achievementsCheck(false); mib.call('news:check'); }
    if (st.loggedIn && !was) { mibSync.pull(); if (window.mibWave) mibWave(); }
  }
  async function refresh() { apply(await mib.call('prof:state')); }
  document.querySelector('.nav[data-p="prof"]').addEventListener('click', () => { render(); refresh(); });
  document.querySelector('.nav[data-p="cos"]').addEventListener('click', renderCos);
  document.querySelector('.nav[data-p="ideas"]').addEventListener('click', renderIdeas);
  document.querySelector('.nav[data-p="friends"]').addEventListener('click', renderFriends);
  // Efekt odblokowania nowego kosmetyku
  // item: { name, type, imageUrl } albo { name, label, glyph } (np. osiągnięcie)
  window.mibUnlock = item => {
    if (document.documentElement.classList.contains('noanim')) return toast((item.label ? item.label.replace(/!$/, '') : T('Nowy przedmiot')) + ': ' + item.name);
    const old = $('unlock'); if (old) old.remove();
    const o = h('div', { id: 'unlock', role: 'dialog', 'aria-label': T('Nowy przedmiot!') }, h('div', { class: 'ring' }),
      h('div', { class: 'card2' }, h('i', {}, item.glyph || itemImage(item, 6)), h('small', {}, item.label || T('Nowy przedmiot!')), h('b', {}, item.name)));
    const close = () => { o.classList.add('bye'); setTimeout(() => o.remove(), 250); };
    o.onclick = close;
    document.body.append(o);
    setTimeout(() => { if (o.isConnected) close(); }, 2200);
  };
  window.mibProfileUI = { modsShown, refresh, get loggedIn() { return !!(st.loggedIn || st.offline); } };
  window.mibUI = { h, msg, fmtDate, capeThumb, itemImage };
  sidebar();
  render();
  refresh();
})();
