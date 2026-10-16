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
