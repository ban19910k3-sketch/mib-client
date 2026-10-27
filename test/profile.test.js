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
