// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Josh Wilk. Part of Esperanza's Drum Kit; see LICENSE for terms (no warranty).
// Audio engine: one graph shape for live play and offline renders, and a look-ahead step scheduler.
// Every note is posted to its instrument as an absolute frame number, so timing is sample-exact in both.
'use strict';
const ENG = {};
ENG._url = null;
// blob: URLs are refused for worklets on some origins (file:// pages, some WebViews): fall back to a data: URL
ENG.addWorklet = async (ctx) => {
  if (ENG._url) return ctx.audioWorklet.addModule(ENG._url);
  const blob = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
  try { await ctx.audioWorklet.addModule(blob); ENG._url = blob; }
  catch (e) { ENG._url = 'data:application/javascript;base64,' + btoa(unescape(encodeURIComponent(WORKLET_SRC))); await ctx.audioWorklet.addModule(ENG._url); }
};
ENG.LOOKAHEAD = 0.14; // seconds of notes queued ahead of the audio clock
ENG.TICK = 20; // ms between scheduler passes

ENG.stepDur = (bpm) => 60 / bpm / 4;
// swing delays every second 16th; 100% pushes it half a step late (a heavy shuffle)
ENG.swingOff = (proj, k) => ((k & 1) ? proj.swing * 0.5 * ENG.stepDur(proj.bpm) : 0);

// What plays at song/pattern step k: [{pat, ps}] where ps is the step inside that pattern
ENG.slicesAt = (proj, k, mode) => {
  if (mode === 'pat') { const pat = M.pat(proj); return pat ? [{ pat, ps: k % pat.len }] : []; }
  const L = M.songLen(proj), pos = k % L, out = [];
  for (const c of proj.playlist.clips) {
    if (pos < c.start || pos >= c.start + c.len) continue;
    const pat = M.pat(proj, c.pat); if (!pat) continue;
    out.push({ pat, ps: (pos - c.start) % pat.len }); // a clip longer than its pattern repeats it
  }
  return out;
};

// Note events for steps [k0, k1): Map channelId -> [[frame, on/off, note, vel], ...]
ENG.events = (proj, mode, k0, k1, stepTime, sr) => {
  const out = new Map(), sd = ENG.stepDur(proj.bpm);
  for (let k = k0; k < k1; k++) {
    const slices = ENG.slicesAt(proj, k, mode);
    if (!slices.length) continue;
    const t = stepTime(k) + ENG.swingOff(proj, k);
    for (const { pat, ps } of slices) {
      for (const ch of proj.channels) {
        const c = M.cell(pat, ch.id, ps); if (!c) continue;
        const f = Math.round(t * sr), gate = Math.max(8, Math.round((c.g || 1) * sd * sr) - Math.round(sr * 0.002));
        let a = out.get(ch.id); if (!a) out.set(ch.id, (a = []));
        a.push([f, 1, c.n, c.v], [f + gate, 0, c.n, 0]);
      }
    }
  }
  return out;
};

const WNODE = (ctx, name, outs, po) => new AudioWorkletNode(ctx, name, {
  numberOfInputs: 1, numberOfOutputs: outs, outputChannelCount: Array(outs).fill(2),
  channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers', processorOptions: po || {},
});

