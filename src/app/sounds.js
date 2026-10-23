// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Josh Wilk. Part of Esperanza's Drum Kit; see LICENSE for terms (no warranty).
// Factory sounds. Every drum one-shot is synthesised by our own drum engine at start-up and kept as a sample,
// so the library is ours outright (GPL) and adds nothing to the download.
'use strict';
const SOUND = {};

// pad order of the drum engine: kick, snare, clap, closed hat, open hat, low tom, high tom, perc, crash, ride
SOUND.PADS = [36, 38, 39, 42, 46, 45, 50, 56, 49, 51];
SOUND.PAD_KEYS = ['kick', 'snare', 'clap', 'chat', 'ohat', 'ltom', 'htom', 'perc', 'crash', 'ride'];
SOUND.PAD_NAMES = ['Kick', 'Snare', 'Clap', 'Closed hat', 'Open hat', 'Low tom', 'High tom', 'Perc', 'Crash', 'Ride'];
// [tune st, decay s, level dB, tone 0..1] per pad
SOUND.KITS = [
  { id: 'roast', name: 'Dark Roast', hint: 'boom bap, warm and round', pads: [[0, 0.9, 0, 0.35], [0, 0.35, -3, 0.5], [0, 0.4, -4, 0.5], [0, 0.4, -9, 0.3], [0, 0.6, -10, 0.3], [0, 0.5, -5, 0.3], [0, 0.4, -5, 0.3], [0, 0.4, -9, 0.5], [0, 1.6, -9, 0.5], [0, 1.3, -12, 0.5]] },
  { id: 'espresso', name: 'Espresso', hint: 'tight and bright', pads: [[2, 0.35, 0, 0.6], [2, 0.18, -2, 0.8], [1, 0.25, -4, 0.6], [2, 0.25, -8, 0.6], [2, 0.35, -10, 0.6], [3, 0.3, -5, 0.4], [3, 0.25, -5, 0.4], [3, 0.25, -9, 0.6], [1, 1.1, -9, 0.65], [1, 0.9, -11, 0.6]] },
  { id: 'coldbrew', name: 'Cold Brew', hint: 'lo-fi, dusty, low', pads: [[-2, 0.55, -1, 0.2], [-3, 0.3, -3, 0.25], [-2, 0.45, -5, 0.3], [-4, 0.3, -11, 0.2], [-4, 0.5, -12, 0.2], [-3, 0.5, -6, 0.2], [-3, 0.4, -6, 0.2], [-5, 0.5, -10, 0.2], [-2, 1.9, -11, 0.3], [-2, 1.5, -13, 0.3]] },
  { id: 'drip', name: 'Drip Machine', hint: '80s drum machine, electro', pads: [[5, 0.45, 0, 0.9], [5, 0.25, -2, 1], [4, 0.3, -3, 0.9], [5, 0.18, -8, 0.9], [5, 0.3, -9, 0.9], [7, 0.3, -5, 0.8], [7, 0.25, -5, 0.8], [6, 0.3, -8, 0.9], [3, 1.3, -9, 0.85], [3, 1.0, -11, 0.8]] },
  { id: 'trap', name: 'Night Shift', hint: 'trap: hard kick, crisp hats', pads: [[3, 0.5, 0, 0.75], [4, 0.22, -2, 0.9], [2, 0.32, -2, 0.75], [6, 0.12, -9, 0.95], [6, 0.4, -10, 0.95], [1, 0.45, -5, 0.6], [2, 0.38, -5, 0.6], [8, 0.2, -8, 1], [2, 1.4, -10, 0.9], [2, 1.1, -12, 0.85]] },
];
// tuned bass one-shots made from the kick voice with a long tail; the root makes them play in key
SOUND.BASSES = [
  { id: 'bass/808long', name: '808 Long', pad: [0, 2.2, 0, 0.05], root: 31, tune: 36 },
  { id: 'bass/808punch', name: '808 Punch', pad: [0, 1.1, 0, 0.6], root: 31, tune: 36 },
  { id: 'bass/808dirty', name: '808 Dirty', pad: [0, 1.6, 0, 1], root: 31, tune: 36 },
];

SOUND.catalog = () => {
  const out = [];
  for (const k of SOUND.KITS) SOUND.PAD_KEYS.forEach((pk, i) => out.push({ id: k.id + '/' + pk, name: SOUND.PAD_NAMES[i], group: k.name, hint: k.hint, kind: 'drum' }));
  for (const b of SOUND.BASSES) out.push({ id: b.id, name: b.name, group: '808s', hint: 'tuned bass, plays in key', kind: 'bass' });
  return out;
};
SOUND.byId = (id) => SOUND.catalog().find((s) => s.id === id);

