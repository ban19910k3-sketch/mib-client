const $=i=>document.getElementById(i), con=$('con');
const log=t=>{con.textContent+=t+'\n';con.scrollTop=1e9};
mib.on('log',log);mib.on('progress',p=>$('prog').style.width=p+'%');
mib.on('closed',c=>{$('cancel').style.display='none';$('go').disabled=false;$('go').firstChild.textContent='GRAJ';log('Gra zamknięta (kod '+c+')');$('prog').style.width='0'});
let S={};
(async()=>{
  S=await mib.call('settings:get');
  const vs=await mib.call('versions').catch(()=>['1.8.9','1.12.2','1.16.5','1.20.1','1.21.1']);
  const pref=['1.8.9',...vs.filter(v=>v!=='1.8.9')];
  $('sel').innerHTML=pref.map(v=>`<option>${v}</option>`).join('');const sv=localStorage.getItem('mibver');if(sv&&pref.includes(sv))$('sel').value=sv;$('ver').textContent='MiB '+$('sel').value;
  const a=await mib.call('restore');if(a)setAcc(a);
  fill();
})();
let logged=false;
function setAcc(a){logged=true;const n=encodeURIComponent(a.name);$('accn').textContent=a.name;$('nick').textContent=a.name;$('plname').textContent=a.name;
loadSkin(a.name);$('topav').src=$('plav').src='https://mc-heads.net/avatar/'+n+'/64'}


$('go').onclick=async()=>{
  const g=$('go'),t=g.firstChild;con.style.display='block';
  if(!logged){log('Najpierw logowanie Microsoft…');try{setAcc(await mib.call('login'))}catch(e){log('Logowanie nieudane: '+e.message);return}}
  g.disabled=true;t.textContent='URUCHAMIANIE…';$('cancel').style.display='inline-block';log('Uruchamianie '+$('sel').value+'…');
  const r=await mib.call('launch',{version:$('sel').value});$('cancel').style.display='none';
  if(r==='ok'){t.textContent='GRA DZIAŁA'}else{log(r);toast(r,1);g.disabled=false;t.textContent='GRAJ'}};
// Ustawienia
const F={ram:'s-ram',java:'s-java',width:'s-w',height:'s-h',root:'s-root',jvm:'s-jvm'};
function fill(){for(const k in F)$(F[k]).value=S[k]??'';$('s-hu').checked=!!S.hideUpdates;$('s-pri').checked=S.priority!==false}
$('s-pick').onclick=async()=>{const d=await mib.call('pickdir');if(d)$('s-root').value=d};
$('s-save').onclick=async()=>{for(const k in F)S[k]=['ram','width','height'].includes(k)?Math.max(1,+$(F[k]).value||1):$(F[k]).value;S.hideUpdates=$('s-hu').checked;S.priority=$('s-pri').checked;await mib.call('settings:set',S);$('s-msg').textContent='Zapisano'};
// Aktualizacje launchera
let pend=null;
mib.on('upd:avail',i=>{pend=i;$('u-st').textContent='Dostępna wersja '+i.version+' — kliknij „Sprawdź aktualizacje", aby zainstalować.';
 if(S.hideUpdates){return}showUpd()});
function showUpd(){if(!pend)return;$('u-v').textContent='Wersja '+pend.current+' → '+pend.version;$('u-n').textContent=pend.notes;$('upd').classList.add('on')}
mib.on('upd:none',t=>{$('u-st').textContent=t;$('u-go').disabled=false});
mib.on('upd:prog',p=>{$('u-pb').style.display='block';$('u-p').style.width=p+'%'});
$('u-later').onclick=async()=>{if($('u-hide').checked){S.hideUpdates=true;await mib.call('settings:set',S);fill()}$('upd').classList.remove('on')};
$('u-go').onclick=()=>{$('u-go').disabled=true;mib.call('upd:install')};
$('u-chk').onclick=async()=>{$('u-st').textContent='Sprawdzanie…';pend=null;await mib.call('upd:check');if(pend)showUpd()};
document.addEventListener('DOMContentLoaded',()=>{});

