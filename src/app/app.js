// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Josh Wilk. Part of Esperanza's Drum Kit; see LICENSE for terms (no warranty).
// Controller: owns the project, the engine and the history; top bar, files, keyboard, boot.
'use strict';
const A = { proj: null, eng: null, hist: new M.History(), MOTTO: 'The best part of breaking down.' };
const AUTOSAVE = 'edk.autosave.v1';

// every edit ends here: sound follows the model, history records it, the touched views redraw
A.change = (key, o) => {
  o = o || {};
  A.eng.sync(A.proj);
  if (o.quiet) return; // knob drag in progress: sound only
  A.hist.commit(A.proj, key);
  A.save();
  if (o.rack) RACK.render();
  if (o.pl) PL.render();
  if (o.top) A.updateTop();
  if (o.panel && PANEL.id) PANEL.open(PANEL.id);
};
A.saveNow = () => { try { localStorage.setItem(AUTOSAVE, JSON.stringify(A.proj)); } catch (e) { /* storage full or blocked */ } };
A.save = U.debounce(A.saveNow, 400);
// hand a file to the person: a download in browsers, Music/Esperanza's Drum Kit/ on Android (WebView has no downloads)
A.deliver = async (blob, name) => {
  // 1) Android app: chunked writes into Music/Esperanza's Drum Kit/ (WebView has no downloads)
  const br = window.EdkAndroid;
  if (br) {
    const u8 = new Uint8Array(await blob.arrayBuffer()), id = br.begin(name);
    if (id < 0) { UI.toast('Could not save ' + name); return; }
    const CH = 3 * 65536;
    for (let i = 0; i < u8.length; i += CH) { let s = ''; const part = u8.subarray(i, i + CH); for (let j = 0; j < part.length; j += 8192) s += String.fromCharCode.apply(null, part.subarray(j, j + 8192)); br.append(id, btoa(s)); }
    const path = br.finish(id); UI.toast(path ? 'Saved to Music/Esperanza\'s Drum Kit' : 'Could not save ' + name, 3000);
    return;
  }
  // 2) published Claude page: the downloads capability takes a short list of types, so audio and projects travel in a .zip
  const dl = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
  if (dl) {
    let fname = name, data = blob;
    if (!/\.(zip|json|txt|html|csv)$/i.test(name)) { fname = name + '.zip'; data = U.zip([{ name, data: new Uint8Array(await blob.arrayBuffer()) }]); }
    try { await dl.save({ filename: fname, data }); UI.toast('Saved ' + fname, 2500); }
    catch (e) { if (e && e.code !== 'declined') UI.toast('Saving is not available here: ' + (e.message || e.code)); }
    return;
  }
  // 3) any browser
  U.download(blob, name);
};
A.load = (proj) => {
  A.eng.stop();
  A.proj = M.migrate(proj); A.eng.sync(A.proj); A.hist.reset(A.proj);
  PANEL.close(); A.renderAll(); A.save();
};
A.renderAll = () => { A.updateTop(); RACK.render(); PL.render(); BROWSER.render(); };
A.undo = () => { const p = A.hist.undo(); if (p) { A.proj = M.migrate(p); A.eng.sync(A.proj); A.save(); A.renderAll(); if (PANEL.id) PANEL.open(PANEL.id); } };
A.redo = () => { const p = A.hist.redo(); if (p) { A.proj = M.migrate(p); A.eng.sync(A.proj); A.save(); A.renderAll(); if (PANEL.id) PANEL.open(PANEL.id); } };

