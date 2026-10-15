// Test animacji: uruchamia launcher i sprawdza stany po animacjach.
// Uruchom: xvfb-run -a node test/e2e/anim.e2e.js [katalog_na_zrzuty]
const path = require('path'), fs = require('fs'), os = require('os');
const { _electron } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..', '..'), OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'mib-anim-'));
const ok = m => console.log('PASS', m);

(async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mib-home-'));
  const app = await _electron.launch({ executablePath: path.join(ROOT, 'node_modules/electron/dist/electron'), args: ['--no-sandbox', ROOT],
    env: { ...process.env, XDG_CONFIG_HOME: home, MIB_SUPA_URL: 'http://127.0.0.1:9' } });
  const w = await app.firstWindow();
  const errors = [];
  w.on('pageerror', e => errors.push(e.message));
  try {
    // klatki splasha co 100 ms, do obejrzenia
    for (let i = 0; i < 70; i++) {
      if (await w.evaluate(() => document.getElementById('app').classList.contains('on')) && !(await w.$('#flylogo'))) break;
      await w.screenshot({ path: path.join(OUT, 'splash-' + String(i).padStart(2, '0') + '.png') });
      await w.waitForTimeout(100);
    }
    await w.waitForSelector('#app.on');
    await w.waitForTimeout(900);
    assert.equal(await w.$('#flylogo'), null, 'klon logo usunięty');
    assert.equal(await w.evaluate(() => getComputedStyle(document.querySelector('.brand svg')).visibility), 'visible');
    ok('1 logo przeleciało i zostało na miejscu');

    await w.click('#w-go', { timeout: 3000 }).catch(() => {});
    await w.click('.nav[data-p="set"]');
    await w.waitForTimeout(400);
    const ind = await w.evaluate(() => {
      const a = document.querySelector('.nav.act'), m = /translateY\(([-\d.]+)px\)/.exec(document.getElementById('navind').style.transform);
      return { y: m ? +m[1] : null, want: a.offsetTop + (a.offsetHeight - document.getElementById('navind').offsetHeight) / 2 };
    });
    assert.ok(ind.y !== null && Math.abs(ind.y - ind.want) <= 2, JSON.stringify(ind));
    ok('2 znacznik menu przesunięty do aktywnej zakładki');

    await w.click('.nav[data-p="home"]');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('progress', 47));
    await w.waitForTimeout(200);
    assert.equal(await w.evaluate(() => document.getElementById('go').style.getPropertyValue('--fill')), '45%');
    assert.equal(await w.textContent('#ver'), 'Pobieranie 47%');
    await w.screenshot({ path: path.join(OUT, 'play-progress.png') });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('closed', 0));
    await w.waitForTimeout(200);
    assert.equal(await w.evaluate(() => document.getElementById('go').style.getPropertyValue('--fill')), '0%');
    ok('3 postęp pobierania w przycisku GRAJ');

    const painted = () => w.evaluate(() => { const c = document.getElementById('fx'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
    await w.waitForTimeout(800);
    assert.ok(await painted() > 0, 'cząsteczki rysują się w tle');
    await w.evaluate(() => { const f = document.getElementById('s-fx'); f.checked = false; f.dispatchEvent(new Event('change')); });
    await w.waitForTimeout(300);
    assert.equal(await painted(), 0, 'wyłączone ustawieniem');
    await w.evaluate(() => { const f = document.getElementById('s-fx'); f.checked = true; f.dispatchEvent(new Event('change')); });
    await w.waitForTimeout(500);
    assert.ok(await painted() > 0, 'włączone z powrotem');
    ok('7 latające cząsteczki w tle i ich wyłączanie');

    await w.evaluate(() => window.mibUnlock({ name: 'Peleryna Start', type: 'cape' }));
    await w.waitForTimeout(250);
    assert.ok(await w.$('#unlock'));
    await w.screenshot({ path: path.join(OUT, 'unlock.png') });
    await w.waitForTimeout(2600);
    assert.equal(await w.$('#unlock'), null, 'nakładka sama znika');
    ok('6 efekt odblokowania pojawia się i znika');

    await w.evaluate(() => { localStorage.setItem('mibanim', 'off'); location.reload(); });
    await w.waitForSelector('#app.on');
    assert.ok(await w.evaluate(() => document.documentElement.classList.contains('noanim')));
    ok('animacje wyłączone ustawieniem');
    assert.deepEqual(errors, []);
    console.log('ALL ANIM E2E PASSED, klatki w', OUT);
  } catch (e) {
    await w.screenshot({ path: path.join(OUT, 'FAIL.png') }).catch(() => {});
    console.error('FAIL', e.message, errors);
    process.exitCode = 1;
  } finally { await app.close(); }
})();
