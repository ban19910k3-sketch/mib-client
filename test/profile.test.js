const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const P = require('../lib/profile');

test('validateNick', () => {
  assert.equal(P.validateNick('ab'), 'nick_length');
  assert.equal(P.validateNick('a'.repeat(17)), 'nick_length');
  assert.equal(P.validateNick('Łukasz'), 'nick_chars');
  assert.equal(P.validateNick('gra cz'), 'nick_chars');
  assert.equal(P.validateNick('Gracz_01'), null);
  assert.equal(P.validateNick(undefined), 'nick_length');
});

test('formatMibId', () => {
  assert.equal(P.formatMibId(127), 'MIB-000127');
  assert.equal(P.formatMibId(1234567), 'MIB-1234567');
});

test('newRecoveryCode', () => {
  const re = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;
  assert.match(P.newRecoveryCode(() => new Uint8Array(16)), re);
  const a = P.newRecoveryCode(crypto.randomBytes), b = P.newRecoveryCode(crypto.randomBytes);
  assert.match(a, re);
  assert.notEqual(a, b);
});

test('normalizeRecoveryCode', () => {
  assert.equal(P.normalizeRecoveryCode(' k7qm-2xpa 9tfd-w4hn '), 'K7QM2XPA9TFDW4HN');
  assert.equal(P.normalizeRecoveryCode('OIL0'), '0110');
});

test('pickSynced', () => {
  assert.deepEqual(P.pickSynced({ ram: 4096, root: 'C:/x', bg: 'custom', lang: 'en' }), { ram: 4096, lang: 'en' });
  assert.deepEqual(P.pickSynced({ bg: 'black', java: 'x', fx: '0' }), { bg: 'black', fx: '0' });
});

test('JVM arguments are never synced', () => {
  assert.deepEqual(P.pickSynced({ jvm: '-javaagent:x.jar', ram: 2048 }), { ram: 2048 });
});

test('sanitizeSynced keeps only safe values', () => {
  assert.deepEqual(P.sanitizeSynced({ ram: 4096, width: 1920, height: 1080, lang: 'en', bg: 'black', anim: 'off', fx: '0', priority: false, hideUpdates: true }),
    { ram: 4096, width: 1920, height: 1080, lang: 'en', bg: 'black', anim: 'off', fx: '0', priority: false, hideUpdates: true });
  assert.deepEqual(P.sanitizeSynced({ ram: '4096', width: 99999, height: -1, lang: 'de', bg: 'url(x)', jvm: '-javaagent:x', priority: 'yes', fx: 1 }), {});
  assert.deepEqual(P.sanitizeSynced(null), {});
});

test('mergeSettings', () => {
  const r = at => ({ settings: {}, updatedAt: at });
  assert.equal(P.mergeSettings(null, r(5)), 'apply');
  assert.equal(P.mergeSettings(10, r(5)), 'push');
  assert.equal(P.mergeSettings(5, r(10)), 'apply');
  assert.equal(P.mergeSettings(5, null), 'push');
  assert.equal(P.mergeSettings(null, null), 'push');
  assert.equal(P.mergeSettings(7, r(7)), 'none');
});

test('clampSessionMinutes', () => {
  assert.equal(P.clampSessionMinutes(-5), 0);
  assert.equal(P.clampSessionMinutes(90_000), 2);
  assert.equal(P.clampSessionMinutes(3 * 86400000), 1440);
});

test('favouriteVersion', () => {
  assert.equal(P.favouriteVersion({ '1.8.9': { min: 30, runs: 5 }, '1.21.1': { min: 90, runs: 1 } }), '1.21.1');
  assert.equal(P.favouriteVersion({}), null);
  assert.equal(P.favouriteVersion(null), null);
});

test('formatPlaytime', () => {
  assert.equal(P.formatPlaytime(0), '0 min');
  assert.equal(P.formatPlaytime(45), '45 min');
  assert.equal(P.formatPlaytime(185), '3 h 05 min');
});

test('validateIdea', () => {
  assert.equal(P.validateIdea({ category: 'feature', body: 'Dodajcie tryb ciemny do konsoli' }), null);
  assert.equal(P.validateIdea({ category: 'feature', body: '   krótko   ' }), 'idea_short');
  assert.equal(P.validateIdea({ category: 'bug', body: 'x'.repeat(1001) }), 'idea_long');
  assert.equal(P.validateIdea({ category: 'hack', body: 'Dodajcie tryb ciemny do konsoli' }), 'idea_category');
  assert.equal(P.validateIdea({}), 'idea_category');
  assert.deepEqual(P.IDEA_CATEGORIES, ['feature', 'cosmetic', 'bug', 'other']);
});

test('backupDecision', () => {
  assert.equal(P.backupDecision({ hasRemote: true, reviewed: false }), 'hold');
  assert.equal(P.backupDecision({ hasRemote: true, reviewed: true }), 'push');
  assert.equal(P.backupDecision({ hasRemote: false, reviewed: false }), 'push');
  assert.equal(P.backupDecision({ hasRemote: false, reviewed: true }), 'push');
});

test('friendsStarted: powiadomienie tylko, gdy znajomy właśnie wszedł do gry (nie przy pierwszym sprawdzeniu)', () => {
  const l1 = [{ id: 'a', nick: 'Ala', state: 'friend', status: 'launcher' }, { id: 'b', nick: 'Bob', state: 'friend', status: 'game', server: 'x.pl' },
    { id: 'c', nick: 'Cyryl', state: 'incoming', status: null }];
  const r1 = P.friendsStarted(null, l1);
  assert.deepStrictEqual(r1.started, [], 'pierwszy raz: bez powiadomień o tych, co już grają');
  const l2 = [{ id: 'a', nick: 'Ala', state: 'friend', status: 'game', version: '1.21.11', server: 'play.mib.pl' }, { id: 'b', nick: 'Bob', state: 'friend', status: 'game' },
    { id: 'd', nick: 'Darek', state: 'friend', status: 'game' }];
  const r2 = P.friendsStarted(r1.map, l2);
  assert.deepStrictEqual(r2.started.map(f => f.nick), ['Ala', 'Darek'], 'Bob już grał; Darek to nowy znajomy w grze');
  assert.deepStrictEqual(P.friendsStarted(r2.map, l2).started, [], 'bez powtórek');
});