// sampler defaults: drums play once and ignore note length; 808s follow the keys
SOUND.samplerParams = (soundId) => {
  const b = SOUND.BASSES.find((x) => x.id === soundId);
  if (b) return { root: b.root, tune: b.tune, track: true, oneshot: false, loop: false, start: 0, lstart: 0, a: 0.001, d: 0.3, s: 1, r: 0.12, cut: 20000, res: 0, vsens: 0.5, vol: 0 };
  return { root: 60, tune: 0, track: true, oneshot: true, loop: false, start: 0, lstart: 0, a: 0.001, d: 0.3, s: 1, r: 0.05, cut: 20000, res: 0, vsens: 0.6, vol: 0 };
};

// ---- the synth channel (polyBLEP VA voice from the shared engine) ----
SOUND.synthDefault = () => ({
  o1w: 'saw', o1oct: 0, o1semi: 0, o2w: 'square', o2oct: 0, o2semi: 0, o2det: 7, mix: 0.4, pw: 0.5, sub: 0, noise: 0,
  ftype: 'lp24', cut: 2400, res: 0.2, fenv: 0.35, fkey: 0.5, vfilt: 0.3, fa: 0.002, fd: 0.35, fs: 0.2, fr: 0.3,
  a: 0.004, d: 0.3, s: 0.7, r: 0.25, lrate: 5, lshape: 0, lpitch: 0, lcut: 0, glide: 0, mono: false, vsens: 0.6, vol: -4, width: 0,
});
const SP = (o) => Object.assign(SOUND.synthDefault(), o);
SOUND.SYNTHS = [
  ['Sub Bass', SP({ o1w: 'sine', o2w: 'tri', o1oct: -1, o2oct: -1, mix: 0.3, cut: 900, res: 0.1, fenv: 0.1, a: 0.002, d: 0.4, s: 0.9, r: 0.08, mono: true, glide: 0.03, vol: 0 }), 36],
  ['Acid Bass', SP({ o1w: 'saw', o2w: 'saw', o1oct: -1, o2oct: -1, o2det: 0, mix: 0, cut: 300, res: 0.82, fenv: 0.65, fd: 0.18, fs: 0, a: 0.001, d: 0.2, s: 0.8, r: 0.06, mono: true, glide: 0.06, vfilt: 0.8, vol: -3 }), 36],
  ['Pick Bass', SP({ o1w: 'square', o2w: 'saw', o1oct: -1, o2oct: -1, mix: 0.5, cut: 600, res: 0.3, fenv: 0.45, fd: 0.12, fs: 0.05, a: 0.001, d: 0.35, s: 0.3, r: 0.12, vol: -2 }), 36],
  ['Saw Lead', SP({ o1w: 'saw', o2w: 'saw', o2det: 12, mix: 0.5, cut: 3800, res: 0.25, fenv: 0.2, a: 0.004, s: 0.85, r: 0.18, lpitch: 12, lrate: 5.5, mono: true, glide: 0.04, vol: -6 }), 72],
  ['Square Lead', SP({ o1w: 'square', o2w: 'square', o2oct: 1, mix: 0.3, pw: 0.35, cut: 2600, res: 0.15, fenv: 0.25, a: 0.002, s: 0.8, r: 0.15, vol: -7 }), 72],
  ['Warm Pad', SP({ o1w: 'saw', o2w: 'saw', o2det: 14, mix: 0.5, cut: 1400, res: 0.12, fenv: 0.15, fa: 0.8, fd: 1.5, fs: 0.5, fr: 1.2, a: 0.9, d: 1.2, s: 0.8, r: 1.6, lcut: 0.25, lrate: 0.3, vol: -9 }), 60],
  ['Glass Pad', SP({ o1w: 'tri', o2w: 'sine', o2oct: 1, o2det: 5, mix: 0.45, cut: 6000, res: 0.35, fenv: 0, a: 0.6, d: 1, s: 0.75, r: 2, lpitch: 6, lrate: 4, vol: -8 }), 60],
  ['Soft Keys', SP({ o1w: 'tri', o2w: 'sine', o2oct: 1, mix: 0.25, cut: 3000, res: 0.05, fenv: 0.25, fd: 0.6, fs: 0.2, a: 0.003, d: 1.2, s: 0.3, r: 0.4, vsens: 0.8, vol: -5 }), 60],
  ['Pluck', SP({ o1w: 'saw', o2w: 'square', mix: 0.4, cut: 700, res: 0.3, fenv: 0.6, fd: 0.16, fs: 0, a: 0.001, d: 0.3, s: 0, r: 0.25, vol: -5 }), 72],
  ['Brass Stab', SP({ o1w: 'saw', o2w: 'saw', o2det: 9, mix: 0.5, cut: 900, res: 0.1, fenv: 0.45, fa: 0.06, fd: 0.4, fs: 0.4, a: 0.03, d: 0.3, s: 0.8, r: 0.2, vol: -6 }), 60],
  ['Strings', SP({ o1w: 'saw', o2w: 'saw', o2det: 18, mix: 0.5, cut: 2200, res: 0.05, fenv: 0.05, a: 0.35, d: 0.5, s: 0.9, r: 0.9, lpitch: 8, lrate: 5, vol: -9 }), 60],
  ['Organ', SP({ o1w: 'sine', o2w: 'sine', o2oct: 1, mix: 0.45, sub: 0.35, cut: 8000, res: 0, fenv: 0, a: 0.004, d: 0.1, s: 1, r: 0.05, lpitch: 9, lrate: 6.5, vol: -8 }), 60],
  ['Bell', SP({ o1w: 'sine', o2w: 'sine', o2semi: 7, o2oct: 1, o2det: 3, mix: 0.4, cut: 9000, fenv: 0, a: 0.001, d: 2.2, s: 0, r: 1.5, vol: -6 }), 72],
  ['Noise Riser', SP({ o1w: 'saw', noise: 0.8, mix: 0, cut: 400, res: 0.6, fenv: 0.9, fa: 3, fd: 0.1, fs: 1, a: 2, s: 1, r: 0.5, vol: -10 }), 60],
];

