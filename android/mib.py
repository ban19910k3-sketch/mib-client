#!/usr/bin/env python3
# MiB Client na Androida (od 0.43.0): zamienia kod Amethyst (LGPL-3.0, https://github.com/AngelAuraMC/Amethyst-Android,
# wersja przypięta w .github/workflows/android.yml) w aplikację MiB Client. Każda podmiana sprawdza, że trafiła — gdy
# Amethyst zmieni kod, skrypt przerwie budowanie zamiast zbudować coś połowicznie.
#   python3 android/mib.py --src <amethyst> --version 0.43.0 --mod mib-mod.jar --fabric-api fabric-api-x.jar \
#       --fabric-profile fabric.json --icon icon.png
import argparse, base64, io, json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = 'pl.mibclient.android'


def patch(path, pairs, count=None):
    with open(path, encoding='utf-8') as f:
        s = f.read()
    for old, new in pairs:
        n = s.count(old)
        if n == 0 or (count is not None and n != count):
            sys.exit(f'mib.py: w {path} nie ma (albo jest {n} razy): {old[:80]!r}')
        s = s.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(s)


def version_code(v):
    a, b, c = (int(x) for x in v.split('.'))
    return a * 1000000 + b * 1000 + c


def icons(app, icon):
    from PIL import Image
    src = Image.open(icon).convert('RGBA')
    bg = (5, 0, 7, 255)  # tło launchera (#050007)
    for d, s in {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}.items():
        out = os.path.join(app, 'src/main/res/mipmap-' + d)
        legacy, adaptive = round(48 * s), round(108 * s)
        # ikona adaptacyjna: logo w bezpiecznym środku (66 z 108 dp), tło w kolorze launchera
        fg = Image.new('RGBA', (adaptive, adaptive), (0, 0, 0, 0))
        logo = src.resize((round(adaptive * 0.6),) * 2, Image.LANCZOS)
        fg.paste(logo, ((adaptive - logo.width) // 2,) * 2, logo)
        fg.save(os.path.join(out, 'ic_launcher_foreground.webp'), 'WEBP', lossless=True)
        Image.new('RGBA', (adaptive, adaptive), bg).save(os.path.join(out, 'ic_launcher_background.webp'), 'WEBP', lossless=True)
        for name in ('ic_launcher', 'ic_launcher_round'):
            im = Image.new('RGBA', (legacy, legacy), bg)
            lg = src.resize((round(legacy * 0.86),) * 2, Image.LANCZOS)
            im.paste(lg, ((legacy - lg.width) // 2,) * 2, lg)
            im.save(os.path.join(out, name + '.webp'), 'WEBP', lossless=True)
    # ikona profilu „domyślnego” w aplikacji
    src.resize((512, 512), Image.LANCZOS).save(os.path.join(app, 'src/main/res/drawable/ic_pojav_full.webp'), 'WEBP', lossless=True)
    buf = io.BytesIO()
    src.resize((64, 64), Image.LANCZOS).save(buf, 'PNG')
    return base64.b64encode(buf.getvalue()).decode()


def main():
    ap = argparse.ArgumentParser()
    for a in ('--src', '--version', '--mod', '--fabric-api', '--fabric-profile', '--icon'):
        ap.add_argument(a, required=True)
    o = ap.parse_args()
    if not re.fullmatch(r'\d+\.\d+\.\d+', o.version):
        sys.exit('mib.py: zła wersja ' + o.version)
    app = os.path.join(o.src, 'app_pojavlauncher')
    main_dir = os.path.join(app, 'src/main')

    # nazwa, pakiet, wersja MiB, podpis kluczem MiB (android/mib.p12, hasło w sekrecie MIB_KEY_PASSWORD)
    gradle = os.path.join(app, 'build.gradle')
    patch(gradle, [
        ('versionCode 10000000', 'versionCode ' + str(version_code(o.version))),
        ('versionName getVersionName()', 'versionName "' + o.version + '"'),
        ('"Amethyst (Debug)"', '"MiB Client (Debug)"'),
        ('resValue "string", "app_name", "Amethyst"', 'resValue "string", "app_name", "MiB Client"'),
        ('resValue "string", "app_short_name", "Amethyst"', 'resValue "string", "app_short_name", "MiB Client"'),
        ('''        customRelease {
            storeFile file("aamc_upload.jks")
            storePassword System.getenv("GPLAY_KEYSTORE_PASSWORD")
            keyAlias "android_github_release"
            keyPassword System.getenv("GPLAY_KEYSTORE_PASSWORD")
        }''', '''        customRelease {
            storeFile file(System.getenv("MIB_KEYSTORE") ?: "debug.keystore")
            storePassword System.getenv("MIB_KEYSTORE") ? System.getenv("MIB_KEY_PASSWORD") : "android"
            keyAlias System.getenv("MIB_KEYSTORE") ? "mib" : "androiddebugkey"
            keyPassword System.getenv("MIB_KEYSTORE") ? System.getenv("MIB_KEY_PASSWORD") : "android"
        }'''),
    ])
    patch(gradle, [('org.angelauramc.amethyst', PKG)])

    # napisy: nazwa aplikacji
    res = os.path.join(main_dir, 'res')
    for d in os.listdir(res):
        f = os.path.join(res, d, 'strings.xml')
        if d.startswith('values') and os.path.isfile(f):
            with open(f, encoding='utf-8') as h:
                s = h.read()
            with open(f, 'w', encoding='utf-8') as h:
                h.write(s.replace('Amethyst', 'MiB Client'))

    # „O aplikacji”: MiB na Amethyst, licencja i kod źródłowy (wymóg LGPL)
    patch(os.path.join(main_dir, 'assets/about_en.txt'), [('%s (Minecraft Java Launcher for Android)',
        'MiB Client for Android is based on <a href="https://github.com/AngelAuraMC/Amethyst-Android">Amethyst</a> '
        '(GNU LGPLv3). MiB source code and changes: <a href="https://github.com/ban19910k3-sketch/mib-client">'
        'github.com/ban19910k3-sketch/mib-client</a> (android).<br><br>%s (Minecraft Java Launcher for Android)')], 1)

    # aktualizacje: pozwolenie na instalator i udostępnienie pobranego APK instalatorowi
    patch(os.path.join(main_dir, 'AndroidManifest.xml'), [
        ('    <uses-permission android:name="android.permission.INTERNET" />',
         '    <uses-permission android:name="android.permission.INTERNET" />\n'
         '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />'),
        ('        <service android:name=".services.ProgressService"',
         '        <provider\n'
         '            android:name="androidx.core.content.FileProvider"\n'
         '            android:authorities="${applicationId}.mibupdate"\n'
         '            android:exported="false"\n'
         '            android:grantUriPermissions="true">\n'
         '            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/mib_update_paths" />\n'
         '        </provider>\n\n'
         '        <service android:name=".services.ProgressService"'),
    ], 1)
    os.makedirs(os.path.join(res, 'xml'), exist_ok=True)
    with open(os.path.join(res, 'xml/mib_update_paths.xml'), 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<paths>\n    <cache-path name="mib-update" path="mib-update/" />\n</paths>\n')

    # start MiB przy otwarciu launchera
    patch(os.path.join(main_dir, 'java/net/kdt/pojavlaunch/LauncherActivity.java'), [
        ('        super.onCreate(savedInstanceState);\n        setContentView(R.layout.activity_pojav_launcher);',
         '        super.onCreate(savedInstanceState);\n        pl.mibclient.android.Mib.start(this);\n        setContentView(R.layout.activity_pojav_launcher);')], 1)
    # tylko oryginalny Minecraft: bez kont offline, gra kontem innym niż Microsoft prosi o zalogowanie (od 0.44.0)
    patch(os.path.join(main_dir, 'java/net/kdt/pojavlaunch/fragments/SelectAuthFragment.java'), [
        ('        mLocalButton.setOnClickListener(v -> hasNoOnlineProfileDialog(requireActivity(), () -> Tools.swapFragment(requireActivity(), LocalLoginFragment.class, LocalLoginFragment.TAG, null)));',
         '        mLocalButton.setVisibility(View.GONE); // MiB: tylko oryginalny Minecraft (konto Microsoft)')], 1)
    patch(os.path.join(main_dir, 'java/net/kdt/pojavlaunch/LauncherActivity.java'), [
        ('''        if(mAccountSpinner.getSelectedAccount() == null){
            Toast.makeText(this, R.string.no_saved_accounts, Toast.LENGTH_LONG).show();
            ExtraCore.setValue(ExtraConstants.SELECT_AUTH_METHOD, true);
            return false;
        }''', '''        if(mAccountSpinner.getSelectedAccount() == null){
            Toast.makeText(this, R.string.no_saved_accounts, Toast.LENGTH_LONG).show();
            ExtraCore.setValue(ExtraConstants.SELECT_AUTH_METHOD, true);
            return false;
        }
        if(!pl.mibclient.android.Mib.original(mAccountSpinner.getSelectedAccount())){
            pl.mibclient.android.Mib.needMicrosoft(this);
            return false;
        }''')], 1)
    # nagroda za grę na telefonie: zgłoszenie tuż przed startem gry
    patch(os.path.join(main_dir, 'java/net/kdt/pojavlaunch/MainActivity.java'), [
        ('        Tools.launchMinecraft(this, minecraftAccount, minecraftProfile, versionId, requiredJavaVersion);',
         '        pl.mibclient.android.Mib.played(this, minecraftAccount);\n        Tools.launchMinecraft(this, minecraftAccount, minecraftProfile, versionId, requiredJavaVersion);')], 1)
    # przycisk Discord: serwer MiB
    patch(os.path.join(res, 'values/strings.xml'), [
        ('<string name="discord_invite" translatable="false">https://discord.gg/5ptqkyZxEy</string>',
         '<string name="discord_invite" translatable="false">https://discord.gg/33d6g9HuyN</string>')], 1)
    dst = os.path.join(main_dir, 'java/pl/mibclient/android')
    os.makedirs(dst, exist_ok=True)
    shutil.copy(os.path.join(HERE, 'Mib.java'), dst)

    # przycisk „MiB” na ekranie gry = prawy Shift (menu MiB), u góry obok „Inventory”
    ctrl = os.path.join(main_dir, 'assets/default.json')
    with open(ctrl, encoding='utf-8') as f:
        layout = json.load(f)
    pause = next(b for b in layout['mControlDataList'] if b['name'] == 'Pause')
    mib = dict(pause, name='MiB', keycodes=[344, 0, 0, 0], width=100, height=40, displayInMenu=True,
               dynamicX='1.0 * ${screen_width} - (px(488.8) / 100.0 * ${preferred_scale}) - (${margin} * 4)',
               dynamicY='0 * ${screen_height}', bgColor=-1300481299)
    layout['mControlDataList'].append(mib)
    with open(ctrl, 'w', encoding='utf-8') as f:
        json.dump(layout, f, indent=2)

    # pliki MiB w paczce: mod, Fabric API, profil Fabric, wersja, ikona profilu
    assets = os.path.join(main_dir, 'assets/mib')
    os.makedirs(assets, exist_ok=True)
    shutil.copy(o.mod, os.path.join(assets, 'mib-client-mod.jar'))
    api = os.path.basename(o.fabric_api)
    if not re.fullmatch(r'fabric-api-[\w.+-]+\.jar', api):
        sys.exit('mib.py: zła nazwa Fabric API ' + api)
    shutil.copy(o.fabric_api, os.path.join(assets, api))
    with open(o.fabric_profile, encoding='utf-8') as f:
        prof = json.load(f)
    if 'id' not in prof or 'inheritsFrom' not in prof:
        sys.exit('mib.py: zły profil Fabric')
    shutil.copy(o.fabric_profile, os.path.join(assets, 'fabric-profile.json'))
    for name, text in (('version.txt', o.version), ('fabric-api.txt', api), ('icon.b64', icons(app, o.icon))):
        with open(os.path.join(assets, name), 'w', encoding='utf-8') as f:
            f.write(text + '\n')
    print('MiB Client', o.version, '→', prof['id'], api)


if __name__ == '__main__':
    main()