test('newInvites: każde zaproszenie raz, ponowne zaproszenie (nowy czas) znowu', () => {
  const i1 = [{ from_id: 'a', nick: 'Ala', server: 'play.mib.pl', version: '1.21.11', created_at: 't1' }];
  const r1 = P.newInvites(new Set(), i1);
  assert.deepStrictEqual(r1.fresh.map(i => i.nick), ['Ala']);
  assert.deepStrictEqual(P.newInvites(r1.seen, i1).fresh, []);
  assert.deepStrictEqual(P.newInvites(r1.seen, [{ ...i1[0], created_at: 't2' }]).fresh.length, 1);
});

test('friendNotice: krótkie teksty powiadomień po polsku i po angielsku', () => {
  assert.deepEqual(P.friendNotice({ type: 'started', nick: 'Ala', version: '1.21.11', server: 'play.mib.pl' }), { title: 'Znajomy w grze', body: 'Ala gra teraz w Minecraft 1.21.11 na play.mib.pl.' });
  assert.equal(P.friendNotice({ type: 'started', nick: 'Bob' }).body, 'Bob gra teraz w Minecraft.');
  assert.deepEqual(P.friendNotice({ type: 'holiday', kind: 'gift', name: 'Boże Narodzenie' }), { title: 'Nagroda świąteczna', body: 'Boże Narodzenie: odbierz nagrodę na stronie głównej launchera.' });
  assert.deepEqual(P.friendNotice({ type: 'holiday', kind: 'advent', day: 5 }), { title: 'Kalendarz adwentowy', body: 'Nowe okienko (5 grudnia) czeka na stronie głównej launchera.' });
  assert.equal(P.friendNotice({ type: 'holiday', kind: 'advent', day: 5 }, 'en').title, 'Advent calendar');
  assert.deepEqual(P.friendNotice({ type: 'invite', nick: 'Ala', version: '1.21.11', server: 'play.mib.pl' }), { title: 'Zaproszenie do gry', body: 'Ala zaprasza Cię do gry na play.mib.pl (Minecraft 1.21.11).' });
  assert.equal(P.friendNotice({ type: 'started', nick: 'Ala', version: '1.21.11', server: 'play.mib.pl' }, 'en').body, 'Ala is now playing Minecraft 1.21.11 on play.mib.pl.');
  assert.equal(P.friendNotice({ type: 'invite', nick: 'Ala', version: '26.1', server: 'mc.x.pl' }, 'en').title, 'Game invite');
});

test('newMessages: powiadomienie tylko o nowych wiadomościach, pierwsze sprawdzenie bez powiadomień', () => {
  const a = { from_id: 'a', nick: 'Ala', unread: 1, last_id: 10, last_body: 'hej' };
  let r = P.newMessages(null, [a]);
  assert.deepEqual(r.fresh, [], 'to, co czekało przed startem, pokazuje licznik');
  r = P.newMessages(r.seen, [a]);
  assert.deepEqual(r.fresh, [], 'ta sama wiadomość drugi raz bez powiadomienia');
  r = P.newMessages(r.seen, [{ ...a, unread: 2, last_id: 12, last_body: 'jesteś?' }]);
  assert.equal(r.fresh.length, 1);
  r = P.newMessages(r.seen, []);
  r = P.newMessages(r.seen, [{ from_id: 'b', nick: 'Bob', unread: 1, last_id: 13, last_body: 'siema' }]);
  assert.deepEqual(r.fresh.map(x => x.nick), ['Bob'], 'po przeczytaniu nowa wiadomość od kogoś innego');
  const n = P.friendNotice({ type: 'message', nick: 'Ala', text: 'x'.repeat(200) });
  assert.equal(n.title, 'Wiadomość od Ala');
  assert.equal(n.body.length, 140);
  assert.equal(P.friendNotice({ type: 'message', nick: 'Ala', text: 'hi' }, 'en').title, 'Message from Ala');
});

test('freshKeys i powiadomienia o prezencie i odpowiedzi na pomysł', () => {
  const k = g => String(g.id);
  let r = P.freshKeys(null, [{ id: 1 }], k);
  assert.deepEqual(r.fresh, [], 'pierwsze sprawdzenie bez powiadomień');
  r = P.freshKeys(r.seen, [{ id: 1 }, { id: 2 }], k);
  assert.deepEqual(r.fresh.map(x => x.id), [2]);
  r = P.freshKeys(r.seen, [{ id: 2 }], k);
  assert.deepEqual(r.fresh, []);
  assert.deepEqual(P.friendNotice({ type: 'gift', text: 'Peleryna Złota' }), { title: 'Prezent od MiB', body: 'Peleryna Złota czeka na Ciebie. Odbierz w launcherze.' });
  assert.equal(P.friendNotice({ type: 'gift', nick: 'Kumpel', text: 'Dusze' }, 'en').title, 'A gift from Kumpel', 'prezent od znajomego');
  assert.equal(P.friendNotice({ type: 'idea', status: 'planned', text: 'Dodamy wkrótce.' }).body, 'Status: W planach — Dodamy wkrótce.');
  assert.equal(P.friendNotice({ type: 'idea', status: 'done' }, 'en').body, 'Status: Done');
  assert.deepEqual(P.friendNotice({ type: 'news', text: 'Turniej za godzinę' }), { title: 'Ważna aktualność', body: 'Turniej za godzinę' });
});

test('achievements: odznaki z liczb profilu', () => {
  const a = P.achievements({ launches: 3, playtime_min: 700, friends: 5, founder: true, owned: 2 });
  const done = a.filter(x => x.done).map(x => x.id);
  assert.deepEqual(done, ['first_game', 'hours_10', 'friend', 'squad', 'founder']);
  const reg = a.find(x => x.id === 'regular');
  assert.deepEqual([reg.value, reg.goal, reg.done], [3, 100, false]);
  assert.equal(a.find(x => x.id === 'veteran').value, 700);
  assert.equal(a.find(x => x.id === 'hours_10').value, 600, 'postęp nie przekracza celu');
  assert.equal(P.achievements(null).filter(x => x.done).length, 0, 'bez danych nic nie jest zdobyte');
});

