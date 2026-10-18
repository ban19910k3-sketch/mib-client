// Test interfejsu profilu: prawdziwy launcher (Electron) + atrapa Supabase.
// Uruchom: xvfb-run -a node test/e2e/profile.e2e.js [katalog_na_zrzuty]
const path = require('path'), fs = require('fs'), os = require('os');
const { _electron } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { createFake } = require('../fake-supabase');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..', '..'), OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'mib-shots-'));
const ok = m => console.log('PASS', m);

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