// ---------------- channels ----------------
A.addSoundChannel = (sid, select) => {
  const p = A.proj, s = SOUND.byId(sid), user = ENG.userSamples.get(sid);
  const name = s ? (s.kind === 'drum' ? s.name : s.name) : user ? user.name : 'Sampler';
  const ch = M.newChannel(p, user ? { name, sample: sid, sound: null, p: SOUND.samplerParams(null), note: 60 } : { name, sound: sid, p: SOUND.samplerParams(sid), note: M.homeNote('sampler', sid) });
  p.channels.push(ch); if (select) p.sel = ch.id;
  A.change('addch', { rack: true });
  return ch;
};
A.addSynthChannel = (i) => {
  const p = A.proj, [name, params, note] = SOUND.SYNTHS[i];
  const ch = M.newChannel(p, { name, type: 'synth', sound: null, p: JSON.parse(JSON.stringify(params)), preset: i, note });
  p.channels.push(ch); p.sel = ch.id; A.change('addch', { rack: true });
  return ch;
};
A.setSound = (ch, sid) => {
  const user = ENG.userSamples.get(sid);
  if (ch.type !== 'sampler') { ch.type = 'sampler'; ch.p = SOUND.samplerParams(sid); }
  if (user) { ch.sample = sid; ch.sound = null; ch.p = Object.assign(ch.p, { root: 60, tune: 0 }); ch.name = user.name; }
  else { const keep = { a: ch.p.a, cut: ch.p.cut, res: ch.p.res }; ch.sample = null; ch.sound = sid; ch.p = Object.assign(SOUND.samplerParams(sid), keep); const s = SOUND.byId(sid); if (s) ch.name = s.name; ch.note = M.homeNote('sampler', sid); }
  A.change('sound', { rack: true });
  A.eng.preview(ch.id, ch.note || 60, M.DEF_VEL);
};
// decode a dropped or picked audio file into a user sample (kept in IndexedDB so autosave can bring it back)
A.loadSampleFile = async (file, target) => {
  try {
    const ab = await A.eng.ctx.decodeAudioData(await file.arrayBuffer());
    const ch = []; for (let c = 0; c < Math.min(2, ab.numberOfChannels); c++) ch.push(new Float32Array(ab.getChannelData(c)));
    const id = U.uid('s'), name = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
    ENG.userSamples.set(id, { ch, sr: ab.sampleRate, name });
    A.storeSample(id);
    if (target) A.setSound(target, id); else A.addSoundChannel(id, true);
    BROWSER.render();
  } catch (e) { UI.toast('Could not read ' + file.name); }
};
A.storeSample = (id) => { const s = ENG.userSamples.get(id); if (s) U.idb.put('buffers', id, { ch: s.ch, sr: s.sr, name: s.name }).catch(() => {}); };
A.restoreSamples = async (proj) => {
  for (const ch of proj.channels) if (ch.sample && !ENG.userSamples.has(ch.sample)) {
    try { const s = await U.idb.get('buffers', ch.sample); if (s) ENG.userSamples.set(ch.sample, s); } catch (e) { /* missing */ }
  }
};

// ---------------- patterns ----------------
A.setPattern = (id) => { A.proj.cur = id; A.change('cur', { rack: true, pl: true, top: true }); };
A.stepPattern = (d) => { const ps = A.proj.patterns, i = ps.findIndex((x) => x.id === A.proj.cur); if (i + d >= 0 && i + d < ps.length) A.setPattern(ps[i + d].id); else if (d > 0) A.newPattern(); };
A.newPattern = () => { const pt = M.newPattern(A.proj); A.proj.patterns.push(pt); A.setPattern(pt.id); };
A.patMenu = (x, y) => {
  const p = A.proj, cur = M.pat(p);
  UI.menu(x, y, [
    ...p.patterns.map((pt) => [(pt.id === p.cur ? '● ' : '   ') + pt.name, () => A.setPattern(pt.id)]),
    'hr',
    ['New pattern', A.newPattern],
    ['Clone pattern', () => { const c = JSON.parse(JSON.stringify(cur)); c.id = U.uid('p'); c.name = cur.name + ' copy'; p.patterns.push(c); A.setPattern(c.id); }],
    ['Rename…', async () => { const n = await UI.ask('Pattern name', cur.name); if (n) { cur.name = n.slice(0, 40); A.change('pname', { top: true, pl: true }); } }],
    ['Delete pattern', () => {
      if (p.patterns.length < 2) { UI.toast('A project keeps at least one pattern'); return; }
      p.patterns = p.patterns.filter((x) => x !== cur); p.playlist.clips = p.playlist.clips.filter((c) => c.pat !== cur.id); p.cur = p.patterns[0].id;
      A.change('pdel', { rack: true, pl: true, top: true });
    }],
  ]);
};

