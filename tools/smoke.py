# Loads the built page, reports console errors and takes desktop + phone screenshots.
import sys, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'dist', 'edk.html') + '?nosplash'
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for name, vp in [('desktop', {'width': 1440, 'height': 900}), ('phone', {'width': 390, 'height': 844})]:
        pg = b.new_page(viewport=vp, device_scale_factor=2 if name == 'phone' else 1)
        errs = []
        pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.goto(URL); pg.wait_for_function('window.EDK && document.querySelector(".crow")', timeout=20000)
        pg.evaluate('EDK.demo()'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{out}/{name}.png')
        if name == 'phone':
            pg.click('#tabs button[data-v="playlist"]'); pg.wait_for_timeout(200); pg.screenshot(path=f'{out}/phone-playlist.png')
            pg.click('#tabs button[data-v="sounds"]'); pg.wait_for_timeout(200); pg.screenshot(path=f'{out}/phone-sounds.png')
        print(name, 'errors:', errs or 'none')
    b.close()