// ---------------- graph: channels -> faders -> master strip -> out ----------------
class Graph {
  // settings that must hold from the first frame of an offline render are passed at creation, not by message
  constructor(ctx, live, events, proj) {
    this.ctx = ctx; this.live = live; this.events = events || null; this.ch = new Map();
    this.mIn = ctx.createGain();
    this.mChan = WNODE(ctx, 'ds-channel', 1, { kind: 'master', meter: false, p: (proj || { master: M.defMaster() }).master.ch });
    this.mVol = ctx.createGain();
    this.mIn.connect(this.mChan); this.mChan.connect(this.mVol);
    if (live) {
      this.an = ctx.createAnalyser(); this.an.fftSize = 2048; this.an.smoothingTimeConstant = 0;
      this.anL = ctx.createAnalyser(); this.anR = ctx.createAnalyser(); this.anL.fftSize = this.anR.fftSize = 1024;
      const sp = ctx.createChannelSplitter(2); this.mVol.connect(sp); sp.connect(this.anL, 0); sp.connect(this.anR, 1);
      this.mVol.connect(this.an);
    }
    this.mVol.connect(ctx.destination);
  }
  sync(proj) {
    const seen = new Set(), anySolo = proj.channels.some((c) => c.solo);
    for (const c of proj.channels) {
      seen.add(c.id);
      let n = this.ch.get(c.id);
      const sig = c.type + '|' + (c.type === 'sampler' ? (c.sound || c.sample || '') : '');
      const muted = c.mute || (anySolo && !c.solo);
      if (!n || n.sig !== sig) { if (n) this.drop(c.id); n = this.make(c, sig, muted); this.ch.set(c.id, n); }
      if (JSON.stringify(c.p) !== n.pSig) { n.inst.port.postMessage({ t: 'set', p: c.p }); n.pSig = JSON.stringify(c.p); }
      const g = M.channelGain(c);
      this.setP(n.fader.parameters.get('gain'), g); this.setP(n.fader.parameters.get('pan'), c.pan);
      if (n.muted !== muted) { n.fader.port.postMessage({ type: 'mute', on: muted }); n.muted = muted; }
    }
    for (const id of Array.from(this.ch.keys())) if (!seen.has(id)) this.drop(id);
    const m = proj.master;
    const mSig = JSON.stringify(m.ch); if (mSig !== this.mSig) { if (this.mSig !== undefined || this.live) this.mChan.port.postMessage({ type: 'set', p: m.ch }); this.mSig = mSig; }
    this.setP(this.mVol.gain, m.vol * m.vol * 1.5625); // 80% is unity
  }
  make(c, sig, muted) {
    const ctx = this.ctx, smp = c.type === 'sampler' ? ENG.sampleFor(c) : null;
    const inst = new AudioWorkletNode(ctx, 'ds-inst', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
      processorOptions: { type: c.type, p: c.p, samples: smp ? { main: smp } : {}, events: (this.events && this.events.get(c.id)) || [] } });
    const fader = WNODE(ctx, 'ds-fader', 1, { meter: false, mono: false, mute: muted });
    inst.connect(fader); fader.connect(this.mIn);
    return { inst, fader, sig, pSig: JSON.stringify(c.p), muted };
  }
  drop(id) { const n = this.ch.get(id); if (!n) return; try { n.inst.disconnect(); n.fader.disconnect(); } catch (e) { /* gone */ } this.ch.delete(id); }
  setP(param, v) { if (this.live) param.setTargetAtTime(v, this.ctx.currentTime, 0.012); else param.value = v; }
  post(id, msg) { const n = this.ch.get(id); if (n) n.inst.port.postMessage(msg); }
  all(msg) { for (const n of this.ch.values()) n.inst.port.postMessage(msg); }
}

ENG.userSamples = new Map(); // id -> { ch, sr, name }
ENG.sampleFor = (c) => (c.sample && ENG.userSamples.get(c.sample)) || (c.sound && SOUND.buffers.get(c.sound)) || null;