// ---------------- transport ----------------
A.togglePlay = () => { if (A.eng.playing) A.stop(); else A.play(); };
A.play = () => {
  const p = A.proj; let from = 0;
  if (p.mode === 'song') { from = PL.songPos; const lp = p.loop; if (lp.on && (from < lp.start || from >= lp.start + lp.len)) from = lp.start; }
  A.eng.play(from); A.updateTop();
};
A.stop = () => { A.eng.stop(); RACK.showNow(-1); PL.showHead(null); A.updateTop(); A.showTime(null); };
A.setMode = (m) => { A.proj.mode = m; A.change('mode', { top: true }); if (A.eng.playing) A.play(); };
A.setTempo = (bpm, done) => { bpm = Math.round(U.clamp(bpm, 10, 522) * 1000) / 1000; A.eng.retempo(bpm); A.proj.bpm = bpm; UI.$('#tempo span').textContent = bpm.toFixed(3); A.change('bpm', { quiet: !done }); };
A.showTime = (pos) => {
  const el = UI.$('#time'); if (!el) return;
  if (pos === null) pos = A.proj.mode === 'song' ? PL.songPos : 0;
  if (A.proj.mode === 'pat') pos = pos % M.pat(A.proj).len; else pos = ENG.songPos(A.proj, Math.floor(pos));
  const k = Math.max(0, Math.floor(pos));
  el.lastChild.textContent = `${Math.floor(k / 16) + 1}:${String(Math.floor(k / 4) % 4 + 1)}:${String(k % 4 + 1)}`;
};
A.frame = () => {
  const pos = A.eng.pos();
  if (pos !== null && pos >= 0) {
    const p = A.proj, k = Math.floor(pos);
    let col = -1;
    if (p.mode === 'pat') col = k % M.pat(p).len;
    else { const sl = ENG.slicesAt(p, k, 'song').find((x) => x.pat.id === p.cur); col = sl ? sl.ps : -1; }
    RACK.showNow(col); PL.showHead(pos); A.showTime(pos);
  }
  A.drawMeter();
  requestAnimationFrame(A.frame);
};
A.meterHold = [0, 0];
A.drawMeter = () => {
  const cv = UI.$('#meter'); if (!cv || !cv.offsetParent) return;
  const dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const pk = A.eng.peak();
  for (let i = 0; i < 2; i++) {
    A.meterHold[i] = Math.max(pk[i], A.meterHold[i] * 0.92);
    const db = 20 * Math.log10(A.meterHold[i] + 1e-9), n = U.clamp((db + 48) / 48, 0, 1);
    const y = 5 + i * 11, ww = (w - 8) * n, red = (w - 8) * (42 / 48);
    g.fillStyle = 'rgba(26,22,17,0.12)'; g.fillRect(4, y, w - 8, 8);
    g.fillStyle = '#1a1611'; g.fillRect(4, y, Math.min(ww, red), 8);
    if (ww > red) { g.fillStyle = '#c8231b'; g.fillRect(4 + red, y, ww - red, 8); }
  }
};

