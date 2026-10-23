// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Josh Wilk. Part of Esperanza's Drum Kit; see LICENSE for terms (no warranty).
// Make your own samples: record from the microphone, trim the silence, name it, drop it in the rack.
// Plus the sample tools every sampler channel gets: reverse, normalize, fit to tempo.
'use strict';
const REC = { stream: null, node: null, chunks: [], take: null, level: 0 };

REC.open = () => {
  if (UI.$('#recDlg')) return;
  const d = document.createElement('div'); d.className = 'dlg-back'; d.id = 'recDlg';
  d.innerHTML = `<div class="dlg rec" role="dialog" aria-label="Record a sample">
    <h3>Record a sample</h3>
    <canvas id="recWave" height="90"></canvas>
    <div class="recrow"><button class="tbtn rec" id="recGo" aria-label="Record">${UI.ICONS.rec}</button><span class="lcd" id="recTime">0.0 s</span>
      <label class="chk"><input type="checkbox" id="recBeat"> Play the beat while recording</label></div>
    <div class="recrow hidden" id="recAfter"><input id="recName" value="My sample" aria-label="Sample name"><button class="btn" id="recPlay">Play</button><button class="btn" id="recAgain">Retake</button></div>
    <p class="sub" id="recMsg">Tap the red button and make a sound: a clap, a voice, a pot lid. Silence at the start and end is trimmed.</p>
    <div class="dlg-btns"><button class="btn" id="recCancel">Cancel</button><button class="btn on" id="recAdd" disabled>Add to the rack</button></div></div>`;
  document.body.appendChild(d);
  UI.$('#recGo').onclick = () => (REC.node ? REC.stop() : REC.start());
  UI.$('#recCancel').onclick = REC.close;
  UI.$('#recAgain').onclick = () => { REC.take = null; UI.$('#recAfter').classList.add('hidden'); UI.$('#recAdd').disabled = true; REC.draw(); REC.start(); };
  UI.$('#recPlay').onclick = () => { if (REC.take) { const id = '_rec_preview'; ENG.userSamples.set(id, REC.take); A.eng.previewSound(id); } };
  UI.$('#recAdd').onclick = () => {
    if (!REC.take) return;
    const id = U.uid('s'); ENG.userSamples.set(id, Object.assign({}, REC.take, { name: (UI.$('#recName').value || 'My sample').slice(0, 40) }));
    ENG.userSamples.delete('_rec_preview'); A.storeSample(id); A.addSoundChannel(id, true); BROWSER.render(); REC.close();
  };
  REC.draw();
};
REC.close = () => { REC.stopStream(); ENG.userSamples.delete('_rec_preview'); const d = UI.$('#recDlg'); if (d) d.remove(); if (A.eng.playing) A.stop(); };
REC.stopStream = () => { if (REC.stream) REC.stream.getTracks().forEach((t) => t.stop()); REC.stream = null; if (REC.node) { try { REC.node.disconnect(); } catch (e) { /* */ } } REC.node = null; };

REC.start = async () => {
  const msg = UI.$('#recMsg');
  try {
    await A.eng.resume();
    REC.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) {
    msg.textContent = 'The microphone is not available here (' + (e.name || e.message) + '). In the Android app allow the microphone when asked; in a browser use the app\'s own page or the local launcher.';
    return;
  }
  const ctx = A.eng.ctx, src = ctx.createMediaStreamSource(REC.stream);
  const node = new AudioWorkletNode(ctx, 'ds-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit' });
  const sink = ctx.createGain(); sink.gain.value = 0; src.connect(node); node.connect(sink); sink.connect(ctx.destination);
  REC.node = node; REC.chunks = []; REC.t0 = ctx.currentTime;
  node.port.onmessage = (e) => {
    const m = e.data;
    if (m.t === 'lvl') REC.level = Math.max(...m.pk);
    else if (m.t === 'chunk') { REC.chunks.push(m.ch); REC.draw(); }
    else if (m.t === 'stopped') REC.finish();
  };
  node.port.postMessage({ type: 'start', at: Math.round(ctx.currentTime * ctx.sampleRate) });
  if (UI.$('#recBeat').checked && !A.eng.playing) A.play();
  UI.$('#recGo').classList.add('on'); UI.$('#recGo').innerHTML = UI.ICONS.stop; msg.textContent = 'Recording… tap again to stop.';
  const tick = () => { if (!REC.node) return; UI.$('#recTime').textContent = (ctx.currentTime - REC.t0).toFixed(1) + ' s'; REC.draw(); requestAnimationFrame(tick); };
  tick();
  REC.limit = setTimeout(() => { if (REC.node) REC.stop(); }, 60000); // one minute per take
};
REC.stop = () => { clearTimeout(REC.limit); if (REC.node) REC.node.port.postMessage({ type: 'stop' }); if (A.eng.playing) A.stop(); };
REC.finish = () => {
  REC.stopStream();
  UI.$('#recGo').classList.remove('on'); UI.$('#recGo').innerHTML = UI.ICONS.rec;
  const nch = REC.chunks.length ? REC.chunks[0].length : 0;
  const len = REC.chunks.reduce((a, c) => a + c[0].length, 0);
  if (!len) { UI.$('#recMsg').textContent = 'Nothing was recorded. Try again.'; return; }
  const ch = Array.from({ length: Math.min(2, nch) }, () => new Float32Array(len));
  let o = 0; for (const c of REC.chunks) { for (let k = 0; k < ch.length; k++) ch[k].set(c[k], o); o += c[0].length; }
  const take = SMP.trim({ ch, sr: A.eng.sr }, -42);
  if (!take) { UI.$('#recMsg').textContent = 'That was silent. Check the microphone and try again.'; return; }
  REC.take = SMP.normalize(take);
  UI.$('#recAfter').classList.remove('hidden'); UI.$('#recAdd').disabled = false;
  UI.$('#recMsg').textContent = 'Trimmed to ' + (REC.take.ch[0].length / REC.take.sr).toFixed(2) + ' s and levelled. Name it and add it, or retake.';
  REC.draw();
};
REC.draw = () => {
  const cv = UI.$('#recWave'); if (!cv) return;
  const w = cv.clientWidth || 300, h = 90, dpr = devicePixelRatio || 1; if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#0d0705'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#3a2619'; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  const d = REC.take ? REC.take.ch[0] : REC.chunks.length ? REC.chunks.map((c) => c[0]) : null;
  if (!d) { // idle: live level bar
    g.fillStyle = '#d99a2b'; g.fillRect(0, h - 6, w * Math.min(1, REC.level * 1.4), 6); REC.level *= 0.9; return;
  }
  const flat = Array.isArray(d) ? (() => { const n = d.reduce((a, c) => a + c.length, 0), f = new Float32Array(n); let o = 0; d.forEach((c) => { f.set(c, o); o += c.length; }); return f; })() : d;
  const per = Math.max(1, Math.floor(flat.length / w)); g.fillStyle = REC.take ? '#f0c46a' : '#c4382a';
  for (let x = 0; x < w && x * per < flat.length; x++) { let m = 0; for (let i = x * per; i < Math.min(flat.length, (x + 1) * per); i++) m = Math.max(m, Math.abs(flat[i])); const y = m * h * 0.48; g.fillRect(x, h / 2 - y, 1, Math.max(1, y * 2)); }
};

