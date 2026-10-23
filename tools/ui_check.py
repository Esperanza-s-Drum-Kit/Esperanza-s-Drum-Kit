# Drives the interface with real clicks: steps, paint, playlist clip, song play, channel panel, browser add.
import os, sys
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dist', 'edk.html') + '?nosplash'
out = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_function('window.EDK && document.querySelector(".crow")', timeout=20000)
    pg.evaluate("EDK.load(M.newProject())"); pg.wait_for_timeout(200)
    row = pg.locator('.crow').nth(0)
    row.locator('.st[data-s="0"]').click()
    # paint steps 4..7 by dragging on the hat row
    hat = pg.locator('.crow').nth(2); a = hat.locator('.st[data-s="4"]').bounding_box(); z = hat.locator('.st[data-s="7"]').bounding_box()
    pg.mouse.move(a['x'] + 5, a['y'] + 5); pg.mouse.down(); pg.mouse.move(z['x'] + 5, z['y'] + 5, steps=8); pg.mouse.up()
    r = pg.evaluate("(() => { const p = EDK.proj, pat = M.pat(p); return { kick0: !!M.cell(pat, p.channels[0].id, 0), hats: [4,5,6,7].map((s) => !!M.cell(pat, p.channels[2].id, s)) }; })()")
    print('steps', r)
    # place a clip in the playlist at bar 3, track 2
    g = pg.locator('#plGrid').bounding_box(); pg.mouse.click(g['x'] + 6 * 32 + 10, g['y'] + 41 + 10)
    print('clips', pg.evaluate("EDK.proj.playlist.clips.map((c) => [c.track, c.start, c.len])"))
    pg.click('#mSong'); pg.click('#playBtn'); pg.wait_for_timeout(700)
    print('song playing', pg.evaluate("[EDK.eng.playing, EDK.proj.mode, +EDK.eng.pos().toFixed(1)]"), 'playhead visible', pg.is_visible('#playhead'))
    pg.screenshot(path=f'{out}/ui-playing.png')
    pg.click('#stopBtn')
    # channel settings by double-click, browser + adds a channel
    pg.locator('.cname').nth(4 if pg.locator('.cname').count() > 4 else 0).dblclick(); pg.wait_for_timeout(200)
    print('panel open', pg.is_visible('#panel'))
    pg.screenshot(path=f'{out}/ui-panel.png')
    pg.keyboard.press('Escape')
    n0 = pg.locator('.crow').count(); pg.locator('.bitem[data-sound="roast/ohat"] .add').click(); print('channels', n0, '->', pg.locator('.crow').count())
    pg.locator('.bgroup[data-g="Synths"] > button').click(); pg.locator('.bitem[data-synth="1"] .add').click()
    print('last channel', pg.evaluate("(() => { const c = EDK.proj.channels.at(-1); return [c.name, c.type, c.note]; })()"))
    pg.keyboard.press('Control+z'); print('after undo', pg.locator('.crow').count())
    print('errors:', errs or 'none'); b.close()