mib.call('ver').then(v=>{$('u-cur').textContent=v;$('brand-v').textContent=tr('wersja')+' '+v});
// Zastępcza głowa (8×8 pikseli), gdy skin nie wczyta się z sieci
const FACE='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect width="8" height="8" fill="#3a2256"/><rect y="2" width="8" height="6" fill="#6b4a8f"/><rect x="1" y="4" width="2" height="1" fill="#eee6f8"/><rect x="5" y="4" width="2" height="1" fill="#eee6f8"/><rect x="2" y="4" width="1" height="1" fill="#a855f7"/><rect x="5" y="4" width="1" height="1" fill="#a855f7"/><rect x="3" y="6" width="2" height="1" fill="#2a1545"/></svg>');
for(const i of ['topav','plav'])$(i).onerror=function(){this.onerror=null;this.src=FACE};

$('skinimg').onerror=()=>{$('skinimg').style.display='none';$('skin').style.display='flex'};
const cards=()=>{$('c-ver').textContent=$('sel').value;$('c-ram').textContent=((S.ram||2048)/1024).toFixed(1).replace('.0','')+' GB';$('c-res').textContent=(S.width||1280)+'×'+(S.height||720)};
$('sel').addEventListener('change',cards);$('s-save').addEventListener('click',()=>setTimeout(cards,300));setTimeout(cards,1500);

// Obracana postać 3D (przeciągnij myszką); w razie błędu pokazuje zwykły obrazek
let viewer;
async function loadSkin(name){
  try{const d=await mib.call('skin',name);if(!d||!viewer)throw 0;await viewer.loadSkin(d);$('skincv').style.display='block';$('skinimg').style.display='none';$('skin').style.display='none'}
  catch{$('skincv').style.display='none';$('skinimg').src='https://mc-heads.net/body/'+encodeURIComponent(name)+'/280';$('skinimg').style.display='block'}
}
try{viewer=new skinview3d.SkinViewer({canvas:$('skincv'),width:300,height:320});viewer.animation=new skinview3d.IdleAnimation();
viewer.autoRotate=true;viewer.autoRotateSpeed=0.6;viewer.controls.enableZoom=false;viewer.controls.enablePan=false}catch(e){log('Podgląd 3D niedostępny: '+e.message)}
loadSkin('MHF_Steve');


$('sel').addEventListener('change',()=>localStorage.setItem('mibver',$('sel').value));
const PROF={pvp:'-XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:MaxGCPauseMillis=50 -XX:+ParallelRefProcEnabled -XX:+DisableExplicitGC -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:InitiatingHeapOccupancyPercent=15 -XX:SurvivorRatio=32 -XX:MaxTenuringThreshold=1',low:'-XX:+UseG1GC -XX:MaxGCPauseMillis=100',def:''};
$('s-prof').onchange=()=>{const v=$('s-prof').value;if(v in PROF){$('s-jvm').value=PROF[v];$('s-msg').textContent='Profil wstawiony — kliknij Zapisz.'}};

