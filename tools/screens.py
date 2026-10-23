# Takes the website's screenshots of the real app (demo beat, sections, panels) and saves them as WebP.
import os, io
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'dist', 'edk.html') + '?nosplash'
OUT = os.path.join(ROOT, 'site', 'img')
SETUP = """() => { EDK.demo(); const p = EDK.proj;
  p.sections = [M.newSection(p,'Intro',0,32), M.newSection(p,'Verse',32,64), M.newSection(p,'Chorus',96,64), M.newSection(p,'Outro',160,32)];
  p.playlist.clips.push({id:'c1',pat:p.patterns[0].id,track:0,start:96,len:64},{id:'c2',pat:p.patterns[1].id,track:1,start:96,len:64},{id:'c3',pat:p.patterns[1].id,track:1,start:0,len:32},{id:'c4',pat:p.patterns[0].id,track:0,start:160,len:32});
  p.loop = {on:true,start:96,len:64}; Object.assign(p.feel, ENG.FEEL_PRESETS[2][1]); p.mode='song'; EDK.load(p); }"""
def save(png, name, w):
    im = Image.open(io.BytesIO(png)).convert('RGB'); im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name), 'WEBP', quality=82); print(name, im.size)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
    pg.goto(URL); pg.wait_for_function('window.EDK && document.querySelector(".crow")'); pg.evaluate(SETUP); pg.wait_for_timeout(400)
    pg.evaluate("PL.songPos = 104; document.querySelector('#ruler .songpos').style.left = 104*PL.zoom+'px'; PL.showHead(110.5)")
    save(pg.screenshot(), 'studio.webp', 1600)
    pg.click('#feelBtn'); pg.wait_for_timeout(300); save(pg.screenshot(), 'feel.webp', 1600); pg.click('#feelBtn')
    pg.locator('.cname').nth(4).dblclick(); pg.wait_for_timeout(300); save(pg.screenshot(), 'channel.webp', 1600); pg.keyboard.press('Escape')
    pg.evaluate("REC.open()"); pg.wait_for_timeout(300); save(pg.screenshot(), 'record.webp', 1600); pg.evaluate("REC.close()")
    pg.evaluate("PL.secMenu(EDK.proj.sections[2].id, 700, 470)"); pg.wait_for_timeout(200); save(pg.screenshot(), 'sections.webp', 1600); pg.evaluate("UI.closeMenu()")
    ph = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    ph.goto(URL); ph.wait_for_function('window.EDK && document.querySelector(".crow")'); ph.evaluate(SETUP); ph.wait_for_timeout(300)
    ph.click('#tabs button[data-v="rack"]'); ph.wait_for_timeout(200); save(ph.screenshot(), 'phone-rack.webp', 700)
    ph.click('#tabs button[data-v="playlist"]'); ph.wait_for_timeout(200); save(ph.screenshot(), 'phone-playlist.webp', 700)
    sp = b.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
    sp.goto(URL.replace('?nosplash', '')); sp.wait_for_function('window.EDK'); sp.wait_for_timeout(500); save(sp.screenshot(), 'card.webp', 1200)
    b.close()