// ---------------- sample tools ----------------
const SMP = {};
SMP.copy = (s) => ({ ch: s.ch.map((c) => new Float32Array(c)), sr: s.sr, name: s.name });
SMP.peak = (s) => { let m = 0; for (const c of s.ch) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > m) m = a; } return m; };
// cut silence below `db` (relative to the peak) off both ends, keeping 5 ms before and a 40 ms tail, with short fades
SMP.trim = (s, db) => {
  const pk = SMP.peak(s); if (pk < 0.002) return null;
  const thr = pk * Math.pow(10, db / 20), L = s.ch[0], n = L.length, hot = (i) => s.ch.some((c) => Math.abs(c[i]) > thr);
  let a = 0; while (a < n && !hot(a)) a++;
  let z = n - 1; while (z > a && !hot(z)) z--;
  a = Math.max(0, a - Math.round(s.sr * 0.005)); z = Math.min(n, z + Math.round(s.sr * 0.04));
  const out = { ch: s.ch.map((c) => c.slice(a, z)), sr: s.sr, name: s.name };
  const fi = Math.min(out.ch[0].length, Math.round(s.sr * 0.002)), fo = Math.min(out.ch[0].length, Math.round(s.sr * 0.015));
  for (const c of out.ch) { for (let i = 0; i < fi; i++) c[i] *= i / fi; for (let i = 0; i < fo; i++) c[c.length - 1 - i] *= i / fo; }
  return out;
};
SMP.normalize = (s) => { const pk = SMP.peak(s); if (!pk) return s; const g = Math.pow(10, -1 / 20) / pk, out = SMP.copy(s); for (const c of out.ch) for (let i = 0; i < c.length; i++) c[i] *= g; return out; };
SMP.reverse = (s) => { const out = SMP.copy(s); for (const c of out.ch) c.reverse(); return out; };
// a channel's current sample (factory or user) as an editable user sample, then swap the channel onto the edited copy
SMP.edit = (ch, fn, suffix) => {
  const src = ENG.sampleFor(ch); if (!src) return;
  const base = Object.assign({ name: ch.name }, src), out = fn(SMP.copy(base));
  const id = U.uid('s'); out.name = (ch.name + ' ' + suffix).slice(0, 40); ENG.userSamples.set(id, out); A.storeSample(id);
  const keep = Object.assign({}, ch.p); ch.sample = id; ch.sound = null; ch.p = keep; ch.name = out.name;
  A.change('smpedit', { rack: true }); BROWSER.render(); PANEL.open(ch.id); A.eng.preview(ch.id, ch.note || 60, M.DEF_VEL);
};
// stretch-by-pitch so the sample lasts exactly `bars` bars at the project tempo when played on the channel's home note
SMP.fit = (ch, bars) => {
  const src = ENG.sampleFor(ch); if (!src) return;
  const dur = src.ch[0].length / src.sr, target = bars * 16 * ENG.stepDur(A.proj.bpm);
  ch.p.root = ch.note || 60; ch.p.tune = Math.round(1200 * Math.log2(dur / target)); ch.p.oneshot = true; ch.p.loop = false; ch.p.track = true;
  A.change('fit', { panel: true });
  UI.toast(`Fitted to ${bars} bar${bars > 1 ? 's' : ''} at ${A.proj.bpm} BPM (${ch.p.tune > 0 ? '+' : ''}${(ch.p.tune / 100).toFixed(2)} st)`);
};