// ===== Język, powiadomienia, wygląd =====
const EN={"Brak sieci": "Offline", "Gracz": "Player", "wersja": "version", "Najnowsza wersja Minecrafta": "Latest Minecraft version", "Popularne mody": "Popular mods", "Wskazówka PvP": "PvP tip", "Gra": "Game", "Wydajność": "Performance", "Wygląd": "Appearance", "Pomoc": "Help", "RAM (MB)": "RAM (MB)", "Masz MiB Client w wersji": "You have MiB Client version", "Tu pojawią się peleryny i dodatki do postaci. Ta część launchera jest jeszcze w budowie.": "Capes and character add-ons will show up here. This part of the launcher is still being built.", "Nie udało się połączyć z Modrinth. Sprawdź internet i wpisz wyszukiwanie ponownie.": "Couldn't connect to Modrinth. Check your internet and search again.", "Nie udało się wczytać listy. Sprawdź połączenie z internetem.": "Couldn't load the list. Check your internet connection.", "Minimalizuj": "Minimize", "Maksymalizuj": "Maximize", "Konsola": "Console", "Aktywne": "Active", "Usuń konto": "Remove account", "Dodaj konto": "Add account", "Konto dodane": "Account added", "Usunąć to konto z launchera?": "Remove this account from the launcher?", "Przełączono na": "Switched to","Strona główna": "Home", "Moje mody": "My mods", "Kosmetyki": "Cosmetics", "Ustawienia": "Settings", "Aktualności": "News", "AKTUALNOŚCI": "NEWS", "Konto Microsoft": "Microsoft account", "Zaloguj się": "Sign in", "GRAJ": "PLAY", "Anuluj": "Cancel", "Wersja": "Version", "Pamięć RAM": "RAM", "Rozdzielczość": "Resolution", "Zamknij": "Close", "Zainstaluj": "Install", "Zainstaluj teraz": "Install now", "Później": "Later", "Nie pokazuj ponownie": "Don't show again", "Dostępna aktualizacja": "Update available", "Wersja Minecrafta": "Minecraft version", "Szukaj (Modrinth)…": "Search (Modrinth)…", "Tylko zgodne z wybraną wersją gry": "Only compatible with the selected game version", "Sprawdź aktualizacje": "Check for updates", "Brak nowych komunikatów": "No new messages", "Osobny etap rozwoju": "Planned for a later stage", "Zapisz": "Save", "Zapisano": "Saved", "Java (ścieżka, puste = domyślna)": "Java (path, empty = default)", "Katalog gry": "Game folder", "Argumenty JVM": "JVM arguments", "Wybierz": "Choose", "Profil wydajności (argumenty JVM)": "Performance profile (JVM arguments)", "Wybierz profil…": "Choose a profile…", "PvP — wydajny (mniej przycięć)": "PvP — performance (fewer stutters)", "Słaby komputer": "Low-end PC", "Domyślny (puste)": "Default (empty)", "Serwer do pomiaru pingu w grze (np. mc.hypixel.net)": "Server for in-game ping (e.g. mc.hypixel.net)", "Wysoki priorytet procesu gry (płynniejsze PvP)": "High game process priority (smoother PvP)", "Nie pokazuj powiadomień o aktualizacjach": "Hide update notifications", "Język / Language": "Language", "Tło launchera": "Launcher background", "Fioletowe (domyślne)": "Purple (default)", "Czarne": "Black", "Granatowe": "Navy", "Własny obraz…": "Custom image…", "Animacja startowa": "Startup animation", "Pełna": "Full", "Krótka": "Short", "Wyłączona": "Off", "Efekty cząsteczek na ekranie startowym": "Particle effects on the startup screen", "Nakładka HUD (Right Shift) działa w trybie okienkowym i w oknie bez ramki. W prawdziwym pełnym ekranie jest niewidoczna.": "The HUD overlay (Right Shift) works in windowed and borderless mode. It is not visible in true fullscreen.", "Napraw instalację": "Repair installation", "Zgłoś problem": "Report a problem", "O programie i prywatność": "About and privacy", "Kopiuj": "Copy", "Zapisz do pliku": "Save to file", "Usuń": "Delete", "Włącz": "Enable", "Wyłącz": "Disable", "Aktualizuj": "Update", "Aktualizuj wszystkie": "Update all", "Zaczynam": "Get started", "Witaj w MiB Client": "Welcome to MiB Client", "NAJNOWSZA WERSJA MINECRAFTA": "LATEST MINECRAFT VERSION", "POPULARNE MODY": "POPULAR MODS", "WSKAZÓWKA PvP": "PvP TIP", "Wybierz ją na liście wersji i kliknij GRAJ.": "Pick it in the version list and press PLAY.", "Przygotowywanie interfejsu…": "Preparing the interface…", "Sprawdzanie plików…": "Checking files…", "Wczytywanie ustawień…": "Loading settings…", "Gotowe": "Ready", "URUCHAMIANIE…": "LAUNCHING…", "GRA DZIAŁA": "GAME RUNNING", "Brak wyników.": "No results.", "Szukanie…": "Searching…", "Sprawdzanie…": "Checking…", "Wszystkie mody są aktualne.": "All mods are up to date.", "Brak zainstalowanych modów dla tej wersji.": "No mods installed for this version.", "Raport nie zawiera haseł ani tokenów. Skopiuj go lub zapisz i wyślij osobie, która pomaga.": "The report contains no passwords or tokens. Copy or save it and send it to whoever is helping you.", "Paczka zasobów": "Resource pack", "paczka zasobów": "resource pack", "Skopiowano": "Copied", "Zaktualizowano": "Updated", "Instalowanie…": "Installing…", "Brak wersji.": "No versions.", "Nie udało się pobrać wersji.": "Could not load versions.", "Zainstalowano": "Installed", "Ten mod nie ma wersji na Fabric ani Forge — nie zostanie załadowany.": "This mod has no Fabric or Forge build and will not load.", "Aktualizacja launchera": "Launcher update", "pobrań": "downloads", "Naprawić instalację wersji": "Repair installation of version", "Pliki gry zostaną usunięte i pobrane ponownie przy następnym GRAJ.": "Game files will be deleted and downloaded again on the next PLAY.", "Pobieranie zakończone": "Download finished", "Brak ": "No ", "Włącz ": "Enable "};
const LEGAL={"pl": ["MiB Client jest niezależnym, darmowym launcherem. Nie jest produktem Mojang Studios ani Microsoft i nie jest przez nich wspierany. Minecraft jest znakiem towarowym Mojang Studios.", "<b>Co zapisujemy na Twoim komputerze:</b> ustawienia launchera, wybraną wersję gry oraz zaszyfrowane sesje kont Microsoft (żeby nie logować się za każdym razem). Hasła nie widzimy ani nie zapisujemy — logowanie odbywa się w oknie Microsoft.", "<b>Z kim się łączymy:</b> Microsoft i Mojang (logowanie, pliki gry), Modrinth (mody i paczki), Adoptium (Java), Fabric i Forge (loadery), GitHub (aktualizacje launchera) oraz mc-heads.net (wyświetlenie skina — widzi Twój nick).", "<b>Czego nie robimy:</b> nie zbieramy statystyk ani telemetrii i nie wysyłamy Twoich danych na własny serwer. Raport błędu tworzysz sam i sam decydujesz, czy go komuś wysłać; tokeny i hasła są z niego usuwane."], "en": ["MiB Client is an independent, free launcher. It is not a Mojang Studios or Microsoft product and is not endorsed by them. Minecraft is a trademark of Mojang Studios.", "<b>What we store on your computer:</b> launcher settings, the selected game version and encrypted Microsoft account sessions (so you do not have to sign in every time). We never see or store your password — sign-in happens in the Microsoft window.", "<b>Who we connect to:</b> Microsoft and Mojang (sign-in, game files), Modrinth (mods and packs), Adoptium (Java), Fabric and Forge (loaders), GitHub (launcher updates) and mc-heads.net (skin display — it sees your nickname).", "<b>What we do not do:</b> no analytics or telemetry, and no data is sent to a server of ours. You create error reports yourself and decide whether to send them; tokens and passwords are removed from them."]};
const TIPS={"pl": ["Ustaw czułość myszki raz i nie zmieniaj jej co dzień — pamięć mięśniowa robi różnicę.", "Stabilny rytm klikania jest lepszy niż chaotyczny spam — ćwicz równe tempo.", "W Ustawieniach wybierz profil wydajności „PvP”, jeśli gra się przycina.", "Zwiększ FOV, aby lepiej widzieć przeciwnika z boku, ale nie przesadzaj, bo pogorszysz celowanie.", "Przed turniejem sprawdź ping do serwera i jakość swojego łącza.", "Rób przerwy co godzinę: skupienie spada szybciej, niż myślisz."], "en": ["Set your mouse sensitivity once and keep it — muscle memory matters.", "A steady click rhythm beats chaotic spam — practice an even tempo.", "Pick the “PvP” performance profile in Settings if the game stutters.", "Raise your FOV to see opponents on the sides, but not too much or your aim suffers.", "Check your ping to the server and your connection quality before a tournament.", "Take a break every hour: focus drops faster than you think."]};
let LANG=localStorage.getItem('mibLang')||'pl';
const tr=s=>LANG==='en'&&EN[s]?EN[s]:s;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function trText(n){if(n.parentNode&&/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName))return;const v=n.nodeValue;if(n.__tr===undefined||v!==n.__tr)n.__o=v;const o=n.__o,t=o.trim();if(!t)return;const w=LANG==='en'&&EN[t]?o.replace(t,EN[t]):o;n.__tr=w;if(v!==w)n.nodeValue=w}
function trAttr(e){for(const a of ['placeholder','title']){if(!e.hasAttribute(a))continue;if(e['__'+a]===undefined)e['__'+a]=e.getAttribute(a);const o=e['__'+a];e.setAttribute(a,LANG==='en'&&EN[o]?EN[o]:o)}}
function walk(r){const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode())trText(n);if(r.querySelectorAll)r.querySelectorAll('[placeholder],[title]').forEach(trAttr)}
new MutationObserver(ms=>{for(const m of ms){if(m.type==='characterData')trText(m.target);else m.addedNodes.forEach(n=>n.nodeType===3?trText(n):n.nodeType===1&&walk(n))}}).observe(document.body,{subtree:true,childList:true,characterData:true});
const legalHtml=n=>LEGAL[LANG].slice(0,n).map(p=>'<p>'+p+'</p>').join('');
function tip(){const t=TIPS[LANG];$('n-tip').textContent=t[new Date().getDate()%t.length]}
function setLang(l){LANG=l;localStorage.setItem('mibLang',l);document.documentElement.lang=l;walk(document.body);$('legal-t').innerHTML=legalHtml(9);$('welcome-t').innerHTML=legalHtml(1)+LEGAL[LANG].slice(3).map(p=>'<p>'+p+'</p>').join('');tip()}
function toast(t,err){const d=document.createElement('div');d.className='toast'+(err?' err':'');d.textContent=t;$('toasts').appendChild(d);setTimeout(()=>d.remove(),6000)}
function applyBg(){const m=localStorage.getItem('mibbg')||'violet',a=$('app'),B={violet:'',black:'#000',blue:'radial-gradient(ellipse at 70% 0,#0d2347,transparent 60%),#02060f'},p=localStorage.getItem('mibbgimg');
 a.style.background=m==='custom'&&p?`linear-gradient(rgba(5,0,7,.55),rgba(5,0,7,.7)),url("file:///${encodeURI(p.replace(/\\/g,'/'))}") center/cover`:(B[m]||'')}