// ---------------- files ----------------
A.fileName = () => (A.proj.name || 'Untitled').replace(/[^\w\- ]+/g, '').trim() || 'Untitled';
A.saveFile = () => {
  const files = [{ name: 'project.json', data: new TextEncoder().encode(JSON.stringify(A.proj)) }];
  const used = new Set(A.proj.channels.map((c) => c.sample).filter(Boolean));
  for (const id of used) { const s = ENG.userSamples.get(id); if (s) files.push({ name: 'samples/' + id + '.wav', data: U.encodeWav(s.ch, s.sr, 32) }); files.push({ name: 'samples/' + id + '.txt', data: new TextEncoder().encode(s ? s.name : id) }); }
  A.deliver(U.zip(files), A.fileName() + '.edk');
};
A.openFile = async () => {
  const [f] = await U.pickFile('.edk,.zip,application/zip'); if (!f) return;
  try {
    let z = await U.unzip(f);
    if (!z['project.json']) { const inner = Object.keys(z).find((n) => /\.edk$/i.test(n)); if (inner) z = await U.unzip(z[inner]); }
    const proj = JSON.parse(new TextDecoder().decode(z['project.json']));
    for (const name in z) {
      const m = /^samples\/(.+)\.wav$/.exec(name); if (!m) continue;
      const w = U.decodeWav(z[name]); const label = z['samples/' + m[1] + '.txt'];
      if (w) { ENG.userSamples.set(m[1], { ch: w.ch, sr: w.sr, name: label ? new TextDecoder().decode(label) : m[1] }); A.storeSample(m[1]); }
    }
    proj.name = proj.name && proj.name !== 'Untitled' ? proj.name : f.name.replace(/(\.edk)?(\.zip)?$/i, '');
    A.load(proj); UI.toast('Opened ' + f.name);
  } catch (e) { UI.toast('That file could not be opened'); }
};
// scope: 'song' | 'pat' | 'section' (with sec); fmt: 'wav' (24-bit) | 'mp3' (320 kbps)
A.exportAudio = async (scope, fmt, sec) => {
  const p = A.proj;
  if (scope === 'song' && !p.playlist.clips.length) { UI.toast('The playlist is empty: place a pattern first, or export the pattern'); return; }
  UI.toast('Rendering…', 1500);
  const opts = { sr: A.eng.sr, tail: 1.5 };
  if (scope === 'section') { opts.range = { start: sec.start, len: sec.len }; opts.tail = 0.5; } else opts.mode = scope;
  const { buf } = await ENG.render(p, opts);
  const ch = [buf.getChannelData(0), buf.getChannelData(1)];
  const name = A.fileName() + (scope === 'pat' ? ' - ' + M.pat(p).name : scope === 'section' ? ' - ' + sec.name : '');
  if (fmt === 'mp3') A.deliver(await A.encodeMp3(ch, buf.sampleRate, 320), name + '.mp3');
  else A.deliver(new Blob([U.encodeWav(ch, buf.sampleRate, 24)], { type: 'audio/wav' }), name + '.wav');
};
A.exportWav = (mode) => A.exportAudio(mode, 'wav');
// MP3 with the bundled LAME port (lamejs, LGPL); encoded in slices so the screen stays responsive
A.encodeMp3 = async (ch, sr, kbps) => {
  if (typeof lamejs === 'undefined') throw new Error('MP3 encoder missing');
  const rate = [48000, 44100, 32000].includes(sr) ? sr : 44100;
  if (rate !== sr) { // resample to a rate MP3 supports
    const oc = new OfflineAudioContext(2, Math.ceil(ch[0].length * rate / sr), rate), b = oc.createBuffer(2, ch[0].length, sr);
    b.copyToChannel(ch[0], 0); b.copyToChannel(ch[1], 1); const src = oc.createBufferSource(); src.buffer = b; src.connect(oc.destination); src.start();
    const r = await oc.startRendering(); ch = [r.getChannelData(0), r.getChannelData(1)];
  }
  const enc = new lamejs.Mp3Encoder(2, rate, kbps), n = ch[0].length, parts = [], B = 1152;
  const toI16 = (f, a, z) => { const o = new Int16Array(z - a); for (let i = a; i < z; i++) { const v = Math.max(-1, Math.min(1, f[i])); o[i - a] = v < 0 ? v * 32768 : v * 32767; } return o; };
  for (let i = 0; i < n; i += B * 200) {
    const z = Math.min(n, i + B * 200), L = toI16(ch[0], i, z), R = toI16(ch[1], i, z);
    for (let j = 0; j < L.length; j += B) { const d = enc.encodeBuffer(L.subarray(j, j + B), R.subarray(j, j + B)); if (d.length) parts.push(new Uint8Array(d)); }
    await new Promise((r) => setTimeout(r, 0));
  }
  const tail = enc.flush(); if (tail.length) parts.push(new Uint8Array(tail));
  return new Blob(parts, { type: 'audio/mpeg' });
};
A.demo = () => {
  const p = M.newProject(); p.name = 'Morning Demo'; p.bpm = 92; p.swing = 0.35;
  const [kick, clap, hat, snare] = p.channels; const pat = p.patterns[0]; pat.name = 'Beat';
  const on = (ch, steps, v) => steps.forEach((s) => M.setCell(pat, ch.id, s, { v: v || M.DEF_VEL, n: 60, g: 1 }));
  on(kick, [0, 7, 10]); on(clap, [4, 12]); on(hat, [0, 2, 4, 6, 8, 10, 12, 14]); on(hat, [3, 11], 0.45); on(snare, [15], 0.5);
  const bass = M.newChannel(p, { name: '808 Long', sound: 'bass/808long', p: SOUND.samplerParams('bass/808long'), note: 36 }); p.channels.push(bass);
  [[0, 36], [7, 36], [10, 39]].forEach(([s, n]) => M.setCell(pat, bass.id, s, { v: M.DEF_VEL, n, g: 3 }));
  const b2 = M.newPattern(p); b2.name = 'Break'; p.patterns.push(b2);
  [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => M.setCell(b2, hat.id, s, { v: 0.6, n: 60, g: 1 })); M.setCell(b2, clap.id, 12, { v: M.DEF_VEL, n: 60, g: 1 });
  p.playlist.clips = [{ id: U.uid('k'), pat: pat.id, track: 0, start: 0, len: 48 }, { id: U.uid('k'), pat: b2.id, track: 0, start: 48, len: 16 }];
  A.load(p);
};

