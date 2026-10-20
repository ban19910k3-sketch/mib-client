// Test interfejsu profilu: prawdziwy launcher (Electron) + atrapa Supabase.
// Uruchom: xvfb-run -a node test/e2e/profile.e2e.js [katalog_na_zrzuty]
const path = require('path'), fs = require('fs'), os = require('os');
const { _electron } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { createFake } = require('../fake-supabase');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..', '..'), OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'mib-shots-'));
const ok = m => console.log('PASS', m);
// Skin 64×64 (fioletowy) jako PNG do atrapy Mojanga
const pngSkin = () => png(64, 64, x => [124 + (x % 8) * 8, 58, 237, 255]);
// PNG w×h, kolor piksela z px(x, y) jako [r, g, b, a]
function png(w, h, px) {
  const zlib = require('zlib'), raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 4 + 1) + 1 + x * 4);
  const crc = b => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4), c = Buffer.alloc(4), td = Buffer.concat([Buffer.from(t), d]); l.writeUInt32BE(d.length); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

(async () => {
  const fake = createFake();
  await new Promise(r => fake.server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + fake.server.address().port;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mib-home-'));
  const app = await _electron.launch({ executablePath: path.join(ROOT, 'node_modules/electron/dist/electron'), args: ['--no-sandbox', ROOT],
    env: { ...process.env, MIB_SUPA_URL: url, XDG_CONFIG_HOME: home } });
  const w = await app.firstWindow();
  const errors = [];
  w.on('pageerror', e => errors.push(e.message));
  const shot = n => w.screenshot({ path: path.join(OUT, n) });
  try {
    await w.waitForSelector('#app.on', { timeout: 15000 });
    await w.click('#w-go', { timeout: 5000 }).catch(() => {});
    await w.waitForFunction(() => document.getElementById('plname').textContent === 'Załóż profil MiB');
    ok('(a) dolny blok zachęca do założenia profilu');
    await w.click('.nav[data-p="ideas"]');
    await w.waitForFunction(() => /Załóż profil MiB/.test(document.getElementById('ideas-box').textContent));
    assert.equal(await w.$('#id-body'), null, 'bez profilu nie ma formularza pomysłów');
    assert.match(await w.textContent('#id-reward'), /ekskluzywny kosmetyk.*musi naprawdę występować/, 'informacja o nagrodzie za błąd');
    ok('(m) pomysły bez profilu: zachęta do założenia profilu');
    await w.click('#plbox');
    await w.waitForSelector('#p-prof.on #pf-nick');
    await shot('prof-out.png');

    await w.fill('#pf-nick', 'Łukasz'); await w.fill('#pf-email', 'tester@mib.pl'); await w.fill('#pf-pass', 'haslo1234');
    await w.click('#pf-go');
    await w.waitForFunction(() => /bez polskich znaków/.test(document.querySelector('#prof-box .err').textContent));
    assert.equal(fake.st.calls.filter(c => c.path === '/auth/v1/signup').length, 0);
    ok('(f) zły nick zatrzymany przed wysłaniem');

    // Supabase z włączonym „Confirm email”: jasny komunikat zamiast fałszywego sukcesu
    fake.st.confirm = true;
    await w.fill('#pf-nick', 'Tester_1');
    await w.click('#pf-go');
    await w.waitForFunction(() => /Confirm email/.test(document.querySelector('#prof-box .err').textContent));
    assert.equal(await w.$('#rc.on'), null);
    await shot('prof-confirm.png');
    fake.st.confirm = false;
    ok('(i) włączone potwierdzanie e-maila daje jasny komunikat');

    await w.click('#pf-go');
    await w.waitForSelector('#rc.on');
    assert.equal(await w.textContent('#rc-t'), 'Konto założone!');
    assert.match(await w.textContent('#rc-done'), /pomyślnie założony.*MIB-000001/);
    const code = await w.textContent('#rc-code');
    assert.match(code, /^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
    assert.equal(await w.isDisabled('#rc-x'), true);
    await w.waitForTimeout(400); // animacja otwierania okna
    await shot('prof-code.png');
    await w.check('#rc-ok');
    assert.equal(await w.isDisabled('#rc-x'), false);
    await w.click('#rc-x');
    ok('(b) rejestracja pokazuje kod odzyskiwania, „Gotowe” dopiero po potwierdzeniu');

    await w.waitForFunction(() => /MIB-000001/.test(document.getElementById('prof-box').textContent) && /Założyciel/.test(document.getElementById('prof-box').textContent));
    assert.equal(await w.textContent('#plsub'), 'MIB-000001');
    await w.waitForTimeout(600);
    assert.ok(fake.st.users[0].settings, 'ustawienia wysłane na nowy profil');
    await shot('prof-in.png');
    ok('(c) profil z ID i odznaką Założyciel, ustawienia zsynchronizowane');
    assert.equal(await w.isHidden('.nav[data-p="admin"]'), true, 'zwykły gracz nie widzi panelu admina');

    fake.st.backups.push({ user: fake.st.users[0].id, game_version: '1.8.9', loader: null, skipped: 1,
      mods: [{ project: 'P1', version: 'V1', file: 'a.jar', on: true }, { project: 'P2', version: 'V2', file: 'b.jar', on: false }] });
    await w.click('.nav[data-p="mods"]');
    await w.waitForFunction(() => !document.getElementById('mbk').hidden && /Przywróć mody z profilu \(2\)/.test(document.getElementById('mbk').textContent));
    assert.match(await w.textContent('#mbk'), /spoza Modrinth: 1/);
    await shot('mods-backup.png');
    ok('(h) baner kopii modów z profilu');

    await w.click('.nav[data-p="cos"]');
    await w.waitForSelector('#cos-code');
    await w.fill('#cos-code', ' start ');
    await w.press('#cos-code', 'Enter');
    await w.waitForFunction(() => /Peleryna Start/.test(document.querySelector('#cos-box .cos-grid') ? document.querySelector('#cos-box .cos-grid').textContent : ''));
    await w.waitForTimeout(400);
    await shot('cos.png');
    await w.fill('#cos-code', 'START'); await w.press('#cos-code', 'Enter');
    await w.waitForFunction(() => /odebrany|Masz już/.test(document.querySelector('#cos-box .err').textContent));
    ok('(d) kod prezentowy dodaje przedmiot, drugi raz daje czytelny błąd');

    await w.click('.cosi .b');
    await w.waitForFunction(() => /Założona/.test(document.querySelector('.cosi').textContent) && document.querySelector('.cosi .b').textContent === 'Zdejmij');
    assert.deepEqual(fake.st.users[0].equipped, { cape: 'cape_start' });
    await shot('cos-equipped.png');
    await w.click('.cosi .b');
    await w.waitForFunction(() => document.querySelector('.cosi .b').textContent === 'Załóż');
    assert.deepEqual(fake.st.users[0].equipped, {});
    ok('(q) peleryna: Załóż i Zdejmij');

    await w.click('.nav[data-p="ideas"]');
    await w.waitForSelector('#id-body');
    await w.fill('#id-body', 'za mało');
    await w.click('#id-send');
    await w.waitForFunction(() => /co najmniej 10 znaków/.test(document.querySelector('#ideas-box .err').textContent));
    assert.equal(fake.st.ideas.length, 0, 'za krótki pomysł nie trafia na serwer');
    await w.selectOption('#id-cat', 'cosmetic');
    await w.fill('#id-body', 'Peleryna z ogniem dla zwycięzców turnieju');
    await w.click('#id-send');
    await w.waitForFunction(() => /Peleryna z ogniem/.test(document.getElementById('id-list').textContent));
    assert.equal(await w.inputValue('#id-body'), '', 'pole wyczyszczone po wysłaniu');
    assert.match(await w.textContent('#id-list'), /Kosmetyk.*Wysłany|Wysłany.*Kosmetyk/s);
    assert.equal(fake.st.ideas[0].category, 'cosmetic');
    await w.waitForTimeout(400);
    await shot('ideas.png');
    ok('(n) gracz wysyła pomysł i widzi go na liście');

    // Skin: odpowiedzi Mojanga z atrapy w procesie głównym (zalogowane konto Microsoft)
    const skinPng = 'data:image/png;base64,' + pngSkin().toString('base64');
    await app.evaluate(({ ipcMain }, png) => {
      global.skinCalls = [];
      for (const ch of ['skin:current', 'skin:pick', 'skin:set', 'skin:history']) ipcMain.removeHandler(ch);
      ipcMain.handle('skin:current', () => ({ variant: 'classic', dataUrl: png }));
      ipcMain.handle('skin:pick', () => ({ dataUrl: png, variant: 'slim' }));
      ipcMain.handle('skin:set', (_, a) => { global.skinCalls.push(a.variant); return { ok: true }; });
      ipcMain.handle('skin:history', () => [{ id: 'a1', variant: 'classic', dataUrl: png }]);
    }, skinPng);
    await w.click('.nav[data-p="cos"]');
    await w.waitForSelector('#skin-pick');
    assert.equal(await w.isDisabled('#skin-set'), true, 'bez wybranego pliku nie da się ustawić');
    await w.click('#skin-pick');
    await w.waitForFunction(() => document.getElementById('skin-var').value === 'slim' && !document.getElementById('skin-set').disabled);
    await w.click('#skin-set');
    await w.waitForFunction(() => document.getElementById('skin-set').disabled);
    assert.deepEqual(await app.evaluate(() => global.skinCalls), ['slim']);
    await w.waitForSelector('#skin-hist .skh');
    await w.waitForTimeout(500);
    await shot('skin.png');
    ok('(s) skin: wybór pliku, model postaci i ustawienie przez Mojanga');

    // Przymiarka: klik w przedmiot pokazuje go na postaci bez zakładania (animowana peleryna: 2 klatki), czapka też;
    // „Załóż” zakłada naprawdę, a po zdjęciu postać jest bez peleryny
    fake.cosmetics.cape_start.texture = 'data:image/png;base64,' + png(64, 64, (x, y) => (x < 22 && y % 32 < 17 ? (y < 32 ? [255, 210, 74, 255] : [157, 78, 221, 255]) : [0, 0, 0, 0])).toString('base64');
    fake.cosmetics.hat_mib = { id: 'hat_mib', name: 'Korona MiB', type: 'hat', image_url: null, texture: 'data:image/png;base64,' + png(64, 32, (x, y) => (y < 16 ? [255, 210, 74, 255] : [0, 0, 0, 0])).toString('base64') };
    const tester = fake.st.users.find(u => u.nick === 'Tester_1');
    fake.st.owned.push({ user: tester.id, cosmetic: 'hat_mib', at: new Date().toISOString() });
    await w.click('.nav[data-p="home"]');
    await w.click('.nav[data-p="cos"]');
    await w.waitForSelector('.cosi[data-id="hat_mib"]');
    await w.click('.cosi[data-id="cape_start"] b');
    await w.waitForFunction(() => document.getElementById('skin3d').dataset.back === 'cape' && document.getElementById('skin3d').dataset.frames === '2');
    assert.ok(await w.$('.cosi[data-id="cape_start"].try'), 'karta przymierzanej peleryny wyróżniona');
    assert.deepEqual(tester.equipped || {}, {}, 'przymiarka niczego nie zakłada');
    await w.click('.cosi[data-id="hat_mib"] b');
    await w.waitForFunction(() => document.getElementById('skin3d').dataset.hat === '1');
    await w.waitForTimeout(1500);
    await shot('skin-try.png');
    await w.click('.cosi[data-id="cape_start"] .b');
    await w.waitForFunction(() => /Założona/.test(document.querySelector('.cosi[data-id="cape_start"]').textContent));
    assert.deepEqual(tester.equipped, { cape: 'cape_start' });
    assert.equal(await w.$('.cosi[data-id="cape_start"].try'), null, 'po założeniu już bez przymiarki');
    await w.click('.cosi[data-id="cape_start"] .b');
    await w.waitForFunction(() => document.querySelector('.cosi[data-id="cape_start"] .b').textContent === 'Załóż');
    await w.waitForFunction(() => document.getElementById('skin3d').dataset.back === '');
    ok('(t) przymiarka peleryny (animowanej) i czapki na podglądzie skina, Załóż i Zdejmij');

    // Znajomi: zaproszenie po nicku, zaproszenie od kogoś innego, znajomy w grze z serwerem
    const now = new Date().toISOString();
    const kolega = { id: 'u-kolega', email: 'k@mib.pl', password: 'x', nick: 'Kolega', num: 50, created: now };
    const ziomek = { id: 'u-ziomek', email: 'z@mib.pl', password: 'x', nick: 'Ziomek', num: 51, created: now };
    fake.st.users.push(kolega, ziomek);
    const me = fake.st.users.find(u => u.nick === 'Tester_1');
    fake.st.friends.push({ from: ziomek.id, to: me.id, accepted: false });
    fake.st.presence[kolega.id] = { at: Date.now(), playing: true, version: '1.21.11', server: 'play.mib.pl' };
    await w.click('.nav[data-p="friends"]');
    await w.waitForSelector('#fr-who');
    await w.waitForFunction(() => /Ziomek/.test(document.getElementById('fr-list').textContent));
    assert.equal(await w.textContent('.nav[data-p="friends"] .cnt'), '1', 'licznik zaproszeń przy Znajomi');
    await w.fill('#fr-who', 'Nikt');
    await w.click('#fr-add');
    await w.waitForFunction(() => /Nie ma gracza/.test(document.querySelector('#friends-box .err').textContent));
    await w.fill('#fr-who', 'kolega');
    await w.click('#fr-add');
    await w.waitForFunction(() => /Wysłane zaproszenia/.test(document.getElementById('fr-list').textContent));
    fake.st.friends.find(f => f.to === kolega.id).accepted = true; // Kolega przyjął zaproszenie
    await w.click('#fr-list .frow:has-text("Ziomek") button:has-text("Przyjmij")');
    await w.waitForFunction(() => /Twoi znajomi \(2\)/.test(document.getElementById('fr-list').textContent));
    assert.match(await w.textContent('#fr-list .frow.st-game'), /Kolega.*W grze · play\.mib\.pl · 1\.21\.11.*Dołącz/);
    assert.equal(await w.isVisible('.nav[data-p="friends"] .cnt'), false, 'po przyjęciu licznik znika');
    assert.ok(fake.st.presence[me.id] && fake.st.presence[me.id].playing === false, 'launcher zgłasza obecność gracza');
    await w.waitForTimeout(300);
    await shot('friends.png');
    ok('(r) znajomi: zaproszenia, przyjęcie, znajomy w grze z serwerem i przyciskiem Dołącz');

    // Zaproszenie do gry od znajomego: sekcja na górze, licznik, Odrzuć
    assert.equal(await w.$('#fr-list button:has-text("Zaproś do gry")'), null, 'bez gry na serwerze nie ma „Zaproś do gry”');
    fake.st.invites.push({ from: kolega.id, to: me.id, server: 'play.mib.pl', version: '1.21.11', at: Date.now() });
    await w.click('.nav[data-p="friends"]');
    await w.waitForFunction(() => /Zaproszenia do gry \(1\)/.test(document.getElementById('fr-list').textContent));
    assert.match(await w.textContent('#fr-list .ginv'), /Kolega.*Zaprasza na play\.mib\.pl · 1\.21\.11.*Dołącz.*Odrzuć/);
    await w.waitForFunction(() => document.querySelector('.nav[data-p="friends"] .cnt').textContent === '1');
    await shot('friends-invite.png');
    await w.click('#fr-list .ginv button:has-text("Odrzuć")');
    await w.waitForFunction(() => !document.querySelector('#fr-list .ginv'));
    assert.equal(fake.st.invites.length, 0, 'odrzucone zaproszenie znika z bazy');
    await w.waitForFunction(() => document.querySelector('.nav[data-p="friends"] .cnt').hidden);
    ok('(v) zaproszenie do gry od znajomego: sekcja, licznik i Odrzuć');

    // Wiadomości: od znajomego (licznik i „Napisz (1)”), rozmowa w oknie, odpowiedź Enterem, przeczytanie
    fake.st.messages.push({ id: ++fake.st.msgId, from: kolega.id, to: me.id, body: 'Siema, gramy?', at: new Date().toISOString(), read: false });
    await w.click('.nav[data-p="friends"]');
    await w.waitForFunction(() => /Napisz \(1\)/.test(document.getElementById('fr-list').textContent));
    await w.waitForFunction(() => document.querySelector('.nav[data-p="friends"] .cnt').textContent === '1');
    await w.click('#fr-list .frow:has-text("Kolega") .chat-b');
    await w.waitForSelector('#chat .msg:has-text("Siema, gramy?")');
    await w.waitForFunction(() => document.querySelector('.nav[data-p="friends"] .cnt').hidden);
    assert.ok(fake.st.messages[0].read, 'otwarta rozmowa oznacza wiadomość jako przeczytaną');
    await w.fill('#chat-in', 'Jasne, wchodzę!');
    await w.press('#chat-in', 'Enter');
    await w.waitForSelector('#chat .msg.me:has-text("Jasne, wchodzę!")');
    assert.equal(await w.inputValue('#chat-in'), '', 'pole czyste po wysłaniu');
    const sent = fake.st.messages.find(m => m.from === me.id);
    assert.ok(sent && sent.to === kolega.id && sent.body === 'Jasne, wchodzę!', 'wiadomość trafiła do bazy');
    sent.read = true; // Kolega przeczytał
    await w.waitForFunction(() => /przeczytana/.test(document.querySelector('#chat .msg.me small').textContent), null, { timeout: 8000 });
    await shot('chat.png');
    await w.press('#chat-in', 'Escape');
    await w.waitForFunction(() => !document.getElementById('chat'));
    ok('(w) wiadomości do znajomego: licznik, okno rozmowy, wysyłanie Enterem, przeczytane');

    await w.click('.nav[data-p="prof"]');
    await w.waitForSelector('#p-prof.on .phead');
    await w.evaluate(() => { setLang('en'); });
    await w.waitForFunction(() => /Statistics/.test(document.getElementById('prof-box').textContent) && /Founder/.test(document.getElementById('prof-box').textContent));
    await shot('prof-en.png');
    await w.evaluate(() => { setLang('pl'); });
    ok('(g) profil po angielsku');

    // Konto bez profilu (założone, zanim w Supabase uruchomiono schema.sql)
    await w.click('.nav[data-p="prof"]');
    await w.waitForSelector('#p-prof.on .phead');
    await w.click('text=Wyloguj');
    await w.waitForSelector('#pf-nick');
    fake.st.users.push({ id: 'orphan-1', email: 'sierota@mib.pl', password: 'haslo1234', nick: '', num: 0, noProfile: true, created: new Date().toISOString() });
    await w.click('.seg button:nth-child(2)');
    await w.fill('#pl-email', 'sierota@mib.pl'); await w.fill('#pl-pass', 'haslo1234');
    await w.press('#pl-pass', 'Enter');
    await w.waitForSelector('#pc-nick');
    assert.equal(await w.textContent('#plname'), 'Dokończ profil MiB');
    await shot('prof-complete.png');
    await w.fill('#pc-nick', 'Sierota_1');
    await w.click('#pc-go');
    await w.waitForSelector('#rc.on');
    assert.equal(await w.textContent('#rc-t'), 'Konto założone!');
    await w.check('#rc-ok'); await w.click('#rc-x');
    await w.waitForFunction(() => document.getElementById('plname').textContent === 'Sierota_1');
    ok('(j) konto bez profilu: wybór nicku dokańcza profil');

    // Panel admina: Sierota_1 ma numer 2 (MIB-000002)
    await w.waitForSelector('.nav[data-p="admin"]:not([hidden])');
    await w.waitForFunction(() => (document.querySelector('.nav[data-p="admin"] .cnt') || {}).textContent === '1');
    await w.click('.nav[data-p="admin"]');
    await w.click('[data-tab="ideas"]');
    assert.equal(await w.textContent('[data-tab="ideas"]'), 'Pomysły (1)');
    await w.waitForFunction(() => /Peleryna z ogniem/.test(document.getElementById('ai-list').textContent) && /Tester_1/.test(document.getElementById('ai-list').textContent));
    await w.waitForTimeout(400);
    await shot('admin-ideas.png');
    await w.selectOption('#ai-list select', 'planned');
    await w.waitForFunction(() => document.querySelector('.nav[data-p="admin"] .cnt').hidden);
    assert.equal(fake.st.ideas[0].status, 'planned', 'status zapisany na serwerze');
    ok('(o) admin widzi pomysł z licznikiem nowych i zmienia jego status');
    await w.click('[data-tab="ann"]');
    assert.equal(await w.textContent('[data-tab="ann"]'), 'Aktualności');
    await w.waitForSelector('#ad-title');
    await w.fill('#ad-title', 'Turniej w sobotę');
    await w.fill('#ad-body', 'Start o 18:00 na serwerze MiB.');
    await w.check('#ad-pin');
    await w.click('#ad-save');
    await w.waitForFunction(() => /Turniej w sobotę/.test(document.getElementById('ad-list').textContent));
    // zmiana dodanej aktualności
    await w.click('#ad-list .arow button.ghost');
    assert.equal(await w.inputValue('#ad-title'), 'Turniej w sobotę');
    await w.fill('#ad-title', 'Turniej w niedzielę');
    await w.click('#ad-save');
    await w.waitForFunction(() => /Turniej w niedzielę/.test(document.getElementById('ad-list').textContent) && !/sobotę/.test(document.getElementById('ad-list').textContent));
    assert.equal(fake.st.ann.length, 1, 'zmiana nie dodała drugiego wpisu');
    await w.waitForTimeout(400);
    await shot('admin-ann.png');
    await w.click('.nav[data-p="home"]');
    await w.waitForFunction(() => /Turniej w niedzielę/.test((document.querySelector('#ann-home .nw .nt') || {}).textContent || ''));
    await shot('home-ann.png');
    // kliknięcie aktualności otwiera stronę Aktualności z pełną treścią i skrótem do panelu dla admina
    await w.click('#ann-home .nw');
    await w.waitForFunction(() => document.getElementById('p-news').classList.contains('on') && /Start o 18:00/.test(document.getElementById('ann-all').textContent));
    assert.equal(await w.isVisible('#ad-quick'), true, 'admin widzi skrót do dodawania aktualności');
    await w.click('#ad-quick');
    await w.waitForSelector('#ad-title');
    ok('(k) admin dodaje i zmienia aktualność, gracze widzą ją w panelu Aktualności na stronie głównej');

    await w.click('.nav[data-p="admin"]');
    await w.click('[data-tab="codes"]');
    await w.waitForSelector('#ak-item option', { state: 'attached' });
    await w.fill('#ak-count', '2');
    await w.click('#ak-go');
    await w.waitForFunction(() => (document.querySelector('#ak-out pre') || {}).textContent?.split('\n').length === 2);
    await w.click('[data-tab="stats"]');
    await w.waitForFunction(() => /Profile MiB/.test(document.getElementById('admin-tab').textContent));
    assert.match(await w.textContent('#as-now'), /W grze \(profile MiB\).*W launcherze.*play\.mib\.pl2 graczy.*1\.21\.11/s, '„Teraz”: liczniki, serwery i wersje');
    await shot('admin-stats.png');
    await w.click('[data-tab="players"]');
    await w.waitForFunction(() => /Tester_1/.test(document.getElementById('ap-res').textContent));
    await w.click('#ap-res .arow:has-text("Tester_1")');
    await w.waitForSelector('#ap-del');
    assert.equal(await w.isDisabled('#ap-del'), true, 'najpierw trzeba wpisać nick');
    await w.fill('#ap-del-nick', 'Tester_1');
    await w.click('#ap-del');
    await w.waitForFunction(() => !/Tester_1/.test(document.getElementById('ap-res').textContent));
    assert.ok(!fake.st.users.some(u => u.nick === 'Tester_1'), 'konto usunięte na serwerze');
    await w.click('[data-tab="cos"]');
    await w.waitForSelector('#ac-list .cosi');
    await shot('admin-cos.png');
    ok('(l) panel admina: kody, statystyki, gracze (z usunięciem konta), kosmetyki');

    await w.click('.nav[data-p="set"]');
    assert.equal(await w.isChecked('#s-mib'), true, 'mod MiB domyślnie włączony');
    await w.uncheck('#s-mib');
    await w.click('#s-save');
    await w.waitForFunction(() => document.getElementById('s-msg').textContent !== '');
    assert.equal((await w.evaluate(() => mib.call('settings:get'))).mibMod, false);
    await w.check('#s-mib'); await w.click('#s-save');
    ok('(p) ustawienie „Mod MiB w grze” zapisuje się');

    await new Promise(r => { fake.server.closeAllConnections && fake.server.closeAllConnections(); fake.server.close(r); });
    await w.click('.nav[data-p="prof"]');
    await w.waitForFunction(() => /Brak połączenia z serwerem MiB/.test(document.getElementById('prof-box').textContent), null, { timeout: 15000 });
    assert.equal(await w.isDisabled('#go'), false);
    await shot('prof-offline.png');
    ok('(e) bez serwera: komunikat, GRAJ dalej aktywny');

    // Usunięcie aktywnego konta Minecraft = wylogowanie z launchera: także z profilu MiB, a okno logowania Microsoftu
    // zapomina zapisane konta (ciasteczka Microsoftu znikają, inne zostają)
    const userData = await app.evaluate(({ app }) => app.getPath('userData'));
    fs.writeFileSync(path.join(userData, 'accounts.json'), JSON.stringify({ active: 'acc1', list: [{ id: 'acc1', name: 'Gracz_MS', t: 'x' }] }));
    await app.evaluate(async ({ session }) => {
      const exp = Date.now() / 1000 + 3600;
      await session.defaultSession.cookies.set({ url: 'https://login.live.com/', name: 'MSPAuth', value: '1', expirationDate: exp });
      await session.defaultSession.cookies.set({ url: 'https://example.com/', name: 'keep', value: '1', expirationDate: exp });
      await session.fromPartition('persist:mslogin').cookies.set({ url: 'https://login.microsoftonline.com/', name: 'ESTSAUTH', value: '1', expirationDate: exp });
    });
    w.once('dialog', d => d.accept());
    await w.click('#accname');
    await w.click('#accmenu .ai[data-id="acc1"] .rm');
    await w.waitForFunction(() => document.getElementById('plname').textContent === 'Załóż profil MiB');
    const left = await app.evaluate(async ({ session }) => ({ def: (await session.defaultSession.cookies.get({})).map(c => c.name),
      ms: (await session.fromPartition('persist:mslogin').cookies.get({})).length }));
    assert.deepEqual(left.def.filter(n => n === 'MSPAuth' || n === 'keep'), ['keep'], 'ciasteczko Microsoftu usunięte, inne zostaje');
    assert.equal(left.ms, 0, 'sesja okna logowania Microsoftu wyczyszczona');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'accounts.json'), 'utf8')), { active: null, list: [] });
    ok('(u) usunięcie aktywnego konta: wylogowanie z profilu MiB i zapomniane konta w oknie Microsoftu');

    assert.deepEqual(errors, []);
    ok('brak błędów JavaScript na stronie');
    console.log('ALL E2E PASSED, zrzuty w', OUT);
  } catch (e) {
    await shot('FAIL.png').catch(() => {});
    console.error('FAIL', e.message, '\nbłędy strony:', errors, '\nzrzut:', path.join(OUT, 'FAIL.png'));
    process.exitCode = 1;
  } finally {
    await app.close();
    fake.server.close();
  }
})();