$('s-lang').value=LANG;$('s-bg').value=localStorage.getItem('mibbg')||'violet';$('s-anim').value=localStorage.getItem('mibanim')||'full';$('s-fx').checked=localStorage.getItem('mibfx')!=='0';
$('s-lang').onchange=()=>{setLang($('s-lang').value);$('w-lang').value=LANG};$('w-lang').onchange=()=>{setLang($('w-lang').value);$('s-lang').value=LANG};
$('s-bg').onchange=async()=>{const v=$('s-bg').value;if(v==='custom'){const p=await mib.call('pickimg');if(!p){$('s-bg').value=localStorage.getItem('mibbg')||'violet';return}localStorage.setItem('mibbgimg',p)}localStorage.setItem('mibbg',v);applyBg()};
$('s-anim').onchange=()=>localStorage.setItem('mibanim',$('s-anim').value);$('s-fx').onchange=()=>localStorage.setItem('mibfx',$('s-fx').checked?'1':'0');
$('s-about').onclick=()=>$('legal').classList.add('on');$('legal-x').onclick=()=>$('legal').classList.remove('on');
$('w-lang').value=LANG;$('w-go').onclick=()=>{localStorage.setItem('mibfirst','1');$('welcome').classList.remove('on')};
const wi=setInterval(()=>{if(sp.classList.contains('out')||sp.style.display==='none'){clearInterval(wi);if(!localStorage.getItem('mibfirst'))$('welcome').classList.add('on')}},300);
// Anulowanie, naprawa, raport
$('cancel').onclick=()=>mib.call('cancel');mib.on('started',()=>{$('cancel').style.display='none'});
$('s-repair').onclick=async()=>{if(!confirm(tr('Naprawić instalację wersji')+' '+$('sel').value+'? '+tr('Pliki gry zostaną usunięte i pobrane ponownie przy następnym GRAJ.')))return;toast(await mib.call('repair',$('sel').value))};
$('s-rep').onclick=async()=>{$('rep-t').value=await mib.call('report:build',$('sel').value);$('rep').classList.add('on')};
$('rep-c').onclick=async()=>{try{await navigator.clipboard.writeText($('rep-t').value)}catch{$('rep-t').select();document.execCommand('copy')}toast(tr('Skopiowano'))};
$('rep-s').onclick=async()=>{if(await mib.call('report:save',$('rep-t').value))toast(tr('Zapisano'))};$('rep-x').onclick=()=>$('rep').classList.remove('on');
// ===== MiB Hub: wszystko w jednej liście (przewijanie lub wyszukiwarka) =====
let hid=0,ht,hoff=0,hend=false,hbusy=false;
const fmt=n=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?Math.round(n/1e3)+'k':String(n);
const card=x=>`<div class="card hc" data-slug="${esc(x.slug)}" data-title="${esc(x.title)}" style="cursor:pointer"><img src="${esc(x.icon)}" width="44" height="44" onerror="this.style.visibility='hidden'"><div style="min-width:0"><b>${esc(x.title)}<em class="tag">${x.type==='resourcepack'?tr('paczka zasobów'):'mod'}</em></b><span class="mut">${esc(x.desc)}</span><span class="mut">${x.dl.toLocaleString()} ${tr('pobrań')}</span></div></div>`;
async function hubLoad(reset){if(hbusy&&!reset)return;if(!reset&&hend)return;hbusy=true;if(reset){hoff=0;hend=false;$('hres').innerHTML='';hid++}const id=hid;
 try{const r=await mib.call('hub',{q:$('hq').value.trim(),version:$('sel').value,compat:$('hc').checked,offset:hoff});if(id!==hid)return;
 if(r.error){$('hres').textContent=r.error;hend=true;return}if(!r.length)hend=true;else hoff+=r.length;$('hres').insertAdjacentHTML('beforeend',r.map(card).join(''));
 if(!$('hres').children.length)$('hres').textContent=tr('Brak wyników.');else if($('hres').scrollHeight<=$('hres').clientHeight+50)hubLoad(false)}
 catch{if(id===hid)$('hres').innerHTML='<p class="empty">'+tr('Nie udało się połączyć z Modrinth. Sprawdź internet i wpisz wyszukiwanie ponownie.')+'</p>'}finally{if(id===hid)hbusy=false}}