// ---------------- top bar ----------------
A.buildTop = () => {
  UI.$('#top').innerHTML = `
    <div class="brand">${UI.ICONS.cup}<div class="wordmark"><b>Esperanza's</b><small>DRUM KIT</small></div></div>
    <div class="motto">${UI.esc(A.MOTTO)}</div>
    <div class="grp"><button class="btn" id="fileBtn">File</button><button class="btn icon hide-phone" id="undoBtn" title="Undo (Ctrl+Z)">${UI.ICONS.undo}</button><button class="btn icon hide-phone" id="redoBtn" title="Redo (Ctrl+Y)">${UI.ICONS.redo}</button></div>
    <div class="sep hide-phone"></div>
    <div class="grp"><div class="seg" role="group" aria-label="Play mode"><button id="mPat">PAT</button><button id="mSong">SONG</button></div>
      <button class="tbtn play" id="playBtn" aria-label="Play (Space)">${UI.ICONS.play}</button><button class="tbtn" id="stopBtn" aria-label="Stop">${UI.ICONS.stop}</button>
      <button class="tbtn rec hide-phone" id="recBtn" disabled title="Recording arrives in 0.7">${UI.ICONS.rec}</button></div>
    <div class="lcd tempo" id="tempo" title="Tempo: drag up/down, wheel, double-click to type"><small>TEMPO</small><span></span></div>
    <div class="lcd" id="time"><small>BAR:BEAT:STEP</small><span>1:1:1</span></div>
    <div class="patsel"><button class="btn icon" id="patPrev" aria-label="Previous pattern">‹</button><button class="name" id="patName"><span class="dot"></span><span class="lab"></span></button><button class="btn icon" id="patNext" aria-label="Next pattern (or new)">›</button></div>
    <div class="grow"></div>
    <div class="grp views"><button class="btn" id="vBrowser" title="Browser (Alt+F8)">Sounds</button><button class="btn" id="vRack" title="Channel rack (F6)">Rack</button><button class="btn" id="vPl" title="Playlist (F5)">Playlist</button></div>
    <canvas id="meter" aria-hidden="true"></canvas>
    <div class="kwrap hide-phone" id="masterK"></div>`;
  UI.$('#masterK').innerHTML = UI.knobLabeled('Master', { min: 0, max: 1.25, def: 0.8, get: () => A.proj.master.vol, set: (v, d) => { A.proj.master.vol = v; A.change('mvol', { quiet: !d }); }, fmt: (v) => Math.round(v * 100) + '%' });
  UI.$('#playBtn').onclick = A.togglePlay; UI.$('#stopBtn').onclick = A.stop;
  UI.$('#mPat').onclick = () => A.setMode('pat'); UI.$('#mSong').onclick = () => A.setMode('song');
  UI.$('#undoBtn').onclick = A.undo; UI.$('#redoBtn').onclick = A.redo;
  UI.$('#patPrev').onclick = () => A.stepPattern(-1); UI.$('#patNext').onclick = () => A.stepPattern(1);
  UI.$('#patName').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); A.patMenu(r.left, r.bottom + 4); };
  UI.$('#fileBtn').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); A.fileMenu(r.left, r.bottom + 4); };
  UI.$('#vBrowser').onclick = () => A.toggleWin('browser'); UI.$('#vRack').onclick = () => A.toggleWin('rack'); UI.$('#vPl').onclick = () => A.toggleWin('playlist');
  // tempo: drag, wheel, double-click to type
  const t = UI.$('#tempo');
  t.addEventListener('pointerdown', (e) => {
    e.preventDefault(); t.setPointerCapture(e.pointerId); let y = e.clientY, v = A.proj.bpm;
    const mv = (ev) => { v += (y - ev.clientY) * (ev.shiftKey ? 0.05 : 0.5); y = ev.clientY; A.setTempo(ev.shiftKey ? v : Math.round(v), false); };
    const up = () => { t.removeEventListener('pointermove', mv); t.removeEventListener('pointerup', up); A.setTempo(A.proj.bpm, true); };
    t.addEventListener('pointermove', mv); t.addEventListener('pointerup', up);
  });
  t.addEventListener('wheel', (e) => { e.preventDefault(); A.setTempo(A.proj.bpm - Math.sign(e.deltaY) * (e.shiftKey ? 0.1 : 1), true); }, { passive: false });
  t.addEventListener('dblclick', async () => { const v = parseFloat(await UI.ask('Tempo (BPM)', A.proj.bpm, { number: true })); if (v) A.setTempo(v, true); });
};
A.updateTop = () => {
  const p = A.proj, pat = M.pat(p);
  UI.$('#mPat').classList.toggle('on', p.mode === 'pat'); UI.$('#mSong').classList.toggle('on', p.mode === 'song');
  UI.$('#playBtn').classList.toggle('on', A.eng.playing);
  UI.$('#tempo span').textContent = p.bpm.toFixed(3);
  UI.$('#patName .dot').style.background = pat.color; UI.$('#patName .lab').textContent = pat.name;
  UI.$('#rackPat').textContent = pat.name;
  const masterK = UI.$('#masterK .knob'); if (masterK) UI.refreshKnob(masterK);
  A.showTime(A.eng.playing ? A.eng.pos() || 0 : null);
};
A.fileMenu = (x, y) => UI.menu(x, y, [
  ['New project', async () => { if (await UI.confirm('Start a new project?', 'Anything not saved to a file in this one will be lost.', 'Start new')) A.load(M.newProject()); }],
  ['Open…', A.openFile], ['Save as .edk', A.saveFile],
  'hr',
  ['Export song as WAV', () => A.exportAudio('song', 'wav')], ['Export song as MP3', () => A.exportAudio('song', 'mp3')],
  ['Export pattern as WAV', () => A.exportAudio('pat', 'wav')], ['Export pattern as MP3', () => A.exportAudio('pat', 'mp3')],
  'hr',
  ['Load the demo beat', async () => { if (await UI.confirm('Load the demo beat?', 'It replaces the project you have open.', 'Load demo')) A.demo(); }],
  ['Rename project…', async () => { const n = await UI.ask('Project name', A.proj.name); if (n) { A.proj.name = n.slice(0, 60); A.change('pname'); } }],
  [document.body.classList.contains('flat') ? 'Turn TV texture on' : 'Turn TV texture off', () => { document.body.classList.toggle('flat'); try { localStorage.setItem('edk.flat', document.body.classList.contains('flat') ? '1' : ''); } catch (e) { /* */ } }],
  ['About', A.about],
]);
A.about = () => UI.menu(innerWidth / 2 - 150, 120, [[`Esperanza's Drum Kit ${M.VERSION} · free software (GPL-3.0-or-later) · no tracking, no network`, () => {}], ['A DAWters and Son studio · fonts: Yesteryear, Oswald, Courier Prime, Alfa Slab One (SIL OFL 1.1)', () => {}]]);

