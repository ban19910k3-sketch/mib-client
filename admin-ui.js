// Panel admina (widoczny tylko dla konta admina; uprawnienia sprawdza baza).
// Tylko po polsku — panel widzi wyłącznie właściciel.
(() => {
  const { h, msg, fmtDate, capeThumb } = window.mibUI;
  const ERR = {
    not_admin: 'To konto nie jest adminem.',
    cosmetic_id_invalid: 'ID przedmiotu: 2–32 znaki, tylko małe litery, cyfry i _ (np. cape_turniej).',
    cosmetic_name_invalid: 'Nazwa przedmiotu musi mieć od 1 do 40 znaków.',
    cosmetic_type_invalid: 'Nieznany rodzaj przedmiotu.',
    cosmetic_in_use: 'Tego przedmiotu nie można usunąć: mają go gracze albo są do niego kody.',
    cosmetic_missing: 'Najpierw dodaj ten przedmiot w zakładce Kosmetyki.',
    codes_invalid: 'Kody: od 1 do 100 naraz, użyć od 1 do 100 000, ważność od 1 do 3650 dni.',
    cannot_delete_admin: 'Nie można usunąć konta admina.',
    announcement_missing: 'To ogłoszenie zostało już usunięte.',
    texture_not_png: 'To nie jest plik PNG.',
    texture_size: 'Tekstura peleryny musi mieć 64×32 piksele (albo 128×64, 256×128, 512×256).',
    texture_too_big: 'Plik jest za duży (najwyżej 100 KB).',
    idea_missing: 'Ten pomysł został już usunięty.',
  };
  const err = r => (r && ERR[r.error]) || msg(r && r.error || 'unknown', r && r.detail);
  const call = (fn, args) => mib.call('prof:admin', { fn, args });
  const failed = r => r && !Array.isArray(r) && r.error;
  const TYPES = { cape: 'Peleryna', hat: 'Czapka', wings: 'Skrzydła' };
  const copy = async t => { try { await navigator.clipboard.writeText(t); toast('Skopiowano'); } catch {} };
  let tab = 'ann';
  // Jeden podgląd 3D na cały panel (każdy nowy SkinViewer zajmuje kontekst WebGL)
  let capeCanvas = null, capeViewer = null;
  function capePreview(dataUrl) {
    if (!capeCanvas) capeCanvas = h('canvas', { width: 180, height: 220, class: 'cape3d', hidden: true });
    try {
      if (dataUrl && !capeViewer) { capeViewer = new skinview3d.SkinViewer({ canvas: capeCanvas, width: 180, height: 220 }); capeViewer.autoRotate = true; capeViewer.autoRotateSpeed = 0.8; capeViewer.controls.enableZoom = false; }
      if (dataUrl) capeViewer.loadCape(dataUrl);
      capeCanvas.hidden = !dataUrl;
    } catch { capeCanvas.hidden = true; }
    return capeCanvas;
  }

  // ===== Ogłoszenia =====
  async function viewAnn(box) {
    const title = h('input', { maxlength: 80, id: 'ad-title', placeholder: 'np. Turniej w sobotę o 18:00' });
    const body = h('textarea', { maxlength: 1000, id: 'ad-body', placeholder: 'Treść (opcjonalnie)' });
    const pin = h('input', { type: 'checkbox', id: 'ad-pin' }), until = h('input', { type: 'date', id: 'ad-until' });
    const e = h('p', { class: 'err' }), save = h('button', { class: 'b', id: 'ad-save', type: 'submit' }, 'Opublikuj');
    let editId = null;
    const cancel = h('button', { class: 'b ghost', type: 'button', hidden: true, on: { click: () => reset() } }, 'Anuluj edycję');
    const reset = () => { editId = null; title.value = body.value = until.value = ''; pin.checked = false; save.textContent = 'Opublikuj'; cancel.hidden = true; };
    const list = h('div', { id: 'ad-list' });
    async function load() {
      const l = await call('admin_list_announcements');
      if (failed(l)) return list.replaceChildren(h('p', { class: 'err' }, err(l)));
      list.replaceChildren(...(l.length ? l.map(a => {
        const expired = a.visible_until && new Date(a.visible_until) < new Date();
        return h('div', { class: 'card arow' },
          h('div', {}, h('b', {}, a.title, a.pinned ? h('em', { class: 'tag' }, 'przypięte') : null, expired ? h('em', { class: 'tag' }, 'wygasło') : null),
            h('span', { class: 'mut' }, fmtDate(a.created_at) + (a.visible_until ? ', widoczne do ' + fmtDate(a.visible_until) : ''))),
          h('button', { class: 'b ghost', on: { click: () => {
            editId = a.id; title.value = a.title; body.value = a.body; pin.checked = a.pinned; until.value = a.visible_until ? a.visible_until.slice(0, 10) : '';
            save.textContent = 'Zapisz zmiany'; cancel.hidden = false; title.focus();
          } } }, 'Edytuj'),
          h('button', { class: 'b danger', on: { click: async () => {
            if (!confirm('Usunąć ogłoszenie „' + a.title + '”?')) return;
            const r = await call('admin_delete_announcement', { p_id: a.id });
            if (failed(r)) return toast(err(r), 1);
            load(); window.mibLoadAnn();
          } } }, 'Usuń'));
      }) : [h('p', { class: 'empty' }, 'Nie ma jeszcze ogłoszeń.')]));
    }
    const form = h('form', { class: 'pform', on: { submit: async ev => {
      ev.preventDefault();
      if (!title.value.trim()) { e.textContent = 'Wpisz tytuł ogłoszenia.'; return; }
      save.disabled = true;
      const r = await call('admin_save_announcement', { p_id: editId, p_title: title.value, p_body: body.value, p_pinned: pin.checked,
        p_until: until.value ? new Date(until.value + 'T23:59:59').toISOString() : null });
      save.disabled = false;
      if (failed(r)) { e.textContent = err(r); return; }
      e.textContent = ''; toast(editId ? 'Ogłoszenie zapisane.' : 'Ogłoszenie opublikowane.'); reset(); load(); window.mibLoadAnn();
    } } },
    h('label', { class: 'sr' }, h('span', {}, 'Tytuł'), title),
    h('label', { class: 'sr' }, h('span', {}, 'Treść'), body),
    h('label', { class: 'sr' }, h('span', {}, 'Widoczne do'), h('span', { class: 'fld' }, until, h('small', { class: 'mut' }, 'Puste = bez końca'))),
    h('label', { class: 'ck' }, pin, 'Przypnij na górze'), e, h('div', { class: 'row' }, save, cancel));
    box.append(h('p', { class: 'lead' }, 'Ogłoszenia widzą wszyscy gracze na stronie głównej i w Aktualnościach, od razu, bez aktualizacji launchera.'), form, h('div', { class: 'sec' }, h('h3', {}, 'Opublikowane'), list));
    load();
  }

  // ===== Pomysły graczy =====
  const IDEA_CAT = { feature: 'Nowa funkcja', cosmetic: 'Kosmetyk', bug: 'Błąd', other: 'Inne' };
  const IDEA_ST = { new: 'Nowy', seen: 'Przeczytany', planned: 'W planach', done: 'Zrobione', rejected: 'Odrzucony' };
  // Licznik nowych pomysłów przy „Panel admina” i na zakładce; raz na uruchomienie także powiadomienie
  let fresh = 0, greeted = false;
  async function badge() {
    const n = await call('admin_count_new_ideas');
    if (typeof n !== 'number') return;
    fresh = n;
    const nav = document.querySelector('.nav[data-p="admin"]');
    let b = nav.querySelector('.cnt');
    if (!b) { b = h('em', { class: 'cnt' }); nav.append(b); }
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = !n;
    const t = document.querySelector('[data-tab="ideas"]');
    if (t) t.textContent = 'Pomysły' + (n ? ' (' + n + ')' : '');
    if (n && !greeted) { greeted = true; toast('Nowe pomysły od graczy: ' + n + '. Zobacz w Panelu admina.'); }
  }
  window.mibAdminBadge = badge;
  setInterval(() => { if (!document.querySelector('.nav[data-p="admin"]').hidden) badge(); }, 5 * 60 * 1000);

  async function viewIdeas(box) {
    const filter = h('select', { id: 'ai-filter' }, h('option', { value: '' }, 'Wszystkie'), ...Object.entries(IDEA_ST).map(([k, v]) => h('option', { value: k }, v)));
    const list = h('div', { id: 'ai-list' });
    let all = [];
    function show() {
      const l = filter.value ? all.filter(i => i.status === filter.value) : all;
      list.replaceChildren(...(l.length ? l.map(i => {
        const status = h('select', { 'aria-label': 'Status pomysłu', on: { change: async () => {
          const r = await call('admin_set_idea_status', { p_id: i.id, p_status: status.value });
          if (failed(r)) { status.value = i.status; return toast(err(r), 1); }
          i.status = status.value; toast('Status: ' + IDEA_ST[i.status] + '.'); show(); badge();
        } } }, ...Object.entries(IDEA_ST).map(([k, v]) => h('option', { value: k, selected: k === i.status }, v)));
        return h('div', { class: 'card idea' + (i.status === 'new' ? ' fresh' : '') },
          h('div', { class: 'ihead' }, h('b', {}, i.nick || 'konto usunięte'), i.num ? h('span', { class: 'mono mut' }, window.MibProfile.formatMibId(i.num)) : null,
            h('em', { class: 'tag' }, IDEA_CAT[i.category] || i.category), h('span', { class: 'mut' }, fmtDate(i.created_at))),
          h('p', {}, i.body),
          h('div', { class: 'row', style: 'align-items:center' }, status,
            h('button', { class: 'b ghost', on: { click: () => copy(i.body) } }, 'Kopiuj'),
            h('button', { class: 'b danger', on: { click: async () => {
              if (!confirm('Usunąć ten pomysł?')) return;
              const r = await call('admin_delete_idea', { p_id: i.id });
              if (failed(r)) return toast(err(r), 1);
              all = all.filter(x => x.id !== i.id); show(); badge();
            } } }, 'Usuń')));
      }) : [h('p', { class: 'empty' }, all.length ? 'Brak pomysłów z tym statusem.' : 'Gracze nie wysłali jeszcze żadnych pomysłów.')]));
    }
    filter.onchange = show;
    box.append(h('p', { class: 'lead' }, 'Pomysły z zakładki Pomysły. Nowe są na górze. Gracz widzi status, który tu ustawisz.'),
      h('div', { class: 'row', style: 'align-items:center' }, h('span', { class: 'mut' }, 'Pokaż:'), filter), list);
    const l = await call('admin_list_ideas');
    if (failed(l)) return list.replaceChildren(h('p', { class: 'err' }, err(l)));
    all = l; show(); badge();
  }

  // ===== Kosmetyki =====
  async function viewCos(box) {
    const id = h('input', { id: 'ac-id', maxlength: 32, placeholder: 'np. cape_turniej' }), name = h('input', { id: 'ac-name', maxlength: 40, placeholder: 'np. Peleryna Turniejowa' });
    const type = h('select', { id: 'ac-type' }, ...Object.entries(TYPES).map(([k, v]) => h('option', { value: k }, v)));
    const prevImg = h('img', { class: 'texprev', alt: '', hidden: true }), cv = capePreview(null);
    const e = h('p', { class: 'err' }), save = h('button', { class: 'b', type: 'submit', id: 'ac-save' }, 'Zapisz przedmiot');
    let texture = null, editing = false, known = new Set();
    function preview(dataUrl) { prevImg.src = dataUrl || ''; prevImg.hidden = !dataUrl; capePreview(dataUrl); }
    const pick = h('button', { class: 'b ghost', type: 'button', on: { click: async () => {
      const r = await mib.call('admin:pickTexture');
      if (!r) return;
      if (r.error) { e.textContent = err(r) + (r.width ? ' Ten plik ma ' + r.width + '×' + r.height + '.' : ''); return; }
      e.textContent = ''; texture = r.dataUrl; preview(texture);
    } } }, 'Wybierz teksturę PNG…');
    const list = h('div', { class: 'cos-grid', id: 'ac-list' });
    async function load() {
      const l = await mib.call('prof:allCosmetics');
      if (failed(l)) return list.replaceChildren(h('p', { class: 'err' }, err(l)));
      known = new Set(l.map(c => c.id));
      list.replaceChildren(...(l.length ? l.map(c => h('div', { class: 'cosi' },
        h('i', {}, c.texture && c.type === 'cape' ? capeThumb(c.texture, 5) : '◆'),
        h('b', {}, c.name), h('small', { class: 'mut' }, c.id + ', ' + (TYPES[c.type] || c.type)),
        h('div', { class: 'row' },
          h('button', { class: 'b ghost', on: { click: () => { editing = true; id.value = c.id; id.disabled = true; name.value = c.name; type.value = c.type; texture = null; preview(c.texture); save.textContent = 'Zapisz zmiany'; name.focus(); } } }, 'Edytuj'),
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
      toast('Przedmiot zapisany.'); e.textContent = ''; id.value = name.value = ''; id.disabled = false; editing = false; texture = null; preview(null); save.textContent = 'Zapisz przedmiot'; load();
    } } },
    h('label', { class: 'sr' }, h('span', {}, 'ID (stałe)'), id), h('label', { class: 'sr' }, h('span', {}, 'Nazwa'), name),
    h('label', { class: 'sr' }, h('span', {}, 'Rodzaj'), type),
    h('div', { class: 'sr' }, h('span', {}, 'Tekstura'), h('span', { class: 'fld' }, h('span', { class: 'row', style: 'align-items:center' }, pick, prevImg), h('small', { class: 'mut' }, 'PNG 64×32 jak peleryna w Minecrafcie'))),
    cv, e, h('div', { class: 'row' }, save));
    box.append(form, h('div', { class: 'sec' }, h('h3', {}, 'Katalog'), list));
    load();
  }

  // ===== Kody prezentowe =====
  async function viewCodes(box) {
    const item = h('select', { id: 'ak-item' }), count = h('input', { type: 'number', min: 1, max: 100, value: 1, id: 'ak-count' });
    const uses = h('input', { type: 'number', min: 1, max: 100000, value: 1, id: 'ak-uses' }), days = h('input', { type: 'number', min: 1, max: 3650, placeholder: 'bez końca', id: 'ak-days' });
    const e = h('p', { class: 'err' }), out = h('div', { id: 'ak-out' }), list = h('div', { id: 'ak-list' });
    const cos = await mib.call('prof:allCosmetics', { lite: true });
    item.replaceChildren(...(Array.isArray(cos) ? cos.map(c => h('option', { value: c.id }, c.name)) : []));
    async function load() {
      const l = await call('admin_list_codes');
      if (failed(l)) return list.replaceChildren(h('p', { class: 'err' }, err(l)));
      list.replaceChildren(...(l.length ? l.map(k => h('div', { class: 'card arow' },
        h('div', {}, h('b', { class: 'mono' }, k.code), h('span', { class: 'mut' }, k.cosmetic_name + ', użyto ' + k.used_count + ' z ' + k.max_uses + (k.expires_at ? ', ważny do ' + fmtDate(k.expires_at) : ''))),
        h('button', { class: 'b ghost', on: { click: () => copy(k.code) } }, 'Kopiuj'),
        h('button', { class: 'b danger', on: { click: async () => { if (!confirm('Usunąć kod ' + k.code + '?')) return; const r = await call('admin_delete_code', { p_code: k.code }); if (failed(r)) return toast(err(r), 1); load(); } } }, 'Usuń')))
        : [h('p', { class: 'empty' }, 'Nie ma jeszcze kodów.')]));
    }
    const gen = h('button', { class: 'b', type: 'submit', id: 'ak-go' }, 'Wygeneruj kody');
    const form = h('form', { class: 'pform', on: { submit: async ev => {
      ev.preventDefault();
      if (!item.value) { e.textContent = ERR.cosmetic_missing; return; }
      gen.disabled = true;
      const r = await call('admin_create_codes', { p_cosmetic: item.value, p_count: +count.value, p_max_uses: +uses.value, p_days: days.value ? +days.value : null });
      gen.disabled = false;
      if (failed(r)) { e.textContent = err(r); return; }
      e.textContent = '';
      out.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'mut' }, 'Nowe kody:'), h('pre', { class: 'mono codes' }, r.join('\n')),
        h('button', { class: 'b ghost', on: { click: () => copy(r.join('\n')) } }, 'Kopiuj wszystkie')));
      load();
    } } },
    h('label', { class: 'sr' }, h('span', {}, 'Przedmiot'), item), h('label', { class: 'sr' }, h('span', {}, 'Ile kodów'), count),
    h('label', { class: 'sr' }, h('span', {}, 'Użyć na jeden kod'), h('span', { class: 'fld' }, uses, h('small', { class: 'mut' }, '1 = kod dla jednej osoby (np. zwycięzcy)'))),
    h('label', { class: 'sr' }, h('span', {}, 'Ważny przez (dni)'), days), e, h('div', { class: 'row' }, gen));
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
        h('div', {}, h('b', {}, p.nick, p.founder ? h('em', { class: 'tag founder' }, 'Założyciel') : null),
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
        delBox(p)));
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
    box.append(h('form', { class: 'row', on: { submit: ev => { ev.preventDefault(); search(); } } }, q, h('button', { class: 'b', type: 'submit' }, 'Szukaj')), res, detail);
    search();
  }

  // ===== Statystyki =====
  async function viewStats(box) {
    const r = await call('admin_stats');
    if (failed(r)) return box.append(h('p', { class: 'err' }, err(r)));
    const row = (l, v) => h('div', { class: 'sr' }, h('span', {}, l), h('b', {}, String(v)));
    const tile = (l, v) => h('div', { class: 'stat' }, h('b', {}, String(v)), h('span', {}, l));
    box.append(h('div', { class: 'sec' }, h('h3', {}, 'Gracze'), h('div', { class: 'stats' },
      tile('Profile MiB', r.profiles), tile('Nowe w ostatnich 7 dniach', r.new7), tile('Grali w ostatnich 7 dniach', r.active7), tile('Wolne miejsca Założyciela', r.foundersLeft))),
    h('div', { class: 'sec' }, h('h3', {}, 'Kosmetyki'), h('div', { class: 'stats' }, tile('Przedmioty w katalogu', r.cosmetics), tile('Przedmioty u graczy', r.owned))),
    h('div', { class: 'sec' }, h('h3', {}, 'Najpopularniejsze wersje'),
      ...(r.versions.length ? r.versions.map(v => row(v.version, window.MibProfile.formatPlaytime(v.min) + ', uruchomień: ' + v.runs)) : [h('p', { class: 'empty' }, 'Brak danych o grze.')])));
  }

  const TABS = [['ann', 'Ogłoszenia', viewAnn], ['ideas', 'Pomysły', viewIdeas], ['cos', 'Kosmetyki', viewCos], ['codes', 'Kody', viewCodes], ['players', 'Gracze', viewPlayers], ['stats', 'Statystyki', viewStats]];
  function render() {
    const box = $('admin-box'), body = h('div', { id: 'admin-tab' });
    box.replaceChildren(h('h2', {}, 'Panel admina'),
      h('div', { class: 'seg', role: 'tablist' }, ...TABS.map(([k, l]) => h('button', { class: tab === k ? 'on' : '', type: 'button', 'data-tab': k, on: { click: () => { tab = k; render(); } } }, l + (k === 'ideas' && fresh ? ' (' + fresh + ')' : '')))),
      body);
    TABS.find(t => t[0] === tab)[2](body);
  }
  document.querySelector('.nav[data-p="admin"]').addEventListener('click', render);
})();