$('hq').oninput=()=>{clearTimeout(ht);ht=setTimeout(()=>hubLoad(true),250)};$('hc').onchange=()=>hubLoad(true);
$('hres').onscroll=()=>{const e=$('hres');if(e.scrollTop+e.clientHeight>=e.scrollHeight-250)hubLoad(false)};
document.querySelector('.nav[data-p="hub"]').addEventListener('click',()=>{if(!$('hres').children.length)hubLoad(true)});
// Okno instalacji (Hub i popularne mody w aktualnościach)
let cur=null;
async function openInstall(slug,title){cur={slug};$('mdl-t').textContent=title;$('mdl-d').textContent='';$('mdl-s').textContent='…';$('mdl-v').innerHTML='';$('mdl-go').disabled=false;$('mdl').classList.add('on');
 try{const r=await mib.call('hub:versions',{slug});$('mdl-v').innerHTML=r.versions.map(v=>`<option ${v===$('sel').value?'selected':''}>${v}</option>`).join('');
 $('mdl-d').textContent=r.type==='resourcepack'?tr('Paczka zasobów'):(r.loaders.length?'Loader: '+r.loaders.join(', '):tr('Ten mod nie ma wersji na Fabric ani Forge — nie zostanie załadowany.'));$('mdl-s').textContent=r.versions.length?'':tr('Brak wersji.')}
 catch{$('mdl-s').textContent=tr('Nie udało się pobrać wersji.')}}
