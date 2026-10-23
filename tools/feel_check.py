# Measures what each Feel preset does: timing spread per role (ms), mean lay-back, velocity range; and repeatability.
import os, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dist', 'edk.html') + '?nosplash'
JS = r"""() => {
  const out = {}, p = M.newProject(); p.bpm = 90; const pat = p.patterns[0]; pat.len = 64;
  const [kick, clap, hat] = p.channels; const sd = ENG.stepDur(p.bpm);
  for (let s = 0; s < 64; s++) { M.setCell(pat, hat.id, s, M.newCell(hat)); if (s % 8 === 0) M.setCell(pat, kick.id, s, M.newCell(kick)); if (s % 8 === 4) M.setCell(pat, clap.id, s, M.newCell(clap)); }
  const stats = (ch) => { const d = [], v = []; for (let s = 0; s < 64; s++) if (M.cell(pat, ch.id, s)) { const f = ENG.feel(p, ch, pat, s, s, sd); d.push(f.dt * 1000); v.push(f.vm); }
    const m = d.reduce((a, b) => a + b, 0) / d.length, sdv = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / d.length);
    return { meanMs: +m.toFixed(1), sdMs: +sdv.toFixed(1), maxAbsMs: +Math.max(...d.map(Math.abs)).toFixed(1), vel: [+Math.min(...v).toFixed(2), +Math.max(...v).toFixed(2)] }; };
  for (const [name, fx] of ENG.FEEL_PRESETS) { p.feel = Object.assign(ENG.defFeel(), fx); out[name] = { kick: stats(kick), clap: stats(clap), hat: stats(hat) }; }
  // repeatability: same take twice identical; a new take differs; 'vary' changes pass 2
  p.feel = Object.assign(ENG.defFeel(), ENG.FEEL_PRESETS[4][1]);
  const a = ENG.feel(p, hat, pat, 5, 5, sd).dt, b = ENG.feel(p, hat, pat, 5, 69, sd).dt; p.feel.take = 2; const c = ENG.feel(p, hat, pat, 5, 5, sd).dt;
  p.feel.vary = true; const d1 = ENG.feel(p, hat, pat, 5, 5, sd).dt, d2 = ENG.feel(p, hat, pat, 5, 69, sd).dt;
  out.repeat = { samePass: a === b, newTakeDiffers: a !== c, varyDiffers: d1 !== d2 };
  ch0: { const p2 = M.newProject(); const k2 = p2.channels[0]; k2.feel = 0; p2.feel = Object.assign(ENG.defFeel(), ENG.FEEL_PRESETS[7][1]); M.setCell(p2.patterns[0], k2.id, 4, M.newCell(k2)); out.channelLocked = ENG.feel(p2, k2, p2.patterns[0], 4, 4, sd); }
  return out; }"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); pg = b.new_page()
    pg.goto(URL); pg.wait_for_function('window.EDK && document.querySelector(".crow")', timeout=20000)
    r = pg.evaluate(JS)
    for k, v in r.items():
        print(k.ljust(14), json.dumps(v))
    b.close()
