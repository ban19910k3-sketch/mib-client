// Panel admina (widoczny tylko dla konta admina; uprawnienia sprawdza baza).
// Tylko po polsku — panel widzi wyłącznie właściciel.
(() => {
  const { h, msg, fmtDate, itemImage } = window.mibUI;
  const ERR = {
    not_admin: 'To konto nie jest adminem.',
    cosmetic_id_invalid: 'ID przedmiotu: 2–32 znaki, tylko małe litery, cyfry i _ (np. cape_turniej).',
    cosmetic_name_invalid: 'Nazwa przedmiotu musi mieć od 1 do 40 znaków.',
    cosmetic_type_invalid: 'Nieznany rodzaj przedmiotu.',
    aura_id_invalid: 'Wybierz ruch aury: ID aury kończy się na _souls, _pumpkins, _ghosts albo _magic.',
    cosmetic_in_use: 'Tego przedmiotu nie można usunąć: mają go gracze albo są do niego kody.',
    cosmetic_missing: 'Najpierw dodaj ten przedmiot w zakładce Kosmetyki.',
    codes_invalid: 'Kody: od 1 do 100 naraz, użyć od 1 do 100 000, data końca w przyszłości; kod o własnej nazwie tylko jeden.',
    code_name_invalid: 'Nazwa kodu: 4–24 znaki, litery A–Z, cyfry i myślnik.',
    code_exists: 'Taki kod już istnieje. Wybierz inną nazwę.',
    warn_reason: 'Wpisz powód (najwyżej 300 znaków). Gracz go zobaczy.',
    cannot_ban_admin: 'Konta admina nie można ostrzec ani zbanować.',
    already_banned: 'Ten gracz ma już bana.',
    report_missing: 'Tego zgłoszenia już nie ma.',
    cannot_delete_admin: 'Nie można usunąć konta admina.',
    announcement_missing: 'Ta aktualność została już usunięta.',
    texture_not_png: 'To nie jest plik PNG.',
    texture_size: 'Tekstura musi mieć 64×32 piksele (albo 128×64, 256×128, 512×256). Animowana: klatki 64×32 jedna pod drugą, najwyżej 32 (np. 64×128 to 4 klatki).',
    texture_too_big: 'Plik jest za duży (najwyżej 100 KB).',
    idea_missing: 'Ten pomysł został już usunięty.',
    idea_rewarded: 'Ten pomysł jest już nagrodzony.',
    idea_reply_long: 'Odpowiedź może mieć najwyżej 500 znaków.',
    gift_message_long: 'Wiadomość może mieć najwyżej 200 znaków.',
    player_missing: 'Tego gracza już nie ma.',
    coins_amount: 'Podaj liczbę coinsów inną niż 0 (najwyżej milion). Minus zabiera coinsy.',
    coins_not_enough: 'Gracz nie ma tylu coinsów, żeby je zabrać.',
    shop_url_invalid: 'Link do sklepu musi zaczynać się od https:// i mieć najwyżej 300 znaków.',
  };
  // Prezent dla gracza: kosmetyk i wiadomość (gracz odbiera w launcherze przyciskiem „Odbierz”); idea = nagroda za ten pomysł
  async function giftForm(user, idea, done, owned = []) {
    const cos = await mib.call('prof:allCosmetics', { lite: true });
    const pick = h('select', { class: 'gift-pick', 'aria-label': 'Kosmetyk' }, ...(Array.isArray(cos) ? cos.filter(c => !owned.some(o => o.id === c.id)).map(c => h('option', { value: c.id }, c.name + ' (' + (TYPES[c.type] || c.type) + ')')) : []));
    const note = h('input', { class: 'gift-note', maxlength: 200, placeholder: idea ? 'Wiadomość, np. Dzięki za znalezienie błędu z czatem!' : 'Wiadomość dla gracza (nieobowiązkowa)' });
    const send = h('button', { class: 'b', type: 'button', on: { click: async () => {
      if (!pick.value) return toast('Najpierw dodaj przedmiot w zakładce Kosmetyki.', 1);
      send.disabled = true;
      const r = await call('admin_gift', { p_user: user, p_cosmetic: pick.value, p_message: note.value, p_idea: idea || null });
      send.disabled = false;
      if (failed(r)) return toast(err(r), 1);
      toast('Prezent wysłany. Gracz odbierze go w launcherze.');
      done();
    } } }, idea ? 'Wyślij nagrodę' : 'Wyślij prezent');
    return h('div', { class: 'row gift-form' }, pick, note, send);
  }
  const err = r => (r && ERR[r.error]) || msg(r && r.error || 'unknown', r && r.detail);
  const call = (fn, args) => mib.call('prof:admin', { fn, args });
  const failed = r => r && !Array.isArray(r) && r.error;
  const TYPES = { cape: 'Peleryna', hat: 'Czapka', wings: 'Skrzydła', aura: 'Aura' };
  // Ruch cząsteczek aury: końcówka ID (launcher i mod znają tylko te)
  const MOTIONS = { souls: 'Dusze unoszą się z ziemi', pumpkins: 'Dynie krążą i lecą w górę, iskry', ghosts: 'Trzy duszki krążą wokół', magic: 'Spirala iskier w górę' };
  const copy = async t => { try { await navigator.clipboard.writeText(t); toast('Skopiowano'); } catch {} };
  let tab = 'ann';
  // Jeden podgląd 3D na cały panel (każdy nowy SkinViewer zajmuje kontekst WebGL)
  let capeCanvas = null, capeViewer = null;
  // Podgląd 3D przedmiotu na postaci (peleryna, skrzydła, czapka jak hełm, aura; animowane też się ruszają)
  function capePreview(dataUrl, type = 'cape', id = '') {
    if (!capeCanvas) capeCanvas = h('canvas', { width: 180, height: 220, class: 'cape3d', hidden: true });
    try {
      if (dataUrl && !capeViewer) {
        capeViewer = new skinview3d.SkinViewer({ canvas: capeCanvas, width: 180, height: 220 }); capeViewer.autoRotate = true; capeViewer.autoRotateSpeed = 0.8; capeViewer.controls.enableZoom = false;
        mib.call('skin', 'MHF_Steve').then(s => capeViewer.loadSkin(s)).catch(() => {});
      }
      if (capeViewer) window.mibDress(capeViewer, dataUrl ? window.mibOutfit([{ type, id, texture: dataUrl }]) : {});
      capeCanvas.hidden = !dataUrl;
    } catch { capeCanvas.hidden = true; }
    return capeCanvas;
  }

  // ===== Aktualności (panel Aktualności na stronie głównej i strona Aktualności) =====
  async function viewAnn(box) {
    const title = h('input', { maxlength: 80, id: 'ad-title', placeholder: 'np. Nowa peleryna w Kosmetykach' });
    const body = h('textarea', { maxlength: 1000, id: 'ad-body', placeholder: 'Treść (opcjonalnie)' });
    const pin = h('input', { type: 'checkbox', id: 'ad-pin' }), until = h('input', { type: 'date', id: 'ad-until' }), popup = h('input', { type: 'checkbox', id: 'ad-popup' });
    const e = h('p', { class: 'err' }), save = h('button', { class: 'b', id: 'ad-save', type: 'submit' }, 'Dodaj aktualność');
    let editId = null;
    const cancel = h('button', { class: 'b ghost', type: 'button', hidden: true, on: { click: () => reset() } }, 'Anuluj zmiany');
    const reset = () => { editId = null; title.value = body.value = until.value = ''; pin.checked = popup.checked = false; save.textContent = 'Dodaj aktualność'; cancel.hidden = true; };
    const list = h('div', { id: 'ad-list' });
    async function load() {
      const l = await call('admin_list_announcements');
      if (failed(l)) return list.replaceChildren(h('p', { class: 'err' }, err(l)));
      list.replaceChildren(...(l.length ? l.map(a => {
        const expired = a.visible_until && new Date(a.visible_until) < new Date();
        return h('div', { class: 'card arow' },
          h('div', {}, h('b', {}, a.title, a.pinned ? h('em', { class: 'tag' }, 'przypięte') : null, a.popup ? h('em', { class: 'tag' }, 'okno') : null, expired ? h('em', { class: 'tag' }, 'wygasło') : null),
            h('span', { class: 'mut' }, fmtDate(a.created_at) + (a.visible_until ? ', widoczne do ' + fmtDate(a.visible_until) : ''))),
          h('button', { class: 'b ghost', on: { click: () => {
            editId = a.id; title.value = a.title; body.value = a.body; pin.checked = a.pinned; popup.checked = !!a.popup; until.value = a.visible_until ? a.visible_until.slice(0, 10) : '';
            save.textContent = 'Zapisz zmiany'; cancel.hidden = false; title.focus();
          } } }, 'Zmień'),
          h('button', { class: 'b danger', on: { click: async () => {
            if (!confirm('Usunąć aktualność „' + a.title + '”?')) return;
            const r = await call('admin_delete_announcement', { p_id: a.id });
            if (failed(r)) return toast(err(r), 1);
            load(); window.mibLoadAnn();
          } } }, 'Usuń'));
      }) : [h('p', { class: 'empty' }, 'Nie ma jeszcze aktualności. Dodaj pierwszą powyżej.')]));
    }
    const form = h('form', { class: 'pform', on: { submit: async ev => {
      ev.preventDefault();
      if (!title.value.trim()) { e.textContent = 'Wpisz tytuł aktualności.'; return; }
      save.disabled = true;
      const r = await call('admin_save_announcement', { p_id: editId, p_title: title.value, p_body: body.value, p_pinned: pin.checked,
        p_until: until.value ? new Date(until.value + 'T23:59:59').toISOString() : null, p_popup: popup.checked });
      save.disabled = false;
      if (failed(r)) { e.textContent = err(r); return; }
      e.textContent = ''; toast(editId ? 'Aktualność zmieniona.' : 'Aktualność dodana.'); reset(); load(); window.mibLoadAnn();
    } } },
    h('label', { class: 'sr' }, h('span', {}, 'Tytuł'), title),
    h('label', { class: 'sr' }, h('span', {}, 'Treść'), body),
    h('label', { class: 'sr' }, h('span', {}, 'Widoczne do'), h('span', { class: 'fld' }, until, h('small', { class: 'mut' }, 'Puste = bez końca'))),
    h('label', { class: 'ck' }, pin, 'Przypnij na górze'),
    h('label', { class: 'ck' }, popup, 'Ważna: pokaż graczom w oknie (każdy zobaczy ją raz, także powiadomienie w grze)'), e, h('div', { class: 'row' }, save, cancel));
    box.append(h('p', { class: 'lead' }, 'Aktualności widzą wszyscy gracze: 3 najnowsze w panelu Aktualności na stronie głównej, wszystkie na stronie Aktualności. Zmiany widać od razu, bez aktualizacji launchera. Kliknij „Zmień”, żeby poprawić wpis.'), form, h('div', { class: 'sec' }, h('h3', {}, 'Dodane aktualności'), list));
    load();
  }

  // ===== Pomysły graczy =====
  const IDEA_CAT = { feature: 'Nowa funkcja', cosmetic: 'Kosmetyk', bug: 'Błąd', other: 'Inne' };
  const IDEA_ST = { new: 'Nowy', seen: 'Przeczytany', planned: 'W planach', done: 'Zrobione', rejected: 'Odrzucony' };
  // Licznik nowych pomysłów przy „Panel admina” i na zakładce; raz na uruchomienie także powiadomienie
  let fresh = 0, freshReports = 0, greeted = false;
  async function badge() {
    const [n, r] = await Promise.all([call('admin_count_new_ideas'), call('admin_count_new_reports')]);
    if (typeof n !== 'number') return;
    fresh = n; freshReports = typeof r === 'number' ? r : 0;
    const all = n + freshReports, nav = document.querySelector('.nav[data-p="admin"]');
    let b = nav.querySelector('.cnt');
    if (!b) { b = h('em', { class: 'cnt' }); nav.append(b); }
    b.textContent = all > 99 ? '99+' : String(all);
    b.hidden = !all;
    const t = document.querySelector('[data-tab="ideas"]'), t2 = document.querySelector('[data-tab="reports"]');
    if (t) t.textContent = 'Pomysły' + (n ? ' (' + n + ')' : '');
    if (t2) t2.textContent = 'Zgłoszenia' + (freshReports ? ' (' + freshReports + ')' : '');
    if (all && !greeted) {
      greeted = true;
      toast([n ? 'Nowe pomysły od graczy: ' + n + '.' : '', freshReports ? 'Nowe zgłoszenia graczy: ' + freshReports + '.' : ''].filter(Boolean).join(' ') + ' Zobacz w Panelu admina.');
    }
  }
  window.mibAdminBadge = badge;
  setInterval(() => { if (!document.querySelector('.nav[data-p="admin"]').hidden) badge(); }, 5 * 60 * 1000);

  async function viewIdeas(box) {
    const filter = h('select', { id: 'ai-filter' }, h('option', { value: '' }, 'Wszystkie'), ...Object.entries(IDEA_ST).map(([k, v]) => h('option', { value: k }, v)));
    const sort = h('select', { id: 'ai-sort', 'aria-label': 'Kolejność' }, h('option', { value: '' }, 'Nowe na górze'), h('option', { value: 'votes' }, 'Najwięcej głosów graczy'));
    const list = h('div', { id: 'ai-list' });
    let all = [];
    function show() {
      let l = filter.value ? all.filter(i => i.status === filter.value) : all;
      if (sort.value === 'votes') l = l.slice().sort((a, b) => (b.votes || 0) - (a.votes || 0));
      list.replaceChildren(...(l.length ? l.map(i => {
        const status = h('select', { 'aria-label': 'Status pomysłu', on: { change: async () => {
          const r = await call('admin_set_idea_status', { p_id: i.id, p_status: status.value });
          if (failed(r)) { status.value = i.status; return toast(err(r), 1); }
          i.status = status.value; toast('Status: ' + IDEA_ST[i.status] + '.'); show(); badge();
        } } }, ...Object.entries(IDEA_ST).map(([k, v]) => h('option', { value: k, selected: k === i.status }, v)));
        return h('div', { class: 'card idea' + (i.status === 'new' ? ' fresh' : '') },
          h('div', { class: 'ihead' }, h('b', {}, i.nick || 'konto usunięte'), i.num ? h('span', { class: 'mono mut' }, window.MibProfile.formatMibId(i.num)) : null,
            h('em', { class: 'tag' }, IDEA_CAT[i.category] || i.category), i.votes ? h('em', { class: 'tag votes' }, 'Głosy: ' + i.votes) : null, h('span', { class: 'mut' }, fmtDate(i.created_at))),
          h('p', {}, i.body),
          i.has_details ? crashBox(i) : null,
          replyBox(i),
          h('div', { class: 'row', style: 'align-items:center' }, status,
            i.rewarded ? h('em', { class: 'tag hunter' }, 'Nagrodzony') : i.user_id ? h('button', { class: 'b', on: { click: async e => {
              const card = e.currentTarget.closest('.idea');
              if (card.querySelector('.gift-form')) return;
              card.append(await giftForm(i.user_id, i.id, () => { i.rewarded = true; i.status = 'done'; show(); badge(); }));
            } } }, 'Nagródź') : null,
            h('button', { class: 'b ghost', on: { click: () => copy(i.body) } }, 'Kopiuj'),
            h('button', { class: 'b danger', on: { click: async () => {
              if (!confirm('Usunąć ten pomysł?')) return;
              const r = await call('admin_delete_idea', { p_id: i.id });
              if (failed(r)) return toast(err(r), 1);
              all = all.filter(x => x.id !== i.id); show(); badge();
            } } }, 'Usuń')));
      }) : [h('p', { class: 'empty' }, all.length ? 'Brak pomysłów z tym statusem.' : 'Gracze nie wysłali jeszcze żadnych pomysłów.')]));
    }
    // Raport awarii wysłany z launchera („Wyślij do twórcy”): pobierany dopiero po kliknięciu
    function crashBox(i) {
      const pre = h('pre', { class: 'crash-log', hidden: true });
      const btn = h('button', { class: 'b ghost', type: 'button', on: { click: async () => {
        if (!pre.hidden) { pre.hidden = true; btn.textContent = 'Pokaż raport awarii'; return; }
        const r = await call('admin_idea_details', { p_id: i.id });
        if (failed(r)) return toast(err(r), 1);
        pre.textContent = r || ''; pre.hidden = false; btn.textContent = 'Schowaj raport';
      } } }, 'Pokaż raport awarii');
      return h('div', { class: 'crash-box' }, h('div', { class: 'row' }, btn, h('button', { class: 'b ghost', type: 'button', on: { click: async () => {
        const r = pre.textContent || await call('admin_idea_details', { p_id: i.id });
        if (failed(r)) return toast(err(r), 1);
        copy(r || '');
      } } }, 'Kopiuj raport')), pre);
    }
    // Odpowiedź dla autora: widzi ją pod swoim pomysłem i dostaje powiadomienie
    function replyBox(i) {
      const t = h('textarea', { class: 'idea-reply', maxlength: 500, rows: 2, placeholder: 'Odpowiedź dla gracza (zobaczy ją pod swoim pomysłem)' });
      t.value = i.reply || '';
      const save = h('button', { class: 'b ghost', type: 'button', on: { click: async () => {
        save.disabled = true;
        const st = i.status === 'new' ? 'seen' : i.status;
        const r = await call('admin_answer_idea', { p_id: i.id, p_status: st, p_reply: t.value });
        save.disabled = false;
        if (failed(r)) return toast(err(r), 1);
        i.reply = t.value.trim() || null; i.status = st; toast('Odpowiedź wysłana.'); show(); badge();
      } } }, 'Wyślij odpowiedź');
      return h('div', { class: 'row idea-answer' }, t, save);
    }
    filter.onchange = sort.onchange = show;
    box.append(h('p', { class: 'lead' }, 'Pomysły z zakładki Pomysły. Nowe są na górze. Gracz widzi status i Twoją odpowiedź i dostaje o nich powiadomienie. „Nagródź” wysyła kosmetyk do odebrania w launcherze. Gracze głosują na pomysły innych (bez zgłoszeń błędów); „Odrzucony” zdejmuje pomysł z głosowania.'),
      h('div', { class: 'row', style: 'align-items:center' }, h('span', { class: 'mut' }, 'Pokaż:'), filter, sort), list);
    const l = await call('admin_list_ideas');
    if (failed(l)) return list.replaceChildren(h('p', { class: 'err' }, err(l)));
    all = l; show(); badge();
  }

  // ===== Zgłoszenia graczy: ostrzeżenie (4. = ban), ban od razu, odrzucenie =====
  const REASON = { insult: 'Wyzwiska', spam: 'Spam', scam: 'Oszustwo', other: 'Inne' };
  const WARN_TEXT = { insult: 'Obrażanie innych graczy', spam: 'Spam w wiadomościach', scam: 'Próba oszustwa', other: '' };
  const REP_ST = { new: 'Nowe', warned: 'Ostrzeżony', banned: 'Zbanowany', dismissed: 'Odrzucone' };
  // Ostrzeż / Zbanuj / Odbanuj dla gracza; report = zgłoszenie, które to załatwia; done() po zmianie
  function moderation(p, report, done) {
    if (p.banned) return h('div', { class: 'row mod-row', style: 'align-items:center' }, h('em', { class: 'tag ban' }, 'Zbanowany'),
      h('button', { class: 'b ghost', type: 'button', on: { click: async () => {
        if (!confirm('Zdjąć bana graczowi ' + p.nick + '? Ostrzeżenia wrócą do zera.')) return;
        const r = await call('admin_unban', { p_user: p.user_id || p.id });
        if (failed(r)) return toast(err(r), 1);
        toast('Ban zdjęty.'); done();
      } } }, 'Odbanuj'));
    const why = h('input', { class: 'warn-why', maxlength: 300, placeholder: 'Powód (gracz go zobaczy)', value: report ? WARN_TEXT[report.reason] || '' : '' });
    return h('div', { class: 'row mod-row', style: 'align-items:center' }, h('span', { class: 'mut' }, 'Ostrzeżenia: ' + (p.warnings || 0) + '/4'), why,
      h('button', { class: 'b', type: 'button', on: { click: async () => {
        const r = await call('admin_warn', { p_user: p.user_id || p.id, p_reason: why.value, p_report: report ? report.id : null });
        if (failed(r)) return toast(err(r), 1);
        toast(r.banned ? 'Czwarte ostrzeżenie: konto zbanowane.' : 'Ostrzeżenie ' + r.warnings + '/4 wysłane.'); done();
      } } }, 'Ostrzeż (' + Math.min(4, (p.warnings || 0) + 1) + '/4)'),
      h('button', { class: 'b danger', type: 'button', on: { click: async () => {
        if (!confirm('Zbanować ' + p.nick + ' od razu, bez czekania na 4 ostrzeżenia?')) return;
        const r = await call('admin_ban', { p_user: p.user_id || p.id, p_reason: why.value, p_report: report ? report.id : null });
        if (failed(r)) return toast(err(r), 1);
        toast('Konto zbanowane.'); done();
      } } }, 'Zbanuj'));
  }
  async function viewReports(box) {
    const filter = h('select', { id: 'ar-filter' }, h('option', { value: 'new' }, 'Nowe'), h('option', { value: '' }, 'Wszystkie'));
    const list = h('div', { id: 'ar-list' });
    let all = [];
    async function load() {
      const l = await call('admin_list_reports');
      if (failed(l)) return list.replaceChildren(h('p', { class: 'err' }, err(l)));
      all = l; show(); badge();
    }
    function show() {
      const l = filter.value ? all.filter(r => r.status === filter.value) : all;
      list.replaceChildren(...(l.length ? l.map(r => h('div', { class: 'card idea report' + (r.status === 'new' ? ' fresh' : '') },
        h('div', { class: 'ihead' }, h('b', {}, r.nick), h('span', { class: 'mono mut' }, window.MibProfile.formatMibId(r.num)),
          h('em', { class: 'tag' }, REASON[r.reason] || r.reason), h('em', { class: 'tag' + (r.status === 'new' ? ' hunter' : '') }, REP_ST[r.status] || r.status),
          h('span', { class: 'mut' }, 'zgłosił ' + (r.reporter || 'konto usunięte') + ', ' + fmtDate(r.created_at))),
        r.note ? h('p', {}, '„' + r.note + '”') : null,
        Array.isArray(r.messages) && r.messages.length ? h('div', { class: 'rp-log' }, ...r.messages.map(m => h('div', { class: m.reported ? 'on' : '' }, h('b', {}, m.from + ': '), m.body))) : null,
        r.status === 'new' || r.banned ? moderation(r, r.status === 'new' ? r : null, load) : null,
        r.status === 'new' ? h('div', { class: 'row' }, h('button', { class: 'b ghost', type: 'button', on: { click: async () => {
          const x = await call('admin_dismiss_report', { p_id: r.id });
          if (failed(x)) return toast(err(x), 1);
          toast('Zgłoszenie odrzucone.'); load();
        } } }, 'Odrzuć zgłoszenie (bez kary)')) : null))
        : [h('p', { class: 'empty' }, all.length ? 'Brak nowych zgłoszeń.' : 'Gracze nie wysłali jeszcze żadnych zgłoszeń.')]));
    }
    filter.onchange = show;
    box.append(h('p', { class: 'lead' }, 'Zgłoszenia wiadomości i graczy. Ostrzeżenie widzi gracz w launcherze; czwarte to ban: bez wiadomości, znajomych, zaproszeń, pomysłów i kosmetyków w grze. Ban możesz zdjąć w zakładce Gracze.'),
      h('div', { class: 'row', style: 'align-items:center' }, h('span', { class: 'mut' }, 'Pokaż:'), filter), list);
    load();
  }

  // ===== Kosmetyki =====
  async function viewCos(box) {
    const id = h('input', { id: 'ac-id', maxlength: 32, placeholder: 'np. cape_turniej' }), name = h('input', { id: 'ac-name', maxlength: 40, placeholder: 'np. Peleryna Turniejowa' });
    const type = h('select', { id: 'ac-type' }, ...Object.entries(TYPES).map(([k, v]) => h('option', { value: k }, v)));
    const motion = h('select', { id: 'ac-motion' }, ...Object.entries(MOTIONS).map(([k, v]) => h('option', { value: k }, v)));
    const motionRow = h('label', { class: 'sr', hidden: true }, h('span', {}, 'Ruch aury'), motion);
    // aura: ruch to końcówka ID (np. aura_zimowa_magic)
    const withMotion = () => { if (type.value === 'aura' && !id.disabled) id.value = id.value.trim().replace(/_(souls|pumpkins|ghosts|magic)$/, '') + '_' + motion.value; };
    const prevImg = h('img', { class: 'texprev', alt: '', hidden: true }), cv = capePreview(null);
    const e = h('p', { class: 'err' }), save = h('button', { class: 'b', type: 'submit', id: 'ac-save' }, 'Zapisz przedmiot');
    let texture = null, editing = false, known = new Set();
    let shown = null;
    function preview(dataUrl) { shown = dataUrl; prevImg.src = dataUrl || ''; prevImg.hidden = !dataUrl; capePreview(dataUrl, type.value, id.value.trim()); }
    type.onchange = () => { motionRow.hidden = type.value !== 'aura'; if (type.value === 'aura') withMotion(); preview(shown); };
    motion.onchange = () => { withMotion(); preview(shown); };
    id.onchange = () => { if (type.value === 'aura') withMotion(); preview(shown); };
    const pick = h('button', { class: 'b ghost', type: 'button', on: { click: async () => {
      const r = await mib.call('admin:pickTexture');
      if (!r) return;
      if (r.error) { e.textContent = err(r) + (r.width ? ' Ten plik ma ' + r.width + '×' + r.height + '.' : ''); return; }
      e.textContent = ''; texture = r.dataUrl; preview(texture);
    } } }, 'Wybierz teksturę PNG…');
    const list = h('div', { class: 'cos-grid', id: 'ac-list' });
    // Link do sklepu MiB Coins: przycisk „Kup MiB Coins” w Kosmetykach u graczy (pusty = bez przycisku)
    const shop = h('input', { id: 'ac-shop', maxlength: 300, placeholder: 'https://… (strona, na której gracze kupują MiB Coins)' });
    mib.call('prof:wallet').then(w => { if (w && w.shopUrl && !shop.value) shop.value = w.shopUrl; });
    const shopSave = h('button', { class: 'b', id: 'ac-shop-save', type: 'button', on: { click: async () => {
      const r = await call('admin_set_config', { p_key: 'shop_url', p_value: shop.value.trim() });
      if (failed(r)) return toast(err(r), 1);
      toast(shop.value.trim() ? 'Link do sklepu zapisany. Gracze widzą przycisk „Kup MiB Coins”.' : 'Link usunięty. Przycisk sklepu zniknął.');
    } } }, 'Zapisz link');
    const shopBox = h('div', { class: 'sec' }, h('h3', {}, 'Sklep MiB Coins'),
      h('p', { class: 'lead' }, 'Przycisk „Kup MiB Coins” w Kosmetykach otwiera ten link w przeglądarce, z numerem MiB gracza na końcu (?mib=MIB-000123). Coinsy dodajesz w zakładce Gracze.'),
      h('div', { class: 'row' }, shop, shopSave));
    async function load() {
      const l = await mib.call('prof:allCosmetics');
      if (failed(l)) return list.replaceChildren(h('p', { class: 'err' }, err(l)));
      known = new Set(l.map(c => c.id));
      list.replaceChildren(...(l.length ? l.map(c => h('div', { class: 'cosi' },
        h('i', {}, c.texture ? itemImage({ type: c.type, imageUrl: c.texture }, 5) : '◆'),
        h('b', {}, c.name), h('small', { class: 'mut' }, c.id + ', ' + (TYPES[c.type] || c.type)),
        h('div', { class: 'row' },
          h('button', { class: 'b ghost', on: { click: () => { editing = true; id.value = c.id; id.disabled = true; name.value = c.name; type.value = c.type; motionRow.hidden = true; texture = null; preview(c.texture); save.textContent = 'Zapisz zmiany'; name.focus(); } } }, 'Edytuj'),
          h('button', { class: 'b danger', on: { click: async () => {
            if (!confirm('Usunąć przedmiot „' + c.name + '”?')) return;
            const r = await call('admin_delete_cosmetic', { p_id: c.id });
            if (failed(r)) return toast(err(r), 1);
            load();
          } } }, 'Usuń')))) : [h('p', { class: 'empty' }, 'Katalog jest pusty. Dodaj pierwszy przedmiot powyżej.')]));
    }
    const form = h('form', { class: 'pform', on: { submit: async ev => {
      ev.preventDefault();
      if (!editing && known.has(id.value.trim())) { e.textContent = 'Przedmiot o takim ID już istnieje. Kliknij „Edytuj” przy nim, żeby go zmienić.'; return; }
      save.disabled = true;
      const r = await call('admin_save_cosmetic', { p_id: id.value.trim(), p_name: name.value, p_type: type.value, p_texture: texture });
      save.disabled = false;
      if (failed(r)) { e.textContent = err(r); return; }
      toast('Przedmiot zapisany.'); e.textContent = ''; id.value = name.value = ''; id.disabled = false; editing = false; texture = null; motionRow.hidden = type.value !== 'aura'; preview(null); save.textContent = 'Zapisz przedmiot'; load();
    } } },
    h('label', { class: 'sr' }, h('span', {}, 'ID (stałe)'), id), h('label', { class: 'sr' }, h('span', {}, 'Nazwa'), name),
    h('label', { class: 'sr' }, h('span', {}, 'Rodzaj'), type), motionRow,
    h('div', { class: 'sr' }, h('span', {}, 'Tekstura'), h('span', { class: 'fld' }, h('span', { class: 'row', style: 'align-items:center' }, pick, prevImg),
      h('small', { class: 'mut' }, 'PNG 64×32 jak peleryna w Minecrafcie. Animowana: klatki jedna pod drugą (64×128 = 4 klatki), 10 klatek na sekundę. ' +
        'Skrzydła jak u wróżki: klatka 128×64, przód skrzydła w polu 32×40 od lewego górnego rogu, obok jego lustro (węższe skrzydła wyglądają jak elytra). ' +
        'Aura: obrazki cząsteczek 8×8 w pierwszym rzędzie tekstury 64×32.'))),
    cv, e, h('div', { class: 'row' }, save));
    box.append(shopBox, form, h('div', { class: 'sec' }, h('h3', {}, 'Katalog'), list));
    load();
  }

  // ===== Kody prezentowe =====
  async function viewCodes(box) {
    const item = h('select', { id: 'ak-item' }), count = h('input', { type: 'number', min: 1, max: 100, value: 1, id: 'ak-count' });
    const uses = h('input', { type: 'number', min: 1, max: 100000, value: 1, id: 'ak-uses' }), until = h('input', { type: 'date', id: 'ak-until' });
    const own = h('input', { id: 'ak-code', maxlength: 24, placeholder: 'np. TURNIEJ2026 (puste = losowe kody)', autocomplete: 'off' });
    own.oninput = () => { count.disabled = !!own.value.trim(); if (count.disabled) count.value = 1; };
    const e = h('p', { class: 'err' }), out = h('div', { id: 'ak-out' }), list = h('div', { id: 'ak-list' });
    const cos = await mib.call('prof:allCosmetics', { lite: true });
    item.replaceChildren(...(Array.isArray(cos) ? cos.map(c => h('option', { value: c.id }, c.name)) : []));
    async function load() {
      const l = await call('admin_list_codes');
      if (failed(l)) return list.replaceChildren(h('p', { class: 'err' }, err(l)));
      list.replaceChildren(...(l.length ? l.map(k => h('div', { class: 'card arow' },
        h('div', {}, h('b', { class: 'mono' }, k.code, k.expires_at && new Date(k.expires_at) < new Date() ? h('em', { class: 'tag' }, 'wygasł') : null),
          h('span', { class: 'mut' }, k.cosmetic_name + ', użyto ' + k.used_count + ' z ' + k.max_uses + (k.expires_at ? ', ważny do ' + fmtDate(k.expires_at) : ''))),
        h('button', { class: 'b ghost', on: { click: () => copy(k.code) } }, 'Kopiuj'),
        h('button', { class: 'b danger', on: { click: async () => { if (!confirm('Usunąć kod ' + k.code + '?')) return; const r = await call('admin_delete_code', { p_code: k.code }); if (failed(r)) return toast(err(r), 1); load(); } } }, 'Usuń')))
        : [h('p', { class: 'empty' }, 'Nie ma jeszcze kodów.')]));
    }
    const gen = h('button', { class: 'b', type: 'submit', id: 'ak-go' }, 'Wygeneruj kody');
    const form = h('form', { class: 'pform', on: { submit: async ev => {
      ev.preventDefault();
      if (!item.value) { e.textContent = ERR.cosmetic_missing; return; }
      gen.disabled = true;
      const r = await call('admin_create_codes', { p_cosmetic: item.value, p_count: +count.value, p_max_uses: +uses.value, p_days: null,
        p_until: until.value ? new Date(until.value + 'T23:59:59').toISOString() : null, p_code: own.value.trim() || null });
      gen.disabled = false;
      if (failed(r)) { e.textContent = err(r); return; }
      e.textContent = ''; own.value = ''; count.disabled = false;
      out.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'mut' }, 'Nowe kody:'), h('pre', { class: 'mono codes' }, r.join('\n')),
        h('button', { class: 'b ghost', on: { click: () => copy(r.join('\n')) } }, 'Kopiuj wszystkie')));
      load();
    } } },
    h('label', { class: 'sr' }, h('span', {}, 'Przedmiot'), item), h('label', { class: 'sr' }, h('span', {}, 'Ile kodów'), count),
    h('label', { class: 'sr' }, h('span', {}, 'Użyć na jeden kod'), h('span', { class: 'fld' }, uses, h('small', { class: 'mut' }, '1 = kod dla jednej osoby (np. zwycięzcy)'))),
    h('label', { class: 'sr' }, h('span', {}, 'Własna nazwa kodu'), h('span', { class: 'fld' }, own, h('small', { class: 'mut' }, 'Jeden kod, który łatwo podać na streamie albo Discordzie'))),
    h('label', { class: 'sr' }, h('span', {}, 'Ważny do'), h('span', { class: 'fld' }, until, h('small', { class: 'mut' }, 'Do końca tego dnia; puste = bez końca'))), e, h('div', { class: 'row' }, gen));
    box.append(form, out, h('div', { class: 'sec' }, h('h3', {}, 'Wszystkie kody'), list));
    load();
  }

  // ===== Gracze =====
  async function viewPlayers(box) {
    const q = h('input', { id: 'ap-q', placeholder: 'Nick, MIB-000001 albo e-mail' }), res = h('div', { id: 'ap-res' }), detail = h('div', { id: 'ap-detail' });
    async function search() {
      const l = await call('admin_find_players', { p_q: q.value });
      if (failed(l)) return res.replaceChildren(h('p', { class: 'err' }, err(l)));
      res.replaceChildren(...(l.length ? l.map(p => h('div', { class: 'card arow click', on: { click: () => show(p) } },
        h('div', {}, h('b', {}, p.nick, p.founder ? h('em', { class: 'tag founder' }, 'Założyciel') : null, p.banned ? h('em', { class: 'tag ban' }, 'ban') : p.warnings ? h('em', { class: 'tag' }, p.warnings + '/4') : null),
          h('span', { class: 'mut' }, window.MibProfile.formatMibId(p.num) + ', ' + p.email + ', od ' + fmtDate(p.created_at))),
        h('span', { class: 'mut' }, window.MibProfile.formatPlaytime(p.playtime_min || 0))))
        : [h('p', { class: 'empty' }, 'Nikogo nie znaleziono.')]));
    }
    async function show(p) {
      const [owned, cos] = await Promise.all([call('admin_player_cosmetics', { p_user: p.id }), mib.call('prof:allCosmetics', { lite: true })]);
      if (failed(owned)) return toast(err(owned), 1);
      const pick = h('select', {}, ...(Array.isArray(cos) ? cos.filter(c => !owned.some(o => o.id === c.id)).map(c => h('option', { value: c.id }, c.name)) : []));
      detail.replaceChildren(h('div', { class: 'sec' },
        h('h3', {}, p.nick + ' (' + window.MibProfile.formatMibId(p.num) + ')'),
        h('div', { class: 'sr' }, h('span', {}, 'E-mail'), h('b', {}, p.email)),
        h('div', { class: 'sr' }, h('span', {}, 'Czas gry'), h('b', {}, window.MibProfile.formatPlaytime(p.playtime_min || 0) + ', uruchomień: ' + (p.launches || 0))),
        h('div', { class: 'sr' }, h('span', {}, 'Przedmioty'), h('span', { class: 'fld' }, ...(owned.length ? owned.map(o => h('span', { class: 'row', style: 'align-items:center' }, h('span', {}, o.name + ' (' + o.source + ')'),
          h('button', { class: 'b ghost', on: { click: async () => { const r = await call('admin_revoke', { p_user: p.id, p_cosmetic: o.id }); if (failed(r)) return toast(err(r), 1); show(p); } } }, 'Zabierz')))
          : [h('span', { class: 'mut' }, 'brak')]))),
        h('div', { class: 'sr' }, h('span', {}, 'Daj przedmiot'), h('span', { class: 'row' }, pick,
          h('button', { class: 'b', on: { click: async () => { if (!pick.value) return; const r = await call('admin_grant', { p_user: p.id, p_cosmetic: pick.value }); if (failed(r)) return toast(err(r), 1); toast('Przedmiot dodany.'); show(p); } } }, 'Daj'))),
        coinsRow(p),
        h('div', { class: 'sr' }, h('span', {}, 'Wyślij prezent (z oknem „Odbierz”)'), await giftForm(p.id, null, () => show(p), owned)),
        h('div', { class: 'sr' }, h('span', {}, p.banned ? 'Ban' + (p.ban_reason ? ': ' + p.ban_reason : '') : 'Ostrzeżenia i ban'),
          moderation(p, null, async () => { await search(); const x = (await call('admin_find_players', { p_q: window.MibProfile.formatMibId(p.num) }))[0]; if (x) show(x); })),
        delBox(p)));
    }
    // MiB Coins gracza: dodanie albo zabranie (minus) z powodem, np. „zakup na stronie”
    function coinsRow(p) {
      const amount = h('input', { id: 'ap-coins', type: 'number', step: 100, placeholder: 'np. 1000 albo -500', style: 'width:150px' });
      const why = h('input', { id: 'ap-coins-why', maxlength: 200, placeholder: 'Powód (opcjonalnie)' });
      const bal = h('b', { id: 'ap-coins-bal' }, (p.coins || 0).toLocaleString('pl-PL'));
      const go = h('button', { class: 'b', id: 'ap-coins-go', type: 'button', on: { click: async () => {
        const n = Number(amount.value);
        if (!Number.isInteger(n) || !n) return toast(ERR.coins_amount, 1);
        go.disabled = true;
        const r = await call('admin_give_coins', { p_user: p.id, p_amount: n, p_reason: why.value });
        go.disabled = false;
        if (failed(r)) return toast(err(r), 1);
        p.coins = r; bal.textContent = Number(r).toLocaleString('pl-PL'); amount.value = why.value = '';
        toast(n > 0 ? 'Dodano ' + n + ' MiB Coins.' : 'Zabrano ' + -n + ' MiB Coins.');
      } } }, 'Zmień saldo');
      return h('div', { class: 'sr' }, h('span', {}, 'MiB Coins'), h('span', { class: 'fld' }, h('span', {}, 'Saldo: ', bal), h('span', { class: 'row' }, amount, why, go)));
    }
    // Usunięcie konta: potwierdzenie wpisaniem nicku (Electron nie obsługuje prompt())
    function delBox(p) {
      const conf = h('input', { id: 'ap-del-nick', placeholder: 'Wpisz nick: ' + p.nick, autocomplete: 'off' });
      const del = h('button', { class: 'b danger', id: 'ap-del', disabled: true, on: { click: async () => {
        del.disabled = true;
        const r = await call('admin_delete_player', { p_user: p.id });
        if (failed(r)) { del.disabled = false; return toast(err(r), 1); }
        toast('Konto usunięte.'); detail.replaceChildren(); search();
      } } }, 'Usuń konto');
      conf.oninput = () => { del.disabled = conf.value !== p.nick; };
      return h('div', { class: 'sr' }, h('span', {}, 'Usuń konto (nieodwracalne)'), h('span', { class: 'row' }, conf, del));
    }
    box.append(await giftAllBox(), h('form', { class: 'row', on: { submit: ev => { ev.preventDefault(); search(); } } }, q, h('button', { class: 'b', type: 'submit' }, 'Szukaj')), res, detail);
    search();
  }
  // Prezent dla wszystkich (np. święta, 1000 graczy): każdy, kto nie ma tego kosmetyku, dostanie okno „Masz prezent!”
  async function giftAllBox() {
    const cos = await mib.call('prof:allCosmetics', { lite: true });
    const pick = h('select', { id: 'ga-pick', 'aria-label': 'Kosmetyk' }, ...(Array.isArray(cos) ? cos.map(c => h('option', { value: c.id }, c.name + ' (' + (TYPES[c.type] || c.type) + ')')) : []));
    const note = h('input', { id: 'ga-note', maxlength: 200, placeholder: 'Wiadomość, np. Wesołych Świąt od MiB!' });
    const go = h('button', { class: 'b', id: 'ga-go', type: 'button', on: { click: async () => {
      if (!pick.value) return toast('Najpierw dodaj przedmiot w zakładce Kosmetyki.', 1);
      if (!confirm('Wysłać „' + pick.selectedOptions[0].textContent + '” wszystkim graczom, którzy go nie mają?')) return;
      go.disabled = true;
      const r = await call('admin_gift_all', { p_cosmetic: pick.value, p_message: note.value });
      go.disabled = false;
      if (failed(r)) return toast(err(r), 1);
      toast(r ? 'Prezent wysłany do ' + r + ' graczy.' : 'Wszyscy gracze już mają ten przedmiot.');
      note.value = '';
    } } }, 'Wyślij wszystkim');
    return h('div', { class: 'sec', id: 'ga' }, h('h3', {}, 'Prezent dla wszystkich'), h('p', { class: 'mut' }, 'Każdy gracz bez bana, który nie ma tego przedmiotu, zobaczy okno „Masz prezent!”.'),
      h('div', { class: 'row gift-form' }, pick, note, go));
  }

  // ===== Wykres graczy: dzień po dniu profile w launcherze i w grze (linie) oraz nowe profile (słupki) =====
  // Kolory sprawdzone walidatorem dataviz na tle --slab (ametyst, morski, pomarańczowy); tekst zawsze w kolorach tekstu.
  const SERIES = [['players', 'W launcherze', '#a855f7'], ['played', 'W grze', '#199e70'], ['new_profiles', 'Nowe profile', '#d95926']];
  function activityChart(rows) {
    const W = 640, H = 200, L = 34, R = 34, T = 10, B = 24, pw = W - L - R, ph = H - T - B, n = rows.length;
    const max = Math.max(1, ...rows.flatMap(r => [r.players, r.played, r.new_profiles]));
    const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find(x => x * 4 >= max) || Math.ceil(max / 4);
    const top = step * 4, x = i => L + (n === 1 ? pw / 2 : (i + 0.5) * pw / n), y = v => T + ph - (v / top) * ph;
    const fmtD = d => d.slice(8, 10) + '.' + d.slice(5, 7), bw = Math.max(2, Math.min(24, pw / n - 4));
    let svg = '';
    for (let k = 0; k <= 4; k++) svg += `<line x1="${L}" x2="${L + pw}" y1="${y(k * step)}" y2="${y(k * step)}" class="ac-grid"/><text x="${L - 6}" y="${y(k * step) + 4}" class="ac-tick" text-anchor="end">${k * step}</text>`;
    rows.forEach((r, i) => {
      if (r.new_profiles) { const h2 = Math.max(2, ph * r.new_profiles / top), x0 = x(i) - bw / 2, y0 = T + ph - h2, rr = Math.min(4, bw / 2, h2);
        svg += `<path d="M${x0} ${T + ph}V${y0 + rr}Q${x0} ${y0} ${x0 + rr} ${y0}H${x0 + bw - rr}Q${x0 + bw} ${y0} ${x0 + bw} ${y0 + rr}V${T + ph}Z" fill="${SERIES[2][2]}"/>`; }
      if (i % 7 === (n - 1) % 7) svg += `<text x="${x(i)}" y="${H - 6}" class="ac-tick" text-anchor="middle">${fmtD(r.day)}</text>`;
    });
    const ends = [];
    for (const [key, , color] of SERIES.slice(0, 2)) {
      svg += `<polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${rows.map((r, i) => x(i) + ',' + y(r[key])).join(' ')}"/>`;
      ends.push([key, y(rows[n - 1][key])]);
    }
    // podpisy na końcu linii tylko wtedy, gdy się nie nakładają (inaczej legenda i dymek)
    const apart = Math.abs(ends[0][1] - ends[1][1]) >= 14;
    for (const [key, , color] of SERIES.slice(0, 2)) {
      const yy = y(rows[n - 1][key]);
      svg += `<circle cx="${x(n - 1)}" cy="${yy}" r="4" fill="${color}" class="ac-ring"/>`;
      if (apart) svg += `<text x="${x(n - 1) + 9}" y="${yy + 4}" class="ac-end">${rows[n - 1][key]}</text>`;
    }
    svg += `<line class="ac-cross" x1="0" x2="0" y1="${T}" y2="${T + ph}" visibility="hidden"/><g class="ac-dots" visibility="hidden">${SERIES.slice(0, 2).map(([k, , c]) => `<circle r="4" fill="${c}" class="ac-ring" data-k="${k}"/>`).join('')}</g>`;
    svg += rows.map((r, i) => `<rect class="ac-hit" data-i="${i}" x="${L + i * pw / n}" y="${T}" width="${pw / n}" height="${ph}" fill="transparent"/>`).join('');
    const legend = h('div', { class: 'ac-legend' }, ...SERIES.map(([, l, c], i) => h('span', {}, h('i', { class: i < 2 ? 'ln' : 'sq', style: 'background:' + c }), l)));
    const plot = h('div', { class: 'ac-plot', tabindex: 0, 'aria-label': 'Wykres graczy dziennie, strzałki zmieniają dzień' });
    plot.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gracze z profilem MiB dziennie, ${n} dni">${svg}</svg>`;
    const tip = h('div', { class: 'ac-tip', hidden: true });
    plot.append(tip);
    const svgEl = plot.querySelector('svg'), cross = svgEl.querySelector('.ac-cross'), dots = svgEl.querySelector('.ac-dots');
    let cur = -1;
    function at(i) {
      cur = i;
      if (i < 0) { cross.setAttribute('visibility', 'hidden'); dots.setAttribute('visibility', 'hidden'); tip.hidden = true; return; }
      const r = rows[i];
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible'); dots.setAttribute('visibility', 'visible');
      for (const d of dots.children) { d.setAttribute('cx', x(i)); d.setAttribute('cy', y(r[d.dataset.k])); }
      tip.replaceChildren(h('b', {}, fmtDate(r.day)), ...SERIES.map(([k, l, c]) => h('div', {}, h('i', { style: 'background:' + c }), l + ': ', h('b', {}, String(r[k])))));
      tip.hidden = false;
      const left = x(i) / W * plot.clientWidth;
      tip.style.left = Math.min(Math.max(0, left - 70), plot.clientWidth - 150) + 'px';
    }
    svgEl.addEventListener('mousemove', e => { const hit = e.target.closest('.ac-hit'); if (hit) at(+hit.dataset.i); });
    svgEl.addEventListener('mouseleave', () => at(-1));
    plot.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); at(Math.max(0, Math.min(n - 1, (cur < 0 ? n : cur) + (e.key === 'ArrowLeft' ? -1 : 1)))); } });
    plot.addEventListener('focus', () => at(n - 1));
    plot.addEventListener('blur', () => at(-1));
    const table = h('details', { class: 'ac-table' }, h('summary', {}, 'Tabela'), h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Dzień'), ...SERIES.map(([, l]) => h('th', {}, l)))),
      h('tbody', {}, ...rows.slice().reverse().map(r => h('tr', {}, h('td', {}, fmtDate(r.day)), ...SERIES.map(([k]) => h('td', {}, String(r[k]))))))));
    return h('div', { class: 'ac', id: 'as-chart' }, legend, plot, table);
  }

  // ===== Statystyki =====
  async function viewStats(box) {
    const r = await call('admin_stats');
    if (failed(r)) return box.append(h('p', { class: 'err' }, err(r)));
    const row = (l, v) => h('div', { class: 'sr' }, h('span', {}, l), h('b', {}, String(v)));
    const tile = (l, v) => h('div', { class: 'stat' }, h('b', {}, String(v)), h('span', {}, l));
    const list = (l, key, empty) => l && l.length ? l.map(x => row(x[key], x.players + (x.players === 1 ? ' gracz' : ' graczy'))) : [h('p', { class: 'empty' }, empty)];
    box.append(h('div', { class: 'sec', id: 'as-now' }, h('h3', {}, 'Teraz'), h('div', { class: 'stats' },
      tile('W grze (profile MiB)', r.nowGame || 0), tile('W launcherze', r.nowLauncher || 0), tile('W grze z modem MiB (też bez profilu)', r.nowMod || 0)),
      h('p', { class: 'mut' }, 'Najpopularniejsze serwery (tylko gracze, którzy pokazują serwer znajomym) i wersje gry teraz:'),
      ...list(r.nowServers, 'server', 'Nikt nie gra teraz na serwerze.'), ...list(r.nowVersions, 'version', 'Nikt nie gra teraz.'),
      h('div', { class: 'row' }, h('button', { class: 'b ghost', type: 'button', on: { click: () => { box.replaceChildren(); viewStats(box); } } }, 'Odśwież'))));
    const days = h('select', { id: 'as-days', 'aria-label': 'Zakres wykresu' }, h('option', { value: 30 }, 'Ostatnie 30 dni'), h('option', { value: 90 }, 'Ostatnie 90 dni'));
    const chartBox = h('div', {}, h('p', { class: 'mut' }, 'Wczytywanie…'));
    async function chart() {
      const a = await call('admin_activity', { p_days: +days.value });
      if (failed(a)) return chartBox.replaceChildren(h('p', { class: 'err' }, err(a)));
      chartBox.replaceChildren(activityChart(a));
    }
    days.onchange = chart;
    box.append(h('div', { class: 'sec' }, h('div', { class: 'row', style: 'align-items:center;justify-content:space-between' }, h('h3', {}, 'Gracze dziennie'), days),
      h('p', { class: 'mut' }, 'Profile MiB z otwartym launcherem, z nich w grze, i nowe profile (czas polski). Liczy od wersji 0.20.0.'), chartBox));
    chart();
    box.append(h('div', { class: 'sec' }, h('h3', {}, 'Gracze'), h('div', { class: 'stats' },
      tile('Profile MiB', r.profiles), tile('Nowe w ostatnich 7 dniach', r.new7), tile('Grali w ostatnich 7 dniach', r.active7), tile('Wolne miejsca Założyciela', r.foundersLeft))),
    h('div', { class: 'sec' }, h('h3', {}, 'Kosmetyki'), h('div', { class: 'stats' }, tile('Przedmioty w katalogu', r.cosmetics), tile('Przedmioty u graczy', r.owned))),
    h('div', { class: 'sec' }, h('h3', {}, 'Najpopularniejsze wersje'),
      ...(r.versions.length ? r.versions.map(v => row(v.version, window.MibProfile.formatPlaytime(v.min) + ', uruchomień: ' + v.runs)) : [h('p', { class: 'empty' }, 'Brak danych o grze.')])));
  }

  const TABS = [['ann', 'Aktualności', viewAnn], ['ideas', 'Pomysły', viewIdeas], ['reports', 'Zgłoszenia', viewReports], ['cos', 'Kosmetyki', viewCos], ['codes', 'Kody', viewCodes], ['players', 'Gracze', viewPlayers], ['stats', 'Statystyki', viewStats]];
  function render() {
    const box = $('admin-box'), body = h('div', { id: 'admin-tab' });
    box.replaceChildren(h('h2', {}, 'Panel admina'),
      h('div', { class: 'seg', role: 'tablist' }, ...TABS.map(([k, l]) => h('button', { class: tab === k ? 'on' : '', type: 'button', 'data-tab': k, on: { click: () => { tab = k; render(); } } }, l + (k === 'ideas' && fresh ? ' (' + fresh + ')' : k === 'reports' && freshReports ? ' (' + freshReports + ')' : '')))),
      body);
    TABS.find(t => t[0] === tab)[2](body);
  }
  document.querySelector('.nav[data-p="admin"]').addEventListener('click', render);

  // Na stronie Aktualności admin ma skrót do dodawania i zmieniania wpisów
  const quick = h('div', { class: 'row', style: 'padding-bottom:10px', hidden: true },
    h('button', { class: 'b', id: 'ad-quick', type: 'button', on: { click: () => { tab = 'ann'; document.querySelector('.nav[data-p="admin"]').click(); } } }, 'Dodaj lub zmień aktualności'));
  $('ann-all').before(quick);
  document.querySelector('.nav[data-p="news"]').addEventListener('click', () => { quick.hidden = document.querySelector('.nav[data-p="admin"]').hidden; });
})();