document.addEventListener('click',e=>{const c=e.target.closest('.hc');if(c&&c.dataset.slug)openInstall(c.dataset.slug,c.dataset.title)});
$('mdl-go').onclick=async()=>{$('mdl-go').disabled=true;$('mdl-s').textContent=tr('Instalowanie…');const r=await mib.call('hub:install',{slug:cur.slug,gv:$('mdl-v').value}),ok=r.startsWith('Zainstalowano');
 $('mdl-s').textContent=r;toast(ok?tr('Zainstalowano'):r,!ok);$('mdl-go').disabled=false;if($('p-mods').classList.contains('on'))modsLoad()};
$('mdl-x').onclick=()=>$('mdl').classList.remove('on');
// ===== Moje mody =====
async function modsLoad(){const gv=$('sel').value,l=await mib.call('mods:list',gv);$('mhead').textContent='MiB '+gv;$('mu').textContent='';
 $('mlist').innerHTML=l.length?l.map(m=>`<div class="card mrow" data-f="${esc(m.file)}"><span style="${m.on?'':'opacity:.5'}">${esc(m.file.replace(/\.disabled$/,''))}</span><span class="mut" style="flex:none">${(m.size/1048576).toFixed(1)} MB</span><button class="b ghost t">${tr(m.on?'Wyłącz':'Włącz')}</button><button class="b danger d">${tr('Usuń')}</button></div>`).join(''):'<p class="empty">'+tr('Brak zainstalowanych modów dla tej wersji.')+'</p>'}
$('mlist').onclick=async e=>{const r=e.target.closest('.mrow');if(!r)return;const gv=$('sel').value,file=r.dataset.f;
 if(e.target.classList.contains('t')){await mib.call('mods:toggle',{gv,file});modsLoad()}else if(e.target.classList.contains('d')&&confirm(file+'?')){await mib.call('mods:delete',{gv,file});modsLoad()}};
