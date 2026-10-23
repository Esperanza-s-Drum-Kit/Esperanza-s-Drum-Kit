// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Josh Wilk. Part of Esperanza's Drum Kit; see LICENSE for terms (no warranty).
// Project model: channels (the rack), patterns (steps per channel), playlist (pattern clips on tracks).
// Time unit everywhere is the STEP: one 16th note. A 4/4 bar is 16 steps.
'use strict';
const M = {};
M.VERSION = '0.2.1';
M.FORMAT = 1;
M.STEPS_PER_BAR = 16;
M.COLORS = ['#C4382A', '#D99A2B', '#7A8B3E', '#5E8FA8', '#B5653A', '#8C4A6B', '#3F7F73', '#C9B27C', '#6A5ACD', '#9C7B4E', '#D0614C', '#4E6E8E'];
M.PAT_COLORS = ['#D99A2B', '#C4382A', '#7A8B3E', '#5E8FA8', '#B5653A', '#8C4A6B', '#3F7F73', '#C9B27C'];
M.DEF_VEL = 100 / 127;
M.DEF_NOTE = 60; // C5 in the naming most beat software uses (MIDI 60)

M.defMaster = () => ({
  vol: 0.8,
  ch: { trim: 0, phase: false, hpf: 20, lpf: 20000, eqOn: false, lsF: 80, lsG: 0, lmF: 400, lmG: 0, hmF: 2500, hmG: 0, hsF: 10000, hsG: 0,
    gate: -80, compOn: false, mode: 'compressor', thresh: 0, ratio: 2, attack: 20, release: 250, makeup: 0, tape: 0, limOn: true, ceiling: -0.3, bypass: false },
});

// a channel is one row of the rack: an instrument with its own volume, pan and mute
M.newChannel = (proj, opts) => {
  const i = proj.channels.length;
  return Object.assign({
    id: U.uid('c'), name: 'Channel ' + (i + 1), color: M.COLORS[i % M.COLORS.length],
    type: 'sampler', sound: null, sample: null, p: SOUND.samplerParams(null),
    vol: 0.78, pan: 0, mute: false, solo: false, target: 0,
  }, opts || {});
};

M.newPattern = (proj, name) => {
  const n = proj.patterns.length;
  return { id: U.uid('p'), name: name || 'Pattern ' + (n + 1), color: M.PAT_COLORS[n % M.PAT_COLORS.length], len: 16, grid: {} };
};

M.newProject = () => {
  const p = {
    format: M.FORMAT, app: 'edk', made: M.VERSION, name: 'Untitled', bpm: 140, swing: 0, mode: 'pat',
    master: M.defMaster(), feel: ENG.defFeel(), channels: [], patterns: [], cur: null, sel: null, loop: { on: false, start: 0, len: 64 }, sections: [],
    playlist: { tracks: 12, clips: [], names: [] }, created: Date.now(),
  };
  for (const [name, sound] of [['Kick', 'roast/kick'], ['Clap', 'roast/clap'], ['Hat', 'roast/chat'], ['Snare', 'roast/snare']]) {
    p.channels.push(M.newChannel(p, { name, sound, p: SOUND.samplerParams(sound) }));
  }
  const pat = M.newPattern(p); p.patterns.push(pat); p.cur = pat.id; p.sel = p.channels[0].id;
  return p;
};

