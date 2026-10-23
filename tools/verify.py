# Acceptance checks for the 0.1 foundations, run in headless Chromium against dist/edk.html.
import os, json, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'dist', 'edk.html') + '?nosplash'
JS = r"""
async () => {
  const R = {}, A = window.EDK, sr = 48000;
  const base = () => { const p = M.newProject(); p.bpm = 140; return p; };
  const onsets = (buf, thr) => { const L = buf.getChannelData(0), out = []; let quiet = 0;
    for (let i = 0; i < L.length; i++) { const a = Math.abs(L[i]); if (a > thr && quiet > 2000) out.push(i); quiet = a > thr ? 0 : quiet + 1; if (i === 0) quiet = 9999; } return out; };
  // 1. grid timing: kick on every beat of a 4-bar render at 140 BPM lands on the exact frame
  { const p = base(); const k = p.channels[0], pat = p.patterns[0]; k.p.s = 0; k.p.d = 0.03; [0, 4, 8, 12].forEach((s) => M.setCell(pat, k.id, s, M.newCell(k)));
    const { buf } = await ENG.render(p, { mode: 'pat', loops: 4, sr, tail: 0.5 });
    const sd = 60 / 140 / 4, want = Array.from({ length: 16 }, (_, i) => Math.round(i * 4 * sd * sr));
    const got = onsets(buf, 1e-3);
    const err = want.map((w, i) => (got[i] === undefined ? 1e9 : got[i] - w));
    // the kick's attack crosses the threshold a fixed few samples after its start: judge spacing, not the attack
    const rel = err.map((e) => e - err[0]);
    R.grid = { hits: got.length, want: want.length, attackSamples: err[0], maxErrSamples: Math.max(...rel.map(Math.abs)) }; }
  // 2. swing 50% moves the odd 16th by a quarter step
  { const p = base(); p.swing = 0.5; const ev = ENG.events(p, 'pat', 0, 2, (k) => k * (60 / 140 / 4), sr); void ev;
    const pat = p.patterns[0], h = p.channels[2]; M.setCell(pat, h.id, 0, M.newCell(h)); M.setCell(pat, h.id, 1, M.newCell(h));
    const e = ENG.events(p, 'pat', 0, 2, (k) => k * (60 / 140 / 4), sr).get(h.id).filter((x) => x[1] === 1).map((x) => x[0]);
    R.swing = { gap: e[1] - e[0], want: Math.round((60 / 140 / 4) * 1.25 * sr) }; }
  // 3. song mode: two clips on different tracks, clip longer than its pattern repeats it
  { const p = base(); const k = p.channels[0], pat = p.patterns[0]; M.setCell(pat, k.id, 0, M.newCell(k));
    const b = M.newPattern(p); p.patterns.push(b); M.setCell(b, p.channels[1].id, 8, M.newCell(p.channels[1]));
    p.playlist.clips = [{ id: 'a', pat: pat.id, track: 0, start: 0, len: 48 }, { id: 'b', pat: b.id, track: 1, start: 16, len: 16 }];
    const ev = ENG.events(p, 'song', 0, M.songLen(p), (x) => x, 1);
    R.song = { songLen: M.songLen(p), kicks: ev.get(k.id).filter((x) => x[1]).map((x) => x[0]), claps: ev.get(p.channels[1].id).filter((x) => x[1]).map((x) => x[0]) }; }
  // 4. a muted channel renders silent; unmuted is loud
  { const p = base(); const k = p.channels[0]; M.setCell(p.patterns[0], k.id, 0, M.newCell(k));
    const peak = (b) => { let m = 0; const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return 20 * Math.log10(m + 1e-12); };
    const a = await ENG.render(p, { mode: 'pat', sr, tail: 0.3 }); k.mute = true; const b2 = await ENG.render(p, { mode: 'pat', sr, tail: 0.3 });
    R.mute = { onDb: +peak(a.buf).toFixed(1), mutedDb: +peak(b2.buf).toFixed(1) }; }
  // 5. 808 plays in key: note 45 (A2) should come out near 110 Hz (zero-crossing estimate on the tail)
  { const p = base(); const ch = M.newChannel(p, { sound: 'bass/808long', p: SOUND.samplerParams('bass/808long'), note: 36 }); p.channels = [ch];
    M.setCell(p.patterns[0], ch.id, 0, { v: 1, n: 45, g: 8 });
    const { buf } = await ENG.render(p, { mode: 'pat', sr, tail: 0.5 }); const d = buf.getChannelData(0);
    let zc = 0, a = Math.round(0.25 * sr), b = Math.round(0.65 * sr); for (let i = a; i < b; i++) if (d[i - 1] <= 0 && d[i] > 0) zc++;
    R.bass808 = { hz: +(zc / ((b - a) / sr)).toFixed(1), want: 110 }; }
  // 6. synth channel note pitch: A4 = 440 Hz on a sine-ish preset
  { const p = base(); const i = SOUND.SYNTHS.findIndex((s) => s[0] === 'Organ'); const ch = M.newChannel(p, { type: 'synth', p: JSON.parse(JSON.stringify(SOUND.SYNTHS[i][1])), note: 69 }); ch.p.sub = 0; ch.p.o2oct = 0; ch.p.mix = 0; ch.p.lpitch = 0; p.channels = [ch];
    M.setCell(p.patterns[0], ch.id, 0, { v: 1, n: 69, g: 8 });
    const { buf } = await ENG.render(p, { mode: 'pat', sr, tail: 0 }); const d = buf.getChannelData(0);
    let zc = 0, a = Math.round(0.1 * sr), b = Math.round(0.4 * sr); for (let i2 = a; i2 < b; i2++) if (d[i2 - 1] <= 0 && d[i2] > 0) zc++;
    R.synth = { hz: +(zc / ((b - a) / sr)).toFixed(1), want: 440 }; }
  // 7. save file round trip (zip with project JSON and a user sample), and undo/redo
  { const smp = { ch: [new Float32Array([0, 0.5, -0.5, 0.25])], sr: 44100, name: 'tiny' };
    const blob = U.zip([{ name: 'project.json', data: new TextEncoder().encode(JSON.stringify(A.proj)) }, { name: 'samples/x.wav', data: U.encodeWav(smp.ch, smp.sr, 32) }]);
    const z = await U.unzip(blob); const back = JSON.parse(new TextDecoder().decode(z['project.json'])); const w = U.decodeWav(z['samples/x.wav']);
    R.file = { same: JSON.stringify(back) === JSON.stringify(A.proj), wav: Array.from(w.ch[0]), sr: w.sr }; }
  { const before = A.proj.bpm; A.setTempo(before + 10, true); const mid = A.proj.bpm; A.undo(); const u = A.proj.bpm; A.redo(); R.undo = { before, mid, afterUndo: u, afterRedo: A.proj.bpm }; }
  // 8. live transport runs and reports a moving position
  { A.proj.mode = 'pat'; A.play(); await new Promise((r) => setTimeout(r, 600)); const pos = A.eng.pos(); A.stop(); R.live = { pos: +(pos || 0).toFixed(2), ctx: A.eng.ctx.state }; }
  return R;
}
"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_function('window.EDK && document.querySelector(".crow")', timeout=20000)
    r = pg.evaluate(JS)
    print(json.dumps(r, indent=1)); print('errors:', errs or 'none')
    ok = (r['grid']['hits'] == r['grid']['want'] and r['grid']['maxErrSamples'] <= 1 and r['swing']['gap'] == r['swing']['want']
          and r['song']['kicks'] == [0, 16, 32] and r['song']['claps'] == [24] and r['song']['songLen'] == 48
          and r['mute']['mutedDb'] < -100 and r['mute']['onDb'] > -6 and abs(r['bass808']['hz'] - 110) < 3 and abs(r['synth']['hz'] - 440) < 4
          and r['file']['same'] and r['undo']['afterUndo'] == r['undo']['before'] and r['undo']['afterRedo'] == r['undo']['mid'] and r['live']['pos'] > 0.5 and not errs)
    print('PASS' if ok else 'FAIL'); b.close(); sys.exit(0 if ok else 1)