$('mupd').onclick=async()=>{$('mu').textContent=tr('Sprawdzanie…');const r=await mib.call('mods:updates',$('sel').value);if(!r.length){$('mu').textContent=tr('Wszystkie mody są aktualne.');return}
 $('mu').innerHTML=r.map(x=>`<div class="card mu" data-f="${esc(x.file)}" data-id="${esc(x.id)}"><span>${esc(x.file)} → ${esc(x.ver)}</span><button class="b ghost">${tr('Aktualizuj')}</button></div>`).join('')+`<button class="b" id="mall">${tr('Aktualizuj wszystkie')}</button>`};
$('mu').onclick=async e=>{if(e.target.tagName!=='BUTTON')return;const all=e.target.id==='mall',rows=all?[...$('mu').querySelectorAll('.mu')]:[e.target.closest('.mu')];
 for(const r of rows){const x=await mib.call('mods:update',{gv:$('sel').value,file:r.dataset.f,id:r.dataset.id});if(x==='ok')r.remove();else toast(x,1)}toast(tr('Zaktualizowano'));modsLoad()};
document.querySelector('.nav[data-p="mods"]').addEventListener('click',modsLoad);
$('sel').addEventListener('change',()=>{if($('p-mods').classList.contains('on'))modsLoad()});
// ===== Panel aktualności: najnowsza wersja, popularne mody, wskazówka =====
(async()=>{try{$('n-ver').textContent=(await mib.call('versions'))[0]}catch{$('n-ver').textContent=tr('Brak sieci')}
 const t=await mib.call('trending');$('n-top').innerHTML=t.map(x=>`<div class="tm hc" data-slug="${esc(x.slug)}" data-title="${esc(x.title)}"><img src="${esc(x.icon)}" onerror="this.style.visibility='hidden'"><span>${esc(x.title)}</span><em>${fmt(x.dl)}</em></div>`).join('')||'<p class="empty">'+tr('Nie udało się wczytać listy. Sprawdź połączenie z internetem.')+'</p>'})();
applyBg();setLang(LANG);

// ===== Konta Microsoft: dodawanie, przełączanie, usuwanie =====
async function accMenu(){const l=await mib.call('accounts:list');
 $('accmenu').innerHTML=l.map(a=>`<div class="ai" data-id="${esc(a.id)}"><img src="https://mc-heads.net/avatar/${encodeURIComponent(a.name)}/48" onerror="this.onerror=null;this.src=FACE" alt=""><b>${esc(a.name)}</b>${a.active?'<em>'+tr('Aktywne')+'</em>':''}<button class="rm" title="${tr('Usuń konto')}">✕</button></div>`).join('')+`<div class="ai add"><b>+ ${tr('Dodaj konto')}</b></div>`;$('accmenu').classList.add('on')}
$('accname').onclick=e=>{e.stopPropagation();$('accmenu').classList.contains('on')?$('accmenu').classList.remove('on'):accMenu()};
document.addEventListener('click',e=>{if(!e.target.closest('#accmenu')&&!e.target.closest('#accname'))$('accmenu').classList.remove('on')});
$('accmenu').onclick=async e=>{const r=e.target.closest('.ai');if(!r)return;$('accmenu').classList.remove('on');
 if(r.classList.contains('add')){try{setAcc(await mib.call('login'));toast(tr('Konto dodane'))}catch(x){log('Logowanie nieudane: '+x.message)}return}
 if(e.target.classList.contains('rm')){if(!confirm(tr('Usunąć to konto z launchera?')))return;await mib.call('accounts:remove',r.dataset.id);
  if(r.querySelector('em')){logged=false;$('accn').textContent=tr('Zaloguj się');$('nick').textContent=tr('Gracz')}return}
 const x=await mib.call('accounts:switch',r.dataset.id);if(x.error)toast(x.error,1);else{setAcc(x);toast(tr('Przełączono na')+' '+x.name)}};
mib.on('account:changed',setAcc);
mib.on('relaunch',()=>{const g=$('go');g.disabled=true;g.firstChild.textContent='URUCHAMIANIE…';$('cancel').style.display='inline-block';con.style.display='block';log('Zmiana konta — uruchamianie gry ponownie…')});
mib.on('started',()=>{$('go').firstChild.textContent='GRA DZIAŁA'});