M.pat = (proj, id) => proj.patterns.find((x) => x.id === (id || proj.cur));
M.chan = (proj, id) => proj.channels.find((x) => x.id === id);
M.row = (pat, chId) => (pat.grid[chId] = pat.grid[chId] || []);
M.cell = (pat, chId, s) => { const r = pat.grid[chId]; return r ? r[s] || null : null; };
M.setCell = (pat, chId, s, v) => { const r = M.row(pat, chId); while (r.length <= s) r.push(null); r[s] = v; };
// a new step plays the channel's home note: the sample's own pitch for drums, a sensible register for basses and synths
M.newCell = (ch) => ({ v: M.DEF_VEL, n: (ch && ch.note) || M.DEF_NOTE, g: 1 });
// changing a channel's home note moves the key of everything it already plays, in every pattern
M.setHomeNote = (proj, ch, note) => {
  const old = ch.note || 60, d = note - old; ch.note = note; if (!d) return;
  for (const pat of proj.patterns) for (const c of pat.grid[ch.id] || []) if (c) c.n = Math.max(0, Math.min(127, c.n + d));
};
M.homeNote = (type, sound, synthIdx) => {
  if (type === 'synth') return (SOUND.SYNTHS[synthIdx || 0] || [])[2] || 60;
  const b = SOUND.BASSES.find((x) => x.id === sound); return b ? 36 : 60;
};
// a pattern's length follows its last used step, rounded up to whole bars (never below its set length)
M.patLen = (pat) => pat.len;
M.songLen = (proj) => {
  let e = 0; for (const c of proj.playlist.clips) e = Math.max(e, c.start + c.len);
  for (const s of proj.sections || []) e = Math.max(e, s.start + s.len);
  return Math.max(M.STEPS_PER_BAR, Math.ceil(e / M.STEPS_PER_BAR) * M.STEPS_PER_BAR);
};
// song sections: names people use, each with its own colour
M.SECTION_KINDS = [['Intro', '#5E8FA8'], ['Verse', '#7A8B3E'], ['Pre-chorus', '#C9B27C'], ['Chorus', '#D99A2B'], ['Hook', '#E0A93C'], ['Bridge', '#8C4A6B'], ['Breakdown', '#3F7F73'], ['Drop', '#C4382A'], ['Interlude', '#9C7B4E'], ['Outro', '#6A5ACD']];
M.newSection = (proj, kind, start, len) => {
  const k = M.SECTION_KINDS.find((x) => x[0] === kind) || [kind, '#B5653A'];
  const same = (proj.sections || []).filter((s) => s.kind === k[0]).length;
  return { id: U.uid('s'), kind: k[0], name: k[0] + (same ? ' ' + (same + 1) : ''), color: k[1], start, len };
};
M.channelGain = (ch) => ch.vol * ch.vol * 1.64; // 78% is unity, 125% is about +8 dB

// bring older files up to date and fill anything missing
M.migrate = (p) => {
  p.master = Object.assign(M.defMaster(), p.master || {});
  p.playlist = Object.assign({ tracks: 12, clips: [], names: [] }, p.playlist || {});
  p.swing = p.swing || 0; p.mode = p.mode || 'pat';
  p.feel = Object.assign(ENG.defFeel(), p.feel || {});
  p.loop = Object.assign({ on: false, start: 0, len: 64 }, p.loop || {});
  p.sections = p.sections || [];
  for (const ch of p.channels) {
    if (ch.type === 'sampler') ch.p = Object.assign(SOUND.samplerParams(ch.sound), ch.p || {});
    if (ch.type === 'synth') ch.p = Object.assign(SOUND.synthDefault(), ch.p || {});
    if (ch.target === undefined) ch.target = 0;
  }
  if (!p.patterns.length) p.patterns.push(M.newPattern(p));
  if (!M.pat(p)) p.cur = p.patterns[0].id;
  return p;
};

// ---- undo: whole-model snapshots (projects are small: steps and settings, samples live elsewhere) ----
class History {
  constructor(limit) { this.limit = limit || 120; this.past = []; this.future = []; this.last = null; this.group = null; this.groupT = 0; }
  reset(proj) { this.past = []; this.future = []; this.last = JSON.stringify(proj); }
  // call after every change; continuous controls (knobs, wheel, tempo) with the same key inside 600 ms merge into one step
  commit(proj, key) {
    if (key && !History.CONT.test(key)) key = null;
    const s = JSON.stringify(proj);
    if (s === this.last) return false;
    const now = Date.now();
    if (key && key === this.group && now - this.groupT < 600) { this.last = s; this.groupT = now; this.future = []; return true; }
    this.past.push(this.last); if (this.past.length > this.limit) this.past.shift();
    this.future = []; this.last = s; this.group = key || null; this.groupT = now;
    return true;
  }
  undo() { if (!this.past.length) return null; this.future.push(this.last); this.last = this.past.pop(); this.group = null; return JSON.parse(this.last); }
  redo() { if (!this.future.length) return null; this.past.push(this.last); this.last = this.future.pop(); this.group = null; return JSON.parse(this.last); }
}
History.CONT = /^(vol|pan|p:|swing|bpm|mvol|note|feel)/;
M.History = History;
