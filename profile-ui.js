// Ekrany profilu MiB i kosmetyków. Rozmawia z procesem głównym przez kanały prof:*.
(() => {
  const ERR = {
    // logowanie do profilu MiB kontem Minecraft (od 0.37.0, main.js → profile:status)
    mc_login_missing: 'Serwer MiB nie jest jeszcze gotowy do logowania kontem Minecraft. Daj znać twórcy MiB.',
    mc_login_jwt: 'Serwer MiB nie jest jeszcze gotowy do logowania kontem Minecraft. Daj znać twórcy MiB.',
    mc_login_setup: 'Serwer MiB nie jest jeszcze gotowy do logowania kontem Minecraft. Daj znać twórcy MiB.',
    not_verified: 'Mojang nie potwierdził Twojego konta Minecraft. Sprawdź, czy to konto ma kupionego Minecrafta, i spróbuj ponownie.',
    mojang_join: 'Mojang nie potwierdził Twojego konta Minecraft. Sprawdź, czy to konto ma kupionego Minecrafta, i spróbuj ponownie.',
    mojang_unavailable: 'Serwery Mojanga nie odpowiadają. Spróbuj za chwilę.',
    mc_taken: 'To konto Minecraft ma już inny profil MiB.',
    shop_missing: 'Sklep MiB Coins nie jest jeszcze dostępny.',
    coins_not_enough: 'Masz za mało MiB Coins.',
    not_for_sale: 'Tego przedmiotu nie ma już w sklepie.',
    gift_not_friend: 'Prezent możesz kupić tylko znajomemu.',
    gift_message_long: 'Wiadomość może mieć najwyżej 200 znaków.',
    friend_has_it: 'Twój znajomy ma już ten przedmiot.',
    offer_missing: 'Ta oferta już się skończyła.',
    theme_missing: 'Tego święta nie ma już w MiB.',
    theme_gift_missing: 'Ta nagroda świąteczna już się skończyła.',
    theme_gift_claimed: 'Ta nagroda świąteczna jest już odebrana.',
    advent_closed: 'Kalendarz adwentowy jest zamknięty. Otwiera się 1 grudnia.',
    advent_locked: 'To okienko otworzysz dopiero tego dnia.',
    advent_opened: 'To okienko jest już otwarte.',
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
    outfit_name_invalid: 'Nazwa zestawu: od 1 do 24 znaków.', outfit_empty: 'Najpierw załóż jakieś kosmetyki — zestaw zapisuje to, co masz na sobie.',
    outfit_limit: 'Masz już 10 zestawów. Usuń któryś albo zapisz pod istniejącą nazwą.', outfit_missing: 'Tego zestawu już nie ma.',
    pet_name_invalid: 'Imię peta: do 16 znaków, bez brzydkich słów.',
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
    party_not_friend: 'Do party zaprosisz tylko znajomych.',
    party_not_leader: 'Tylko lider party może to zrobić.',
    party_already: 'Ten gracz jest już w Twoim party albo ma od Ciebie zaproszenie.',
    party_full: 'Party jest pełne (najwyżej 8 osób razem z zaproszonymi).',
    party_invite_missing: 'To zaproszenie do party już wygasło.',
    party_none: 'Nie jesteś w party.',
    party_not_member: 'Tego gracza nie ma w Twoim party.',
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
  // Główka skina gracza (0.38.0) po nazwie konta Minecraft z mc-heads.net; bez konta Minecraft albo bez sieci — Steve
  const head = (mc, size = 28) => h('img', { class: 'head', 'data-mc': mc || '', width: size, height: size, alt: '', draggable: 'false',
    src: mc ? 'https://mc-heads.net/avatar/' + encodeURIComponent(mc) + '/' + size * 2 : FACE,
    on: { error: e => { if (e.target.dataset.fb) return; e.target.dataset.fb = '1'; e.target.src = FACE; } } });
  // główka z kropką statusu w rogu (lista znajomych, party, nagłówek rozmowy)
  const headDot = (mc, size = 32) => h('span', { class: 'hdot' }, head(mc, size), h('i', { class: 'dot', 'aria-hidden': 'true' }));
  // wiadomość od kogoś innego: główka i nick przy pierwszej z kilku pod rząd, potem samo wcięcie
  const otherMsg = (first, mc, nick, bubble) => h('div', { class: 'mrow' }, first ? head(mc, 28) : h('span', { class: 'hsp' }),
    h('div', { class: 'mcol' }, first ? h('b', { class: 'who' }, nick) : null, bubble));
  const go = page => document.querySelector(`.nav[data-p="${page}"]`).click();
  const fmtDate = d => new Date(d).toLocaleDateString(LANG === 'en' ? 'en-GB' : 'pl-PL');
  // filtr wulgaryzmów w tekstach innych graczy (Ustawienia, domyślnie włączony)
  const clean = t => (typeof S !== 'undefined' && S && S.chatFilter === false ? String(t == null ? '' : t) : MibProfile.cleanText(t));

  let st = { loading: true }, tab = 'signup', busy = false;
  let mibSt = { state: 'idle' }, otherOpen = false; // logowanie do profilu MiB kontem Minecraft (main.js), viewAuto niżej

  // ===== Dolny blok paska bocznego =====
  // bez konta Microsoft (klasa nolog z ui.js, od 0.35.0) dolny blok otwiera okno logowania
  const noAcc = () => document.documentElement.classList.contains('nolog');
  function sidebar() {
    if (!st.loggedIn && noAcc()) { $('plname').textContent = T('Zaloguj się'); $('plsub').textContent = T('Konto Microsoft'); return; }
    if (!st.loggedIn && !st.needsProfile && !st.offline && !st.loading && mibSt.state !== 'error') { $('plname').textContent = T('Profil MiB'); $('plsub').textContent = T('Logowanie…'); return; }
    $('plname').textContent = st.loggedIn ? st.nick : st.needsProfile ? T('Dokończ profil MiB') : st.offline || st.loading ? T('Profil MiB') : T('Załóż profil MiB');
    $('plsub').textContent = st.loggedIn ? st.mibId : st.needsProfile ? T('Wybierz nick') : st.loading ? T('Wczytywanie…') : st.offline ? T('Brak połączenia') : T('Kosmetyki i ustawienia');
  }
  const plGo = () => (noAcc() && !st.loggedIn && window.mibGate ? window.mibGate.open() : go('prof'));
  $('plbox').addEventListener('click', plGo);
  $('plbox').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); plGo(); } });

  // Po założeniu profilu: potwierdzenie z ID (kody odzyskiwania usunięte w 0.27.0 — profil loguje konto Microsoft)
  const created = id => toast(T('Profil MiB został pomyślnie założony. Twoje ID:') + ' ' + id);

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
        created(r.mibId);
        mib.call('profile:mc');
      });
    } } },
    field('Nick MiB', nick, '3–16 znaków: litery, cyfry, _'), field('E-mail', email), field('Hasło', pass, 'Co najmniej 8 znaków'), err, h('div', { class: 'row' }, submit));
  }
  function formLogin() {
    const email = h('input', { id: 'pl-email', type: 'email', autocomplete: 'email' }), pass = h('input', { id: 'pl-pass', type: 'password', autocomplete: 'current-password' }), err = errBox();
    const submit = h('button', { class: 'b', type: 'submit' }, T('Zaloguj się'));
    return h('form', { class: 'pform', on: { submit: async e => {
      e.preventDefault();
      await run(submit, err, () => mib.call('prof:login', { email: email.value, password: pass.value }), () => { toast(T('Zalogowano do profilu MiB.')); mib.call('profile:mc'); });
    } } },
    field('E-mail', email), field('Hasło', pass), err,
    h('div', { class: 'row' }, submit),
    h('p', { class: 'mut' }, T('Nie pamiętasz hasła? Zaloguj się kontem Microsoft — profil połączony z kontem Minecraft zaloguje się sam.')));
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
      ...[['signup', 'Załóż profil'], ['login', 'Zaloguj się']].map(([k, l]) => h('button', { class: tab === k ? 'on' : '', role: 'tab', type: 'button', on: { click: () => { tab = k; render(); } } }, T(l))));
    return [
      h('h2', {}, T('Profil MiB')),
      h('p', { class: 'lead' }, T('Profil zapisuje Twoje kosmetyki, ustawienia launchera i kopię modów. Grać możesz też bez niego.')),
      h('p', { class: 'card reward', id: 'pf-mc-hint' }, T('Najprościej: zaloguj się kontem Microsoft (u góry, „Zaloguj się”), a profil MiB założy się sam i będzie połączony z Twoim kontem Minecraft.')),
      tabs,
      tab === 'signup' ? formSignup() : formLogin(),
    ];
  }
  // Konto Microsoft jest, a profilu MiB jeszcze nie (od 0.37.0): launcher loguje do niego sam (main.js, profile:status) i
  // zakłada go, gdy go nie ma; formularze e-mail tylko pod „Masz stary profil MiB z e-mailem?” (łączenie starych profili)
  mib.call('profile:status').then(x => { if (x) { mibSt = x; if (!st.loggedIn) render(); } }).catch(() => {});
  mib.on('profile:status', x => { mibSt = x || { state: 'idle' }; if (!st.loggedIn) { render(); sidebar(); } });
  function viewAuto() {
    const other = h('details', { class: 'pf-other', id: 'pf-other', open: otherOpen, on: { toggle: e => { otherOpen = e.currentTarget.open; } } },
      h('summary', {}, T('Masz stary profil MiB z e-mailem?')), h('div', { class: 'pf-other-in' }, ...viewOut().slice(3)));
    const err = mibSt.state === 'error';
    const card = err
      ? h('div', { class: 'card pf-auto err', id: 'pf-auto', role: 'alert' }, h('b', {}, T('Nie udało się zalogować do profilu MiB')),
        h('p', { class: 'mut' }, ERR[mibSt.error] ? T(ERR[mibSt.error]) : msg(mibSt.error || 'unknown')),
        h('div', { class: 'row' }, h('button', { class: 'b', id: 'pf-retry', type: 'button', on: { click: () => { mibSt = { state: 'busy' }; render(); mib.call('profile:mc'); } } }, T('Spróbuj ponownie'))),
        mibSt.retryIn ? h('small', { class: 'mut' }, T('Launcher spróbuje też sam za chwilę.')) : null)
      : h('div', { class: 'card pf-auto', id: 'pf-auto', role: 'status' }, h('i', { class: 'spin', 'aria-hidden': 'true' }),
        h('div', {}, h('b', {}, T('Loguję do profilu MiB…')), h('p', { class: 'mut' }, T('Wystarczy konto Microsoft: profil MiB loguje się sam, a jeśli go nie masz, zakłada się sam.'))));
    return [h('h2', {}, T('Profil MiB')), card, other];
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
        await run(submit, err, () => mib.call('prof:createProfile', { nick: nick.value }), r => created(r.mibId));
      } } }, field('Nick MiB', nick, '3–16 znaków: litery, cyfry, _'), err,
      h('div', { class: 'row' }, submit)),
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
        h('button', { class: 'b ghost', id: 'pf-copy', on: { click: async () => toast(T(await copyText(st.mibId) ? 'Skopiowano' : 'Nie udało się skopiować')) } }, T('Kopiuj ID'))),
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
        h('p', { class: 'mcline', id: 'pf-mc' }, st.mcName ? T('Konto Minecraft') + ': ' + st.mcName + ' — ' + T('logujesz się nim do MiB na każdym komputerze.')
          : T('Zaloguj się w launcherze kontem Microsoft, a profil połączy się z Twoim kontem Minecraft.')),
        h('p', { class: 'mut' }, T('Profil idzie za kontem Microsoft: wylogowanie z konta Microsoft (u góry) wylogowuje też z profilu, a zmiana konta przełącza profil.')),
        h('div', { class: 'row' },
          h('button', { class: 'b danger', on: { click: () => { $('pdel-n').value = ''; $('pdel-go').disabled = true; $('pdel').classList.add('on'); $('pdel-n').focus(); } } }, T('Usuń profil')))),
    ];
  }
  function render() {
    const box = $('prof-box');
    box.replaceChildren(...(st.loading ? [h('h2', {}, T('Profil MiB')), h('p', { class: 'mut' }, T('Wczytywanie…'))] : st.loggedIn ? viewIn() : st.needsProfile ? viewComplete() : st.offline ? viewOffline() : noAcc() ? viewOut() : viewAuto()).filter(Boolean));
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

  // Peleryna 1000 graczy (0.38.0): baza daje ją od razu profilom do MIB-001000 (źródło „founder”); raz na profil efekt
  // „Nowy przedmiot” — tylko gdy dostał ją niedawno (na nowym komputerze po miesiącach już bez efektu)
  async function founderCape() {
    const key = 'mib-founder-cape-' + st.mibId;
    try { if (localStorage.getItem(key)) return; } catch { return; }
    const list = await mib.call('prof:cosmetics');
    const c = Array.isArray(list) && list.find(x => x.source === 'founder');
    if (!c) return;
    try { localStorage.setItem(key, '1'); } catch {}
    if (!(Date.now() - Date.parse(c.acquiredAt) < 7 * 864e5)) return;
    for (let i = 0; i < 60 && document.querySelector('#gate:not([hidden]), #warn, #gift, #news-pop, #wn, #fcard, #unlock, #cfm, #idea-pop, #welcome.on'); i++) await new Promise(r => setTimeout(r, 1000));
    if (window.mibUnlock) mibUnlock({ name: c.name, type: c.type, imageUrl: c.imageUrl, label: T('Jesteś jednym z pierwszych 1000 graczy!') });
    else toast(T('Nowy przedmiot') + ': ' + c.name);
  }

  // ===== Strona Kosmetyki =====
  const GLYPH ={ cape: '▚', hat: '▀', mask: '▄', wings: '▞', aura: '✺', pet: '🐾', tail: '〰', back: '▣' };
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
  // Miniatura czapki i maski: przód kostki (gdy pusty, lewy bok) z nakładką; wysoka czapka z drugą kostką nad pierwszą
  function headThumb(url, type) {
    const model = MibProfile.cosmeticModel(url);
    if (model) return modelThumb(url, model);
    const c = h('canvas', { width: 40, height: 40, class: 'headth' }), x = c.getContext('2d');
    loadImg(url).then(img => {
      const tall = type === 'hat' && MibProfile.hatModel(img.width) === 'tall', u = img.width / (tall ? 128 : 64);
      const probe = document.createElement('canvas'); probe.width = probe.height = 8;
      const px = probe.getContext('2d');
      px.drawImage(img, 8 * u, 8 * u, 8 * u, 8 * u, 0, 0, 8, 8); px.drawImage(img, 40 * u, 8 * u, 8 * u, 8 * u, 0, 0, 8, 8);
      const fx = px.getImageData(0, 0, 8, 8).data.some((v, i) => i % 4 === 3 && v > 0) ? 8 : 16;
      if (tall) c.height = 72;
      x.imageSmoothingEnabled = false;
      const box = (sx, y) => { x.drawImage(img, sx * u, 8 * u, 8 * u, 8 * u, 4, y + 4, 32, 32); x.drawImage(img, (sx + 32) * u, 8 * u, 8 * u, 8 * u, 2, y + 2, 36, 36); };
      if (tall) box(fx + 64, 0);
      box(fx, tall ? 32 : 0);
    }, () => {});
    return c;
  }
  // Do schowka: przez Electron (clip:write w main.js), a gdyby się nie dało — przez przeglądarkę
  async function copyText(t) {
    try { if (await mib.call('clip:write', String(t))) return true; } catch {}
    try { await navigator.clipboard.writeText(String(t)); return true; } catch { return false; }
  }
  // Miniatura kosmetyku z modelem 3D (MibProfile.cosmeticModel): model z boku i z góry, ściany z pierwszej klatki tekstury
  // przyciemnione jak w grze (wierzch najjaśniejszy, boki najciemniejsze)
  function modelThumb(url, model, type) {
    const c = h('canvas', { width: 128, height: 128, class: 'headth modelth' }), x = c.getContext('2d');
    loadImg(url).then(img => {
      // ogon i plecak widać od tyłu, resztę od przodu
      const faces = MibProfile.modelFaces(model, type === 'tail' || type === 'back' ? 152 : -28, 22);
      if (!faces.length) return;
      const shaded = new Map();
      const tex = shade => {
        if (!shaded.has(shade)) {
          const t = document.createElement('canvas'); t.width = model.w; t.height = model.h;
          const tx = t.getContext('2d');
          tx.drawImage(img, 0, 0, model.w, model.h, 0, 0, model.w, model.h);
          tx.globalCompositeOperation = 'source-atop'; tx.fillStyle = `rgba(0,0,0,${1 - shade})`; tx.fillRect(0, 0, model.w, model.h);
          shaded.set(shade, t);
        }
        return shaded.get(shade);
      };
      const xs = [], ys = [];
      for (const { p: [a, b, d] } of faces) for (const q of [a, b, d, [b[0] + d[0] - a[0], b[1] + d[1] - a[1]]]) { xs.push(q[0]); ys.push(q[1]); }
      const x0 = Math.min(...xs), y0 = Math.min(...ys), k = Math.min(120 / (Math.max(...xs) - x0), 120 / (Math.max(...ys) - y0));
      const ox = (128 - (Math.max(...xs) - x0) * k) / 2 - x0 * k, oy = (128 - (Math.max(...ys) - y0) * k) / 2 - y0 * k;
      x.imageSmoothingEnabled = false;
      for (const f of faces) {
        const [a, b, d] = f.p.map(q => [q[0] * k + ox, q[1] * k + oy]), [u, v, w, hh] = f.uv;
        x.setTransform((b[0] - a[0]) / w, (b[1] - a[1]) / w, (d[0] - a[0]) / hh, (d[1] - a[1]) / hh, a[0], a[1]);
        x.drawImage(tex(f.shade), u, v, w, hh, 0, 0, w, hh);
      }
      x.setTransform(1, 0, 0, 1, 0, 0);
    }, () => {});
    return c;
  }
  const itemImage = (c, k) => {
    const png = c.imageUrl && c.imageUrl.startsWith('data:image/png');
    if (png && c.type === 'cape') return capeThumb(c.imageUrl, k);
    if (png && (c.type === 'hat' || c.type === 'mask')) return headThumb(c.imageUrl, c.type);
    // pet, ogon i plecak (od 0.34.0) są tylko z modelem 3D; bez modelu znaczek rodzaju
    if (png && ['pet', 'tail', 'back'].includes(c.type)) { const m = MibProfile.cosmeticModel(c.imageUrl); return m ? modelThumb(c.imageUrl, m, c.type) : GLYPH[c.type]; }
    if (png && c.type === 'aura') return auraThumb(c.imageUrl, k);
    if (png && c.type === 'wings') return wingsThumb(c.imageUrl);
    return c.imageUrl ? h('img', { src: c.imageUrl, alt: '' }) : GLYPH[c.type] || '◆';
  };
  // Miniatury kosmetyków do menu w grze (0.40.0): te same co w Kosmetykach launchera, jako PNG 64×64. main.js prosi
  // o brakujące (thumbs:make), a gotowe zapisuje do <gra>/mib/thumbs (thumbs:save); mod rysuje je na kafelkach.
  async function thumbPng(c) {
    const url = c.imageUrl;
    if (typeof url !== 'string' || !url.startsWith('data:image/png')) return null;
    const img = await loadImg(url).catch(() => null);
    if (!img) return null;
    const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    if (c.type === 'cape') { // zewnętrzna strona peleryny (10×16 od 1,1) z pierwszej klatki, 3 razy większa
      const u = img.width / 64;
      x.drawImage(img, u, u, 10 * u, 16 * u, 17, 8, 30, 48);
      return cv.toDataURL('image/png');
    }
    const el = itemImage(c, 4);
    if (!el || !el.nodeType) return null;
    await new Promise(r => setTimeout(r, 80)); // miniatury rysują się po loadImg (obrazek jest już wczytany)
    const src = el.tagName === 'CANVAS' ? el : el.tagName === 'IMG' ? await loadImg(el.src).catch(() => null) : null;
    if (!src || !src.width || !src.height) return null;
    let k = Math.min(S / src.width, S / src.height);
    if (k >= 1) k = Math.floor(k); else x.imageSmoothingEnabled = true; // piksele bez rozmycia, duże modele pomniejszone gładko
    const w = Math.round(src.width * k), hh = Math.round(src.height * k);
    x.drawImage(src, Math.floor((S - w) / 2), Math.floor((S - hh) / 2), w, hh);
    return cv.toDataURL('image/png');
  }
  mib.on('thumbs:make', async list => {
    for (const t of Array.isArray(list) ? list : []) {
      const data = await thumbPng(t).catch(() => null);
      if (data) await mib.call('thumbs:save', { name: t.name, data });
    }
    mib.call('thumbs:done');
  });
  // ===== Skin konta Minecraft (na górze strony Kosmetyki; wystarczy konto Microsoft) =====
  // Jedna postać na całe Kosmetyki (mib3d w ui.js: rysuje się tylko na widocznej stronie). Od 0.47.3 przerysowanie strony
  // (filtr, zakładka, zakup) nie wczytuje drugi raz tego samego skina i stroju, a bez kontekstu WebGL postać powstaje
  // od nowa na nowym płótnie w tym samym miejscu, z tym samym skinem i strojem.
  let skinViewer = null, skinNow = null, lastDress = [];
  const newSkinCanvas = () => h('canvas', { width: 200, height: 260, class: 'skin3d', id: 'skin3d' });
  let skinCanvas = newSkinCanvas();
  function cosViewer() {
    if (skinViewer) return skinViewer;
    try {
      skinViewer = mib3d.view({ canvas: skinCanvas, width: 200, height: 260 }, () => {
        const c = newSkinCanvas(), was = skinNow;
        skinCanvas.replaceWith(c); skinCanvas = c;
        mib3d.drop(skinViewer); skinViewer = null; skinNow = null;
        cosViewer();
        if (was) showSkin(was.url, was.model);
        dressPage(lastDress);
      });
      skinViewer.autoRotate = true; skinViewer.autoRotateSpeed = 0.7;
    } catch {}
    return skinViewer;
  }
  // url null = Steve
  async function showSkin(url, model) {
    const v = cosViewer(), m = model === 'slim' ? 'slim' : 'default';
    if (!v || (skinNow && skinNow.url === url && skinNow.model === m)) return;
    skinNow = { url, model: m };
    try { await v.loadSkin(url || await mib.call('skin', 'MHF_Steve'), { model: m }); } catch { skinNow = null; }
  }
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
    cosViewer();
    // bez konta Microsoft: postać Steve (na niej też da się przymierzać kosmetyki), bez zmiany skina
    if (cur.error === 'skin_no_account') {
      showSkin(null, 'classic');
      sec.append(h('div', { class: 'skinside' }, h('p', { class: 'mut' }, msg('skin_no_account'))));
      return sec;
    }
    let picked = null;
    const variant = h('select', { id: 'skin-var' }, h('option', { value: 'classic' }, T('Klasyczny (szersze ręce)')), h('option', { value: 'slim' }, T('Smukły (węższe ręce)')));
    variant.value = cur.variant || 'classic';
    const show = showSkin;
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
      if (!(await window.mibConfirm(T('Wrócić do domyślnego skina Minecrafta?')))) return;
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
    // chwilowy błąd Mojanga (np. limit zapytań): zostaje skin, który już widać, zamiast Steve'a
    if (!cur.error || !skinNow) show(cur.dataUrl, variant.value);
    loadHist();
    sec.append(h('div', { class: 'skinside' },
      h('p', { class: 'mut' }, T('Skin Twojego konta Minecraft. Widzą go wszyscy gracze, na każdym serwerze.')),
      h('label', { class: 'sr' }, h('span', {}, T('Model postaci')), variant),
      h('div', { class: 'row' }, pick, setBtn, reset), err, hist));
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
    const t = viewer.skinTexture || viewer.capeTexture;
    return t ? t.constructor : null;
  }
  function newTex(viewer, Tex, canvas) {
    const t = new Tex(canvas);
    t.magFilter = t.minFilter = 1003;
    if (viewer.skinTexture) t.colorSpace = viewer.skinTexture.colorSpace;
    return t;
  }
  // cape, wings, hat: tekstury albo null; aura: { texture, id } albo null. Skrzydła jak elytra zastępują pelerynę,
  // skrzydła wróżki są razem z nią. Zwraca, co widać.
  async function dress(viewer, { cape = null, wings = null, hat = null, mask = null, aura = null, pet = null, tail = null, back = null, petMode = 'fly', petSide = 'left' } = {}) {
    const st = dressed.get(viewer) || {};
    dressed.set(viewer, st);
    // ten sam strój na postaci, która jest na stronie (od 0.47.3): bez zdejmowania i zakładania wszystkiego od nowa
    const key = JSON.stringify([cape, wings, hat, mask, aura && aura.texture, aura && aura.id, pet, tail, back, petMode, petSide]);
    if (st.key === key && st.last && viewer.canvas && viewer.canvas.isConnected) {
      if (st.wings || st.aura || moving(st)) animate(viewer, st);
      return st.last;
    }
    st.key = key; st.last = null;
    const my = st.gen = (st.gen || 0) + 1;
    const load = u => (u ? frames(u).catch(() => null) : null);
    const [cf, wf, hf, mf, af, pf, tf, kf] = await Promise.all([load(cape), load(wings), load(hat), load(mask), load(aura && aura.texture), load(pet), load(tail), load(back)]);
    const hm = hf && MibProfile.cosmeticModel(hat), mm = mf && MibProfile.cosmeticModel(mask);
    // pet, ogon i plecak (od 0.34.0) są tylko z modelem 3D w teksturze; bez modelu nic nie widać
    const pm = pf && MibProfile.cosmeticModel(pet), tm = tf && MibProfile.cosmeticModel(tail), km = kf && MibProfile.cosmeticModel(back);
    if (st.gen !== my) return null;
    clearInterval(st.timer); st.timer = null;
    const fairy = wf && MibProfile.wingsModel(wf[0].width) === 'fairy' ? wf : null;
    const bf = cf || (wf && !fairy ? wf : null), kind = cf ? 'cape' : bf ? 'elytra' : '';
    try { if (bf) viewer.loadCape(bf[0], { backEquipment: kind }); else viewer.resetCape(); } catch {}
    await putHead(viewer, st, 'hat', hf, my, hm);
    if (st.gen !== my) return null;
    await putHead(viewer, st, 'mask', mf, my, mm);
    if (st.gen !== my) return null;
    for (const [slot, f, m] of [['tail', tf, tm], ['back', kf, km], ['pet', pf, pm]]) {
      await putHead(viewer, st, slot, m ? f : null, my, m, slot === 'pet' ? { mode: petMode, side: petSide } : null);
      if (st.gen !== my) return null;
    }
    // peleryna przy plecaku wisi dalej od pleców, za plecakiem (w grze tak samo: CapeLayerMixin)
    const capeObj = viewer.playerObject && viewer.playerObject.cape;
    if (capeObj) { if (st.capeZ0 == null) st.capeZ0 = capeObj.position.z; capeObj.position.z = st.capeZ0 - (st.back ? 4 : 0); }
    // wysoka czapka wystaje nad głowę: kamera trochę dalej i postać niżej, żeby zmieściła się w podglądzie
    if (st.zoom0 == null) st.zoom0 = viewer.zoom;
    const tall = !!(st.hat && (st.hat.model ? st.hat.top < -13 : st.hat.parts.length > 1)), taller = tall && st.hat.model && st.hat.top < -18;
    viewer.zoom = st.zoom0 * (taller ? 0.76 : tall ? 0.84 : 1) * (st.pet && st.pet.pet.mode !== 'shoulder' ? 0.9 : 1);
    if (viewer.playerWrapper) viewer.playerWrapper.position.y = taller ? -5 : tall ? -3 : 0;
    await putWings(viewer, st, fairy, my);
    if (st.gen !== my) return null;
    const style = af && MibProfile.auraStyle(aura.id);
    await putAura(viewer, st, style ? af : null, style, my);
    if (st.gen !== my) return null;
    const n = Math.max(bf ? bf.length : 1, hf ? hf.length : 1, mf ? mf.length : 1, fairy ? fairy.length : 1, ...[pf, tf, kf].map(f => (f ? f.length : 1)));
    if (n > 1) {
      let i = 0;
      st.timer = setInterval(() => {
        if (!viewer.canvas || !viewer.canvas.isConnected) { clearInterval(st.timer); st.timer = null; return; }
        i++;
        if (bf && bf.length > 1 && viewer.capeTexture) draw(viewer.capeCanvas, bf[i % bf.length], 0, viewer.capeTexture);
        for (const [slot, f] of [['hat', hf], ['mask', mf], ['pet', pf], ['tail', tf], ['back', kf]]) if (f && f.length > 1 && st[slot]) for (const p of st[slot].parts) paint(p, f[i % f.length]);
        if (fairy && fairy.length > 1 && st.wingTex) draw(st.wingCanvas, fairy[i % fairy.length], 0, st.wingTex);
      }, MibProfile.CAPE_FRAME_MS);
    }
    if (st.wings || st.aura || moving(st)) animate(viewer, st);
    return (st.last = { back: kind, fairy: !!st.wings, hat: st.hat ? (st.hat.model ? 'model' : st.hat.parts.length > 1 ? 'tall' : '1') : '', mask: !!st.mask, aura: st.aura ? style : '', frames: n,
      pet: st.pet ? st.pet.pet.mode : '', tail: !!st.tail, pack: !!st.back });
  }
  function draw(canvas, frame, y, tex) {
    const x = canvas.getContext('2d');
    x.clearRect(0, y, canvas.width, frame.height * canvas.width / frame.width);
    x.drawImage(frame, 0, y, canvas.width, frame.height * canvas.width / frame.width);
    tex.needsUpdate = true;
  }
  // Czapka i maska: kopia głowy postaci powiększona jak hełm (czapka 10 i 11 pikseli zamiast 8, maska 9,2 i 10,2 — pod czapką)
  // z teksturą w górnej połowie płótna 64×64, tak jak leżą głowa i nakładka na skinie. Wysoka czapka (tekstura szeroka
  // na 128 px, MibProfile.hatModel) ma drugą taką kostkę 10 pikseli wyżej z prawej połowy tekstury (w grze tak samo: HatLayer).
  async function putHead(viewer, st, slot, hf, my, model, pet) {
    const head = viewer.playerObject && viewer.playerObject.skin && viewer.playerObject.skin.head;
    if (st[slot]) {
      if (st[slot].group && st[slot].group.parent) st[slot].group.parent.remove(st[slot].group);
      for (const m of st[slot].meshes) { if (m.parent) m.parent.remove(m); if (st[slot].model) m.geometry.dispose(); else m.material.dispose(); }
      if (st[slot].model) st[slot].mat.dispose();
      for (const p of st[slot].parts) p.tex.dispose();
      st[slot] = null;
    }
    if (!hf || !head || !head.innerLayer || !head.outerLayer) return;
    const Tex = await texClass(viewer, st, my);
    if (!Tex || st.gen !== my) return;
    if (model) { putModel(viewer, st, slot, hf, model, Tex, pet); return; }
    if (slot !== 'hat' && slot !== 'mask') return;
    const tall = slot === 'hat' && MibProfile.hatModel(hf[0].width) === 'tall', k = hf[0].width / (tall ? 128 : 64);
    const sizes = slot === 'mask' ? [9.2, 10.2] : [10, 11];
    const parts = (tall ? [0, 64] : [0]).map(sx => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64 * k;
      const p = { cv, sx: sx * k, lift: sx ? 10 : 0, tex: newTex(viewer, Tex, cv) };
      paint(p, hf[0]);
      return p;
    });
    const meshes = parts.flatMap(p => [[head.innerLayer, sizes[0]], [head.outerLayer, sizes[1]]].map(([src, size]) => {
      const m = src.clone();
      m.material = head.outerLayer.material.clone();
      m.material.map = p.tex;
      const w = (src.geometry && src.geometry.parameters && src.geometry.parameters.width) || 8;
      m.scale.multiplyScalar(size / w);
      m.position.y += p.lift;
      head.add(m);
      return m;
    }));
    st[slot] = { parts, meshes };
  }
  // Kosmetyk z modelem 3D (MibProfile.cosmeticModel): każdy prostopadłościan to osobna siatka na głowie albo tułowiu postaci,
  // w układzie skinview3d (y w górę, przód w stronę +z: y i z z odwrotnym znakiem, obroty wokół y i z też). Tułów skinview3d
  // ma środek 6 pikseli pod szyją, a w grze środek tułowia jest na szyi. Pet (od 0.34.0) to grupa w miejscu z petAnchor
  // (tryb i strona z ustawień gracza), a części z ruchem (kręcenie, kołysanie, łapki, sen) ustawia animate. Tak samo w grze:
  // HatLayer.ModelHat i PetLayer.
  function putModel(viewer, st, slot, hf, model, Tex, pet) {
    const skin = viewer.playerObject.skin, src = skin.head.innerLayer, Box = src.geometry.constructor, Mesh = src.constructor;
    const cv = document.createElement('canvas');
    cv.width = model.w; cv.height = model.h;
    const p = { cv, sx: 0, lift: 0, tex: newTex(viewer, Tex, cv) };
    paint(p, hf[0]);
    const mat = skin.head.outerLayer.material.clone();
    mat.map = p.tex; mat.transparent = false; mat.alphaTest = 0.5;
    const meshes = [], movers = [];
    let group = null, top = 0;
    if (pet) {
      group = new Mesh();
      const a = MibProfile.petAnchor(pet.mode, pet.side, 0, false);
      (a.bone === 'body' ? skin.body : skin).add(group);
      group.scale.setScalar(a.scale);
      group.position.set(a.pos[0], -a.pos[1] + (a.bone === 'body' ? 6 : 0), -a.pos[2]);
    }
    for (const part of model.parts) for (const [u, v, x, y, z, w, h, d, inf] of part.boxes) {
      const g = new Box(w + 2 * inf, h + 2 * inf, d + 2 * inf);
      g.translate(x + w / 2, -(y + h / 2), -(z + d / 2));
      g.attributes.uv.array.set(MibProfile.boxUVs(u, v, w, h, d, model.w, model.h));
      g.attributes.uv.needsUpdate = true;
      const m = new Mesh(g, mat), onBody = !pet && part.bone === 'body';
      m.position.set(part.pivot[0], -part.pivot[1] + (onBody ? 6 : 0), -part.pivot[2]);
      setRot(m, part.rot);
      (group || (onBody ? skin.body : skin.head)).add(m);
      meshes.push(m);
      if (part.spin || part.wave || part.step || part.sit || part.state) movers.push([m, part, m.position.y]);
      if (part.state === 'sleep') m.visible = false;
      if (part.bone === 'head') top = Math.min(top, part.pivot[1] + y - inf);
    }
    st[slot] = { parts: [p], meshes, movers, model: true, mat, top, group, pet };
  }
  const setRot = (m, r) => m.rotation.set(r[0] * Math.PI / 180, -r[1] * Math.PI / 180, -r[2] * Math.PI / 180, 'ZYX');
  const MODEL_SLOTS = ['hat', 'mask', 'tail', 'back', 'pet'];
  const moving = st => MODEL_SLOTS.some(k => st[k] && (st[k].group || (st[k].movers && st[k].movers.length)));
  // Część tekstury czapki (od sx, 64×32 w skali tekstury) w górnej połowie płótna części
  function paint(p, frame) {
    const x = p.cv.getContext('2d'), w = p.cv.width;
    x.clearRect(0, 0, w, w / 2);
    x.drawImage(frame, p.sx, 0, w, w / 2, 0, 0, w, w / 2);
    p.tex.needsUpdate = true;
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
      if (!viewer.canvas || !viewer.canvas.isConnected || !(st.wings || st.aura || moving(st))) return;
      // części z ruchem (śmigło, kołysanie, łapki, oczy) i miejsce peta — MibProfile.partPose/petAnchor, w grze tak samo (Pets)
      const t = reduceMotion.matches ? 0 : (now / 1000) % 3600;
      for (const slot of MODEL_SLOTS) {
        const o = st[slot];
        if (!o || !o.model) continue;
        const walking = o.pet && o.pet.mode === 'walk', ctx = { t, walk: walking && !reduceMotion.matches ? 0.5 : 0, phase: t * 2 * Math.PI * 1.2 };
        if (o.group) {
          const a = MibProfile.petAnchor(o.pet.mode, o.pet.side, t, false);
          o.group.position.set(a.pos[0], -a.pos[1] + (a.bone === 'body' ? 6 : 0), -a.pos[2]);
        }
        for (const [m, part, y0] of o.movers) {
          const ps = MibProfile.partPose(part, ctx);
          setRot(m, ps.rot);
          m.position.y = y0 - ps.dy;
          m.visible = ps.visible;
        }
      }
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
    for (const c of list) if (c && c.texture && ['cape', 'wings', 'hat', 'mask', 'aura', 'pet', 'tail', 'back'].includes(c.type) && !o[c.type]) o[c.type] = c.type === 'aura' ? { texture: c.texture, id: c.id } : c.texture;
    return o;
  }
  window.mibOutfit = outfit;

  // Strona Kosmetyki: na postaci założone przedmioty, a klik w przedmiot to przymiarka (bez zakładania).
  // data-back, data-hat (1 albo tall) i data-mask na płótnie mówią, co widać.
  let trying = {};
  // ustawienia peta gracza (tryb, strona, imię) — z bazy przy wejściu na Kosmetyki
  let petCfg = { mode: 'fly', side: 'left', name: '' };
  let lastItems = [];
  // Zestawy kosmetyków (od 0.47.3): założone przedmioty zapisane pod nazwą, zakładane jednym kliknięciem (też w grze)
  let outfitList = [];
  function outfitsCard() {
    // własna klasa błędu: karta jest w lewej kolumnie, przed polem kodu z jego .err
    const err = h('p', { class: 'of-err', role: 'alert' }), name = h('input', { id: 'of-name', maxlength: 24, placeholder: T('Nazwa zestawu') });
    const save = h('button', { class: 'b ghost', type: 'button', id: 'of-save', on: { click: async () => {
      err.textContent = '';
      const r = await mib.call('prof:outfitSave', { name: name.value });
      if (!r || r.error) { err.textContent = msg((r && r.error) || 'unknown'); return; }
      toast(T('Zestaw zapisany.'));
      renderCos();
    } } }, T('Zapisz założone'));
    name.onkeydown = e => { if (e.key === 'Enter') save.click(); };
    const chip = o => h('div', { class: 'of-chip', 'data-id': o.id },
      h('button', { class: 'of-wear', type: 'button', title: o.missing ? T('Brakuje przedmiotów') + ': ' + o.missing : T('Załóż zestaw'), on: { click: async () => {
        const r = await mib.call('prof:outfitWear', { id: o.id });
        if (!r || r.error) return toast(msg((r && r.error) || 'unknown'), 1);
        toast(T('Założono zestaw') + ' „' + o.name + '”. ' + T('Widać to w grze.'));
        trying = {};
        renderCos();
      } } }, o.name, o.missing ? h('small', { class: 'mut' }, ' −' + o.missing) : null),
      h('button', { class: 'of-x', type: 'button', title: T('Usuń zestaw'), 'aria-label': T('Usuń zestaw') + ' ' + o.name, on: { click: async () => {
        if (!(await window.mibConfirm(T('Usunąć zestaw') + ' „' + o.name + '”?', { danger: true, ok: T('Usuń') }))) return;
        const r = await mib.call('prof:outfitDelete', { id: o.id });
        if (r && r.error) return toast(msg(r.error), 1);
        renderCos();
      } } }, '×'));
    return h('div', { class: 'card outfits', id: 'cos-outfits' }, h('h4', {}, T('Zestawy')),
      outfitList.length ? h('div', { class: 'of-list' }, ...outfitList.map(chip))
        : h('p', { class: 'mut' }, T('Załóż kosmetyki i zapisz je jako zestaw — potem zmienisz cały strój jednym kliknięciem, też w grze.')),
      outfitList.length < 10 ? h('div', { class: 'row of-new' }, name, save) : h('small', { class: 'mut' }, T('Najwyżej 10 zestawów — nowy zapiszesz pod nazwą istniejącego.')), err);
  }
  async function dressPage(list) {
    lastDress = list;
    if (!skinViewer) return;
    const on = t => trying[t] || list.find(c => c.equipped && c.type === t && c.texture);
    const tried = trying.wings && !trying.cape ? 'wings' : null;
    const r = await dress(skinViewer, { ...outfit([tried ? null : on('cape'), on('wings'), on('hat'), on('mask'), on('aura'), on('pet'), on('tail'), on('back')]),
      petMode: petCfg.mode, petSide: petCfg.side });
    if (r) Object.assign(skinCanvas.dataset, { back: r.back, hat: r.hat, mask: r.mask ? '1' : '', fairy: r.fairy ? '1' : '', aura: r.aura, frames: r.frames,
      pet: r.pet, tail: r.tail ? '1' : '', pack: r.pack ? '1' : '' });
  }

  // Kosmetyki mają zakładki: Moje przedmioty, Sklep (od 0.24.0, za MiB Coins), Historia coinsów i Skin (od 0.32.0);
  // z lewej postać 3D z obracaniem i założone przedmioty, nad siatką filtr rodzajów
  let cosTab = 'mine', cosKind = 'all';
  const KINDS = [['all', 'Wszystko'], ['cape', 'Peleryny'], ['hat', 'Czapki'], ['mask', 'Maski'], ['wings', 'Skrzydła'], ['aura', 'Aury'], ['pet', 'Pety'], ['tail', 'Ogony'], ['back', 'Plecaki']];
  const ofKind = c => cosKind === 'all' || c.type === cosKind;
  // Pasek rodzajów (od 0.35.0): jedna linia kafelków z pikselową ikoną, nazwą i liczbą przedmiotów (moich albo w sklepie).
  // Ikony z prostokątów na siatce 12×12 (1 = 2 px), w stylu pixelarticons z menu, zawsze 24 px.
  const KIND_ICON = {
    all: [[1, 1, 4, 4], [7, 1, 4, 4], [1, 7, 4, 4], [7, 7, 4, 4]],
    cape: [[2, 1, 8, 1], [2, 2, 1, 8], [9, 2, 1, 8], [3, 10, 2, 1], [7, 10, 2, 1], [5, 9, 2, 1], [4, 3, 4, 1]],
    hat: [[3, 2, 6, 1], [3, 3, 1, 5], [8, 3, 1, 5], [4, 6, 4, 1], [1, 8, 10, 1], [2, 9, 8, 1]],
    mask: [[1, 4, 10, 1], [1, 5, 2, 2], [5, 5, 2, 2], [9, 5, 2, 2], [1, 7, 4, 1], [7, 7, 4, 1], [2, 8, 2, 1], [8, 8, 2, 1]],
    wings: [[1, 2, 1, 7], [2, 3, 1, 6], [3, 4, 1, 5], [4, 5, 1, 3], [10, 2, 1, 7], [9, 3, 1, 6], [8, 4, 1, 5], [7, 5, 1, 3], [5, 6, 2, 1]],
    aura: [[5, 1, 2, 3], [5, 8, 2, 3], [1, 5, 3, 2], [8, 5, 3, 2], [5, 5, 2, 2], [2, 2, 1, 1], [9, 2, 1, 1], [2, 9, 1, 1], [9, 9, 1, 1]],
    pet: [[1, 4, 2, 2], [4, 1, 2, 2], [7, 1, 2, 2], [10, 4, 1, 2], [4, 6, 4, 1], [3, 7, 6, 2], [4, 9, 4, 1]],
    tail: [[1, 9, 4, 1], [5, 8, 2, 1], [7, 6, 1, 2], [8, 3, 1, 3], [7, 2, 1, 1], [5, 1, 2, 1], [9, 4, 2, 1]],
    // party (0.38.0): dwie osoby, jak ikona „users” w menu gry
    party: [[2, 1, 4, 1], [7, 1, 3, 1], [1, 2, 2, 3], [5, 2, 2, 3], [9, 2, 2, 3], [2, 5, 4, 1], [7, 5, 3, 1], [2, 7, 4, 1], [8, 7, 2, 1], [1, 8, 1, 1], [6, 8, 1, 1], [10, 8, 1, 1], [0, 9, 1, 2], [7, 9, 1, 2], [11, 9, 1, 2]],
    back: [[4, 1, 4, 1], [3, 2, 1, 1], [8, 2, 1, 1], [2, 3, 8, 1], [2, 4, 1, 7], [9, 4, 1, 7], [3, 10, 6, 1], [4, 6, 4, 1], [4, 7, 1, 2], [7, 7, 1, 2]],
  };
  const kindIcon = k => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '24'); s.setAttribute('height', '24'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<path fill="currentColor" d="' + KIND_ICON[k].map(([x, y, w, hh]) => `M${x * 2} ${y * 2}h${w * 2}v${hh * 2}h-${w * 2}z`).join('') + '"/>';
    return s;
  };
  let kindSrc = []; // przedmioty, z których liczymy liczby przy rodzajach (moje albo sklep)
  function kindChips() {
    const n = k => (k === 'all' ? kindSrc.length : kindSrc.filter(c => c.type === k).length);
    return h('div', { class: 'kinds', id: 'cos-kinds', role: 'group', 'aria-label': T('Rodzaj') }, ...KINDS.map(([k, l]) => {
      const c = n(k);
      return h('button', { type: 'button', class: 'kind' + (cosKind === k ? ' on' : '') + (c ? '' : ' none'), 'data-k': k, title: T(l) + ': ' + c,
        'aria-pressed': String(cosKind === k), on: { click: () => { if (cosKind !== k) { cosKind = k; renderCos(); } } } },
      h('span', { class: 'ki' }, kindIcon(k), h('span', { class: 'kn' }, String(c))), h('span', { class: 'kl' }, T(l)));
    }));
  }
  function cosLeft(items) {
    const spin = d => { if (!skinViewer) return; skinViewer.autoRotate = false; skinViewer.playerObject.rotation.y += d; };
    const rb = (txt, title, fn) => h('button', { class: 'b ghost', type: 'button', title: T(title), 'aria-label': T(title), on: { click: fn } }, txt);
    const slot = (t, l) => {
      const c = items.find(x => x.equipped && x.type === t);
      return h('div', { class: 'slot' + (c ? ' on' : ''), 'data-slot': t }, h('i', { 'aria-hidden': 'true' }, c ? itemImage(c, 2) : KIND_ICON[t] ? kindIcon(t) : GLYPH[t] || '◆'),
        h('b', {}, T(l)), h('small', { class: 'mut' }, c ? c.name : T('Brak')));
    };
    return h('aside', { class: 'cosl' },
      h('div', { class: 'card cosprev' }, skinCanvas, h('b', { class: 'cosnick' }, st.nick || $('nick').textContent), h('small', { class: 'mut' }, T('Podgląd wyposażenia')),
        h('div', { class: 'row cosrot' }, rb('‹', 'Obróć w lewo', () => spin(-0.6)),
          rb('⟳', 'Obracaj samo', () => { if (!skinViewer) return; skinViewer.playerObject.rotation.y = 0; skinViewer.autoRotate = true; }), rb('›', 'Obróć w prawo', () => spin(0.6)))),
      st.loggedIn ? h('div', { class: 'card cosworn' }, h('h4', {}, T('Założone')), h('div', { class: 'slots' },
        slot('cape', 'Peleryna'), slot('hat', 'Czapka'), slot('mask', 'Maska'), slot('wings', 'Skrzydła'), slot('aura', 'Aura'),
        slot('pet', 'Pet'), slot('tail', 'Ogon'), slot('back', 'Plecak'))) : null,
      st.loggedIn ? outfitsCard() : null,
      st.loggedIn && items.some(x => x.equipped && x.type === 'pet') ? petPanel(items) : null);
  }
  // Ustawienia założonego peta (od 0.34.0): jak się zachowuje (lata, na ramieniu, chodzi), po której stronie i jak ma na imię.
  // Inni gracze MiB widzą go tak samo; tryb i stronę można też zmienić w menu Kosmetyki w grze.
  function petPanel() {
    const err = errBox();
    const save = async cfg => {
      err.textContent = '';
      const r = await mib.call('prof:setPet', cfg);
      if (!r || r.error) { err.textContent = msg((r && r.error) || 'unknown'); return false; }
      petCfg = r;
      dressPage(lastItems);
      return true;
    };
    const seg = (key, opts) => h('div', { class: 'seg petseg', role: 'group', 'data-k': key }, ...opts.map(([v, l]) => h('button', {
      type: 'button', class: petCfg[key] === v ? 'on' : '', 'data-v': v, 'aria-pressed': String(petCfg[key] === v),
      on: { click: async e => {
        const group = e.currentTarget.parentNode; // po await currentTarget jest już pusty
        if (await save({ ...petCfg, [key]: v })) group.querySelectorAll('button').forEach(b => { const on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      } } }, T(l))));
    const name = h('input', { id: 'pet-name', maxlength: 16, placeholder: T('Imię peta'), value: petCfg.name || '' });
    const ok = h('button', { class: 'b ghost', type: 'button', id: 'pet-name-save', on: { click: async () => { if (await save({ ...petCfg, name: name.value })) toast(T('Imię peta zapisane.')); } } }, T('Zapisz'));
    name.onkeydown = e => { if (e.key === 'Enter') ok.click(); };
    return h('div', { class: 'card petcfg', id: 'pet-cfg' }, h('h4', {}, T('Twój pet')),
      seg('mode', [['fly', 'Lata'], ['shoulder', 'Na ramieniu'], ['walk', 'Chodzi']]),
      seg('side', [['left', 'Lewa strona'], ['right', 'Prawa strona']]),
      h('div', { class: 'row petname' }, name, ok), err);
  }
  const cosTitle = () => cosTab === 'shop' ? h('div', { class: 'ptitle' }, h('h1', {}, T('Sklep')), h('p', { class: 'lead' }, T('Kosmetyki za MiB Coins. Kliknij, żeby przymierzyć.')))
    : h('div', { class: 'ptitle' }, h('h1', {}, T('Twój styl.')), h('p', { class: 'lead' }, T('Twoja postać. Twoje kosmetyki.')));
  // zaznaczona pozycja paska bocznego idzie za zakładką: Sklep albo Kosmetyki
  function cosNav() {
    if (!$('p-cos').classList.contains('on')) return;
    document.querySelectorAll('#side .nav[data-p="cos"]').forEach(x => x.classList.toggle('act', (x.dataset.tab === 'shop') === (cosTab === 'shop')));
    const a = document.querySelector('#side .nav.act span'), c = $('crumb-p');
    if (a && c) c.textContent = a.textContent;
  }
  async function renderCos() {
    const box = $('cos-box');
    cosNav();
    if (st.loading) return box.replaceChildren(h('h2', {}, T('Kosmetyki')), h('p', { class: 'mut' }, T('Wczytywanie…')));
    const skin = await skinSection();
    if (!st.loggedIn) return renderBrowse(skin);
    const [list, pc, ofs] = await Promise.all([mib.call('prof:cosmetics'), mib.call('prof:pet'), mib.call('prof:outfits')]);
    outfitList = Array.isArray(ofs) ? ofs : [];
    const items = Array.isArray(list) ? list : [];
    if (pc && !pc.error) petCfg = pc;
    lastItems = items;
    const tabs = h('div', { class: 'seg', role: 'tablist', id: 'cos-tabs' }, ...[['mine', 'Moje przedmioty'], ['shop', 'Sklep'], ['log', 'Historia'], ['skin', 'Skin']].map(([k, l]) =>
      h('button', { class: cosTab === k ? 'on' : '', role: 'tab', type: 'button', 'data-t': k, 'aria-selected': String(cosTab === k), on: { click: () => {
        if (cosTab === k) return;
        cosTab = k; trying = {};
        renderCos();
      } } }, T(l))));
    const body = cosTab === 'shop' ? await shopView(items) : cosTab === 'log' ? await logView() : cosTab === 'skin' ? (dressPage(items), [skin]) : mineView(list, items);
    const wallet = walletCard();
    const gift = giftCount ? h('div', { class: 'card reward gift-banner', id: 'cos-gift' }, h('b', {}, T('Masz prezent do odebrania!')),
      h('button', { class: 'b', type: 'button', on: { click: () => giftsCheck(true) } }, T('Odbierz'))) : null;
    const chips = cosTab === 'mine' || cosTab === 'shop' ? kindChips() : null;
    // bez prezentu gift to null: replaceChildren wstawiłby napis „null”
    box.replaceChildren(h('div', { class: 'cosw' }, cosLeft(items), h('div', { class: 'cosr' },
      ...[cosTitle(), wallet, gift, h('div', { class: 'sec' }, tabs, chips, ...body.filter(Boolean))].filter(Boolean))));
  }
  // Bez profilu MiB (od 0.35.0; bez konta Microsoft to jedyny sposób): Sklep do oglądania i przymierzania na postaci,
  // kupowanie i zakładanie po zalogowaniu. Katalog z prof:catalog (to, co jest dziś na sprzedaż), pamiętany do następnej próby.
  let browseList = null;
  async function renderBrowse(skin) {
    const box = $('cos-box'), noAcc = document.documentElement.classList.contains('nolog');
    if (!Array.isArray(browseList)) browseList = await mib.call('prof:catalog');
    const ok = Array.isArray(browseList), err = ok ? null : (browseList && browseList.error) || 'offline', list = ok ? browseList.map(c => ({ ...c, imageUrl: c.texture })) : [];
    if (!ok) browseList = null;
    kindSrc = list;
    for (const t of Object.keys(trying)) if (!list.some(c => c.id === trying[t].id)) delete trying[t];
    dressPage([]);
    const go2 = () => (noAcc ? window.mibGate && window.mibGate.open() : (tab = 'signup', go('prof')));
    const cta = h('div', { class: 'card browse-cta', id: 'cos-cta' },
      h('div', {}, h('b', {}, T(noAcc ? 'Zaloguj się, żeby zbierać kosmetyki' : st.offline ? 'Brak połączenia z serwerem MiB' : 'Załóż profil MiB, żeby zbierać kosmetyki')),
        h('p', { class: 'mut' }, T(st.offline && !noAcc ? 'Kosmetyki pokażą się, gdy połączenie wróci. Sklep możesz dalej oglądać.' : 'Możesz oglądać Sklep i przymierzać przedmioty na postaci. Kupowanie i zakładanie po zalogowaniu.'))),
      st.offline && !noAcc ? null : h('button', { class: 'b', type: 'button', on: { click: go2 } }, T(noAcc ? 'Zaloguj się' : st.needsProfile ? 'Dokończ profil MiB' : 'Załóż profil MiB')));
    const shown = list.filter(ofKind);
    const card = c => h('div', { class: 'cosi shopi' + (trying[c.type] && trying[c.type].id === c.id ? ' try' : ''), 'data-id': c.id, title: T('Kliknij, żeby przymierzyć'),
      on: { click: () => tryToggle(c, []) } },
    h('i', { 'aria-hidden': 'true' }, itemImage(c, 5)), h('b', {}, c.name), h('small', { class: 'mut' }, T(KIND[c.type] || 'Kosmetyk')), price(c.price));
    const grid = !ok ? h('p', { class: 'empty' }, msg(err))
      : !list.length ? h('p', { class: 'empty' }, T('W Sklepie nie ma teraz przedmiotów.'))
      : !shown.length ? h('p', { class: 'empty' }, T('Brak przedmiotów tego rodzaju w Sklepie.'))
      : h('div', { class: 'cos-grid' }, ...shown.map(card));
    box.replaceChildren(h('div', { class: 'cosw' }, cosLeft([]), h('div', { class: 'cosr' }, cosTitle(), cta,
      h('div', { class: 'sec' }, h('h3', {}, T('Sklep')), kindChips(), grid), noAcc ? null : skin)));
  }
  // Przymiarka: klik w przedmiot zakłada go na postać na górze strony (bez zakładania w grze); drugi klik zdejmuje
  function tryToggle(c, owned) {
    if (!c.texture || c.equipped) return;
    trying[c.type] = trying[c.type] && trying[c.type].id === c.id ? null : c;
    if (!trying[c.type]) delete trying[c.type];
    for (const el of document.querySelectorAll('#cos-box [data-id]')) el.classList.toggle('try', Object.values(trying).some(t => t.id === el.dataset.id));
    dressPage(owned);
  }
  function mineView(list, items) {
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
    // przymiarka tylko przedmiotów, które gracz dalej ma i które nie są już założone
    for (const t of Object.keys(trying)) { const x = trying[t] && items.find(c => c.id === trying[t].id); if (!x || x.equipped) delete trying[t]; }
    dressPage(items);
    kindSrc = Array.isArray(list) ? list : [];
    const shown = Array.isArray(list) ? list.filter(ofKind) : [];
    const grid = Array.isArray(list) && list.length && !shown.length ? h('p', { class: 'empty' }, T('Nie masz przedmiotów tego rodzaju.'))
      : Array.isArray(list) && list.length
      ? h('div', { class: 'cos-grid' }, ...shown.map(c => h('div', { class: 'cosi' + (c.equipped ? ' on' : '') + (trying[c.type] && trying[c.type].id === c.id ? ' try' : ''),
          'data-id': c.id, title: c.texture && !c.equipped ? T('Kliknij, żeby przymierzyć') : null, on: { click: e => { if (!e.target.closest('button')) tryToggle(c, items); } } },
        h('i', { 'aria-hidden': 'true' }, itemImage(c, 5)),
        h('b', {}, c.name), h('small', { class: 'mut' }, c.equipped ? '✓ ' + T('Założona — widać ją w grze') : T(c.source === 'shop' ? 'Kupiono' : 'Odebrano') + ' ' + fmtDate(c.acquiredAt)),
        h('button', { class: c.equipped ? 'b ghost' : 'b', type: 'button', on: { click: async e => {
          e.currentTarget.disabled = true;
          // peleryna i plecak się wykluczają (od 0.38.0, pilnuje baza): powiedz graczowi, co zdjęliśmy
          const other = !c.equipped && (c.type === 'cape' ? 'back' : c.type === 'back' ? 'cape' : null);
          const had = other && items.some(x => x.equipped && x.type === other);
          const r = await mib.call('prof:equip', { type: c.type, id: c.equipped ? null : c.id });
          if (r.error) toast(msg(r.error), 1);
          else if (had) toast(T(other === 'back' ? 'Zdjęto plecak: peleryny i plecaka nie można nosić razem.' : 'Zdjęto pelerynę: peleryny i plecaka nie można nosić razem.'));
          renderCos();
        } } }, T(c.equipped ? 'Zdejmij' : 'Załóż')))))
      : h('p', { class: 'empty' }, Array.isArray(list) ? T('Nie masz jeszcze żadnych przedmiotów. Kup coś w Sklepie albo wpisz kod z konkursu.') : msg(list.error));
    return [h('p', { class: 'lead' }, T('Przedmioty przypisane do profilu') + ' ' + st.nick + '.'), form, err,
      items.length ? h('p', { class: 'mut' }, T('Kliknij przedmiot, żeby przymierzyć go na postaci. „Załóż” zakłada go w grze.')) : null, grid];
  }

  // ===== Sklep za MiB Coins (od 0.24.0): kosmetyki z ceną, oferty i pakiety z datą końca, prezent dla znajomego =====
  const fmtCoins = n => Number(n || 0).toLocaleString(LANG === 'en' ? 'en-US' : 'pl-PL');
  const price = (n, cls) => h('span', { class: 'price' + (cls ? ' ' + cls : '') }, coinIcon(), fmtCoins(n));
  // Ile zostało do końca oferty
  function leftText(end) {
    const ms = new Date(end) - Date.now(), d = Math.floor(ms / 864e5);
    if (d >= 2) return T('jeszcze {n} dni').replace('{n}', d);
    if (d === 1) return T('jeszcze 1 dzień');
    return T('jeszcze {n} godz.').replace('{n}', Math.max(1, Math.ceil(ms / 36e5)));
  }
  let shopCoins = null;
  async function shopView(owned) {
    const s = await mib.call('prof:shop');
    if (!s || s.error || !Array.isArray(s.items)) return [h('p', { class: 'empty' }, msg(s && s.error ? s.error : 'unknown', s && s.detail))];
    shopCoins = s.coins;
    const all = s.items.map(c => ({ ...c, imageUrl: c.texture }));
    kindSrc = all.filter(c => c.price != null);
    const byId = Object.fromEntries(all.map(c => [c.id, c]));
    for (const t of Object.keys(trying)) if (!trying[t] || !byId[trying[t].id]) delete trying[t];
    dressPage(owned);
    const isTry = c => trying[c.type] && trying[c.type].id === c.id ? ' try' : '';
    const offers = (cosKind === 'all' ? s.offers || [] : []).map(o => {
      const its = (o.items || []).map(id => byId[id]).filter(Boolean), pay = o.mine == null ? o.price : o.mine;
      const pct = o.full > o.price ? Math.round((1 - o.price / o.full) * 100) : 0;
      return h('div', { class: 'card offer', 'data-offer': o.id },
        h('div', { class: 'offer-top' }, h('small', { class: 'gift-kicker' }, T(its.length > 1 ? 'Pakiet' : 'Oferta')),
          pct ? h('em', { class: 'tag sale' }, '−' + pct + '%') : null,
          o.ends_at ? h('small', { class: 'mut offer-end', title: new Date(o.ends_at).toLocaleString(LANG === 'en' ? 'en-GB' : 'pl-PL') }, T('do') + ' ' + fmtDate(o.ends_at) + ' · ' + leftText(o.ends_at)) : null),
        h('b', { class: 'offer-name' }, o.name),
        h('div', { class: 'offer-items' }, ...its.map(c => h('span', { class: 'offer-it' + (c.owned ? ' own' : '') + isTry(c), 'data-id': c.id,
          title: c.name + (c.owned ? ' · ' + T('Masz') : ' · ' + T('Kliknij, żeby przymierzyć')), on: { click: () => tryToggle(c, owned) } }, h('i', { 'aria-hidden': 'true' }, itemImage(c, 3)), h('small', {}, c.name)))),
        h('div', { class: 'offer-buy' },
          o.full > pay && pay > 0 ? h('s', { class: 'mut old' }, fmtCoins(o.full)) : null,
          pay > 0 ? price(pay, 'big') : null,
          pay > 0 ? h('button', { class: 'b', type: 'button', on: { click: () => buyDialog({ offer: o, items: its, cost: pay }) } }, T(its.length > 1 ? 'Kup pakiet' : 'Kup'))
            : h('span', { class: 'tag own' }, '✓ ' + T('Masz wszystko'))),
        pay > 0 && pay < o.price ? h('small', { class: 'mut' }, T('Taniej, bo masz już część tych przedmiotów.')) : null);
    });
    const forSale = all.filter(c => c.price != null && ofKind(c));
    const card = c => h('div', { class: 'cosi shopi' + (c.owned ? ' own' : '') + isTry(c), 'data-id': c.id,
        title: c.texture ? T('Kliknij, żeby przymierzyć') : null, on: { click: e => { if (!e.target.closest('button')) tryToggle(c, owned); } } },
      h('i', { 'aria-hidden': 'true' }, itemImage(c, 5)),
      h('b', {}, c.name), h('small', { class: 'mut' }, T(KIND[c.type] || 'Kosmetyk')), price(c.price),
      h('div', { class: 'row' },
        c.owned ? h('span', { class: 'tag own' }, '✓ ' + T('Masz')) : h('button', { class: 'b', type: 'button', on: { click: () => buyDialog({ item: c, cost: c.price }) } }, T('Kup')),
        h('button', { class: 'b ghost', type: 'button', title: T('Kup ten przedmiot w prezencie dla znajomego'), on: { click: () => buyDialog({ item: c, cost: c.price, gift: true }) } }, T('Podaruj'))));
    // kolekcje świąteczne (od 0.25.0) osobno, z datą końca: po święcie znikają ze sklepu
    const cols = (s.themes || []).map(t => ({ ...t, list: forSale.filter(c => (t.items || []).includes(c.id)) })).filter(t => t.list.length);
    const inCol = new Set(cols.flatMap(t => t.list.map(c => c.id))), rest = forSale.filter(c => !inCol.has(c.id));
    const colBox = cols.map(t => h('div', { class: 'shop-col', 'data-theme': t.id },
      h('div', { class: 'col-head' }, h('small', { class: 'gift-kicker' }, T('Kolekcja')), h('b', {}, T(t.name)),
        t.until ? h('small', { class: 'mut' }, T('do') + ' ' + fmtDate(t.until + 'T12:00:00') + ' · ' + leftText(t.until + 'T23:59:59')) : null),
      h('div', { class: 'cos-grid' }, ...t.list.map(card))));
    const grid = rest.length ? h('div', { class: 'cos-grid', id: 'shop-grid' }, ...rest.map(card)) : null;
    if (!offers.length && !grid && !colBox.length) return [h('p', { class: 'empty' }, T('W sklepie nic jeszcze nie ma. Zajrzyj tu wkrótce.'))];
    return [offers.length ? h('div', { class: 'offers' }, ...offers) : null,
      grid || colBox.length ? h('p', { class: 'mut' }, T('Kliknij przedmiot, żeby przymierzyć go na postaci. „Podaruj” kupuje go znajomemu w prezencie.')) : null,
      ...colBox, grid && colBox.length ? h('h3', { class: 'shop-rest' }, T('Zawsze w sklepie')) : null, grid];
  }
  // Okno zakupu: podgląd na postaci, cena, saldo po zakupie; przy prezencie wybór znajomego i wiadomość.
  // Gdy coinsów brakuje, zamiast „Kup” jest „Kup MiB Coins”.
  async function buyDialog({ item, offer, items, cost, gift }) {
    const old = $('buy'); if (old) old.remove();
    // saldo prosto z bazy: coinsy mogły dojść w międzyczasie (zakup na stronie)
    const w = await mib.call('prof:wallet');
    if (w && Number.isInteger(w.coins)) shopCoins = w.coins;
    const what = offer ? offer.name : item.name, coins = Number.isInteger(shopCoins) ? shopCoins : 0, short = cost - coins;
    const canvas = h('canvas', { width: 170, height: 200, class: 'gift3d' }), err = errBox();
    let viewer = null;
    const close = () => { mib3d.drop(viewer); viewer = null; ov.remove(); };
    const who = gift ? h('select', { id: 'buy-to' }, h('option', { value: '' }, T('Wczytywanie…'))) : null;
    const note = gift ? h('textarea', { id: 'buy-msg', maxlength: 200, rows: 2, placeholder: T('Wiadomość do znajomego (nieobowiązkowa)') }) : null;
    const go2 = h('button', { class: 'b', id: 'buy-go', type: 'submit' }, (gift ? T('Kup i wyślij za') : T('Kup za')) + ' ' + fmtCoins(cost));
    const topUp = h('button', { class: 'b', id: 'buy-topup', type: 'button', on: { click: async () => { const r = await mib.call('prof:shopOpen'); toast(r.error ? msg(r.error) : T('Sklep otworzył się w przeglądarce. Po zakupie coinsy pojawią się tutaj.'), !!r.error); } } }, T('Kup MiB Coins'));
    const ov = h('div', { class: 'ov on', id: 'buy' }, h('form', { class: 'm buy-m', role: 'dialog', 'aria-label': what, on: { submit: async e => {
      e.preventDefault();
      if (short > 0) return;
      if (gift && !who.value) { err.textContent = T('Wybierz znajomego.'); return; }
      go2.disabled = true; err.textContent = '';
      // saldo spada w chwili kliknięcia (od 0.47.0), a odpowiedź bazy je potwierdza; przy błędzie wraca
      const before = shopCoins;
      if (Number.isInteger(before)) showCoins(Math.max(0, before - cost));
      const r = offer ? await mib.call('prof:buyOffer', { id: offer.id }) : await mib.call('prof:buy', { id: item.id, to: gift ? who.value : null, message: gift ? note.value : '' });
      if (r.error) { go2.disabled = false; err.textContent = msg(r.error, r.detail); if (Number.isInteger(before)) showCoins(before); return; }
      showCoins(r.coins);
      close();
      if (gift) toast(T('Prezent wysłany!') + ' ' + who.selectedOptions[0].textContent + ' ' + T('dostanie') + ' ' + item.name + '.');
      else if (window.mibUnlock) mibUnlock(offer ? { name: offer.name, label: T('Kupione!'), glyph: coinIcon() } : { name: item.name, type: item.type, imageUrl: item.texture, label: T('Kupione!') });
      else toast(T('Kupione!') + ' ' + what);
      refreshWallet();
      if ($('p-cos').classList.contains('on')) renderCos();
    } } },
      h('div', { class: 'buy-top' }, canvas, h('div', { class: 'buy-t' },
        h('small', { class: 'gift-kicker' }, T(gift ? 'Prezent dla znajomego' : offer ? (items.length > 1 ? 'Pakiet' : 'Oferta') : KIND[item.type] || 'Kosmetyk')),
        h('h3', {}, what),
        offer && items.length > 1 ? h('p', { class: 'mut' }, items.filter(c => !c.owned).map(c => c.name).join(', ')) : null,
        h('div', { class: 'buy-sum' },
          h('div', { class: 'sr' }, h('span', {}, T('Cena')), price(cost)),
          h('div', { class: 'sr' }, h('span', {}, T('Twoje coinsy')), price(coins)),
          short > 0 ? h('div', { class: 'sr short', id: 'buy-short' }, h('span', {}, T('Brakuje')), price(short))
            : h('div', { class: 'sr' }, h('span', {}, T('Zostanie')), price(coins - cost))))),
      gift ? field('Dla kogo', who) : null, gift ? field('Wiadomość', note) : null,
      gift ? h('p', { class: 'mut' }, T('Znajomy dostanie okno „Masz prezent!” z Twoim nickiem i wiadomością.')) : null,
      err,
      h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'b ghost', type: 'button', on: { click: close } }, T('Anuluj')), short > 0 ? topUp : go2)));
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    document.body.append(ov);
    (short > 0 ? topUp : go2).focus();
    if (gift) {
      const l = await mib.call('prof:friends');
      const fr = Array.isArray(l) ? l.filter(f => f.state === 'friend') : [];
      who.replaceChildren(...(fr.length ? [h('option', { value: '' }, T('Wybierz znajomego')), ...fr.map(f => h('option', { value: f.id }, f.nick))]
        : [h('option', { value: '' }, T('Nie masz jeszcze znajomych'))]));
      who.disabled = !fr.length;
      if (!fr.length) err.textContent = T('Prezent możesz kupić tylko znajomemu. Dodaj znajomych na stronie Znajomi.');
    }
    // okno zamknięte w trakcie: bez nowej postaci (zajęłaby kontekst WebGL do końca)
    try {
      if (!ov.isConnected) return;
      const v = viewer = mib3d.view({ canvas, width: 170, height: 200 }); v.autoRotate = true; v.autoRotateSpeed = 0.9;
      const cur = await mib.call('skin:current');
      const skin = cur && cur.dataUrl ? cur.dataUrl : await mib.call('skin', 'MHF_Steve');
      if (v.disposed) return;
      await v.loadSkin(skin, { model: cur && cur.variant === 'slim' ? 'slim' : 'default' });
      if (!v.disposed) window.mibDress(v, outfit(offer ? items : [item]));
    } catch {}
  }

  // ===== Historia MiB Coins: zakupy, prezenty, nagrody dzienne i zmiany od MiB =====
  const fmtTime = d => new Date(d).toLocaleString(LANG === 'en' ? 'en-GB' : 'pl-PL', { dateStyle: 'short', timeStyle: 'short' });
  function logText(l) {
    if (l.kind === 'buy') return T('Zakup') + ': ' + l.label;
    if (l.kind === 'gift') return T('Prezent dla') + ' ' + (l.friend || '?') + ': ' + l.label;
    if (l.kind === 'offer') return T('Pakiet') + ': ' + l.label;
    if (l.kind === 'theme') return T('Nagroda świąteczna') + (l.label ? ': ' + l.label : '');
    if (l.kind === 'advent') return T('Kalendarz adwentowy') + (l.item ? ' · ' + T('{n} grudnia').replace('{n}', l.item) : '');
    if (l.kind === 'daily') return T('Nagroda dzienna') + (+l.item > 1 ? ' · ' + T('{n}. dzień z rzędu').replace('{n}', l.item) : '');
    return T(l.delta > 0 ? 'Dodane przez MiB' : 'Zabrane przez MiB') + (l.label ? ': ' + l.label : '');
  }
  const logRow = l => h('div', { class: 'cl-row', 'data-kind': l.kind },
    h('span', { class: 'cl-t' }, h('span', {}, logText(l)), h('small', { class: 'mut' }, fmtTime(l.created_at))),
    h('b', { class: 'cl-d ' + (l.delta > 0 ? 'plus' : 'minus') }, (l.delta > 0 ? '+' : '−') + fmtCoins(Math.abs(l.delta))),
    h('small', { class: 'mut cl-b', title: T('Saldo po zmianie') }, fmtCoins(l.balance)));
  async function logView() {
    const list = await mib.call('prof:coinLog');
    if (!Array.isArray(list)) return [h('p', { class: 'empty' }, msg(list ? list.error : 'unknown', list && list.detail))];
    if (!list.length) return [h('p', { class: 'empty' }, T('Tu pojawi się każda zmiana Twoich MiB Coins: zakupy, prezenty i nagrody dzienne.'))];
    const box = h('div', { class: 'coin-log', id: 'cos-log' }, ...list.map(logRow));
    let last = list[list.length - 1].id;
    const more = list.length >= 50 ? h('button', { class: 'b ghost', type: 'button', on: { click: async () => {
      more.disabled = true;
      const l = await mib.call('prof:coinLog', { before: last });
      more.disabled = false;
      if (!Array.isArray(l)) return toast(msg(l.error, l.detail), 1);
      box.append(...l.map(logRow));
      if (l.length) last = l[l.length - 1].id;
      if (l.length < 50) more.remove();
    } } }, T('Pokaż starsze')) : null;
    return [box, more];
  }

  // ===== MiB Coins (od 0.23.0): stan konta i przycisk do strony sklepu (kupuje się w przeglądarce) =====
  const coinIcon = () => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 12 12'); s.setAttribute('shape-rendering', 'crispEdges'); s.setAttribute('class', 'coin'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<path fill="#a16207" d="M3 0h6v1h2v2h1v6h-1v2H9v1H3v-1H1V9H0V3h1V1h2z"/><path fill="#facc15" d="M3 1h6v1h1v1h1v6h-1v1H9v1H3v-1H2V9H1V3h1V2h1z"/>'
      + '<path fill="#fef08a" d="M3 2h3v1H4v1H3v2H2V3h1z"/><path fill="#a16207" d="M5 3h2v1h1v1H7V4H5v4h2V7h1v1H7v1H5V8H4V4h1z"/>';
    return s;
  };
  function walletCard() {
    const amount = h('b', { class: 'coins', id: 'cos-coins' }, '…');
    const buy = h('button', { class: 'b', id: 'cos-shop', type: 'button', hidden: true, on: { click: async () => {
      buy.disabled = true;
      const r = await mib.call('prof:shopOpen');
      buy.disabled = false;
      if (r.error) toast(msg(r.error), 1); else toast(T('Sklep otworzył się w przeglądarce. Po zakupie coinsy pojawią się tutaj.'));
    } } }, T('Kup MiB Coins'));
    const soon = h('small', { class: 'mut soon', hidden: true }, T('Sklep już wkrótce.'));
    const card = h('div', { class: 'card wallet', id: 'cos-wallet' }, coinIcon(), h('div', { class: 'wallet-t' }, h('small', { class: 'mut' }, T('Twoje MiB Coins')), amount),
      h('div', { class: 'daily', id: 'cos-daily', hidden: true }), soon, buy);
    refreshWallet(card);
    return card;
  }
  // Saldo wszędzie naraz (od 0.47.0): karta portfela w Kosmetykach i licznik w górnym pasku — wcześniej górny pasek
  // pokazywał stare saldo po zakupie aż do 90 s albo przełączenia okna
  function showCoins(n) {
    if (!Number.isInteger(n)) return;
    shopCoins = n;
    const c = document.getElementById('cos-coins'), tb = document.getElementById('tb-coins'), tn = document.getElementById('tb-coins-n');
    if (c) c.textContent = fmtCoins(n);
    if (tb && tn) { tn.textContent = fmtCoins(n); tb.hidden = false; }
  }
  async function refreshWallet(card = document.getElementById('cos-wallet')) {
    const w = await mib.call('prof:wallet');
    const ok = !!(w && !w.error && w.loggedIn && Number.isInteger(w.coins)), shop = !!(w && w.shopUrl);
    if (ok) showCoins(w.coins);
    if (!card) return;
    // bez profilu albo przed uruchomieniem nowego schema.sql (brak coinsów w bazie) karty nie ma; bez sieci: „—”
    card.hidden = !ok && !(w && w.error);
    card.querySelector('#cos-coins').textContent = ok ? fmtCoins(w.coins) : '—';
    card.querySelector('#cos-shop').hidden = !shop;
    card.querySelector('.soon').hidden = shop;
    dailyPips(card);
  }
  // ===== Nagroda dzienna (od 0.24.0): 10 MiB Coins za każdy dzień, co 7. dzień z rzędu 50 więcej =====
  // Launcher odbiera ją sam (baza daje ją raz na dobę); pytamy najwyżej raz na godzinę
  let daily = null, dailyAt = 0;
  function dailyPips(card = document.getElementById('cos-wallet')) {
    const box = card && card.querySelector('#cos-daily');
    if (!box) return;
    box.hidden = !(daily && daily.streak);
    if (box.hidden) return;
    const n = ((daily.streak - 1) % 7) + 1;
    box.title = T('Codziennie +10 MiB Coins, a za 7 dni z rzędu +50 więcej.');
    box.replaceChildren(h('small', { class: 'mut' }, T('Seria') + ' ' + n + '/7'),
      h('span', { class: 'pips', 'aria-hidden': 'true' }, ...Array.from({ length: 7 }, (_, i) => h('i', { class: (i < n ? 'on' : '') + (i === 6 ? ' bonus' : '') }))),
      h('small', { class: 'mut' }, n === 7 ? T('Bonus odebrany!') : T('7. dzień: +50')));
  }
  async function dailyCheck() {
    if (!st.loggedIn || st.banned || Date.now() - dailyAt < 3600e3) return;
    dailyAt = Date.now();
    const r = await mib.call('prof:daily');
    if (!r || r.error) { dailyAt = 0; return; }
    if (r.streak) daily = r;
    if (r.claimed) {
      toast(T('Nagroda dzienna') + ': +' + r.amount + ' MiB Coins' + (r.amount > 10 ? ' · ' + T('{n} dni z rzędu!').replace('{n}', r.streak) : ''));
      refreshWallet();
    } else dailyPips();
  }
  // po powrocie ze sklepu (okno znów aktywne) saldo odświeża się samo
  window.addEventListener('focus', () => { if ($('p-cos').classList.contains('on')) refreshWallet(); dailyCheck(); });

  // ===== Prezenty od MiB: okno „Masz prezent!” z podglądem na postaci, Odbierz i Załóż od razu =====
  let giftOpen = false, giftCount = 0;
  const KIND = { cape: 'Peleryna', hat: 'Czapka', mask: 'Maska', wings: 'Skrzydła', aura: 'Aura', pet: 'Pet', tail: 'Ogon', back: 'Plecak' };
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
      h('small', { class: 'gift-kicker' }, (g.from_nick ? T('Prezent od') + ' ' + g.from_nick : T(g.bug ? 'Nagroda za znalezienie błędu' : 'Prezent od MiB')) + (total > 1 ? ' · 1/' + total : '')),
      h('h3', {}, T('Masz prezent!')), canvas,
      h('b', { class: 'gift-name' }, g.name), h('span', { class: 'mut' }, T(KIND[g.type] || 'Kosmetyk')),
      g.message ? h('blockquote', { class: 'gift-msg' }, '„' + (g.from_nick ? clean(g.message) : g.message) + '”', h('small', {}, '— ' + (g.from_nick || T('twórca MiB Client')))) : null,
      actions));
    const close = () => { mib3d.drop(viewer); viewer = null; ov.remove(); giftOpen = false; if ($('p-cos').classList.contains('on')) renderCos(); giftsCheck(true); };
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
      const v = viewer = mib3d.view({ canvas, width: 200, height: 230 }); v.autoRotate = true; v.autoRotateSpeed = 0.9;
      const cur = await mib.call('skin:current');
      const skin = cur && cur.dataUrl ? cur.dataUrl : await mib.call('skin', 'MHF_Steve');
      if (v.disposed) return;
      await v.loadSkin(skin, { model: cur && cur.variant === 'slim' ? 'slim' : 'default' });
      if (g.texture && !v.disposed) window.mibDress(v, outfit([{ type: g.type, id: g.cosmetic_id, texture: g.texture }]));
    } catch {}
  }
  // launcher sprawdza prezenty i odpowiedzi co minutę (main.js); kliknięte powiadomienie otwiera okno albo Pomysły
  mib.on('gifts:changed', n => { if (st.loggedIn && (n !== giftCount || (n && !giftOpen))) giftsCheck(true); });
  mib.on('gifts:open', () => giftsCheck(true));
  // zestaw założony w grze (od 0.47.3, main.js onOutfit): Kosmetyki od razu w nowym stroju
  mib.on('cosmetics:changed', () => { if ($('p-cos').classList.contains('on') && !giftOpen) renderCos(); });
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
    async function loadMine() {
      const l = await mib.call('prof:myIdeas');
      if (!Array.isArray(l)) return list.replaceChildren(h('p', { class: 'err' }, msg(l.error, l.detail)));
      list.replaceChildren(...(l.length ? l.map(i => h('div', { class: 'card idea' },
        h('div', { class: 'ihead' }, h('em', { class: 'tag' }, T(IDEA_CAT[i.category] || i.category)), h('span', { class: 'mut' }, fmtDate(i.created_at)),
          i.rewarded ? h('em', { class: 'tag hunter' }, T('Nagrodzony')) : null,
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
      loadMine();
    } } },
    field('Czego dotyczy', cat), field('Pomysł', body, 'Od 10 do 1000 znaków. Najwyżej 5 pomysłów dziennie.'), err,
    h('div', { class: 'row', style: 'align-items:center;justify-content:space-between' }, send, count));
    // od 0.37.0 bez pomysłów innych graczy: każdy widzi tylko swoje (i odpowiedzi twórcy)
    box.replaceChildren(...head, form, h('div', { class: 'sec' }, h('h3', {}, T('Twoje pomysły')), list));
    loadMine();
  }

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
    const [l, inv, un, pinv] = await Promise.all([mib.call('prof:friends'), mib.call('prof:invites'), mib.call('prof:chatUnread'), mib.call('prof:partyInvites')]);
    if (!Array.isArray(l)) return;
    const n = l.filter(f => f.state === 'incoming').length + (Array.isArray(inv) ? inv.length : 0) + (Array.isArray(pinv) ? pinv.length : 0)
      + (Array.isArray(un) ? un.reduce((a, u) => a + Number(u.unread || 0), 0) : 0);
    if (!b) { b = h('em', { class: 'cnt' }); nav.append(b); }
    b.textContent = String(n); b.hidden = !n;
    // znajomi online w górnym pasku (od 0.30.0)
    const on = l.filter(f => f.state === 'friend' && (f.status === 'game' || f.status === 'launcher')).length, pill = $('tb-friends');
    if (pill) { pill.hidden = false; $('tb-friends-n').textContent = String(on); }
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
    let shown = null, first = true;
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
        headDot(f.mc_name, 34),
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
          list.replaceChildren(...(l.length ? l.map((m, i) => {
            const bubble = h('div', { class: 'msg' + (m.mine ? ' me' : '') },
              h('span', { class: 'tx' }, m.mine ? m.body : clean(m.body)),
              h('small', {}, timeOf(m.created_at) + (i === lastMine && m.read ? ' · ' + T('przeczytana') : ''),
                m.mine ? null : h('button', { class: 'rep-b', type: 'button', title: T('Zgłoś wiadomość'), on: { click: () => openReport(f, m, b => { if (b) closeChat(); }) } }, T('Zgłoś'))));
            return m.mine ? bubble : otherMsg(i === 0 || l[i - 1].mine, f.mc_name, f.nick, bubble);
          })
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
  // ===== Party (0.38.0): do 8 osób, lider zaprasza znajomych, czat party, „Lider gra na X — Dołącz” =====
  let partyChatTimer = null, partyChatReload = null;
  function closePartyChat() {
    clearTimeout(partyChatTimer); partyChatReload = null;
    const o = $('pchat'); if (o) { o.remove(); mib.call('party:chatOpen', false); }
  }
  function openPartyChat(party) {
    closePartyChat();
    let shown = null, first = true;
    const list = h('div', { class: 'chat-list', id: 'pchat-list' }, h('p', { class: 'mut' }, T('Wczytywanie…')));
    const input = h('input', { id: 'pchat-in', maxlength: 300, autocomplete: 'off', placeholder: T('Napisz do party…') });
    const sendB = h('button', { class: 'b', id: 'pchat-send', type: 'submit' }, T('Wyślij'));
    const err = h('p', { class: 'err', id: 'pchat-err' });
    const form = h('form', { class: 'row chat-form', on: { submit: async e => {
      e.preventDefault();
      const body = input.value.trim();
      if (!body || sendB.disabled) return;
      sendB.disabled = true; err.textContent = '';
      const r = await mib.call('prof:partySend', { body });
      sendB.disabled = false;
      if (r.error) { err.textContent = msg(r.error, r.detail); return; }
      input.value = ''; first = true;
      load(); input.focus();
    } } }, input, sendB);
    const who = (party && party.members || []).map(m => h('span', { class: 'mem' }, head(m.mc_name, 16), m.nick + (m.id === party.leader ? ' ★' : '')));
    const ov = h('div', { class: 'ov on', id: 'pchat' }, h('div', { class: 'm chat-m', role: 'dialog', 'aria-label': T('Czat party') },
      h('div', { class: 'frow chat-head' }, h('i', { class: 'pico', 'aria-hidden': 'true' }, kindIcon('party')),
        h('div', { class: 'fi' }, h('b', {}, T('Czat party')), h('span', { class: 'mut', id: 'pchat-who' }, ...who)),
        h('button', { class: 'b ghost', id: 'pchat-x', type: 'button', on: { click: closePartyChat } }, T('Zamknij'))),
      list, err, form));
    ov.addEventListener('mousedown', e => { if (e.target === ov) closePartyChat(); });
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') closePartyChat(); });
    document.body.append(ov);
    mib.call('party:chatOpen', true);
    input.focus();
    async function load() {
      clearTimeout(partyChatTimer);
      if (!ov.isConnected) return;
      const l = await mib.call('prof:partyMessages', {});
      if (!ov.isConnected) return;
      if (!Array.isArray(l)) list.replaceChildren(h('p', { class: 'err' }, msg(l.error, l.detail)));
      else {
        const key = l.map(m => m.id).join(',');
        if (key !== shown) {
          shown = key;
          const bottom = first || list.scrollHeight - list.scrollTop - list.clientHeight < 40;
          list.replaceChildren(...(l.length ? l.map((m, i) => {
            const bubble = h('div', { class: 'msg' + (m.mine ? ' me' : '') },
              h('span', { class: 'tx' }, m.mine ? m.body : clean(m.body)),
              h('small', {}, timeOf(m.created_at)));
            return m.mine ? bubble : otherMsg(i === 0 || l[i - 1].from_id !== m.from_id, m.mc_name, m.nick || '?', bubble);
          })
            : [h('p', { class: 'empty' }, T('Czat party: piszą wszyscy członkowie. Wiadomości znikają po 2 dniach.'))]));
          if (bottom) list.scrollTop = list.scrollHeight;
          first = false;
        }
      }
      partyChatTimer = setTimeout(load, 4000);
    }
    partyChatReload = load;
    load();
  }
  // Okienko w rogu: lider party wszedł na serwer (main.js party:play) — jedno kliknięcie i gra rusza na tym serwerze
  function partyPop(p) {
    const old = $('party-pop'); if (old) old.remove();
    const el = h('div', { id: 'party-pop', class: 'card', role: 'alert' },
      h('small', { class: 'gift-kicker' }, 'Party'),
      h('p', {}, T('Lider') + ' ', h('b', {}, p.nick), ' ' + T('gra na') + ' ' + p.server + ' (Minecraft ' + p.version + ')'),
      h('div', { class: 'row' },
        h('button', { class: 'b', id: 'pp-join', type: 'button', on: { click: () => { el.remove(); window.mibJoin(p.version, p.server); } } }, T('Dołącz')),
        h('button', { class: 'b ghost', id: 'pp-x', type: 'button', on: { click: () => el.remove() } }, T('Później'))));
    document.body.append(el);
    setTimeout(() => el.remove(), 60000);
  }
  // Karta party na stronie Znajomi: zaproszenia do party, członkowie (lider z gwiazdką), Dołącz do lidera, czat, wyjście
  function partySection(party, pinv, here, reload) {
    const act = (label, cls, fn, id) => h('button', { class: 'b ' + cls, type: 'button', ...(id ? { id } : {}), on: { click: async e => { e.currentTarget.disabled = true; const r = await fn(); if (r && r.error) toast(msg(r.error, r.detail), 1); mib.call('party:check'); reload(); } } }, T(label));
    const out = [];
    for (const i of pinv) out.push(h('div', { class: 'card frow st-launcher pinv' }, h('i', { class: 'dot', 'aria-hidden': 'true' }),
      h('div', { class: 'fi' }, h('b', {}, i.from_nick), h('span', { class: 'mut' }, T('Zaprasza Cię do party') + ' (' + i.members + '/' + MibProfile.PARTY_MAX + ')')),
      act('Dołącz', '', async () => { const r = await mib.call('prof:partyAnswer', { id: i.party_id, accept: true }); if (!r.error) toast(T('Jesteś w party.')); return r; }),
      act('Odrzuć', 'ghost', () => mib.call('prof:partyAnswer', { id: i.party_id, accept: false }))));
    if (party) {
      const lead = party.leader === party.me;
      const rows = party.members.map(m => h('div', { class: 'prow st-' + m.status },
        headDot(m.mc_name, 30),
        h('div', { class: 'fi' }, h('b', {}, m.nick, m.id === party.leader ? h('em', { class: 'tag lead', title: T('Lider party') }, '★ ' + T('Lider')) : null, m.id === party.me ? h('span', { class: 'mut' }, ' (' + T('Ty') + ')') : null),
          h('span', { class: 'mut' }, statusText(m))),
        m.id === party.leader && m.id !== party.me && m.status === 'game' && m.server && m.version && m.server !== here
          ? h('button', { class: 'b', type: 'button', on: { click: () => window.mibJoin(m.version, m.server) } }, T('Dołącz')) : null,
        lead && m.id !== party.me ? act('Wyrzuć', 'ghost', async () => (await window.mibConfirm(T('Wyrzucić') + ' ' + m.nick + ' ' + T('z party?'), { danger: true, ok: T('Wyrzuć') })) ? mib.call('prof:partyKick', { id: m.id }) : null) : null));
      out.push(h('div', { class: 'card party-card', id: 'party-card' },
        h('div', { class: 'row ph' }, h('h3', {}, 'Party (' + party.members.length + '/' + MibProfile.PARTY_MAX + ')'),
          h('button', { class: 'b', id: 'party-chat', type: 'button', on: { click: () => openPartyChat(party) } }, T('Czat party')),
          act('Wyjdź z party', 'ghost', async () => (await window.mibConfirm(T('Wyjść z party?') + (lead && party.members.length > 1 ? ' ' + T('Liderem zostanie osoba, która dołączyła najwcześniej.') : ''), { ok: T('Wyjdź') })) ? mib.call('prof:partyLeave') : null, 'party-leave')),
        ...rows,
        party.invited.length ? h('p', { class: 'mut' }, T('Zaproszeni') + ': ' + party.invited.map(x => x.nick).join(', ')) : null,
        h('p', { class: 'mut hint' }, T(lead ? 'Zapraszasz znajomych przyciskiem „Do party” przy ich nicku. Gdy wejdziesz na serwer, reszta party dostanie „Dołącz”.' : 'Gdy lider wejdzie na serwer, dostaniesz powiadomienie „Dołącz” — jedno kliknięcie i grasz razem z nim.'))));
    } else if (!pinv.length) out.push(h('div', { class: 'card party-card empty-party' }, h('h3', {}, 'Party'),
      h('p', { class: 'mut' }, T('Zagrajcie razem: zaproś do 7 znajomych przyciskiem „Do party” przy ich nicku. Gdy lider wejdzie na serwer, reszta dostaje „Dołącz” i czat party.'))));
    return out.length ? h('div', { class: 'sec', id: 'party-sec' }, ...out) : null;
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
      headDot(f.mc_name, 32),
      h('div', { class: 'fi' }, f.state === 'friend' ? h('button', { class: 'linkb fr-name', type: 'button', title: T('Pokaż kartę gracza'), on: { click: () => openCard(f) } }, f.nick) : h('b', {}, f.nick),
        h('span', { class: 'mut' }, f.state === 'friend' ? statusText(f) : f.num ? MibProfile.formatMibId(f.num) : '')),
      ...buttons);
    async function load() {
      clearTimeout(friendsTimer);
      const [l, inv, me, un, bl, ps, pi] = await Promise.all([mib.call('prof:friends'), mib.call('prof:invites'), mib.call('prof:nowPlaying'), mib.call('prof:chatUnread'), mib.call('prof:blocked'),
        mib.call('prof:partyState'), mib.call('prof:partyInvites')]);
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
      // party: przycisk „Do party” przy znajomym (gdy nie jestem w party albo jestem liderem, jest miejsce i jeszcze go tam nie ma)
      const party = ps && !ps.error && Array.isArray(ps.members) ? ps : null, pinv = Array.isArray(pi) ? pi : [];
      const lead = !party || party.leader === party.me, room = !party || party.members.length + party.invited.length < MibProfile.PARTY_MAX;
      const inParty = id => !!party && (party.members.some(m => m.id === id) || party.invited.some(m => m.id === id));
      const toParty = f => act('Do party', 'ghost', async () => {
        const r = await mib.call('prof:partyInvite', { id: f.id });
        if (!r.error) { toast(T('Zaproszenie do party wysłane do') + ' ' + f.nick + '.'); mib.call('party:check'); }
        return r;
      });
      const inc = l.filter(f => f.state === 'incoming'), out = l.filter(f => f.state === 'outgoing');
      const order = { game: 0, launcher: 1, offline: 2 };
      const fr = l.filter(f => f.state === 'friend').sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.nick.localeCompare(b.nick));
      const sec = (title, items) => items.length ? h('div', { class: 'sec' }, h('h3', {}, T(title) + ' (' + items.length + ')'), ...items) : null;
      list.replaceChildren(...[
        ps && ps.error === 'schema_outdated' ? null : partySection(party, pinv, here, load),
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
          !st.banned && lead && room && !inParty(f.id) ? toParty(f) : null,
          write(f),
          act('Usuń', 'ghost', async () => (await window.mibConfirm(T('Usunąć') + ' ' + f.nick + ' ' + T('ze znajomych?'), { danger: true, ok: T('Usuń') })) ? mib.call('prof:friendRemove', { id: f.id }) : null))))
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
    if (!(await window.mibConfirm(T('Zablokować') + ' ' + f.nick + '? ' + T('Znajomość, zaproszenia i rozmowa znikną, a ten gracz nie zaprosi Cię ponownie. Jeśli ktoś Cię obraża, najpierw zgłoś wiadomość.'), { danger: true, ok: T('Zablokuj') }))) return;
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
    const close = () => { mib3d.drop(viewer); viewer = null; ov.remove(); };
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
      const v = viewer = mib3d.view({ canvas, width: 170, height: 210 }); v.autoRotate = true; v.autoRotateSpeed = 0.8;
      const skin = await mib.call('skin', c.mc_name || 'MHF_Steve');
      if (v.disposed) return;
      await v.loadSkin(skin);
      if (!v.disposed) window.mibDress(v, outfit(eq));
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
      if (!(await window.mibConfirm(T('Zastąpić kopię na profilu modami z tego komputera?')))) return;
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

  // ===== Święta (od 0.25.0): nagroda świąteczna i kalendarz adwentowy na stronie głównej =====
  let holAt = 0;
  async function holidayCheck(force) {
    const box = $('hol-home');
    if (!st.loggedIn || st.banned) { box.replaceChildren(); return; }
    if (!force && Date.now() - holAt < 600e3) return;
    holAt = Date.now();
    const [gifts, adv] = await Promise.all([mib.call('prof:themeGifts'), mib.call('prof:advent')]);
    const cards = [];
    for (const g of Array.isArray(gifts) ? gifts : []) {
      const what = [g.coins > 0 ? fmtCoins(g.coins) + ' MiB Coins' : null, g.cosmetic_name].filter(Boolean).join(' + ');
      const btn = h('button', { class: 'b', type: 'button', on: { click: async () => {
        btn.disabled = true;
        const r = await mib.call('prof:claimThemeGift', { id: g.id });
        if (r.error) { btn.disabled = false; toast(msg(r.error, r.detail), 1); holidayCheck(true); return; }
        if (r.cosmetic && window.mibUnlock) mibUnlock({ name: r.cosmetic.name, type: r.cosmetic.type, imageUrl: r.cosmetic.texture, label: T('Nagroda świąteczna') });
        if (r.amount > 0) toast(T('Nagroda świąteczna') + ': +' + fmtCoins(r.amount) + ' MiB Coins');
        refreshWallet(); holidayCheck(true);
        if ($('p-cos').classList.contains('on')) renderCos();
      } } }, T('Odbierz'));
      cards.push(h('div', { class: 'card reward hol', 'data-theme': g.id }, h('small', { class: 'gift-kicker' }, T('Nagroda świąteczna')),
        h('b', {}, T(g.name)), h('p', {}, what), g.until ? h('small', { class: 'mut' }, T('Odbierz do') + ' ' + fmtDate(g.until + 'T12:00:00')) : null, btn));
    }
    if (adv && adv.open && Array.isArray(adv.days)) {
      const ready = adv.days.filter(d => d.day <= adv.today && !d.opened).length;
      cards.push(h('div', { class: 'card reward hol', id: 'hol-adv' }, h('small', { class: 'gift-kicker' }, T('Kalendarz adwentowy')),
        h('b', {}, ready ? (ready === 1 ? T('1 okienko do otwarcia') : T(few(ready) ? '{n} okienka do otwarcia' : '{n} okienek do otwarcia').replace('{n}', ready)) : T('Wszystko otwarte. Wróć jutro!')),
        h('button', { class: ready ? 'b' : 'b ghost', type: 'button', id: 'hol-adv-go', on: { click: () => adventOpen(adv) } }, T('Otwórz kalendarz'))));
    }
    box.replaceChildren(...cards);
  }
  // polska liczba mnoga: 2–4, 22–24… okienka, reszta okienek
  const few = n => n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  // Kalendarz: 24 okienka w stałej, pomieszanej kolejności; dzisiejsze i zaległe świecą, otwarte pokazują nagrodę
  const ADV_ORDER = [7, 18, 3, 22, 11, 1, 15, 24, 9, 20, 5, 13, 2, 17, 10, 23, 6, 14, 19, 4, 12, 21, 8, 16];
  function adventOpen(adv) {
    const old = $('adv'); if (old) old.remove();
    const byDay = Object.fromEntries(adv.days.map(d => [d.day, d]));
    const reward = d => d.cosmetic ? h('span', { class: 'adv-prize' }, h('i', { 'aria-hidden': 'true' }, itemImage({ ...d.cosmetic, imageUrl: d.cosmetic.texture }, 3)), h('small', {}, d.cosmetic.name))
      : h('span', { class: 'adv-prize' }, coinIcon(), h('b', {}, '+' + fmtCoins(d.coins || 0)));
    const win = n => {
      const d = byDay[n] || { day: n, kind: 'coins', opened: false }, ready = !d.opened && n <= adv.today;
      const b = h('button', { type: 'button', class: 'adv-win' + (d.opened ? ' open' : ready ? ' ready' : '') + (d.kind === 'cosmetic' ? ' big' : ''), 'data-day': n,
        disabled: !ready, 'aria-label': T('{n} grudnia').replace('{n}', n) + (d.opened ? ' · ' + T('otwarte') : ready ? '' : ' · ' + T('jeszcze zamknięte')),
        title: ready || d.opened ? null : T('Otworzysz {n} grudnia').replace('{n}', n), on: { click: async () => {
          if (!ready || b.dataset.busy) return;
          b.dataset.busy = '1';
          const r = await mib.call('prof:claimAdvent', { day: n });
          delete b.dataset.busy;
          if (r.error) { toast(msg(r.error, r.detail), 1); return; }
          Object.assign(d, { opened: true, coins: r.amount, cosmetic: r.cosmetic });
          b.className = 'adv-win open opening' + (d.kind === 'cosmetic' ? ' big' : '');
          b.disabled = true;
          b.replaceChildren(h('em', {}, String(n)), reward(d));
          if (r.cosmetic && window.mibUnlock) mibUnlock({ name: r.cosmetic.name, type: r.cosmetic.type, imageUrl: r.cosmetic.texture, label: T('Kalendarz adwentowy') });
          else if (r.amount > 0) toast(T('Kalendarz adwentowy') + ': +' + fmtCoins(r.amount) + ' MiB Coins');
          refreshWallet(); holidayCheck(true);
          // otwarte okienko traci fokus (wyłączone): fokus na następne do otwarcia albo na Zamknij
          (ov.querySelector('.adv-win.ready') || ov.querySelector('.m .b.ghost')).focus();
        } } }, h('em', {}, String(n)), d.opened ? reward(d) : d.kind === 'cosmetic' ? h('span', { class: 'adv-star', 'aria-hidden': 'true' }, '★') : null);
      return b;
    };
    const esc = e => { if (e.key === 'Escape') close(); };
    const close = () => { ov.remove(); document.removeEventListener('keydown', esc); };
    const ov = h('div', { class: 'ov on', id: 'adv' }, h('div', { class: 'm adv-m', role: 'dialog', 'aria-label': T('Kalendarz adwentowy') },
      h('h3', {}, T('Kalendarz adwentowy')),
      h('p', { class: 'mut' }, T('Codziennie od 1 do 24 grudnia nowe okienko: MiB Coins, a w ostatnich dniach kosmetyki (gwiazdka). Zaległe okienka otworzysz do 26 grudnia.')),
      h('div', { class: 'adv-cal' }, ...ADV_ORDER.map(win)),
      h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'b ghost', type: 'button', on: { click: close } }, T('Zamknij')))));
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    document.addEventListener('keydown', esc);
    document.body.append(ov);
    (ov.querySelector('.adv-win.ready') || ov.querySelector('.m .b.ghost')).focus();
  }
  window.addEventListener('focus', () => holidayCheck());
  if (window.MibThemes) MibThemes.onChange(() => holidayCheck(true));
  // nowa nagroda albo okienko (main.js co minutę) i kliknięte powiadomienie: strona główna, przy kalendarzu od razu okno kalendarza
  mib.on('holiday:changed', () => holidayCheck(true));
  mib.on('holiday:open', async kind => {
    go('home');
    await holidayCheck(true);
    if (kind === 'advent' && $('hol-adv-go')) $('hol-adv-go').click();
  });

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
    if (st.loggedIn && !was) { achievementsCheck(false); founderCape(); mib.call('news:check'); daily = null; dailyAt = 0; }
    dailyCheck();
    holidayCheck(st.loggedIn !== was);
    if (st.loggedIn && !was) { mibSync.pull(); if (window.mibWave) mibWave(); }
  }
  async function refresh() { apply(await mib.call('prof:state')); }
  // Odpowiedź twórcy na pomysł gracza (od 0.38.0, main.js idea:reply): okno w launcherze, po kolei, gdy nic innego nie jest otwarte
  const ideaQueue = [];
  let ideaTimer = null;
  const IDEA_ST_LBL = { new: 'Nowy', seen: 'Przeczytany', planned: 'W planach', done: 'Zrobione', rejected: 'Odrzucony' };
  function ideaPop() {
    ideaTimer = null;
    if (!ideaQueue.length || $('idea-pop')) return;
    if (document.querySelector('#gate:not([hidden]), #warn, #gift, #news-pop, #wn, #fcard, #unlock, #cfm, #welcome.on')) { ideaTimer = setTimeout(ideaPop, 2000); return; }
    const x = ideaQueue.shift();
    const close = () => { ov.remove(); setTimeout(ideaPop, 300); };
    const body = String(x.body || ''), short = body.length > 160 ? body.slice(0, 157) + '…' : body;
    const ov = h('div', { class: 'ov on', id: 'idea-pop', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ip-title', on: { keydown: e => { if (e.key === 'Escape') close(); } } },
      h('div', { class: 'm ip-m' },
        h('small', { class: 'gift-kicker' }, T('Odpowiedź twórcy MiB Client')),
        h('h3', { id: 'ip-title' }, T('Twórca odpowiedział na Twój pomysł')),
        short ? h('blockquote', { class: 'ip-idea' }, short) : null,
        h('div', { class: 'ireply ip-reply' }, h('p', {}, x.reply)),
        x.status && x.status !== 'new' ? h('em', { class: 'tag st-' + x.status }, T(IDEA_ST_LBL[x.status] || x.status)) : null,
        h('div', { class: 'row', style: 'justify-content:flex-end' },
          h('button', { class: 'b ghost', type: 'button', id: 'ip-ok', on: { click: close } }, T('OK')),
          h('button', { class: 'b', type: 'button', id: 'ip-go', on: { click: () => { ideaQueue.length = 0; close(); go('ideas'); } } }, T('Zobacz w Pomysłach')))));
    document.body.append(ov);
    ov.querySelector('#ip-go').focus();
  }
  // Party (0.38.0): stan z main.js co 15 s, „Lider gra na X — Dołącz”, kliknięte powiadomienie Windows, nowe wiadomości
  mib.on('party:changed', () => { if (friendsReload && $('p-friends').classList.contains('on')) friendsReload(); friendsBadge(); });
  mib.on('party:invite', x => { toast(x.nick + ' ' + T('zaprasza Cię do party. Odpowiedz na stronie Znajomi.')); friendsBadge(); });
  mib.on('party:play', x => { if (st.loggedIn) partyPop(x); });
  mib.on('party:join', x => { if (x && x.server && x.version) window.mibJoin(x.version, x.server); });
  mib.on('party:open', async () => { go('friends'); const s2 = await mib.call('prof:partyState'); if (s2 && !s2.error) openPartyChat(s2); });
  mib.on('party:messages', () => { if (partyChatReload) partyChatReload(); });
  mib.on('idea:reply', x => { if (x && x.reply) { ideaQueue.push(x); if (!ideaTimer) ideaTimer = setTimeout(ideaPop, 400); } });
  // Profil z konta Minecraft (od 0.26.0, main.js): założony, zalogowany albo połączony z profilem e-mail
  mib.on('profile:changed', async x => {
    await refresh();
    if (x && x.loggedOut) toast(T('Wylogowano z profilu MiB: profil loguje się razem z kontem Microsoft.'));
    else if (x && x.created) toast(T('Utworzyliśmy Twój profil MiB') + ': ' + x.nick + '. ' + T('Logujesz się do niego kontem Minecraft.'));
    else if (x && x.linked) toast(T('Profil MiB połączony z kontem Minecraft') + ' ' + x.linked + '.');
    else if (x && x.switched) toast(T('Przełączono profil MiB na') + ' ' + x.nick + '.');
    else toast(T('Zalogowano do profilu MiB kontem Minecraft.'));
  });
  document.querySelector('.nav[data-p="prof"]').addEventListener('click', () => { render(); refresh(); });
  // Kosmetyki i Sklep w pasku bocznym to ta sama strona z inną zakładką (od 0.30.0)
  document.querySelectorAll('.nav[data-p="cos"]').forEach(n => n.addEventListener('click', () => {
    cosTab = n.dataset.tab === 'shop' ? 'shop' : 'mine';
    renderCos();
  }));
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
  window.mibProfileUI = { modsShown, refresh, sidebar, holidays: () => holidayCheck(true), coinIcon, get loggedIn() { return !!(st.loggedIn || st.offline); },
    openShop: () => document.querySelector('#side .nav[data-tab="shop"]').click() };
  window.mibUI = { h, msg, fmtDate, capeThumb, itemImage, copyText, kindIcon };
  sidebar();
  render();
  refresh();
})();
