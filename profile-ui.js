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
        h('h2', {}, st.nick), st.founder ? h('em', { class: 'tag founder', title: T('Jeden z pierwszych 1000 profili MiB') }, T('Założyciel')) : null),
      h('div', { class: 'idrow' }, h('span', { class: 'mono', id: 'pf-id' }, st.mibId),
        h('button', { class: 'b ghost', on: { click: async () => { try { await navigator.clipboard.writeText(st.mibId); toast(T('Skopiowano')); } catch {} } } }, T('Kopiuj ID'))),
      h('div', { class: 'sec' }, h('h3', {}, T('Statystyki')), h('div', { class: 'stats' },
        stat('Czas gry przez MiB', MibProfile.formatPlaytime(st.playtimeMin || 0)),
        stat('Uruchomienia gry', String(st.launches || 0)),
        stat('Ulubiona wersja', fav || '—'),
        stat('Profil od', fmtDate(st.createdAt)))),
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
    box.replaceChildren(...(st.loading ? [h('h2', {}, T('Profil MiB')), h('p', { class: 'mut' }, T('Wczytywanie…'))] : st.loggedIn ? viewIn() : st.needsProfile ? viewComplete() : st.offline ? viewOffline() : viewOut()));
    if (st.loggedIn) mib.call('prof:cosmetics').then(l => { const e = $('pf-cos'); if (e) e.textContent = Array.isArray(l) ? T('Posiadane przedmioty') + ': ' + l.length : msg(l.error); });
  }

  // ===== Strona Kosmetyki =====
  const GLYPH = { cape: '▚', hat: '▀', wings: '▞' };
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
  const itemImage = (c, k) => (c.imageUrl && c.type === 'cape' && c.imageUrl.startsWith('data:image/png') ? capeThumb(c.imageUrl, k) : c.imageUrl ? h('img', { src: c.imageUrl, alt: '' }) : GLYPH[c.type] || '◆');
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

  // ===== Kosmetyki na postaci 3D (skinview3d): peleryna albo skrzydła (jak elytra) i czapka (jak hełm) =====
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
  // back: { texture, kind: 'cape' | 'elytra' } albo null; hat: tekstura czapki albo null. Zwraca, co widać.
  async function dress(viewer, { back = null, hat = null } = {}) {
    const st = dressed.get(viewer) || {};
    dressed.set(viewer, st);
    const my = st.gen = (st.gen || 0) + 1;
    const [bf, hf] = await Promise.all([back ? frames(back.texture).catch(() => null) : null, hat ? frames(hat).catch(() => null) : null]);
    if (st.gen !== my) return null;
    clearInterval(st.timer); st.timer = null;
    try { if (bf) viewer.loadCape(bf[0], { backEquipment: back.kind }); else viewer.resetCape(); } catch {}
    await putHat(viewer, st, hf, my);
    const n = Math.max(bf ? bf.length : 1, hf ? hf.length : 1);
    if (n > 1) {
      let i = 0;
      st.timer = setInterval(() => {
        if (!viewer.canvas || !viewer.canvas.isConnected) { clearInterval(st.timer); st.timer = null; return; }
        i++;
        if (bf && bf.length > 1 && viewer.capeTexture) draw(viewer.capeCanvas, bf[i % bf.length], 0, viewer.capeTexture);
        if (hf && hf.length > 1 && st.hatTex) draw(st.hatCanvas, hf[i % hf.length], 0, st.hatTex);
      }, MibProfile.CAPE_FRAME_MS);
    }
    return { back: bf ? back.kind : '', hat: !!(hf && st.hat), frames: n };
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
    // klasa tekstury z samego skinview3d; skin ładuje się osobno, więc chwilę na nią czekamy
    for (let i = 0; i < 20 && !(viewer.skinTexture || viewer.capeTexture); i++) { await new Promise(r => setTimeout(r, 100)); if (st.gen !== my) return; }
    const Tex = (viewer.skinTexture || viewer.capeTexture || {}).constructor;
    if (!Tex) return;
    st.hatCanvas = document.createElement('canvas');
    st.hatCanvas.width = st.hatCanvas.height = hf[0].width;
    st.hatTex = new Tex(st.hatCanvas);
    st.hatTex.magFilter = st.hatTex.minFilter = 1003;
    if (viewer.skinTexture) st.hatTex.colorSpace = viewer.skinTexture.colorSpace;
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
  window.mibDress = dress;

  // Strona Kosmetyki: na postaci założone przedmioty, a klik w przedmiot to przymiarka (bez zakładania).
  // data-back i data-hat na płótnie mówią, co widać.
  let trying = {};
  async function dressPage(list) {
    if (!skinViewer) return;
    const on = t => trying[t] || list.find(c => c.equipped && c.type === t && c.texture);
    const tried = trying.wings && !trying.cape ? 'wings' : null;
    const cape = tried ? null : on('cape'), wings = on('wings'), hat = on('hat');
    const back = cape ? { texture: cape.texture, kind: 'cape' } : wings ? { texture: wings.texture, kind: 'elytra' } : null;
    const r = await dress(skinViewer, { back, hat: hat ? hat.texture : null });
    if (r) { skinCanvas.dataset.back = r.back; skinCanvas.dataset.hat = r.hat ? '1' : ''; skinCanvas.dataset.frames = r.frames; }
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
    box.replaceChildren(h('h2', {}, T('Kosmetyki')), skin, h('div', { class: 'sec' }, h('h3', {}, T('Przedmioty MiB')), h('p', { class: 'lead' }, T('Przedmioty przypisane do profilu') + ' ' + st.nick + '.'), form, err,
      items.length ? h('p', { class: 'mut' }, T('Kliknij przedmiot, żeby przymierzyć go na postaci. „Załóż” zakłada go w grze.')) : null, grid));
  }

  // ===== Strona Pomysły =====
  const IDEA_CAT = { feature: 'Nowa funkcja', cosmetic: 'Kosmetyk', bug: 'Błąd do naprawy', other: 'Inne' };
  const IDEA_ST = { new: 'Wysłany', seen: 'Przeczytany', planned: 'W planach', done: 'Zrobione', rejected: 'Odrzucony' };
  async function renderIdeas() {
    const box = $('ideas-box');
    const head = [h('h2', {}, T('Pomysły')), h('p', { class: 'lead' }, T('Masz pomysł, co dodać albo poprawić w MiB Client? Napisz go tutaj, a trafi prosto do twórcy launchera.'))];
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
          h('em', { class: 'tag st-' + i.status }, T(IDEA_ST[i.status] || i.status))),
        h('p', {}, i.body))) : [h('p', { class: 'empty' }, T('Nie masz jeszcze wysłanych pomysłów.'))]));
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
  let friendsTimer = null;
  async function friendsBadge() {
    const nav = document.querySelector('.nav[data-p="friends"]');
    let b = nav.querySelector('.cnt');
    if (!st.loggedIn) { if (b) b.hidden = true; return; }
    const [l, inv] = await Promise.all([mib.call('prof:friends'), mib.call('prof:invites')]);
    if (!Array.isArray(l)) return;
    const n = l.filter(f => f.state === 'incoming').length + (Array.isArray(inv) ? inv.length : 0);
    if (!b) { b = h('em', { class: 'cnt' }); nav.append(b); }
    b.textContent = String(n); b.hidden = !n;
  }
  setInterval(() => { if (st.loggedIn) friendsBadge(); }, 2 * 60 * 1000);
  // Launcher sprawdza znajomych co 30 s (main.js): nowe zaproszenie do gry albo kliknięte powiadomienie
  mib.on('friends:changed', () => { if (!st.loggedIn) return; if ($('p-friends').classList.contains('on')) renderFriends(); else friendsBadge(); });
  mib.on('friends:open', () => go('friends'));
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
      h('div', { class: 'fi' }, h('b', {}, f.nick), h('span', { class: 'mut' }, f.state === 'friend' ? statusText(f) : MibProfile.formatMibId(f.num))),
      ...buttons);
    async function load() {
      clearTimeout(friendsTimer);
      const [l, inv, me] = await Promise.all([mib.call('prof:friends'), mib.call('prof:invites'), mib.call('prof:nowPlaying')]);
      if (!box.isConnected || !$('p-friends').classList.contains('on')) return;
      if (!Array.isArray(l)) return list.replaceChildren(h('p', { class: 'err' }, msg(l.error, l.detail)));
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
          act('Odrzuć', 'ghost', () => mib.call('prof:friendAnswer', { id: f.id, accept: false }))))),
        fr.length ? sec('Twoi znajomi', fr.map(f => row(f,
          f.status === 'game' && f.server && f.version && f.server !== here ? act('Dołącz', '', async () => { window.mibJoin(f.version, f.server); }) : null,
          canInvite(f) ? invite(f) : null,
          act('Usuń', 'ghost', () => confirm(T('Usunąć') + ' ' + f.nick + ' ' + T('ze znajomych?')) ? mib.call('prof:friendRemove', { id: f.id }) : null))))
          : h('p', { class: 'empty' }, T('Nie masz jeszcze znajomych. Wpisz nick albo ID MiB kolegi i kliknij „Zaproś”.')),
        sec('Wysłane zaproszenia', out.map(f => row(f, act('Anuluj', 'ghost', () => mib.call('prof:friendRemove', { id: f.id }))))),
      ].filter(Boolean));
      friendsBadge();
      friendsTimer = setTimeout(load, 30000);
    }
    box.replaceChildren(...head, form, err, list);
    load();
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
    if (st.loggedIn && !was) { mibSync.pull(); if (window.mibWave) mibWave(); }
  }
  async function refresh() { apply(await mib.call('prof:state')); }
  document.querySelector('.nav[data-p="prof"]').addEventListener('click', () => { render(); refresh(); });
  document.querySelector('.nav[data-p="cos"]').addEventListener('click', renderCos);
  document.querySelector('.nav[data-p="ideas"]').addEventListener('click', renderIdeas);
  document.querySelector('.nav[data-p="friends"]').addEventListener('click', renderFriends);
  // Efekt odblokowania nowego kosmetyku
  window.mibUnlock = item => {
    if (document.documentElement.classList.contains('noanim')) return toast(T('Nowy przedmiot') + ': ' + item.name);
    const old = $('unlock'); if (old) old.remove();
    const o = h('div', { id: 'unlock', role: 'dialog', 'aria-label': T('Nowy przedmiot!') }, h('div', { class: 'ring' }),
      h('div', { class: 'card2' }, h('i', {}, itemImage(item, 6)), h('small', {}, T('Nowy przedmiot!')), h('b', {}, item.name)));
    const close = () => { o.classList.add('bye'); setTimeout(() => o.remove(), 250); };
    o.onclick = close;
    document.body.append(o);
    setTimeout(() => { if (o.isConnected) close(); }, 2200);
  };
  window.mibProfileUI = { modsShown, refresh, get loggedIn() { return !!(st.loggedIn || st.offline); } };
  window.mibUI = { h, msg, fmtDate, capeThumb };
  sidebar();
  render();
  refresh();
})();