test('releaseNotes: sekcje i punkty z notatek wydania', () => {
  const md = '<!-- 0.20.0 -->\n## Dodane\n\n- Blokowanie graczy.\n- Osiągnięcia.\n## Zmienione\n- Kody z datą końca.\n## Usunięte\n';
  assert.deepEqual(P.releaseNotes(md), [{ title: 'Dodane', items: ['Blokowanie graczy.', 'Osiągnięcia.'] }, { title: 'Zmienione', items: ['Kody z datą końca.'] }]);
  assert.deepEqual(P.releaseNotes(''), []);
});

test('cleanText: przekleństwa na gwiazdki, zwykłe słowa bez zmian', () => {
  assert.equal(P.cleanText('Ty kurwo jebana!'), 'Ty k**** j*****!');
  assert.equal(P.cleanText('KURW4 i kuuurwa, co za $hit.'), 'K**** i k******, co za $***.');
  assert.equal(P.cleanText('what the fuck? a$$hole'), 'what the f***? a******');
  assert.equal(P.cleanText('Spierdalaj, chujowy serwer, pojeb'), 'S*********, c****** serwer, p****');
  assert.equal(P.cleanText('k.u.r.w.a cipa huj'), 'k******** c*** h**');
  assert.equal(P.cleanText('Principle cipher Nigeria fagot as klasa Scunthorpe hujnia'), 'Principle cipher Nigeria fagot as klasa Scunthorpe h*****');
  assert.equal(P.cleanText('Gramy w bedwars? Jest 5 graczy :)'), 'Gramy w bedwars? Jest 5 graczy :)');
  assert.equal(P.cleanText('„kurwa”'), '„k****”');
  assert.equal(P.cleanText(null), '');
});

test('wingsModel: tekstura szeroka na 128+ to skrzydła wróżki, węższa to elytra', () => {
  assert.equal(P.wingsModel(64), 'elytra');
  assert.equal(P.wingsModel(128), 'fairy');
  assert.equal(P.wingsModel(256), 'fairy');
});

test('hatModel: czapka z teksturą szeroką na 128+ jest wysoka (druga kostka), węższa jak hełm', () => {
  assert.equal(P.hatModel(64), 'helmet');
  assert.equal(P.hatModel(128), 'tall');
});

test('auraStyle: ruch z końcówki id', () => {
  assert.equal(P.auraStyle('halloween_aura_souls'), 'souls');
  assert.equal(P.auraStyle('zimowa_aura_magic'), 'magic');
  assert.equal(P.auraStyle('aura_magic_x'), null);
  assert.equal(P.auraStyle(null), null);
});

test('auraParticles: te same liczby co w modzie (Auras.java), w zasięgu postaci, bez skoków', () => {
  // wspólne wartości z AurasTest.java
  assert.deepEqual([P.h32(0), P.h32(1), P.h32(123456789), P.h32(-5)], [0, 824515495, 1952335732, 3253613923]);
  const s = P.auraParticles('souls', 12.345, 777)[0];
  assert.ok(Math.abs(s.x - 7.760290074110731) < 1e-9 && Math.abs(s.y - 3.370260721633739) < 1e-9 && Math.abs(s.z + 4.649836497573228) < 1e-9);
  // snow i burst (od 0.25.0): te same liczby w AurasTest.java
  const sn = P.auraParticles('snow', 12.345, 777)[0], bu = P.auraParticles('burst', 12.345, 777)[0];
  assert.ok(Math.abs(sn.x + 7.217017681779219) < 1e-9 && Math.abs(sn.y - 37.3144990696101) < 1e-9 && Math.abs(sn.z + 10.068235890165253) < 1e-9 && Math.abs(sn.alpha - 0.17273166450379662) < 1e-9);
  assert.ok(Math.abs(bu.x - 3.7694770974434135) < 1e-9 && Math.abs(bu.y - 25.982781449966975) < 1e-9 && Math.abs(bu.z + 4.457260652910918) < 1e-9 && bu.alpha === 1);
  assert.equal(P.auraParticles('nie_ma', 1, 1).length, 0);
  for (const style of P.AURA_STYLES) {
    const n = { souls: 22, pumpkins: 24, ghosts: 3, magic: 60, snow: 26, burst: 36 }[style];
    for (let t = 0; t < 30; t += 0.37) {
      const a = P.auraParticles(style, t, 42), b = P.auraParticles(style, t + 0.01, 42);
      assert.equal(a.length, n);
      for (let i = 0; i < n; i++) {
        const p = a[i];
        assert.ok(Math.hypot(p.x, p.z) <= 17 && p.y >= 0 && p.y <= 40, `${style} poza postacią: ${JSON.stringify(p)}`);
        assert.ok(p.alpha >= 0 && p.alpha <= 1 && [0, 1, 2].includes(p.cell));
        // przez 10 ms cząsteczka przesuwa się o mniej niż piksel, chyba że właśnie zaczęła nowe życie
        const q = b[i], moved = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
        assert.ok(moved < 1 || p.alpha < 0.1 || q.y < p.y, `${style} skok o ${moved}`);
      }
    }
  }
});

test('season: motyw Halloween od 15 października do 5 listopada włącznie, poza tym zwykły', () => {
  const at = (m, d) => P.season(new Date(2026, m - 1, d, 12));
  assert.equal(at(10, 14), '');
  assert.equal(at(10, 15), 'halloween');
  assert.equal(at(10, 31), 'halloween');
  assert.equal(at(11, 5), 'halloween');
  assert.equal(at(11, 6), '');
  assert.equal(at(1, 1), '');
  assert.equal(P.season(new Date(2026, 9, 15, 0, 0)), 'halloween', 'od północy');
  assert.equal(P.season(new Date(2026, 10, 5, 23, 59)), 'halloween', 'do końca 5 listopada');
});