// ---- render the factory kits once (OfflineAudioContext + the shared drum voice) ----
SOUND.buffers = new Map(); // id -> { ch: [Float32Array, Float32Array], sr }
SOUND.render = async (sr) => {
  const jobs = [];
  for (const k of SOUND.KITS) k.pads.forEach((pad, i) => jobs.push({ id: k.id + '/' + SOUND.PAD_KEYS[i], pad, padIdx: i }));
  for (const b of SOUND.BASSES) jobs.push({ id: b.id, pad: b.pad, padIdx: 0 });
  const SLOT = 3; // seconds per hit
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * SLOT * jobs.length), sr);
  await ENG.addWorklet(ctx);
  // one drum node per job (each with its own pad settings), all into one render
  jobs.forEach((j, n) => {
    const pads = SOUND.PADS.map(() => ({ tune: 0, decay: 0.3, level: -60, tone: 0.5, pan: 0 }));
    const [tune, decay, level, tone] = j.pad;
    pads[j.padIdx] = { tune, decay, level: 0, tone, pan: 0 }; void level;
    const node = new AudioWorkletNode(ctx, 'ds-inst', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
      processorOptions: { type: 'drums', p: { kit: 0, vol: 0, pads }, events: [[Math.round(n * SLOT * sr), 1, SOUND.PADS[j.padIdx], 1]] } });
    node.connect(ctx.destination);
  });
  const out = await ctx.startRendering();
  const L = out.getChannelData(0), R = out.getChannelData(1);
  jobs.forEach((j, n) => {
    const a = Math.round(n * SLOT * sr), b = a + Math.round(SLOT * sr);
    let pk = 0, end = a;
    for (let i = a; i < b; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (v > pk) pk = v; }
    const floor = pk * Math.pow(10, -70 / 20);
    for (let i = a; i < b; i++) if (Math.abs(L[i]) > floor || Math.abs(R[i]) > floor) end = i;
    const len = Math.max(64, end - a + 1), g = pk > 0 ? Math.pow(10, -1 / 20) / pk : 1; // peak at -1 dBFS
    const l = new Float32Array(len), r = new Float32Array(len);
    for (let i = 0; i < len; i++) { l[i] = L[a + i] * g; r[i] = R[a + i] * g; }
    const fade = Math.min(len, Math.round(sr * 0.004)); // 4 ms fade on the cut tail
    for (let i = 0; i < fade; i++) { const w = i / fade; l[len - 1 - i] *= w; r[len - 1 - i] *= w; }
    SOUND.buffers.set(j.id, { ch: [l, r], sr });
  });
};
