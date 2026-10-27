// Test interfejsu profilu: prawdziwy launcher (Electron) + atrapa Supabase.
// Uruchom: xvfb-run -a node test/e2e/profile.e2e.js [katalog_na_zrzuty]
const path = require('path'), fs = require('fs'), os = require('os');
const { _electron } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { createFake } = require('../fake-supabase');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..', '..'), OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'mib-shots-'));
const ok = m => console.log('PASS', m);
// czeka, aż warunek po stronie atrapy (proces testu) będzie spełniony
async function until(f, ms = 8000) {
  for (const end = Date.now() + ms; !f(); await new Promise(r => setTimeout(r, 50))) if (Date.now() > end) throw new Error('until: ' + f);
}
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
    assert.equal(await w.evaluate(() => document.documentElement.classList.contains('t-halloween')), require('../../lib/profile').season() === 'halloween', 'motyw według daty');
    ok('(ao) motyw Halloween według daty');
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

    // Halloween (0.22.0): skrzydła wróżki (tekstura 128×64, 8 klatek) i aura z ruchem z końcówki id — tekstury z supabase/schema.sql
    const seeded = id => new RegExp("\\('" + id + "', '[^']*', '\\w+', '(data:image/png;base64,[^']+)'\\)").exec(fs.readFileSync(path.join(__dirname, '../../supabase/schema.sql'), 'utf8'))[1];
    fake.cosmetics.wings_test = { id: 'wings_test', name: 'Skrzydła testowe', type: 'wings', image_url: null, texture: seeded('halloween_wings_fire') };
    fake.cosmetics.aura_test_magic = { id: 'aura_test_magic', name: 'Aura testowa', type: 'aura', image_url: null, texture: seeded('halloween_aura_magic') };
    fake.st.owned.push({ user: tester.id, cosmetic: 'wings_test', at: new Date().toISOString() }, { user: tester.id, cosmetic: 'aura_test_magic', at: new Date().toISOString() });
    await w.click('.nav[data-p="home"]');
    await w.click('.nav[data-p="cos"]');
    await w.waitForSelector('.cosi[data-id="aura_test_magic"] canvas.aurath');
    // element null w replaceChildren pokazuje się jako napis „null”
    const nullText = () => w.evaluate(() => { const t = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), bad = []; while (t.nextNode()) if (/^(null|undefined)$/.test(t.currentNode.textContent.trim())) bad.push(t.currentNode.parentElement.id || t.currentNode.parentElement.className); return bad; });
    assert.deepEqual(await nullText(), [], 'napis null na stronie');
    assert.ok(await w.$('.cosi[data-id="wings_test"] canvas.wingth'), 'miniatura skrzydeł wróżki');
    await w.click('.cosi[data-id="wings_test"] b');
    await w.waitForFunction(() => document.getElementById('skin3d').dataset.fairy === '1' && document.getElementById('skin3d').dataset.back === '');
    await w.click('.cosi[data-id="aura_test_magic"] b');
    await w.waitForFunction(() => document.getElementById('skin3d').dataset.aura === 'magic' && document.getElementById('skin3d').dataset.fairy === '1');
    await w.$eval('#skin3d', el => el.scrollIntoView({ block: 'start' }));
    await w.waitForTimeout(1500);
    await shot('halloween.png');
    await w.click('.cosi[data-id="aura_test_magic"] .b');
    await w.waitForFunction(() => /Założona/.test(document.querySelector('.cosi[data-id="aura_test_magic"]').textContent));
    assert.equal(tester.equipped.aura, 'aura_test_magic');
    await w.click('.cosi[data-id="aura_test_magic"] .b');
    await w.waitForFunction(() => document.querySelector('.cosi[data-id="aura_test_magic"] .b').textContent === 'Załóż');
    await w.click('.cosi[data-id="wings_test"] b');
    await w.waitForFunction(() => document.getElementById('skin3d').dataset.fairy === '' && document.getElementById('skin3d').dataset.aura === '');
    ok('(t2) skrzydła wróżki i aura na podglądzie, zakładanie aury');

    // MiB Coins: stan konta w Kosmetykach, „Kup MiB Coins” otwiera link sklepu z numerem MiB (w przeglądarce)
    await app.evaluate(({ shell }) => { global.opened = []; shell.openExternal = async u => { global.opened.push(u); }; });
    tester.coins = 1250;
    await w.click('.nav[data-p="home"]');
    await w.click('.nav[data-p="cos"]');
    await w.waitForFunction(() => document.getElementById('cos-coins') && /^1250$/.test(document.getElementById('cos-coins').textContent));
    assert.equal(await w.isVisible('#cos-shop'), false, 'bez linku do sklepu nie ma przycisku');
    assert.equal(await w.isVisible('#cos-wallet .soon'), true, '„Sklep już wkrótce”');
    fake.st.config.shop_url = 'https://sklep.mib.pl/coins';
    tester.coins = 13250;
    await w.evaluate(() => window.dispatchEvent(new Event('focus')));
    await w.waitForFunction(() => /^13\s250$/.test(document.getElementById('cos-coins').textContent) && !document.getElementById('cos-shop').hidden);
    await w.locator('#cos-wallet').scrollIntoViewIfNeeded();
    await shot('coins.png');
    await w.click('#cos-shop');
    for (let i = 0; i < 100 && !(await app.evaluate(() => global.opened.length)); i++) await w.waitForTimeout(50);
    assert.deepEqual(await app.evaluate(() => global.opened), ['https://sklep.mib.pl/coins?mib=MIB-000001']);
    delete fake.st.config.shop_url;
    tester.coins = 0;
    ok('(am) MiB Coins w Kosmetykach i przycisk do sklepu');

    // Sklep za MiB Coins (0.24.0): przymiarka, za mało coinsów, zakup, prezent dla znajomego, pakiet taniej o to, co gracz
    // już ma, historia coinsów i nagroda dzienna (launcher odebrał ją sam po zalogowaniu)
    assert.ok(fake.st.coinLog.some(l => l.user === tester.id && l.kind === 'daily'), 'nagroda dzienna odebrana po zalogowaniu');
    fake.cosmetics.hat_shop = { id: 'hat_shop', name: 'Czapka sklepowa', type: 'hat', image_url: null, price: 500, texture: fake.cosmetics.hat_mib.texture };
    fake.cosmetics.cape_shop = { id: 'cape_shop', name: 'Peleryna sklepowa', type: 'cape', image_url: null, price: 800, texture: fake.cosmetics.cape_start.texture };
    fake.cosmetics.wings_test.price = 700;
    fake.st.offers.push({ id: ++fake.st.offerId, name: 'Pakiet testowy', items: ['hat_shop', 'cape_shop', 'wings_test'], price: 1000, ends_at: new Date(Date.now() + 3 * 864e5 + 36e5).toISOString() });
    tester.coins = 600;
    await w.click('.nav[data-p="home"]');
    await w.click('.nav[data-p="cos"]');
    await w.click('#cos-tabs [data-t="shop"]');
    await w.waitForSelector('#shop-grid .cosi[data-id="hat_shop"]');
    assert.equal(await w.textContent('#cos-tabs .on'), 'Sklep');
    const offer = await w.textContent('.card.offer');
    assert.match(offer, /Pakiet.*−50%.*jeszcze 3 dni.*Pakiet testowy/s, 'pakiet: zniżka i ile zostało');
    assert.match(offer, /2000.*650.*Kup pakiet.*Taniej, bo masz już część/s, 'zwykła cena przekreślona, cena dla mnie (mam skrzydła)');
    assert.match(await w.textContent('#cos-daily'), /Seria 1\/7/, 'seria nagród dziennych');
    await w.click('#shop-grid .cosi[data-id="hat_shop"] b');
    await w.waitForFunction(() => document.getElementById('skin3d').dataset.hat === '1');
    assert.ok(await w.$('#shop-grid .cosi[data-id="hat_shop"].try'), 'przymiarka w sklepie');
    await w.click('#shop-grid .cosi[data-id="cape_shop"] button:has-text("Kup")');
    await w.waitForSelector('#buy #buy-short');
    assert.match(await w.textContent('#buy-short'), /Brakuje.*200/s, 'za mało coinsów: ile brakuje');
    assert.equal(await w.$('#buy-go'), null, 'zamiast Kup jest Kup MiB Coins');
    await w.press('#buy', 'Escape');
    await w.click('#shop-grid .cosi[data-id="hat_shop"] button:has-text("Kup")');
    await w.waitForSelector('#buy-go');
    assert.match(await w.textContent('#buy .buy-sum'), /Cena.*500.*Twoje coinsy.*600.*Zostanie.*100/s);
    await w.waitForTimeout(800);
    await shot('shop-buy.png');
    await w.click('#buy-go');
    await until(() => fake.st.owned.some(o => o.user === tester.id && o.cosmetic === 'hat_shop' && o.source === 'shop'));
    assert.equal(tester.coins, 100);
    await w.waitForFunction(() => /^100$/.test(document.getElementById('cos-coins').textContent) && /Masz/.test(document.querySelector('#shop-grid .cosi[data-id="hat_shop"]').textContent));
    await w.waitForFunction(() => !document.getElementById('unlock'), null, { timeout: 5000 });
    // prezent: bez znajomych nie ma komu, potem znajomy dostaje okno „Masz prezent!” z nickiem kupującego
    await w.click('#shop-grid .cosi[data-id="cape_shop"] button:has-text("Podaruj")');
    await w.waitForFunction(() => /tylko znajomemu/.test(document.querySelector('#buy .err').textContent));
    assert.equal(await w.isDisabled('#buy-to'), true);
    await w.press('#buy', 'Escape');
    const kumpel = { id: 'u-kumpel', email: 'kumpel@mib.pl', password: 'x', nick: 'Kumpel', num: 60, created: new Date().toISOString() };
    fake.st.users.push(kumpel);
    fake.st.friends.push({ from: tester.id, to: kumpel.id, accepted: true });
    tester.coins = 2000;
    await w.click('#shop-grid .cosi[data-id="cape_shop"] button:has-text("Podaruj")');
    await w.waitForSelector('#buy-to option[value="u-kumpel"]', { state: 'attached' });
    await w.selectOption('#buy-to', 'u-kumpel');
    await w.fill('#buy-msg', 'Wszystkiego najlepszego!');
    await w.waitForTimeout(800);
    await shot('shop-gift.png');
    await w.click('#buy-go');
    await until(() => fake.st.gifts.some(g => g.user === kumpel.id && g.cosmetic === 'cape_shop' && g.from === tester.id && g.message === 'Wszystkiego najlepszego!'));
    await w.waitForSelector('.toast:has-text("Prezent wysłany")');
    assert.equal(tester.coins, 1200);
    assert.ok(!fake.st.owned.some(o => o.user === tester.id && o.cosmetic === 'cape_shop'), 'kupujący nie dostaje prezentu');
    // pakiet: brakuje już tylko peleryny (800 z 2000) → 400
    await w.waitForFunction(() => /400/.test(document.querySelector('.card.offer .price').textContent));
    await w.click('.card.offer button:has-text("Kup pakiet")');
    await w.waitForSelector('#buy-go');
    assert.match(await w.textContent('#buy h3'), /Pakiet testowy/);
    await w.click('#buy-go');
    await until(() => fake.st.owned.some(o => o.user === tester.id && o.cosmetic === 'cape_shop'));
    assert.equal(tester.coins, 800);
    await w.waitForFunction(() => /Masz wszystko/.test(document.querySelector('.card.offer').textContent));
    await w.waitForFunction(() => !document.getElementById('unlock'), null, { timeout: 5000 });
    await w.$eval('#cos-tabs', el => el.scrollIntoView({ block: 'start' }));
    await shot('shop.png');
    await w.click('#cos-tabs [data-t="log"]');
    await w.waitForSelector('#cos-log .cl-row');
    const log = await w.$$eval('#cos-log .cl-row', l => l.map(r => r.textContent));
    assert.match(log[0], /Pakiet: Pakiet testowy.*−400.*800/s);
    assert.match(log[1], /Prezent dla Kumpel: Peleryna sklepowa.*−800/s);
    assert.match(log[2], /Zakup: Czapka sklepowa.*−500.*100/s);
    assert.ok(log.some(r => /Nagroda dzienna.*\+10/s.test(r)), 'nagroda dzienna w historii');
    await shot('shop-history.png');
    await w.click('#cos-tabs [data-t="mine"]');
    await w.waitForSelector('#cos-code');
    assert.match(await w.textContent('.cosi[data-id="cape_shop"]'), /Kupiono/);
    fake.st.friends = fake.st.friends.filter(f => f.to !== kumpel.id);
    fake.st.users = fake.st.users.filter(u => u !== kumpel);
    fake.st.gifts = fake.st.gifts.filter(g => g.user !== kumpel.id);
    tester.coins = 0;
    ok('(an) sklep: przymiarka, za mało coinsów, zakup, prezent dla znajomego, pakiet taniej, historia i nagroda dzienna');

    // Święta (0.25.0): maska i wysoka czapka na podglądzie, kolekcja w sklepie z datą końca, nagroda świąteczna i kalendarz
    // adwentowy na stronie głównej (dzień w atrapie: 5 grudnia), wyłączenie motywów w Ustawieniach. Tekstury z schema.sql.
    const seededP = id => new RegExp("\\('" + id + "', '[^']*', '\\w+', \\w+, '(data:image/png;base64,[^']+)'\\)").exec(fs.readFileSync(path.join(__dirname, '../../supabase/schema.sql'), 'utf8'))[1];
    for (const [id, name, type, price] of [['adwent_mask_broda', 'Broda Mikołaja', 'mask', null], ['zima_hat_renifer', 'Rogi renifera', 'hat', 600], ['zima_hat_elf', 'Czapka elfa', 'hat', 500], ['adwent_hat_pompon', 'Czapka z pomponem', 'hat', null]])
      fake.cosmetics[id] = { id, name, type, price, image_url: null, texture: seededP(id) };
    fake.st.owned.push({ user: tester.id, cosmetic: 'adwent_mask_broda', at: new Date().toISOString() }, { user: tester.id, cosmetic: 'zima_hat_renifer', at: new Date().toISOString() });
    await w.click('.nav[data-p="home"]');
    await w.click('.nav[data-p="cos"]');
    await w.waitForSelector('.cosi[data-id="adwent_mask_broda"] canvas.headth');
    assert.equal(await w.$eval('.cosi[data-id="zima_hat_renifer"] canvas.headth', c => c.height), 72, 'miniatura wysokiej czapki z drugą kostką');
    assert.match(await w.textContent('.cosi[data-id="adwent_mask_broda"]'), /Broda Mikołaja/);
    await w.click('.cosi[data-id="adwent_mask_broda"] b');
    await w.waitForFunction(() => document.getElementById('skin3d').dataset.mask === '1');
    await w.click('.cosi[data-id="zima_hat_renifer"] b');
    await w.waitForFunction(() => document.getElementById('skin3d').dataset.hat === 'tall' && document.getElementById('skin3d').dataset.mask === '1');
    await w.$eval('#skin3d', el => el.scrollIntoView({ block: 'start' }));
    await w.waitForTimeout(1500);
    await shot('swieta-try.png');
    await w.click('.cosi[data-id="adwent_mask_broda"] .b');
    await w.waitForFunction(() => /Założona/.test(document.querySelector('.cosi[data-id="adwent_mask_broda"]').textContent));
    assert.equal(tester.equipped.mask, 'adwent_mask_broda', 'maska to osobne miejsce (razem z czapką)');
    await w.click('.cosi[data-id="adwent_mask_broda"] .b');
    await w.waitForFunction(() => document.querySelector('.cosi[data-id="adwent_mask_broda"] .b').textContent === 'Załóż');
    // 5 grudnia: Boże Narodzenie trwa — kolekcja w sklepie, nagroda świąteczna i 5 okienek kalendarza
    const boze = fake.st.themes.find(t => t.id === 'boze');
    Object.assign(boze, { items: ['zima_hat_renifer', 'zima_hat_elf'], gift_coins: 50, gift_cosmetic: 'adwent_hat_pompon' });
    fake.st.today = '2026-12-05';
    tester.coins = 0;
    await w.click('#cos-tabs [data-t="shop"]');
    await w.waitForSelector('.shop-col[data-theme="boze"] .cosi[data-id="zima_hat_elf"]');
    assert.match(await w.textContent('.shop-col[data-theme="boze"]'), /Kolekcja.*Boże Narodzenie.*do 6\.01\.2027.*jeszcze \d+ dni/s, 'kolekcja z datą końca');
    assert.match(await w.textContent('.shop-col[data-theme="boze"] .cosi[data-id="zima_hat_renifer"]'), /Masz/);
    await w.$eval('.shop-col', el => el.scrollIntoView({ block: 'start' }));
    await shot('swieta-shop.png');
    await w.click('#cos-tabs [data-t="mine"]');
    await w.click('.nav[data-p="home"]');
    await w.evaluate(() => mibProfileUI.holidays());
    await w.waitForSelector('#hol-home .card[data-theme="boze"]');
    assert.match(await w.textContent('#hol-home .card[data-theme="boze"]'), /Nagroda świąteczna.*Boże Narodzenie.*50 MiB Coins \+ Czapka z pomponem.*Odbierz do 6\.01\.2027/s);
    assert.match(await w.textContent('#hol-adv'), /Kalendarz adwentowy.*5 okienek do otwarcia/s);
    await shot('swieta-home.png');
    await w.click('#hol-home .card[data-theme="boze"] button');
    await until(() => tester.coins === 50 && fake.st.owned.some(o => o.user === tester.id && o.cosmetic === 'adwent_hat_pompon'));
    await w.waitForFunction(() => !document.querySelector('#hol-home .card[data-theme="boze"]'));
    await w.waitForFunction(() => !document.getElementById('unlock'), null, { timeout: 5000 });
    await w.click('#hol-adv-go');
    await w.waitForSelector('#adv .adv-win.ready');
    assert.equal((await w.$$('#adv .adv-win.ready')).length, 5, 'okienka 1–5 do otwarcia');
    assert.equal(await w.isDisabled('#adv .adv-win[data-day="6"]'), true, 'jutrzejsze okienko zamknięte');
    await w.click('#adv .adv-win[data-day="5"]');
    await w.waitForSelector('#adv .adv-win[data-day="5"].open');
    assert.match(await w.textContent('#adv .adv-win[data-day="5"]'), /\+20/);
    assert.equal(tester.coins, 70);
    await w.waitForTimeout(600);
    await shot('swieta-advent.png');
    await w.press('#adv', 'Escape');
    await w.waitForFunction(() => /4 okienka do otwarcia/.test(document.getElementById('hol-adv').textContent));
    // zaległe okienko 26 grudnia, potem kalendarz zamknięty
    fake.st.today = '2026-12-27';
    await w.evaluate(() => mibProfileUI.holidays());
    await w.waitForFunction(() => !document.getElementById('hol-adv'));
    fake.st.today = null;
    // historia coinsów: nagroda świąteczna i okienko kalendarza
    await w.click('.nav[data-p="cos"]');
    await w.click('#cos-tabs [data-t="log"]');
    await w.waitForSelector('#cos-log .cl-row');
    const log2 = await w.$$eval('#cos-log .cl-row', l => l.map(r => r.textContent));
    assert.match(log2[0], /Kalendarz adwentowy · 5 grudnia.*\+20/s);
    assert.match(log2[1], /Nagroda świąteczna: Boże Narodzenie.*\+50/s);
    await w.click('#cos-tabs [data-t="mine"]');
    // Ustawienia: bez motywów świątecznych zwykły wygląd, po włączeniu wraca motyw z dzisiejszej daty
    const themeNow = require('../../lib/profile').themeNow(fake.st.themes);
    await w.click('.nav[data-p="set"]');
    assert.equal(await w.isChecked('#s-themes'), true);
    await w.uncheck('#s-themes');
    await w.waitForFunction(() => !/\bt-|themed/.test(document.documentElement.className));
    await w.check('#s-themes');
    await w.waitForFunction(id => !id || document.documentElement.classList.contains('t-' + id), themeNow);
    tester.coins = 0;
    ok('(ap) święta: maska i wysoka czapka, kolekcja w sklepie, nagroda świąteczna, kalendarz adwentowy, wyłączenie motywów');

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

    // Zgłoszenie wiadomości z rozmowy: powód, opis, kopia rozmowy trafia do twórcy
    fake.st.messages.push({ id: ++fake.st.msgId, from: kolega.id, to: me.id, body: 'Jesteś noobem, kurwa', at: new Date().toISOString(), read: false });
    await w.click('.nav[data-p="friends"]');
    await w.click('#fr-list .frow:has-text("Kolega") .chat-b');
    await w.waitForSelector('#chat .msg:has-text("Jesteś noobem, k****")');
    assert.equal(await w.$('#chat .msg:has-text("kurwa")'), null, 'filtr wulgaryzmów w rozmowie');
    await w.click('#chat .msg:has-text("Jesteś noobem") .rep-b');
    await w.waitForSelector('#report blockquote.rp-msg:has-text("Jesteś noobem, k****")');
    await w.selectOption('#rp-reason', 'insult');
    await w.fill('#rp-note', 'Obraża mnie od rana');
    await shot('report.png');
    await w.click('#rp-send');
    await w.waitForFunction(() => !document.getElementById('report'));
    const rep = fake.st.reports[0];
    assert.ok(rep && rep.user === kolega.id && rep.reason === 'insult' && rep.note === 'Obraża mnie od rana', 'zgłoszenie w bazie');
    assert.deepEqual(rep.messages.filter(m => m.reported).map(m => m.body), ['Jesteś noobem, kurwa'], 'kopia zgłoszonej wiadomości (bez filtra, dla twórcy)');
    assert.ok(await w.$('#chat'), 'bez blokady rozmowa zostaje otwarta');
    await w.press('#chat-in', 'Escape');
    await w.waitForFunction(() => !document.getElementById('chat'));
    ok('(ab) zgłoszenie wiadomości z rozmowy: powód, opis i kopia rozmowy');

    // Karta znajomego: postać w jego kosmetykach, odznaki, osiągnięcia; Zablokuj i Odblokuj
    fake.st.owned.push({ user: kolega.id, cosmetic: 'cape_start', at: now });
    kolega.equipped = { cape: 'cape_start' }; kolega.playtime = 720; kolega.launches = 12;
    await w.click('#fr-list .fr-name:has-text("Kolega")');
    await w.waitForFunction(() => /Peleryna Start/.test((document.querySelector('#fcard .fc-body') || {}).textContent || ''));
    assert.match(await w.textContent('#fcard .fc-body'), /Kolega.*MIB-000050.*Czas gry przez MiB.*12 h.*Osiągnięcia \(\d+\/13\)/s);
    assert.equal(await w.$$eval('#fcard .ach', l => l.length), 13);
    assert.ok(await w.$('#fcard .ach.on[data-id="hours_10"]'), '12 godzin gry: osiągnięcie 10 godzin');
    await w.waitForTimeout(800);
    await shot('friend-card.png');
    w.once('dialog', d => d.accept());
    await w.click('#fc-block');
    await w.waitForFunction(() => !document.getElementById('fcard'));
    assert.ok(fake.st.blocks.some(b => b.user === me.id && b.blocked === kolega.id), 'blokada w bazie');
    assert.ok(!fake.st.friends.some(f => [f.from, f.to].includes(kolega.id) && [f.from, f.to].includes(me.id)), 'blokada kończy znajomość');
    await w.waitForFunction(() => /Zablokowani \(1\)/.test(document.getElementById('fr-list').textContent));
    await w.fill('#fr-who', 'Kolega');
    await w.click('#fr-add');
    await w.waitForFunction(() => /Nie możesz zaprosić tego gracza/.test(document.querySelector('#friends-box .err').textContent));
    await w.click('#fr-list .frow.blocked button:has-text("Odblokuj")');
    await w.waitForFunction(() => !/Zablokowani/.test(document.getElementById('fr-list').textContent));
    assert.equal(fake.st.blocks.length, 0, 'odblokowany');
    ok('(ac) karta znajomego z osiągnięciami, blokowanie (bez zaproszeń) i odblokowanie');

    // Osiągnięcia na profilu, ostrzeżenie od twórcy i raport awarii wysłany jednym kliknięciem
    me.warnings = 1;
    fake.st.warnings.push({ id: ++fake.st.warnId, user: me.id, num: 1, reason: 'Obrażanie innych graczy', at: now, seen: false });
    await w.click('.nav[data-p="prof"]');
    await w.waitForSelector('#warn h3');
    assert.equal(await w.textContent('#warn h3'), 'Ostrzeżenie 1/4');
    assert.match(await w.textContent('#warn'), /Powód: Obrażanie innych graczy.*Przy 4\. ostrzeżeniu/s);
    await shot('warning.png');
    await w.click('#warn-ok');
    await w.waitForFunction(() => !document.getElementById('warn'));
    assert.ok(fake.st.warnings.every(x => x.seen), 'ostrzeżenie obejrzane');
    await w.waitForFunction(() => /1\/4/.test((document.getElementById('pf-warn') || {}).textContent || ''));
    await w.waitForSelector('#pf-ach .ach.on[data-id="founder"]');
    assert.ok(await w.$('#pf-ach .ach.on[data-id="idea"]') && await w.$('#pf-ach .ach.on[data-id="friend"]'), 'pomysł i znajomy');
    assert.ok(await w.$('#pf-ach .ach:not(.on)[data-id="veteran"]'), 'niezdobyte z postępem');
    await shot('achievements.png');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('crashed', { code: 1, cause: 'memory', report: false }));
    await w.waitForSelector('#crash.on');
    await w.click('#crash-send');
    await w.waitForFunction(() => !document.getElementById('crash').classList.contains('on'));
    const crash = fake.st.ideas.find(i => i.details);
    assert.ok(crash && crash.user === me.id && crash.category === 'bug' && /^Problem z grą \(Minecraft /.test(crash.body), 'raport jako zgłoszenie błędu');
    assert.match(crash.details, /^MiB Client \d/, 'raport launchera w szczegółach');
    assert.doesNotMatch(crash.details, /accessToken\s+\w{20}/, 'bez tokenów');
    ok('(ad) osiągnięcia na profilu, okno ostrzeżenia 1/4 i raport awarii do twórcy');

    // Głosowanie na pomysły innych graczy (bez własnych i bez zgłoszeń błędów), filtr wulgaryzmów w treści
    fake.st.ideas.push({ id: ++fake.st.ideaId, user: kolega.id, category: 'feature', body: 'Dodajcie kurwa tryb 1v1 na arenie', status: 'new', created_at: now },
      { id: ++fake.st.ideaId, user: ziomek.id, category: 'cosmetic', body: 'Skrzydła z ognia dla zwycięzców', status: 'planned', created_at: now },
      { id: ++fake.st.ideaId, user: ziomek.id, category: 'bug', body: 'Czat się zacina w menu gry', status: 'new', created_at: now });
    const kIdea = fake.st.ideas.find(i => i.user === kolega.id && i.category === 'feature');
    fake.st.votes.push({ idea: fake.st.ideaId - 1, user: kolega.id }, { idea: fake.st.ideaId - 1, user: 'x' });
    await w.click('.nav[data-p="ideas"]');
    await w.waitForSelector('#ip-list .idea.pub');
    assert.match(await w.textContent('#ip-list .idea.pub:first-child'), /Ziomek.*Skrzydła z ognia/s, 'najpopularniejsze na górze');
    assert.equal(await w.$('#ip-list .idea.pub:has-text("Czat się zacina")'), null, 'zgłoszeń błędów nie ma w głosowaniu');
    const kCard = `#ip-list .idea.pub[data-id="${kIdea.id}"]`;
    assert.match(await w.textContent(kCard), /Dodajcie k\*\*\*\* tryb 1v1/, 'filtr wulgaryzmów w pomysłach');
    assert.equal(await w.isDisabled('#ip-list .idea.pub.mine .vote'), true, 'na własny pomysł nie można głosować');
    await w.click(kCard + ' .vote');
    await w.waitForFunction(s => document.querySelector(s + ' .vote').classList.contains('on') && document.querySelector(s + ' .vote b').textContent === '1', kCard);
    assert.ok(fake.st.votes.some(v => v.idea === kIdea.id && v.user === me.id), 'głos w bazie');
    await shot('ideas-vote.png');
    await w.click(kCard + ' .vote');
    await w.waitForFunction(s => !document.querySelector(s + ' .vote').classList.contains('on') && document.querySelector(s + ' .vote b').textContent === '0', kCard);
    await w.click(kCard + ' .vote');
    await until(() => fake.st.votes.some(v => v.idea === kIdea.id && v.user === me.id));
    await w.click('#ip-sort button[data-sort="new"]');
    await w.waitForFunction(id => document.querySelector('#ip-list .idea.pub').dataset.id === String(id), fake.st.ideaId - 1);
    ok('(ak) głosowanie na pomysły graczy: najpopularniejsze, głos i cofnięcie, filtr wulgaryzmów');

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
    await w.click('#prof-box .seg button:nth-child(2)');
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
    // licznik: 4 nowe pomysły (Tester_1, raport awarii, Kolega, błąd od Ziomka) + 1 nowe zgłoszenie
    await w.waitForFunction(() => (document.querySelector('.nav[data-p="admin"] .cnt') || {}).textContent === '5');
    await w.click('.nav[data-p="admin"]');
    await w.click('[data-tab="ideas"]');
    assert.equal(await w.textContent('[data-tab="ideas"]'), 'Pomysły (4)');
    await w.waitForFunction(() => /Peleryna z ogniem/.test(document.getElementById('ai-list').textContent) && /Tester_1/.test(document.getElementById('ai-list').textContent));
    await w.waitForTimeout(400);
    await shot('admin-ideas.png');
    const idea = '#ai-list .idea:has-text("Peleryna z ogniem")', crashCard = '#ai-list .idea:has-text("Problem z grą")';
    await w.click(crashCard + ' button:has-text("Pokaż raport awarii")');
    await w.waitForFunction(() => /^MiB Client \d/.test((document.querySelector('#ai-list .crash-log:not([hidden])') || {}).textContent || ''));
    await w.selectOption(idea + ' select', 'planned');
    await w.waitForFunction(() => document.querySelector('.nav[data-p="admin"] .cnt').textContent === '4');
    await w.selectOption('#ai-sort', 'votes');
    assert.match(await w.textContent('#ai-list .idea:first-child'), /Ziomek.*Głosy: 2.*Skrzydła z ognia/s, 'najwięcej głosów na górze');
    await w.selectOption('#ai-sort', '');
    assert.equal(fake.st.ideas[0].status, 'planned', 'status zapisany na serwerze');
    ok('(o) admin widzi pomysł z licznikiem nowych, raport awarii i zmienia status');

    // Odpowiedź na pomysł i nagroda za niego: kosmetyk do odebrania, pomysł → Zrobione
    await w.fill(idea + ' .idea-reply', 'Dzięki, dodamy ją w następnej wersji!');
    await w.click(idea + ' button:has-text("Wyślij odpowiedź")');
    await until(() => fake.st.ideas[0].reply === 'Dzięki, dodamy ją w następnej wersji!');
    await w.click(idea + ' button:has-text("Nagródź")');
    await w.waitForSelector(idea + ' .gift-form .gift-pick option', { state: 'attached' });
    await w.selectOption(idea + ' .gift-pick', 'cape_start');
    await w.fill(idea + ' .gift-note', 'Dzięki za świetny pomysł!');
    await w.click(idea + ' button:has-text("Wyślij nagrodę")');
    await w.waitForSelector(idea + ' .tag.hunter:has-text("Nagrodzony")');
    assert.equal(fake.st.gifts.length, 1, 'prezent czeka w bazie');
    assert.equal(fake.st.ideas[0].status, 'done', 'nagrodzony pomysł jest zrobiony');
    assert.equal(await w.$(idea + ' button:has-text("Nagródź")'), null, 'drugi raz nie da się nagrodzić');
    await shot('admin-reward.png');
    ok('(y) admin odpowiada na pomysł i nagradza go kosmetykiem');

    await w.click('[data-tab="reports"]');
    assert.equal(await w.textContent('[data-tab="reports"]'), 'Zgłoszenia (1)');
    await w.waitForSelector('#ar-list .report .rp-log .on:has-text("Jesteś noobem")');
    assert.match(await w.textContent('#ar-list .report'), /Kolega.*Wyzwiska.*zgłosił Tester_1.*Obraża mnie od rana/s);
    assert.equal(await w.inputValue('#ar-list .warn-why'), 'Obrażanie innych graczy', 'powód podpowiedziany z powodu zgłoszenia');
    await shot('admin-reports.png');
    await w.click('#ar-list button:has-text("Ostrzeż (1/4)")');
    await until(() => kolega.warnings === 1 && fake.st.reports[0].status === 'warned');
    await w.waitForFunction(() => /Brak nowych zgłoszeń/.test(document.getElementById('ar-list').textContent));
    ok('(ae) zgłoszenia w panelu admina: kopia rozmowy i ostrzeżenie 1/4');
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

    await w.fill('#ad-title', 'Turniej za godzinę!');
    await w.check('#ad-popup');
    await w.click('#ad-save');
    await w.waitForFunction(() => /Turniej za godzinę!.*okno/.test(document.getElementById('ad-list').textContent));
    assert.ok(fake.st.ann.find(a => a.title === 'Turniej za godzinę!').popup, 'zapisana jako okno');
    await w.evaluate(() => mib.call('news:check'));
    await w.waitForSelector('#news-pop h3:has-text("Turniej za godzinę!")');
    await shot('news-popup.png');
    await w.click('#news-ok');
    await w.evaluate(() => mib.call('news:check'));
    await w.waitForTimeout(300);
    assert.equal(await w.$('#news-pop'), null, 'każdą ważną aktualność widać raz');
    ok('(af) ważna aktualność: okno u gracza tylko raz');

    await w.click('.nav[data-p="admin"]');
    await w.click('[data-tab="codes"]');
    await w.waitForSelector('#ak-item option', { state: 'attached' });
    await w.fill('#ak-count', '2');
    await w.click('#ak-go');
    await w.waitForFunction(() => (document.querySelector('#ak-out pre') || {}).textContent?.split('\n').length === 2);
    await w.fill('#ak-code', 'turniej2026');
    assert.equal(await w.isDisabled('#ak-count'), true, 'kod o własnej nazwie jest jeden');
    await w.fill('#ak-until', new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
    await w.click('#ak-go');
    await w.waitForFunction(() => (document.querySelector('#ak-out pre') || {}).textContent === 'TURNIEJ2026');
    assert.ok(fake.st.codes.TURNIEJ2026 && fake.st.codes.TURNIEJ2026.until, 'kod z datą końca');
    await w.waitForFunction(() => /TURNIEJ2026.*ważny do/s.test(document.getElementById('ak-list').textContent));
    await w.click('[data-tab="stats"]');
    await w.waitForFunction(() => /Profile MiB/.test(document.getElementById('admin-tab').textContent));
    assert.match(await w.textContent('#as-now'), /W grze \(profile MiB\).*W launcherze.*play\.mib\.pl2 graczy.*1\.21\.11/s, '„Teraz”: liczniki, serwery i wersje');
    await w.waitForSelector('#as-chart svg polyline');
    assert.equal(await w.$$eval('#as-chart svg polyline', l => l.length), 2, 'linie: w launcherze i w grze');
    assert.equal(await w.$$eval('#as-chart .ac-table tbody tr', l => l.length), 30, 'tabela 30 dni');
    await w.hover('#as-chart .ac-hit[data-i="20"]');
    await w.waitForFunction(() => !document.querySelector('#as-chart .ac-tip').hidden && /W launcherze: \d+.*W grze: \d+.*Nowe profile: \d+/s.test(document.querySelector('#as-chart .ac-tip').textContent));
    await w.locator('#as-chart').scrollIntoViewIfNeeded();
    await shot('admin-stats.png');
    await w.click('[data-tab="players"]');
    await w.waitForFunction(() => /Tester_1/.test(document.getElementById('ap-res').textContent));
    await w.click('#ap-res .arow:has-text("Tester_1")');
    await w.waitForSelector('#ap-del');
    // MiB Coins: dodanie i zabranie (minus) z powodem
    await w.fill('#ap-coins', '1500');
    await w.fill('#ap-coins-why', 'zakup na stronie');
    await w.click('#ap-coins-go');
    await w.waitForFunction(() => /^1500$/.test(document.getElementById('ap-coins-bal').textContent));
    await w.fill('#ap-coins', '-9999999');
    await w.click('#ap-coins-go');
    await w.waitForSelector('.toast:has-text("najwyżej milion")');
    assert.equal(fake.st.users.find(u => u.nick === 'Tester_1').coins, 1500, 'saldo po zmianach w panelu');
    await w.click('#ap-coins-hist');
    await w.waitForFunction(() => /Od admina: zakup na stronie.*\+1500/s.test(document.getElementById('ap-coins-log').textContent) && /Pakiet: Pakiet testowy/.test(document.getElementById('ap-coins-log').textContent));
    assert.equal(await w.isDisabled('#ap-del'), true, 'najpierw trzeba wpisać nick');
    await w.fill('#ap-del-nick', 'Tester_1');
    await w.click('#ap-del');
    await w.waitForFunction(() => !/Tester_1/.test(document.getElementById('ap-res').textContent));
    assert.ok(!fake.st.users.some(u => u.nick === 'Tester_1'), 'konto usunięte na serwerze');
    await w.click('#ap-res .arow:has-text("Kolega")');
    await w.waitForSelector('#ap-detail .mod-row');
    assert.match(await w.textContent('#ap-detail .mod-row'), /Ostrzeżenia: 1\/4/);
    await w.fill('#ap-detail .warn-why', 'Próba oszustwa');
    w.once('dialog', d => d.accept());
    await w.click('#ap-detail button:has-text("Zbanuj")');
    await until(() => kolega.banned && kolega.banReason === 'Próba oszustwa');
    await w.waitForSelector('#ap-detail .mod-row button:has-text("Odbanuj")');
    await shot('admin-ban.png');
    w.once('dialog', d => d.accept());
    await w.click('#ap-detail button:has-text("Odbanuj")');
    await until(() => !kolega.banned && kolega.warnings === 0);
    ok('(ag) gracze: ban od razu i zdjęcie bana (ostrzeżenia od zera)');
    await w.click('[data-tab="cos"]');
    await w.waitForSelector('#ac-list .cosi');
    await w.fill('#ac-shop', 'http://zly-link.pl');
    await w.click('#ac-shop-save');
    await w.waitForSelector('.toast:has-text("https://")');
    await w.fill('#ac-shop', 'https://sklep.mib.pl/coins');
    await w.click('#ac-shop-save');
    await until(() => fake.st.config.shop_url === 'https://sklep.mib.pl/coins');
    // cena przedmiotu i oferta z datą końca
    await w.click('#ac-list .cosi:has-text("Peleryna Start") button:has-text("Edytuj")');
    await w.fill('#ac-price', '300');
    await w.click('#ac-save');
    await until(() => fake.cosmetics.cape_start.price === 300);
    await w.waitForFunction(() => /300 coinsów/.test(document.querySelector('#ac-list').textContent));
    await w.fill('#ao-name', 'Pakiet startowy');
    await w.check('#ao-items input[value="cape_start"]');
    await w.check('#ao-items input[value="hat_mib"]');
    await w.fill('#ao-price', '200');
    await w.waitForFunction(() => /300.*taniej o 33%/.test(document.getElementById('ao-sum').textContent));
    await w.fill('#ao-until', new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10));
    await w.click('#ao-save');
    await until(() => fake.st.offers.some(o => o.name === 'Pakiet startowy' && o.ends_at && o.items.join() === 'cape_start,hat_mib' && o.price === 200));
    await w.waitForFunction(() => /Pakiet startowy.*−33%.*200 coinsów zamiast 300/s.test(document.getElementById('ao-list').textContent));
    await w.locator('#ao').scrollIntoViewIfNeeded();
    await shot('admin-offers.png');
    fake.st.offers = fake.st.offers.filter(o => o.name !== 'Pakiet startowy');
    await shot('admin-cos.png');
    ok('(l) panel admina: kody, statystyki, gracze (z usunięciem konta i historią coinsów), kosmetyki z ceną, oferty');

    // Zakładka Motywy (0.25.0): zła data, nagroda świąteczna, dodatek dzienny, kolekcja, włączenie od razu i kalendarz adwentowy
    const walOld = { ...fake.st.themes.find(t => t.id === 'walentynki') };
    await w.click('[data-tab="themes"]');
    await w.waitForSelector('#at-list .theme-row[data-id="walentynki"]');
    assert.equal((await w.$$('#at-list .theme-row')).length, 11, '11 motywów');
    await w.click('#at-list .theme-row[data-id="walentynki"] button');
    await w.fill('#at-starts', '13-02');
    await w.click('#at-save');
    await w.waitForFunction(() => /MM-DD/.test(document.querySelector('#at-form .err').textContent));
    await w.fill('#at-starts', '02-12');
    await w.fill('#at-coins', '75');
    await w.selectOption('#at-gift', 'cape_start');
    await w.fill('#at-bonus', '5');
    await w.check('#at-items input[value="hat_mib"]');
    await w.check('#at-forced');
    await w.click('#at-save');
    await until(() => { const t = fake.st.themes.find(x => x.id === 'walentynki'); return t.starts === '02-12' && t.gift_coins === 75 && t.gift_cosmetic === 'cape_start' && t.daily_bonus === 5 && t.forced && t.items.join() === 'hat_mib'; });
    await w.waitForFunction(() => /włączony teraz ręcznie.*Nagroda: 75 MiB Coins i Peleryna Start.*kolekcja: 1.*dzienna \+5/s.test(document.querySelector('#at-list .theme-row[data-id="walentynki"]').textContent));
    // launcher bierze wymuszony motyw z bazy
    await w.evaluate(() => MibThemes.refresh());
    await w.waitForFunction(() => document.documentElement.classList.contains('t-walentynki') && document.documentElement.classList.contains('themed'));
    await w.fill('#aa-list .adv-row[data-day="7"] .adv-coins', '40');
    await w.press('#aa-list .adv-row[data-day="7"] .adv-coins', 'Tab');
    await until(() => fake.st.advent.find(a => a.day === 7).coins === 40);
    await w.selectOption('#aa-list .adv-row[data-day="8"] .adv-cos', 'cape_start');
    await until(() => fake.st.advent.find(a => a.day === 8).cosmetic_id === 'cape_start');
    await w.waitForTimeout(500);
    await shot('admin-themes.png');
    Object.assign(fake.st.themes.find(t => t.id === 'walentynki'), walOld);
    Object.assign(fake.st.advent.find(a => a.day === 7), { coins: 20 });
    Object.assign(fake.st.advent.find(a => a.day === 8), { cosmetic_id: null });
    await w.evaluate(() => MibThemes.refresh());
    await w.waitForFunction(() => !document.documentElement.classList.contains('t-walentynki'));
    ok('(aq) zakładka Motywy: daty, nagroda świąteczna, kolekcja, włączenie od razu, kalendarz adwentowy');

    // Prezent z zakładki Gracze i nagroda za zgłoszony błąd z odpowiedzią: admin (Sierota_1) wysyła je sobie.
    // Sprawdzanie prezentów co minutę (main.js) wstrzymane, żeby okno nie wyskoczyło w połowie klikania w panelu
    await app.evaluate(({ BrowserWindow }) => { for (const b of BrowserWindow.getAllWindows()) { const wc = b.webContents, real = wc.send; wc.realSend = real; wc.send = (ch, ...a) => ch === 'gifts:changed' ? undefined : real.call(wc, ch, ...a); } });
    const sier = fake.st.users.find(u => u.nick === 'Sierota_1');
    await w.click('[data-tab="players"]');
    await w.click('#ap-res .arow:has-text("Sierota_1")');
    await w.waitForSelector('#ap-detail .gift-pick option[value="cape_start"]', { state: 'attached' });
    await w.selectOption('#ap-detail .gift-pick', 'cape_start');
    await w.click('#ap-detail button:has-text("Wyślij prezent")');
    await until(() => fake.st.gifts.some(g => g.user === sier.id && g.cosmetic === 'cape_start'));
    fake.st.ideas.push({ id: ++fake.st.ideaId, user: sier.id, category: 'bug', body: 'Czat w grze nie przewija się do końca', status: 'new', created_at: new Date().toISOString() });
    await w.click('[data-tab="ideas"]');
    const bugCard = '#ai-list .idea:has-text("Czat w grze")';
    await w.waitForSelector(bugCard + ' button:has-text("Nagródź")');
    await w.fill(bugCard + ' .idea-reply', 'Naprawione, poprawka będzie w 0.19.0.');
    await w.click(bugCard + ' button:has-text("Wyślij odpowiedź")');
    await until(() => fake.st.ideas.some(i => i.user === sier.id && i.reply));
    await w.click(bugCard + ' button:has-text("Nagródź")');
    await w.waitForSelector(bugCard + ' .gift-pick option[value="hat_mib"]', { state: 'attached' });
    await w.selectOption(bugCard + ' .gift-pick', 'hat_mib');
    await w.fill(bugCard + ' .gift-note', 'Dzięki za znalezienie błędu z czatem!');
    await w.click(bugCard + ' button:has-text("Wyślij nagrodę")');
    await w.waitForSelector(bugCard + ' .tag.hunter');
    assert.equal(sier.bugs, 1, 'nagrodzony błąd liczy się do odznaki Łowca błędów');
    await app.evaluate(({ BrowserWindow }) => { for (const b of BrowserWindow.getAllWindows()) if (b.webContents.realSend) b.webContents.send = b.webContents.realSend; });

    // Gracz: okno „Masz prezent!” (po kolei oba prezenty), Odbierz, Później / Załóż od razu, kropka przy Kosmetyki
    await w.click('.nav[data-p="prof"]');
    await w.waitForSelector('#gift .gift-name');
    assert.equal(await w.textContent('#gift .gift-name'), 'Peleryna Start');
    assert.match(await w.textContent('#gift .gift-kicker'), /Prezent od MiB · 1\/2/);
    assert.equal(await w.textContent('.nav[data-p="cos"] .cnt'), '2', 'licznik prezentów przy Kosmetyki');
    await w.click('#gift-claim');
    await w.waitForSelector('#gift-later');
    await w.waitForFunction(() => !document.getElementById('unlock'), null, { timeout: 5000 });
    await w.click('#gift-later');
    await w.waitForFunction(() => /Korona MiB/.test((document.querySelector('#gift .gift-name') || {}).textContent || ''));
    assert.match(await w.textContent('#gift .gift-kicker'), /Nagroda za znalezienie błędu/);
    assert.match(await w.textContent('#gift .gift-msg'), /Dzięki za znalezienie błędu z czatem!.*twórca MiB Client/);
    await w.waitForTimeout(1200);
    await shot('gift.png');
    await w.click('#gift-claim');
    await w.waitForSelector('#gift-equip');
    await w.waitForFunction(() => !document.getElementById('unlock'), null, { timeout: 5000 });
    await w.click('#gift-equip');
    await w.waitForFunction(() => !document.getElementById('gift'));
    assert.deepEqual(sier.equipped, { hat: 'hat_mib' }, 'Załóż od razu zakłada prezent');
    assert.deepEqual(fake.st.owned.filter(o => o.user === sier.id).map(o => o.cosmetic).sort(), ['cape_start', 'hat_mib']);
    assert.ok(fake.st.gifts.every(g => g.user !== sier.id || g.claimed), 'oba prezenty odebrane');
    await w.waitForFunction(() => document.querySelector('.nav[data-p="cos"] .cnt').hidden);
    assert.match(await w.textContent('#pf-hunter'), /Łowca błędów/);
    ok('(z) prezenty od MiB: okno z podglądem, Odbierz, Załóż od razu, licznik przy Kosmetyki, odznaka Łowca błędów');

    // Odpowiedź na pomysł: kropka przy Pomysły, odpowiedź pod pomysłem, po obejrzeniu kropka znika
    await w.waitForFunction(() => document.querySelector('.nav[data-p="ideas"] .cnt')?.textContent === '1');
    await w.click('.nav[data-p="ideas"]');
    await w.waitForSelector('#id-list .ireply');
    assert.match(await w.textContent('#id-list .idea'), /Nagrodzony.*Zrobione.*Czat w grze.*Odpowiedź twórcy MiB Client.*Naprawione, poprawka będzie w 0\.19\.0\./s);
    await w.waitForFunction(() => document.querySelector('.nav[data-p="ideas"] .cnt').hidden);
    await w.waitForTimeout(300);
    await shot('ideas-reply.png');
    ok('(aa) odpowiedź twórcy pod pomysłem i kropka przy Pomysły do obejrzenia');

    await w.click('.nav[data-p="admin"]');
    await w.click('[data-tab="players"]');
    await w.waitForSelector('#ga-pick option[value="cape_start"]', { state: 'attached' });
    await w.selectOption('#ga-pick', 'cape_start');
    await w.fill('#ga-note', 'Wesołych Świąt od MiB!');
    const giftsBefore = fake.st.gifts.length;
    w.once('dialog', d => d.accept());
    await w.click('#ga-go');
    await until(() => fake.st.gifts.length > giftsBefore);
    const toAll = fake.st.gifts.slice(giftsBefore);
    assert.ok(toAll.every(g => g.cosmetic === 'cape_start' && g.message === 'Wesołych Świąt od MiB!' && g.user !== sier.id), 'tylko gracze bez tej peleryny');
    assert.ok(toAll.some(g => g.user === ziomek.id) && !toAll.some(g => g.user === kolega.id), 'Ziomek dostaje prezent, Kolega już ma tę pelerynę');
    ok('(ah) prezent dla wszystkich graczy, którzy go nie mają');

    await w.click('.nav[data-p="set"]');
    assert.equal(await w.isChecked('#s-mib'), true, 'mod MiB domyślnie włączony');
    await w.uncheck('#s-mib');
    await w.click('#s-save');
    await w.waitForFunction(() => document.getElementById('s-msg').textContent !== '');
    assert.equal((await w.evaluate(() => mib.call('settings:get'))).mibMod, false);
    await w.check('#s-mib'); await w.click('#s-save');
    ok('(p) ustawienie „Mod MiB w grze” zapisuje się');
    fake.st.presence[sier.id] = { at: Date.now(), playing: false };
    await w.check('#s-inv'); await w.click('#s-save');
    await until(() => !fake.st.presence[sier.id] && fake.st.calls.some(c => c.path === '/rest/v1/rpc/presence_ping' && c.body.p_hidden === true));
    await w.uncheck('#s-inv'); await w.click('#s-save');
    await until(() => !!fake.st.presence[sier.id]);
    ok('(ai) tryb niewidoczny: znajomi widzą offline, po wyłączeniu znów online');
    assert.equal(await w.isChecked('#s-cf'), true, 'filtr wulgaryzmów domyślnie włączony');
    await w.uncheck('#s-cf'); await w.click('#s-save');
    await w.waitForFunction(() => mib.call('settings:get').then(s => s.chatFilter === false));
    await w.click('.nav[data-p="ideas"]');
    await w.waitForSelector('#ip-list .idea.pub:has-text("Dodajcie kurwa tryb")');
    await w.click('.nav[data-p="set"]');
    await w.check('#s-cf'); await w.click('#s-save');
    ok('(al) filtr wulgaryzmów można wyłączyć w Ustawieniach');

    // Moje mody: pliki .jar przeciągnięte do okna (ten sam kanał co upuszczenie na stronę)
    {
      const AdmZip = require(path.join(ROOT, 'node_modules/adm-zip'));
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mib-drop-'));
      const mk = (name, entry) => { const z = new AdmZip(); z.addFile(entry, Buffer.from('{}')); z.writeZip(path.join(dir, name)); return path.join(dir, name); };
      const fab = mk('sodium-test.jar', 'fabric.mod.json'), forge = mk('forge-only.jar', 'META-INF/mods.toml'), junk = mk('notatki.jar', 'readme.txt');
      fs.writeFileSync(path.join(dir, 'obraz.png'), 'x');
      const r = await w.evaluate(p => mib.call('mods:add', { gv: '1.21.11', paths: p }), [fab, forge, junk, path.join(dir, 'obraz.png')]);
      assert.deepEqual(r.added, ['sodium-test.jar']);
      assert.deepEqual(r.errors.map(e => e.code), ['wrong_loader', 'not_mod', 'not_jar'], 'Forge do wersji z Fabricem, nie-mod i nie-.jar odrzucone');
      const again = await w.evaluate(p => mib.call('mods:add', { gv: '1.21.11', paths: [p] }), fab);
      assert.equal(again.errors[0].code, 'exists');
      const list = await w.evaluate(() => mib.call('mods:list', '1.21.11'));
      assert.ok(list.some(m => m.file === 'sodium-test.jar'), 'mod na liście Moje mody');
      await w.click('.nav[data-p="mods"]');
      await w.waitForSelector('#p-mods.on #mdrop');
      await w.dispatchEvent('#p-mods', 'dragenter', { dataTransfer: await w.evaluateHandle(() => { const d = new DataTransfer(); d.items.add(new File(['x'], 'a.jar')); return d; }) });
      assert.ok(await w.$('#p-mods.drop'), 'pole upuszczania podświetla się przy przeciąganiu pliku');
      await shot('mods-drop.png');
      await w.dispatchEvent('#p-mods', 'dragleave');
      assert.equal(await w.$('#p-mods.drop'), null);
      ok('(x) mody przeciągnięte do Moje mody: tylko .jar z modem na loader tej wersji');
    }

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

    // Co nowego: po aktualizacji (inna wersja w mib-state.json) okno z listą zmian tej wersji, tylko raz
    fs.writeFileSync(path.join(userData, 'mib-state.json'), JSON.stringify({ lastVersion: '0.0.1' }));
    await w.reload();
    await w.waitForSelector('#wn h4', { timeout: 15000 });
    assert.match(await w.textContent('#wn'), /Co nowego.*Dodane/s);
    await shot('whatsnew.png');
    await w.click('#wn-ok');
    assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'mib-state.json'), 'utf8')).lastVersion, require(path.join(ROOT, 'package.json')).version);
    ok('(aj) okno „Co nowego” raz po aktualizacji');

    assert.deepEqual(errors, []);
    ok('brak błędów JavaScript na stronie');
    console.log('ALL E2E PASSED, zrzuty w', OUT);
  } catch (e) {
    await shot('FAIL.png').catch(() => {});
    console.error('FAIL', e.message, '\nbłędy strony:', errors, '\nzrzut:', path.join(OUT, 'FAIL.png'), '\n' + String(e.stack).split('\n').filter(l => l.includes('profile.e2e')).join('\n'));
    process.exitCode = 1;
  } finally {
    await app.close();
    fake.server.close();
  }
})();