// ---------------- live engine + transport ----------------
class Engine {
  constructor() { this.ctx = null; this.graph = null; this.playing = false; this.timer = null; this.onPos = null; }
  async init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.sr = this.ctx.sampleRate;
    await ENG.addWorklet(this.ctx);
    this.graph = new Graph(this.ctx, true);
  }
  sync(proj) { this.proj = proj; if (this.graph) this.graph.sync(proj); }
  resume() { if (this.ctx && this.ctx.state !== 'running') return this.ctx.resume(); return Promise.resolve(); }
  stepTime(k) { return this.t0 + (k - this.k0) * ENG.stepDur(this.proj.bpm); }
  // position in steps (fractional) as heard now; null when stopped
  pos() {
    if (!this.playing) return null;
    const lat = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
    return this.k0 + (this.ctx.currentTime - lat - this.t0) / ENG.stepDur(this.proj.bpm);
  }
  play(fromStep) {
    this.resume();
    this.stop(true);
    this.playing = true; this.mode = this.proj.mode;
    this.k0 = Math.max(0, Math.floor(fromStep || 0)); this.t0 = this.ctx.currentTime + 0.06; this.next = this.k0;
    this.tick(); this.timer = setInterval(() => this.tick(), ENG.TICK);
  }
  tick() {
    if (!this.playing) return;
    if (this.proj.mode !== this.mode) { // switching pattern/song while playing restarts from the top on the next step
      this.mode = this.proj.mode; this.k0 = this.next; this.t0 = this.stepTime(this.next);
      if (this.mode === 'song') { this.k0 = 0; this.next = 0; }
    }
    const until = this.ctx.currentTime + ENG.LOOKAHEAD;
    let k1 = this.next; while (this.stepTime(k1) < until) k1++;
    if (k1 === this.next) return;
    const ev = ENG.events(this.proj, this.mode, this.next, k1, (k) => this.stepTime(k), this.sr);
    for (const [id, list] of ev) this.graph.post(id, { t: 'ev', ev: list });
    this.next = k1;
  }
  // tempo changes keep the beat: steps already queued stay, new ones follow the new tempo
  retempo(bpm) {
    if (!this.playing) { this.proj.bpm = bpm; return; }
    const t = this.stepTime(this.next); this.proj.bpm = bpm; this.k0 = this.next; this.t0 = t;
  }
  stop(quiet) {
    clearInterval(this.timer); this.timer = null;
    if (this.playing && this.graph) this.graph.all({ t: 'clear' });
    this.playing = false;
    if (!quiet && this.onPos) this.onPos(null);
  }
  // play a channel right now (rack name taps, browser previews)
  preview(chId, note, vel) {
    this.resume(); const f = Math.round((this.ctx.currentTime + 0.01) * this.sr);
    this.graph.post(chId, { t: 'ev', ev: [[f, 1, note, vel], [f + Math.round(this.sr * 0.3), 0, note, 0]] });
  }
  previewSound(id) { // a factory or user sample on its own voice, straight to the master
    this.resume();
    const smp = SOUND.buffers.get(id) || ENG.userSamples.get(id); if (!smp) return;
    if (this.pv) { try { this.pv.disconnect(); } catch (e) { /* */ } }
    const p = SOUND.samplerParams(id);
    const f = Math.round((this.ctx.currentTime + 0.01) * this.sr);
    this.pv = new AudioWorkletNode(this.ctx, 'ds-inst', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
      processorOptions: { type: 'sampler', p, samples: { main: smp }, events: [[f, 1, p.root, 0.85], [f + this.sr * 0.6, 0, p.root, 0]] } });
    const g = this.ctx.createGain(); g.gain.value = 0.8; this.pv.connect(g); g.connect(this.graph.mIn);
  }
  peak() {
    if (!this.graph) return [0, 0];
    const a = new Float32Array(1024), r = [0, 0];
    [this.graph.anL, this.graph.anR].forEach((an, i) => { an.getFloatTimeDomainData(a); let m = 0; for (let j = 0; j < a.length; j++) { const v = Math.abs(a[j]); if (v > m) m = v; } r[i] = m; });
    return r;
  }
}
ENG.Engine = Engine;

// ---------------- offline render (export, tests) ----------------
// mode 'song' renders the playlist once; 'pat' renders the current pattern `loops` times
ENG.render = async (proj, opts) => {
  opts = opts || {};
  const sr = opts.sr || 48000, mode = opts.mode || proj.mode, loops = opts.loops || 1;
  const steps = mode === 'song' ? M.songLen(proj) : M.pat(proj).len * loops;
  const sd = ENG.stepDur(proj.bpm), tail = opts.tail !== undefined ? opts.tail : 2;
  const frames = Math.ceil((steps * sd + tail) * sr);
  const ctx = new OfflineAudioContext(2, frames, sr);
  await ENG.addWorklet(ctx);
  const ev = ENG.events(proj, mode, 0, steps, (k) => k * sd, sr);
  const g = new Graph(ctx, false, ev, proj); g.mSig = JSON.stringify(proj.master.ch); g.sync(proj);
  const buf = await ctx.startRendering();
  return { buf, steps, sr, events: ev };
};