// desktop: show/hide windows; phone: one view at a time from the bottom tabs
A.toggleWin = (w) => { if (innerWidth <= 760) { A.view(w === 'browser' ? 'sounds' : w); return; } document.body.classList.toggle('hide-' + w); A.syncViewBtns(); };
A.syncViewBtns = () => { [['vBrowser', 'browser'], ['vRack', 'rack'], ['vPl', 'playlist']].forEach(([b, w]) => UI.$('#' + b).classList.toggle('on', !document.body.classList.contains('hide-' + w))); };
A.view = (v) => { document.body.classList.remove('v-sounds', 'v-rack', 'v-playlist'); document.body.classList.add('v-' + v); UI.$$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === v)); if (v === 'playlist') PL.render(); };

A.keys = (e) => {
  if (e.target.closest('input, select, textarea') || UI.$('.dlg-back')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (e.code === 'Space') { e.preventDefault(); A.togglePlay(); }
  else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) A.redo(); else A.undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); A.redo(); }
  else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); A.saveFile(); }
  else if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); A.openFile(); }
  else if (!mod && e.key.toLowerCase() === 'l') A.setMode(A.proj.mode === 'pat' ? 'song' : 'pat');
  else if (e.key === 'F6') { e.preventDefault(); A.toggleWin('rack'); }
  else if (e.key === 'F5') { e.preventDefault(); A.toggleWin('playlist'); }
  else if (e.key === 'F8' && e.altKey) { e.preventDefault(); A.toggleWin('browser'); }
  else if (e.code === 'NumpadAdd' || (e.key === ']' && !mod)) A.stepPattern(1);
  else if (e.code === 'NumpadSubtract' || (e.key === '[' && !mod)) A.stepPattern(-1);
  else if (e.key === 'Escape') { UI.closeMenu(); PANEL.close(); }
};

