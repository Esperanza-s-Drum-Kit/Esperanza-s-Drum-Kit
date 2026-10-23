# 0.2 acceptance: loop region, sections (duplicate, export range), MP3 round trip, Feel in a render,
# sample tools, and recording a sample through Chromium's fake microphone.
import os, json, sys
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dist', 'edk.html') + '?nosplash'
JS = r"""async () => {
  const R = {}, A = window.EDK, sr = 48000;
  // loop region: steps past the loop end wrap back to its start
  { const p = M.newProject(); p.playlist.clips = [{ id: 'a', pat: p.patterns[0].id, track: 0, start: 0, len: 128 }]; p.loop = { on: true, start: 32, len: 32 };
    R.loop = [0, 31, 32, 63, 64, 70, 100].map((k) => ENG.songPos(p, k)); }
  // sections: duplicate inserts a copy with its clips and pushes later material right; a section renders only its own bars
  { const p = M.newProject(); const k = p.channels[0], pat = p.patterns[0]; M.setCell(pat, k.id, 0, M.newCell(k));
    p.sections = [M.newSection(p, 'Intro', 0, 32), M.newSection(p, 'Chorus', 32, 32)];
    p.playlist.clips = [{ id: 'a', pat: pat.id, track: 0, start: 0, len: 32 }, { id: 'b', pat: pat.id, track: 1, start: 32, len: 16 }];
    A.load(p); PL.secMenu(A.proj.sections[0].id, 10, 10);
    const dup = [...document.querySelectorAll('.menu button')].find((b) => /Duplicate/.test(b.textContent)); dup.click();
    R.sections = { names: A.proj.sections.map((s) => s.name + '@' + s.start), clips: A.proj.playlist.clips.map((c) => c.track + ':' + c.start).sort() };
    const { buf } = await ENG.render(A.proj, { range: { start: 32, len: 32 }, sr, tail: 0 });
    R.sectionRender = { seconds: +(buf.length / sr).toFixed(3), want: +(32 * ENG.stepDur(A.proj.bpm)).toFixed(3) }; }
  // MP3: encode a rendered beat, decode it back, compare length and loudness
  { const p = M.newProject(); p.bpm = 120; const k = p.channels[0]; [0, 4, 8, 12].forEach((s) => M.setCell(p.patterns[0], k.id, s, M.newCell(k)));
    const { buf } = await ENG.render(p, { mode: 'pat', loops: 2, sr, tail: 0.2 });
    const blob = await A.encodeMp3([buf.getChannelData(0), buf.getChannelData(1)], sr, 320);
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const back = await A.eng.ctx.decodeAudioData(await blob.arrayBuffer());
    const pk = (b) => { let m = 0; const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return 20 * Math.log10(m); };
    R.mp3 = { kb: Math.round(blob.size / 1024), frameSync: head[0] === 0xff && (head[1] & 0xe0) === 0xe0, secIn: +(buf.length / sr).toFixed(2), secOut: +back.duration.toFixed(2), peakIn: +pk(buf).toFixed(1), peakOut: +pk(back).toFixed(1) }; }
  // Feel in a real render: a laid-back clap lands later than the grid; Machine lands on it
  { const mk = (feel) => { const p = M.newProject(); p.bpm = 100; p.channels = [p.channels[1]]; const c = p.channels[0]; c.p.d = 0.03; c.p.s = 0; M.setCell(p.patterns[0], c.id, 4, M.newCell(c)); M.setCell(p.patterns[0], c.id, 12, M.newCell(c)); p.feel = Object.assign(ENG.defFeel(), feel); return p; };
    const onset = (b) => { const d = b.getChannelData(0), out = []; let q = 99999; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]) > 1e-3; if (a && q > 3000) out.push(i); q = a ? 0 : q + 1; } return out; };
    const g = (await ENG.render(mk(ENG.FEEL_PRESETS[0][1]), { mode: 'pat', sr, tail: 0 })).buf, l = (await ENG.render(mk(ENG.FEEL_PRESETS[3][1]), { mode: 'pat', sr, tail: 0 })).buf;
    const a = onset(g), b = onset(l); R.feelRender = { machine: a, laidBack: b, lateMs: b.map((x, i) => +((x - a[i]) / sr * 1000).toFixed(1)) }; }
  // sample tools: reverse really reverses; fit makes a 1-bar loop last one bar
  { const p = M.newProject(); A.load(p); const ch = A.proj.channels[0]; const src = ENG.sampleFor(ch).ch[0];
    SMP.edit(ch, SMP.reverse, 'rev'); const rv = ENG.sampleFor(ch).ch[0];
    R.reverse = { sameLen: rv.length === src.length, mirrored: Math.abs(rv[0] - src[src.length - 1]) < 1e-7 && Math.abs(rv[rv.length - 1] - src[0]) < 1e-7, nowUser: !!ch.sample };
    SMP.fit(ch, 1); const s = ENG.sampleFor(ch), rate = Math.pow(2, ch.p.tune / 1200);
    R.fit = { playedSec: +(s.ch[0].length / s.sr / rate).toFixed(3), barSec: +(16 * ENG.stepDur(A.proj.bpm)).toFixed(3) }; }
  return R; }"""
REC = r"""async () => {
  REC.open(); await REC.start(); await new Promise((r) => setTimeout(r, 1500)); REC.stop();
  for (let i = 0; i < 40 && !REC.take; i++) await new Promise((r) => setTimeout(r, 100));
  const take = REC.take; const n0 = EDK.proj.channels.length;
  document.querySelector('#recName').value = 'Test beep'; document.querySelector('#recAdd').click();
  const ch = EDK.proj.channels.at(-1);
  return { seconds: take ? +(take.ch[0].length / take.sr).toFixed(2) : 0, peakDb: take ? +(20 * Math.log10(SMP.peak(take))).toFixed(1) : null, channelAdded: EDK.proj.channels.length === n0 + 1, name: ch.name, hasSample: !!ENG.userSamples.get(ch.sample) };
}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])
    ctx = b.new_context(permissions=['microphone']); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_function('window.EDK && document.querySelector(".crow")', timeout=20000)
    r = pg.evaluate(JS); r['record'] = pg.evaluate(REC)
    for k, v in r.items(): print(k.ljust(14), json.dumps(v))
    print('errors:', errs or 'none')
    ok = (r['loop'] == [0, 31, 32, 63, 32, 38, 36] and r['sections']['names'] == ['Intro@0', 'Intro 2@32', 'Chorus@64']
          and r['sections']['clips'] == ['0:0', '0:32', '1:64'] and abs(r['sectionRender']['seconds'] - r['sectionRender']['want']) < 0.001
          and r['mp3']['frameSync'] and abs(r['mp3']['secOut'] - r['mp3']['secIn']) < 0.1 and abs(r['mp3']['peakOut'] - r['mp3']['peakIn']) < 1.5
          and all(5 <= x <= 22 for x in r['feelRender']['lateMs']) and r['reverse']['mirrored'] and r['reverse']['nowUser']
          and abs(r['fit']['playedSec'] - r['fit']['barSec']) < 0.01 and r['record']['channelAdded'] and r['record']['hasSample'] and r['record']['seconds'] > 0.5 and not errs)
    print('PASS' if ok else 'FAIL'); b.close(); sys.exit(0 if ok else 1)