// Instalator (electron-builder, build.files w package.json) musi mieć każdy plik, który ładują strony i procesy launchera:
// brak themes.js w 0.25.0 zatrzymał ui.js w połowie (nie działały konta ani logowanie)
test('instalator zawiera wszystkie pliki ładowane przez launcher', () => {
  const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
  const files = require('../package.json').build.files;
  const re = files.map(g => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$'));
  const packed = f => re.some(r => r.test(f));
  const need = new Set();
  for (const page of ['index.html', 'overlay.html']) {
    need.add(page);
    for (const m of fs.readFileSync(path.join(root, page), 'utf8').matchAll(/(?:src|href)="([^"#?]+)"/g)) if (!/^(https?:|data:|file:|\/)/.test(m[1])) need.add(m[1]);
  }
  for (const js of ['main.js', 'profile-main.js', 'preload.js', 'worker.js']) {
    need.add(js);
    for (const m of fs.readFileSync(path.join(root, js), 'utf8').matchAll(/require\('\.\/([^']+)'\)/g)) need.add(m[1].endsWith('.js') ? m[1] : m[1] + '.js');
  }
  const missing = [...need].filter(f => fs.existsSync(path.join(root, f)) && !packed(f));
  assert.deepEqual(missing, [], 'pliki spoza instalatora');
  assert.ok(need.has('themes.js') && packed('themes.js'));
});

test('mcProfileAction: profil MiB idzie za kontem Microsoft', () => {
  const A = '44444444-4444-4444-4444-444444444444', B = '55555555555555555555555555555555';
  assert.equal(P.mcProfileAction({ loggedIn: false }, A), 'login', 'bez profilu: zaloguj albo załóż');
  assert.equal(P.mcProfileAction({ loggedIn: true, mcUuid: A }, '44444444444444444444444444444444'), 'none', 'ten sam Minecraft (z kreskami i bez)');
  assert.equal(P.mcProfileAction({ loggedIn: true, mcUuid: A }, B), 'login', 'inne konto: przełącz profil');
  assert.equal(P.mcProfileAction({ loggedIn: true, mcUuid: null }, A), 'link', 'profil e-mail bez Minecrafta: połącz');
  assert.equal(P.mcProfileAction({ offline: true }, A), 'none', 'bez sieci nic');
  assert.equal(P.mcProfileAction({ needsProfile: true }, A), 'none', 'konto bez profilu: gracz wybiera nick');
  assert.equal(P.mcProfileAction(null, A), 'none');
});

// ===== Model 3D kosmetyku w PNG (od 0.33.0); te same przypadki w CosmeticModelTest.java =====
function pngWith(w, h, text, key = 'mib-model') {
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), ...(text == null ? [] : [chunk('tEXt', Buffer.from(key + '\0' + text, 'latin1'))]), chunk('IEND', Buffer.alloc(0))]);
}
const MODEL_GOOD = '{"parts":[{"boxes":[[0,0,-4,-9,-4,8,1,8]]},{"bone":"body","pivot":[2,4,0],"rot":[0,0,-16],"spin":90,"boxes":[[0,9,-1,0,-3,2,4,1,-0.1]]}]}';
const MODEL_BAD = ['{"parts":[]}', '{"parts":[{"boxes":[]}]}', '{"parts":[{"bone":"arm","boxes":[[0,0,0,0,0,1,1,1]]}]}', '{"parts":[{"boxes":[[0,0,0,0,0,1,1]]}]}',
  '{"parts":[{"boxes":[[0.5,0,0,0,0,1,1,1]]}]}', '{"parts":[{"boxes":[[40,0,0,0,0,8,1,8]]}]}', '{"parts":[{"boxes":[[0,30,0,0,0,1,2,1]]}]}', '{"parts":[{"boxes":[[0,0,65,0,0,1,1,1]]}]}',
  '{"parts":[{"pivot":null,"boxes":[[0,0,0,0,0,1,1,1]]}]}', '{"parts":[{"rot":[0,0],"boxes":[[0,0,0,0,0,1,1,1]]}]}', '{"parts":[{"spin":"x","boxes":[[0,0,0,0,0,1,1,1]]}]}',
  '{"parts":[{"boxes":[[0,0,0,0,0,1,1,1,9]]}]}', '{"parts":[{"boxes":[[0,0,0,0,0,-1,1,1]]}]}', 'nie json',
  // ruch części (0.34.0)
  '{"parts":[{"wave":[1,2,3,1],"boxes":[[0,0,0,0,0,1,1,1]]}]}', '{"parts":[{"wave":[1,2,3,0,0],"boxes":[[0,0,0,0,0,1,1,1]]}]}',
  '{"parts":[{"wave":[1,2,3,1,2],"boxes":[[0,0,0,0,0,1,1,1]]}]}', '{"parts":[{"step":91,"boxes":[[0,0,0,0,0,1,1,1]]}]}',
  '{"parts":[{"sit":[0,0,0],"boxes":[[0,0,0,0,0,1,1,1]]}]}', '{"parts":[{"state":"x","boxes":[[0,0,0,0,0,1,1,1]]}]}',
  '{"parts":[{"state":null,"boxes":[[0,0,0,0,0,1,1,1]]}]}', '{"parts":[{"wave":null,"boxes":[[0,0,0,0,0,1,1,1]]}]}', '{"parts":[{"bone":"pet","step":null,"boxes":[[0,0,0,0,0,1,1,1]]}]}'];
// pet z ruchem: kołysanie, łapka, kucanie, oczy tylko we śnie (te same w CosmeticModelTest.java)
const MODEL_PET = '{"parts":[{"bone":"pet","rot":[5,0,0],"wave":[20,0,10,1,0.1],"step":30,"sit":[0,0,10,2],"boxes":[[0,0,-2,-4,-2,4,4,4]]},{"bone":"pet","state":"sleep","boxes":[[0,8,-1,-3,-2.1,2,1,0]]}]}';

test('cosmeticModel: model z kawałka tEXt „mib-model” w PNG, sprawdzony jak w modzie', () => {
  const m = P.cosmeticModel(pngWith(64, 32, MODEL_GOOD));
  assert.deepEqual(m, { w: 64, h: 32, parts: [
    { bone: 'head', pivot: [0, 0, 0], rot: [0, 0, 0], spin: 0, boxes: [[0, 0, -4, -9, -4, 8, 1, 8, 0]], wave: null, step: 0, sit: null, state: null },
    { bone: 'body', pivot: [2, 4, 0], rot: [0, 0, -16], spin: 90, boxes: [[0, 9, -1, 0, -3, 2, 4, 1, -0.1]], wave: null, step: 0, sit: null, state: null }] });
  // z data URL (tak przychodzi z bazy) to samo
  assert.deepEqual(P.cosmeticModel('data:image/png;base64,' + pngWith(64, 32, MODEL_GOOD).toString('base64')), m);
  // animacja (klatki 64×32 jedna pod drugą): model w układzie jednej klatki
  assert.equal(P.cosmeticModel(pngWith(64, 96, MODEL_GOOD)).h, 32);
  for (const bad of MODEL_BAD) assert.equal(P.cosmeticModel(pngWith(64, 32, bad)), null, bad);
  assert.equal(P.cosmeticModel(pngWith(64, 32, null)), null, 'bez modelu');
  assert.equal(P.cosmeticModel(pngWith(64, 32, MODEL_GOOD, 'Comment')), null, 'inny klucz');
  assert.equal(P.cosmeticModel(pngWith(64, 33, MODEL_GOOD)), null, 'zły rozmiar tekstury');
  assert.equal(P.cosmeticModel(Buffer.from('nie png')), null);
  assert.equal(P.cosmeticModel('data:image/png;base64,@@@'), null);
  // szersza tekstura mieści więcej
  assert.ok(P.cosmeticModel(pngWith(128, 64, '{"parts":[{"boxes":[[40,0,0,0,0,8,1,8]]}]}')));
  const many = JSON.stringify({ parts: Array.from({ length: 33 }, () => ({ boxes: [[0, 0, 0, 0, 0, 1, 1, 1]] })) });
  assert.equal(P.cosmeticModel(pngWith(64, 32, many)), null, 'za dużo części');
});

test('boxUVs: ściany jak w skinview3d (przód: lewy górny, prawy górny, lewy dolny, prawy dolny)', () => {
  const uv = P.boxUVs(0, 0, 8, 8, 8, 64, 64);
  assert.equal(uv.length, 48);
  assert.deepEqual(uv.slice(32, 40), [0.125, 0.875, 0.25, 0.875, 0.125, 0.75, 0.25, 0.75]);
  assert.deepEqual(uv.slice(16, 24), [0.125, 1, 0.25, 1, 0.125, 0.875, 0.25, 0.875]);
});

test('modelFaces: widoczne ściany od najdalszej, z rogami na ekranie i polem tekstury', () => {
  const m = { w: 64, h: 32, parts: [{ bone: 'head', pivot: [0, 0, 0], rot: [0, 0, 0], spin: 0, boxes: [[0, 0, -4, -8, -4, 8, 8, 8, 0]] }] };
  const front = P.modelFaces(m, 0, 0);
  assert.equal(front.length, 1);
  assert.deepEqual(front[0].uv, [8, 8, 8, 8]);
  assert.deepEqual(front[0].p.map(q => q.map(v => Math.round(v * 1000) / 1000)), [[-4, -8], [4, -8], [-4, 0]]);
  const three = P.modelFaces(m, -28, 22);
  assert.deepEqual(three.map(f => f.uv.join(',')).sort(), ['0,8,8,8', '8,0,8,8', '8,8,8,8']);
  for (let i = 1; i < three.length; i++) assert.ok(three[i - 1].depth >= three[i].depth);
  // obrót części: ta sama kostka obrócona o 90° wokół pionu pokazuje bok
  const turned = P.modelFaces({ ...m, parts: [{ ...m.parts[0], rot: [0, 90, 0] }] }, 0, 0);
  assert.equal(turned.length, 1);
  assert.notDeepEqual(turned[0].uv, [8, 8, 8, 8]);
});

test('cosmeticModel: czapki z modelem 3D w schema.sql (0.33.0) są poprawne', () => {
  const sql = require('node:fs').readFileSync(require('node:path').join(__dirname, '../supabase/schema.sql'), 'utf8');
  const ids = ['zima_hat_mikolaj', 'zima_hat_renifer', 'zima_hat_elf', 'adwent_hat_pompon', 'sylwester_hat_cylinder', 'wielkanoc_hat_uszy', 'primaaprilis_hat_blazen', 'dziendziecka_hat_smiglo', 'wakacje_hat_slomkowy', 'niepodleglosc_hat_kotylion'];
  for (const id of ids) {
    const m = sql.match(new RegExp(`\\('${id}', '(?:[^']|'')*', 'hat', (?:null|\\d+), '(data:image/png;base64,[A-Za-z0-9+/=]+)'\\)`));
    assert.ok(m, id);
    const model = P.cosmeticModel(m[1]);
    assert.ok(model, id + ': model');
    assert.ok(P.modelFaces(model, -28, 22).length > 5, id + ': widać ściany');
  }
  const kot = P.cosmeticModel(sql.match(/\('niepodleglosc_hat_kotylion', [^)]*'(data:[^']+)'\)/)[1]);
  assert.ok(kot.parts.every(p => p.bone === 'body'), 'kotylion na piersi');
  const smiglo = P.cosmeticModel(sql.match(/\('dziendziecka_hat_smiglo', [^)]*'(data:[^']+)'\)/)[1]);
  assert.ok(smiglo.parts.some(p => p.spin), 'śmigło się kręci');
});

test('partPose i petAnchor: ruch części i miejsce peta (te same liczby w CosmeticModelTest.java)', () => {
  const m = P.cosmeticModel(pngWith(64, 32, MODEL_PET)), a = m.parts[0], e = m.parts[1];
  assert.deepEqual([a.bone, a.wave, a.step, a.sit, e.state], ['pet', [20, 0, 10, 1, 0.1], 30, [0, 0, 10, 2], 'sleep']);
  const near = (x, y) => Math.abs(x - y) < 1e-9;
  const pose = c => P.partPose(a, c);
  let r = pose({ t: 0.37 });
  assert.ok(near(r.rot[0], 8.7476262917145) && near(r.rot[2], 1.8738131458572502) && r.dy === 0 && r.visible);
  r = pose({ t: 0.37, run: true });
  assert.ok(near(r.rot[0], -22.858628475476404) && near(r.rot[2], -13.929314237738202), 'bieg: szybciej i mocniej');
  r = pose({ t: 0.37, sleep: true });
  assert.ok(near(r.rot[0], 6.12428788751435) && near(r.rot[2], 0.562143943757175), 'sen: słabiej');
  r = pose({ t: 0.37, walk: 1, phase: 1.1 });
  assert.ok(near(r.rot[0], 35.48384709355756), 'łapka przy chodzie');
  r = pose({ t: 0.37, crouch: true });
  assert.ok(near(r.rot[2], 11.87381314585725) && r.dy === 2, 'kucanie');
  assert.equal(P.partPose(e, { t: 1 }).visible, false, 'oczy zamknięte tylko we śnie');
  assert.equal(P.partPose(e, { t: 1, sleep: true }).visible, true);
  assert.deepEqual(P.partPose({ rot: [0, 10, 0], spin: 90, wave: null, step: 0, sit: null, state: null }, { t: 5 }).rot, [0, 100, 0], 'kręcenie');
  const fly = P.petAnchor('fly', 'right', 0.37, false);
  assert.ok(fly.bone === 'root' && fly.pos[0] === -11 && near(fly.pos[1], -1.8986944491792226) && fly.pos[2] === 1 && fly.scale === 0.8);
  assert.deepEqual(P.petAnchor('fly', 'left', 0.37, true), { bone: 'root', pos: [11, -2, 1], scale: 0.8 }, 'śpi: bez bujania, niżej');
  assert.deepEqual(P.petAnchor('shoulder', 'right', 0, false), { bone: 'body', pos: [-6, 0, 0], scale: 0.6 });
  assert.deepEqual(P.petAnchor('walk', 'left', 0, false), { bone: 'root', pos: [14, 24, 3], scale: 1 });
  assert.deepEqual(P.petAnchor('nie_ma', 'x', 0, true).pos, [11, -2, 1], 'nieznany tryb = lata po lewej');
});

test('cosmeticModel: wszystkie pety, ogony i plecaki w schema.sql (0.34.0) mają poprawny model', () => {
  const sql = require('node:fs').readFileSync(require('node:path').join(__dirname, '../supabase/schema.sql'), 'utf8');
  const rows = [...sql.matchAll(/\('([a-z0-9_]+)', '(?:[^']|'')*', '(pet|tail|back)', (?:null|\d+), '(data:image\/png;base64,[A-Za-z0-9+/=]+)'\)/g)];
  assert.equal(rows.length, 114);
  for (const [, id, type, png] of rows) {
    const m = P.cosmeticModel(png);
    assert.ok(m, id);
    assert.ok(id.length <= 32, id + ': id do 32 znaków');
    if (type === 'pet') assert.ok(m.parts.every(p => p.bone === 'pet'), id + ': pet ma kość pet');
    else assert.ok(m.parts.every(p => p.bone === 'body'), id + ': ogon i plecak na tułowiu');
    assert.ok(P.modelFaces(m, type === 'pet' ? -28 : 152, 22).length > 0, id + ': miniatura');
  }
});

test('browseCatalog: shop without login shows priced items, holiday collections only during the holiday (0.35.0)', () => {
  const themes = [
    { id: 'boze', starts: '12-20', ends: '12-26', enabled: true, forced: false, items: ['zima_pet', 'zima_hat'] },
    { id: 'wielkanoc', starts: 'E-3', ends: 'E+1', enabled: false, forced: false, items: ['zajac'] },
    { id: 'halloween', starts: '10-15', ends: '11-05', enabled: true, forced: true, items: ['dynia'] },
  ];
  const list = [
    { id: 'pet_kotek', price: 1500 }, { id: 'cape_start', price: null }, { id: 'zima_pet', price: 1500 }, { id: 'zima_hat', price: null },
    { id: 'zajac', price: 500 }, { id: 'dynia', price: 300 },
  ];
  const ids = d => P.browseCatalog(list, themes, d).map(c => c.id);
  assert.deepEqual(ids(new Date(2026, 6, 1)), ['pet_kotek', 'dynia'], 'latem: całoroczne i włączone na siłę');
  assert.deepEqual(ids(new Date(2026, 11, 22)), ['pet_kotek', 'zima_pet', 'dynia'], 'w święta: kolekcja świąteczna z ceną');
  assert.deepEqual(P.browseCatalog(list, null, new Date(2026, 6, 1)).map(c => c.id), ['pet_kotek', 'zima_pet', 'zajac', 'dynia'], 'stara baza bez motywów');
  assert.deepEqual(P.browseCatalog(null, themes), []);
});

test('launcher style (0.36.0): presets, own colors, palette, game colors and share code', () => {
  assert.equal(P.styleOf(null), null);
  assert.equal(P.styleOf({ p: 'mib' }), null, 'MiB = zwykły wygląd');
  assert.deepEqual(P.styleOf({ p: 'ocean', a: '#000000' }), { p: 'ocean', ...P.STYLES.ocean }, 'gotowa paleta ma swoje kolory');
  assert.deepEqual(P.styleOf({ p: 'custom', a: '#FF0000', b: '#000000', c: '#111111', x: '#ffffff' }), { p: 'custom', a: '#ff0000', b: '#000000', c: '#111111', x: '#ffffff' });
  assert.equal(P.styleOf({ p: 'custom', a: 'red', b: '#000000', c: '#111111', x: '#ffffff' }), null, 'tylko kolory #rrggbb');
  assert.equal(P.styleOf({ p: 'hack' }), null);
  assert.equal(P.stylePalette(P.styleOf({ p: 'snieg' })).light, true, 'Śnieg jest jasny');
  assert.equal(P.stylePalette(P.styleOf({ p: 'neon' })).light, false);
  const css = P.styleCss(P.styleOf({ p: 'snieg' }));
  assert.match(css, /^:root\[data-style\]\[data-mode\]:not\(\.t-halloween\):not\(\.themed\)\{color-scheme:light;--style-img:[^;]+;--void:#eef3fa;--slab:#ffffff;/, 'ustępuje motywom świątecznym');
  // te same liczby w ThemeTest w modzie
  assert.equal(P.styleGame(P.styleOf({ p: 'ocean' })), '020814,0a1628,162132,212b3d,315069,38bdf8,a5e1fc,2681a9,e6e9f8,868b98,60caf9,1f6888,31a6da');
  assert.equal(P.styleGame(null), '');
  assert.equal(P.styleCode(P.styleOf({ p: 'ocean' })), 'MIBT-38bdf8-020814-0a1628-7dd3fc');
  assert.deepEqual(P.parseStyleCode(' mibt-38BDF8-020814-0a1628-7dd3fc '), { p: 'ocean', ...P.STYLES.ocean }, 'kod gotowej palety to ta paleta');
  assert.deepEqual(P.parseStyleCode('MIBT-ff0000-000000-111111-ffffff'), { p: 'custom', a: '#ff0000', b: '#000000', c: '#111111', x: '#ffffff' });
  for (const bad of ['', 'MIBT-ff0000-000000-111111', 'MIBT-gg0000-000000-111111-ffffff', 'x MIBT-ff0000-000000-111111-ffffff']) assert.equal(P.parseStyleCode(bad), null, bad);
  // Własny z dodatkami (od 0.47.0): tekst, paski, drugi akcent, drugie tło, kształt, ruch i szybkość cząsteczek
  const ext = P.styleOf({ p: 'custom', a: '#ff0000', b: '#000000', c: '#111111', x: '#ffffff', t: '#EEEE00', s: '#222222', g: '#00ff00', d: '#0000ff', k: 'heart', v: 'down', q: 'fast' });
  assert.deepEqual(ext, { p: 'custom', a: '#ff0000', b: '#000000', c: '#111111', x: '#ffffff', t: '#eeee00', s: '#222222', g: '#00ff00', d: '#0000ff', k: 'heart', v: 'down', q: 'fast' });
  assert.deepEqual(P.styleOf({ p: 'custom', a: '#ff0000', b: '#000000', c: '#111111', x: '#ffffff', t: 'zly', k: 'pix', v: 'bok', q: 'normal' }), { p: 'custom', a: '#ff0000', b: '#000000', c: '#111111', x: '#ffffff' }, 'złe i domyślne dodatki pomijane');
  assert.equal(P.stylePalette(ext).t, '#eeee00', 'własny kolor tekstu');
  const ecss = P.styleCss(ext);
  assert.match(ecss, /#side,[^{]+#top\{background:#222222/);
  assert.match(ecss, /#app\{background:linear-gradient\(160deg,#000000,#0000ff\)/);
  assert.match(ecss, /\.go:not\(\.loading\),[^{]+\.b:not\(\.ghost\):not\(:disabled\)\{background:linear-gradient\(135deg,/);
  assert.doesNotMatch(P.styleCss(P.styleOf({ p: 'ocean' })), /#side|#app|\.go/, 'gotowe palety bez dodatków');
  assert.deepEqual(P.styleFx(ext), { colors: ['#ffffff', '#ffffff', '#ff0000', '#00ff00'], shape: 'heart', dir: 1, speed: 2 });
  assert.deepEqual(P.styleFx(P.styleOf({ p: 'ocean' })), { colors: ['#7dd3fc', '#7dd3fc', '#38bdf8'], shape: 'pix', dir: -1, speed: 1 });
  assert.equal(P.styleFx(null), null);
  const code = P.styleCode(ext);
  assert.equal(code, 'MIBT-ff0000-000000-111111-ffffff-Teeee00-S222222-G00ff00-D0000ff-Kheart-Vdown-Qfast');
  assert.deepEqual(P.parseStyleCode(code), ext, 'kod z dodatkami wraca do tego samego motywu');
  assert.deepEqual(P.parseStyleCode('MIBT-38bdf8-020814-0a1628-7dd3fc-Kstar'), { p: 'custom', ...P.STYLES.ocean, k: 'star' }, 'paleta z dodatkiem to Własny');
  assert.equal(P.styleCode(P.styleOf({ p: 'custom', a: '#ff0000', b: '#000000', c: '#111111', x: '#ffffff' })), 'MIBT-ff0000-000000-111111-ffffff', 'bez dodatków stary krótki kod');
  for (const bad of ['MIBT-ff0000-000000-111111-ffffff-Kkwadrat', 'MIBT-ff0000-000000-111111-ffffff-Tzzzzzz', 'MIBT-ff0000-000000-111111-ffffff-Xabc', 'MIBT-ff0000-000000-111111-ffffff-Vbok']) assert.equal(P.parseStyleCode(bad), null, bad);
  for (const k of P.STYLE_OPTS.k) assert.equal(P.parseStyleCode('MIBT-ff0000-000000-111111-ffffff-K' + k).k, k === 'pix' ? undefined : k, k);
  assert.deepEqual(P.sanitizeSynced({ style: { p: 'mib' } }), { style: { p: 'mib' } }, 'powrót do MiB idzie na inne komputery');
  assert.deepEqual(P.sanitizeSynced({ style: { p: 'custom', a: 'zly' } }), {}, 'zły motyw z profilu odrzucony');
  assert.ok(P.SYNCED_KEYS.includes('style'));
});

test('party: lider gra na serwerze, wpis w menu gry, czat w grze, powiadomienia', () => {
  const st = { id: 7, leader: 'L', me: 'M', members: [
    { id: 'L', nick: 'Lider', status: 'game', server: 'play.mib.pl', version: '1.21.11' },
    { id: 'M', nick: 'Ja', status: 'launcher', server: null, version: null },
    { id: 'K', nick: 'Kolega', status: 'offline' }] };
  assert.deepEqual(P.partyPlay(st), { key: 'L|play.mib.pl|1.21.11', nick: 'Lider', server: 'play.mib.pl', version: '1.21.11' });
  assert.equal(P.partyPlay({ ...st, me: 'L' }), null, 'lider nie dostaje powiadomienia o sobie');
  assert.equal(P.partyPlay({ ...st, members: [st.members[0], { ...st.members[1], status: 'game', server: 'play.mib.pl', version: '1.21.11' }] }), null, 'już jestem na tym serwerze');
  assert.notEqual(P.partyPlay({ ...st, members: [st.members[0], { ...st.members[1], status: 'game', server: 'inny.pl', version: '1.21.11' }] }), null, 'inny serwer: Dołącz');
  assert.equal(P.partyPlay({ ...st, members: [{ ...st.members[0], server: null }, st.members[1]] }), null, 'lider bez serwera (świat jednoosobowy)');
  assert.equal(P.partyPlay(null), null);
  assert.deepEqual(P.partyEntry(st, 2), { id: 'party', nick: 'Party (3/8)', status: 'game', server: 'play.mib.pl', unread: 2, party: true, members: '★Lider · Ja · Kolega' });
  assert.equal(P.partyEntry(null), null);
  assert.equal(P.partyEntry({ ...st, members: [] }), null);
  assert.deepEqual(P.partyChatRows([{ id: 1, nick: 'Lider', mine: false, body: 'kurwa gramy' }, { id: 2, nick: 'Ja', mine: true, body: 'ok' }], P.cleanText),
    [{ id: 1, mine: false, read: true, body: 'Lider: ' + P.cleanText('kurwa gramy') }, { id: 2, mine: true, read: true, body: 'ok' }]);
  assert.notEqual(P.cleanText('kurwa gramy'), 'kurwa gramy');
  assert.deepEqual(P.friendNotice({ type: 'party_play', nick: 'Lider', server: 'play.mib.pl', version: '1.21.11' }, 'pl'),
    { title: 'Party gra', body: 'Lider Lider gra na play.mib.pl (Minecraft 1.21.11) — Dołącz' });
  assert.match(P.friendNotice({ type: 'party_invite', nick: 'Kolega' }, 'en').body, /Kolega invites you to a party/);
  assert.equal(P.friendNotice({ type: 'party_msg', nick: 'Kolega', text: 'x'.repeat(200) }, 'pl').body.length, 140);
  assert.equal(P.PARTY_MAX, 8);
});

// ===== Własny wygląd w czasie święta (0.47.0): wybór gracza ukrywa to święto do jego końca =====
test('themeSkipFor i themeShown: święto ukryte do swojego końca, następne święto już normalnie', () => {
  const P = require('../lib/profile');
  const d = new Date(2026, 10, 11); // 11 listopada: Święto Niepodległości (11-08 … 11-12)
  assert.equal(P.themeNow(null, d), 'niepodleglosc');
  const skip = P.themeSkipFor(null, 'niepodleglosc', d);
  assert.deepEqual(skip, { id: 'niepodleglosc', until: '2026-11-12' });
  assert.equal(P.themeShown(null, skip, d), '', 'ukryte dziś');
  assert.equal(P.themeShown(null, skip, new Date(2026, 10, 12)), '', 'do ostatniego dnia święta');
  assert.equal(P.themeShown(null, skip, new Date(2027, 10, 9)), 'niepodleglosc', 'za rok znowu');
  assert.equal(P.themeShown(null, skip, new Date(2026, 11, 3)), 'boze', 'inne święto normalnie');
  assert.equal(P.themeShown(null, null, d), 'niepodleglosc');
  assert.equal(P.themeShown(null, { id: 'x', until: 'zle' }, d), 'niepodleglosc', 'zepsuty zapis nic nie ukrywa');
  // Boże Narodzenie przez Nowy Rok: ukryte do 6 stycznia
  assert.deepEqual(P.themeSkipFor(null, 'boze', new Date(2026, 11, 20)), { id: 'boze', until: '2027-01-06' });
  // wymuszony z panelu admina (bez końca): 30 dni
  const forced = P.DEFAULT_THEMES.map(t => ({ ...t, forced: t.id === 'wakacje' }));
  assert.deepEqual(P.themeSkipFor(forced, 'wakacje', d), { id: 'wakacje', until: '2026-12-11' });
  assert.equal(P.themeSkipFor(null, 'nieznany', d), null);
});

// ===== Więcej opcji wyglądu (0.47.0): nowe palety, zaokrąglenie, czcionka, ilość cząsteczek, przyciemnienie i rozmycie tła =====
test('lookOf, nowe palety i synchronizacja wyglądu', () => {
  const P = require('../lib/profile');
  assert.deepEqual(P.STYLE_IDS, ['mib', 'ocean', 'las', 'lawa', 'snieg', 'neon', 'zachod', 'mieta', 'wisnia', 'zloto', 'grafit', 'lawenda', 'custom']);
  for (const id of Object.keys(P.STYLES)) { assert.match(P.styleGame(P.styleOf({ p: id })), /^([0-9a-f]{6},){12}[0-9a-f]{6}$/); }
  assert.equal(P.stylePalette(P.styleOf({ p: 'lawenda' })).light, true, 'Lawenda jest jasna');
  assert.deepEqual(P.lookOf(null), P.LOOK_DEFAULT);
  assert.deepEqual(P.LOOK_DEFAULT, { r: 'soft', f: 'geist', n: 'normal', dim: 55, blur: 0 });
  assert.deepEqual(P.lookOf({ r: 'square', f: 'pixel', n: 'high', dim: 120, blur: -3, x: 1 }), { r: 'square', f: 'pixel', n: 'high', dim: 90, blur: 0 });
  assert.deepEqual(P.lookOf({ r: 'zle', f: 'comic', n: 'max', dim: 'a', blur: 7.6 }), { ...P.LOOK_DEFAULT, blur: 8 });
  assert.ok(P.SYNCED_KEYS.includes('look'));
  assert.deepEqual(P.sanitizeSynced({ look: { r: 'round', f: 'system', n: 'low', dim: 30, blur: 10 } }).look, { r: 'round', f: 'system', n: 'low', dim: 30, blur: 10 });
  assert.equal(P.sanitizeSynced({ look: 'x' }).look, undefined);
  // baner w kolorze akcentu: fiolet MiB bez zmian, Ocean (błękit) w stronę niebieskiego, Grafit szary
  assert.equal(P.styleImg({ a: '#a855f7' }), 'hue-rotate(-4deg) saturate(1.1)');
  assert.match(P.styleImg(P.styleOf({ p: 'ocean' })), /^hue-rotate\(-\d+deg\)/);
  assert.equal(P.styleImg(P.styleOf({ p: 'grafit' })), 'grayscale(1) brightness(1.1)');
  assert.match(P.styleCss(P.styleOf({ p: 'zachod' })), /--style-img:hue-rotate\(/);
});