// ---------------- boot ----------------
A.boot = async () => {
  UI.initKnobs();
  try { if (localStorage.getItem('edk.flat')) document.body.classList.add('flat'); } catch (e) { /* */ }
  A.eng = new ENG.Engine();
  await A.eng.init();
  await SOUND.render(A.eng.sr);
  let proj = null;
  try { const s = localStorage.getItem(AUTOSAVE); if (s) proj = JSON.parse(s); } catch (e) { proj = null; }
  if (proj) { try { await A.restoreSamples(proj); proj = M.migrate(proj); } catch (e) { proj = null; } }
  A.proj = proj || M.newProject();
  A.eng.sync(A.proj); A.hist.reset(A.proj);
  A.eng.onPos = () => {};
  A.buildTop(); RACK.init(); PL.init(); BROWSER.init();
  A.renderAll(); A.syncViewBtns(); A.view('rack');
  UI.$$('#tabs button').forEach((b) => (b.onclick = () => A.view(b.dataset.v)));
  document.addEventListener('keydown', A.keys);
  addEventListener('resize', U.debounce(() => PL.render(), 200));
  requestAnimationFrame(A.frame);
  window.EDK = A; // handle for tests and the console
  const sp = UI.$('#splash'); UI.$('#splashGo').disabled = false; UI.$('#splashGo').textContent = 'Start';
  const go = () => { A.eng.resume(); sp.classList.add('gone'); setTimeout(() => sp.remove(), 450); };
  UI.$('#splashGo').onclick = go;
  if (/[?&]nosplash/.test(location.search)) go();
};
A.bootFail = (e) => {
  console.error(e);
  const sp = UI.$('#splash'); if (!sp) return;
  const fileOpen = location.protocol === 'file:' || location.origin === 'null';
  sp.querySelector('p').textContent = fileOpen
    ? 'This browser will not start the audio engine from a file opened directly. Open the app from its web link, run the "Start" launcher in the web folder, or use Chrome or Edge.'
    : 'The audio engine could not start in this browser (' + (e && e.message ? e.message : e) + '). Try a current Chrome, Edge, Firefox or Safari.';
  const g = UI.$('#splashGo'); if (g) { g.textContent = 'Audio unavailable'; g.disabled = true; }
};
const startApp = () => A.boot().catch(A.bootFail);
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', startApp); else startApp();
