// Pobieranie i uruchamianie gry w osobnym procesie, aby dało się je anulować
const { Client } = require('minecraft-launcher-core');
const pp = process.parentPort, out = m => pp.postMessage(m);
pp.once('message', async ({ data }) => {
  const l = new Client();
  l.on('debug', d => out({ t: 'log', d: String(d) })); l.on('data', d => out({ t: 'log', d: String(d) }));
  l.on('progress', p => out({ t: 'progress', d: p.total ? Math.round(p.task / p.total * 100) : 0 }));
  l.on('close', c => { out({ t: 'close', c }); setTimeout(() => process.exit(0), 200); });
  try {
    const proc = await l.launch(data);
    if (!proc) { out({ t: 'error', d: 'Nie udało się uruchomić gry (sprawdź konsolę).' }); return process.exit(1); }
    out({ t: 'spawned', pid: proc.pid });
  } catch (e) { out({ t: 'error', d: e.message }); process.exit(1); }
});
