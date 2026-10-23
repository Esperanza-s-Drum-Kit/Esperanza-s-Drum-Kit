// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Josh Wilk. Part of Esperanza's Drum Kit; see LICENSE for terms (no warranty).
// Browser: factory kits, 808s, synth presets and the user's own samples. Click to hear, + or double-click to add,
// drag onto a channel name to swap its sound.
'use strict';
const BROWSER = { open: new Set(['Dark Roast']), filter: '' };

BROWSER.render = () => {
  const el = UI.$('#browserList'), f = BROWSER.filter.toLowerCase();
  const groups = new Map();
  for (const s of SOUND.catalog()) { if (!groups.has(s.group)) groups.set(s.group, { hint: s.hint, items: [] }); groups.get(s.group).items.push(s); }
  const user = Array.from(ENG.userSamples.entries()).map(([id, s]) => ({ id, name: s.name, kind: 'user' }));
  if (user.length) groups.set('Your samples', { hint: '', items: user });
  let html = '';
  for (const [name, g] of groups) {
    const items = g.items.filter((s) => !f || (s.name + ' ' + name).toLowerCase().includes(f));
    if (!items.length) continue;
    const open = f || BROWSER.open.has(name);
    html += `<div class="bgroup${open ? ' open' : ''}" data-g="${UI.esc(name)}"><button data-act="tog"><span class="chev">▸</span>${UI.esc(name)}<span class="hint">${items.length}</span></button><div class="bitems">${items.map((s) =>
      `<div class="bitem" draggable="true" data-sound="${UI.esc(s.id)}" title="${UI.esc(g.hint || '')}">${UI.ICONS.wav}<span>${UI.esc(s.name)}</span><button class="add" data-act="add" aria-label="Add ${UI.esc(s.name)} as a channel">+</button></div>`).join('')}</div></div>`;
  }
  const synths = SOUND.SYNTHS.map((s, i) => ({ i, name: s[0] })).filter((s) => !f || ('synth ' + s.name).toLowerCase().includes(f));
  if (synths.length) {
    const open = f || BROWSER.open.has('Synths');
    html += `<div class="bgroup${open ? ' open' : ''}" data-g="Synths"><button data-act="tog"><span class="chev">▸</span>Synths<span class="hint">${synths.length}</span></button><div class="bitems">${synths.map((s) =>
      `<div class="bitem" data-synth="${s.i}">${UI.ICONS.synth}<span>${UI.esc(s.name)}</span><button class="add" data-act="add" aria-label="Add ${UI.esc(s.name)} as a channel">+</button></div>`).join('')}</div></div>`;
  }
  el.innerHTML = html || '<div style="padding:12px;color:var(--crema3)">Nothing matches.</div>';
};

BROWSER.init = () => {
  const el = UI.$('#browserList');
  el.addEventListener('click', (e) => {
    const tog = e.target.closest('[data-act="tog"]');
    if (tog) { const g = tog.parentElement.dataset.g; if (BROWSER.open.has(g)) BROWSER.open.delete(g); else BROWSER.open.add(g); tog.parentElement.classList.toggle('open'); return; }
    const it = e.target.closest('.bitem'); if (!it) return;
    const add = e.target.closest('[data-act="add"]');
    if (it.dataset.sound) { if (add) A.addSoundChannel(it.dataset.sound, true); else A.eng.previewSound(it.dataset.sound); }
    else if (it.dataset.synth !== undefined && add) A.addSynthChannel(+it.dataset.synth);
  });
  el.addEventListener('dblclick', (e) => {
    const it = e.target.closest('.bitem'); if (!it || e.target.closest('.add')) return;
    if (it.dataset.sound) A.addSoundChannel(it.dataset.sound, true); else if (it.dataset.synth !== undefined) A.addSynthChannel(+it.dataset.synth);
  });
  el.addEventListener('dragstart', (e) => { const it = e.target.closest('.bitem'); if (it && it.dataset.sound) { e.dataTransfer.setData('text/edk-sound', it.dataset.sound); e.dataTransfer.effectAllowed = 'copy'; } });
  UI.$('#browserFind').addEventListener('input', (e) => { BROWSER.filter = e.target.value; BROWSER.render(); });
};

// ---------------- channel settings panel ----------------
const PANEL = { id: null };
PANEL.close = () => { UI.$('#panel').classList.add('hidden'); PANEL.id = null; };
PANEL.open = (id) => {
  const ch = M.chan(A.proj, id); if (!ch) return;
  PANEL.id = id; A.proj.sel = id;
  const el = UI.$('#panel'); el.classList.remove('hidden');
  const set = (k, key, done) => (v, d) => { ch.p[k] = v; A.change(key || ('p:' + k + id), { quiet: !d }); };
  const K = (label, k, spec) => UI.knobLabeled(label, Object.assign({ get: () => ch.p[k], set: set(k) }, spec));
  const sec = (title, inner) => `<h3>${title}</h3><div class="krow">${inner}</div>`;
  const s = (v) => (v < 1 ? Math.round(v * 1000) + ' ms' : v.toFixed(2) + ' s');
  const hz = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz');
  let inner = '';
  inner += `<div class="field">Colour <div class="swatches">${M.COLORS.map((c) => `<button data-col="${c}" class="${c === ch.color ? 'on' : ''}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}</div></div>`;
  inner += `<div class="krow">${UI.knobLabeled('Volume', { min: 0, max: 1.25, def: 0.78, get: () => ch.vol, set: (v, d) => { ch.vol = v; A.change('vol' + id, { quiet: !d, rack: d }); }, fmt: (v) => Math.round(v * 100) + '%' })}
    ${UI.knobLabeled('Pan', { min: -1, max: 1, def: 0, bipolar: true, get: () => ch.pan, set: (v, d) => { ch.pan = Math.abs(v) < 0.02 ? 0 : v; A.change('pan' + id, { quiet: !d, rack: d }); }, fmt: RACK.fmtPan })}
    ${UI.knobLabeled('Home note', { min: 24, max: 96, step: 1, def: 60, get: () => ch.note || 60, set: (v, d) => { ch.note = Math.round(v); A.change('note' + id, { quiet: !d }); if (d) A.eng.preview(id, ch.note, M.DEF_VEL); }, fmt: UI.noteName })}</div>`;
  if (ch.type === 'sampler') {
    const opts = SOUND.catalog().map((x) => `<option value="${x.id}"${x.id === ch.sound && !ch.sample ? ' selected' : ''}>${UI.esc(x.group + ' · ' + x.name)}</option>`).join('')
      + Array.from(ENG.userSamples.entries()).map(([sid, x]) => `<option value="${sid}"${sid === ch.sample ? ' selected' : ''}>${UI.esc('Your samples · ' + x.name)}</option>`).join('');
    inner += `<div class="field">Sound <select id="pSound">${opts}</select></div>`;
    const base = SOUND.samplerParams(ch.sample ? null : ch.sound).tune; // 808s carry a small built-in correction
    inner += sec('Pitch', UI.knobLabeled('Pitch', { min: -2400 + base, max: 2400 + base, def: base, bipolar: true, get: () => ch.p.tune,
      set: (v, d) => { ch.p.tune = Math.round((v - base) / 100) * 100 + base; A.change('p:tune' + id, { quiet: !d }); }, fmt: (v) => { const st = Math.round((v - base) / 100); return (st > 0 ? '+' : '') + st + ' st'; } })
      + `<div class="kwrap"><label>Play</label><button class="btn${ch.p.oneshot ? ' on' : ''}" id="pOne" style="height:26px">${ch.p.oneshot ? 'One-shot' : 'Note length'}</button></div>`);
    inner += sec('Envelope', K('Attack', 'a', { min: 0.001, max: 2, def: 0.001, log: true, fmt: s }) + K('Decay', 'd', { min: 0.01, max: 4, def: 0.3, log: true, fmt: s }) + K('Sustain', 's', { min: 0, max: 1, def: 1, fmt: (v) => Math.round(v * 100) + '%' }) + K('Release', 'r', { min: 0.005, max: 4, def: 0.05, log: true, fmt: s }));
    inner += sec('Tone', K('Cutoff', 'cut', { min: 80, max: 20000, def: 20000, log: true, fmt: hz }) + K('Reso', 'res', { min: 0, max: 1, def: 0, fmt: (v) => Math.round(v * 100) + '%' }) + K('Velocity', 'vsens', { min: 0, max: 1, def: 0.6, fmt: (v) => Math.round(v * 100) + '%' }) + K('Level', 'vol', { min: -24, max: 12, def: 0, fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB' }));
  } else {
    inner += `<div class="field">Preset <select id="pPreset">${SOUND.SYNTHS.map((x, i) => `<option value="${i}"${i === ch.preset ? ' selected' : ''}>${UI.esc(x[0])}</option>`).join('')}</select></div>`;
    inner += sec('Filter', K('Cutoff', 'cut', { min: 40, max: 18000, def: 2400, log: true, fmt: hz }) + K('Reso', 'res', { min: 0, max: 1, def: 0.2, fmt: (v) => Math.round(v * 100) + '%' }) + K('Env amt', 'fenv', { min: -1, max: 1, def: 0.35, bipolar: true, fmt: (v) => Math.round(v * 100) + '%' }) + K('Env decay', 'fd', { min: 0.01, max: 5, def: 0.35, log: true, fmt: s }));
    inner += sec('Amp', K('Attack', 'a', { min: 0.001, max: 5, def: 0.004, log: true, fmt: s }) + K('Decay', 'd', { min: 0.01, max: 5, def: 0.3, log: true, fmt: s }) + K('Sustain', 's', { min: 0, max: 1, def: 0.7, fmt: (v) => Math.round(v * 100) + '%' }) + K('Release', 'r', { min: 0.01, max: 6, def: 0.25, log: true, fmt: s }));
    inner += sec('Voice', K('Detune', 'o2det', { min: -50, max: 50, def: 7, bipolar: true, fmt: (v) => Math.round(v) + ' ct' }) + K('Glide', 'glide', { min: 0, max: 0.5, def: 0, fmt: s }) + K('Vibrato', 'lpitch', { min: 0, max: 100, def: 0, fmt: (v) => Math.round(v) + ' ct' }) + K('Level', 'vol', { min: -24, max: 12, def: -4, fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB' })
      + `<div class="kwrap"><label>Voices</label><button class="btn${ch.p.mono ? ' on' : ''}" id="pMono" style="height:26px">${ch.p.mono ? 'Mono' : 'Poly'}</button></div>`);
  }
  el.innerHTML = `<div class="phead"><input id="pName" value="${UI.esc(ch.name)}" aria-label="Channel name"><button class="btn icon" id="pClose" aria-label="Close">✕</button></div><div class="pbody">${inner}</div>`;
  // place it beside the rack on wide screens, as a sheet on phones
  if (innerWidth <= 760) Object.assign(el.style, { left: '8px', right: '8px', top: 'auto', bottom: '60px', width: 'auto' });
  else { const r = UI.$('#rackWin').getBoundingClientRect(); Object.assign(el.style, { left: Math.min(innerWidth - 392, r.left + 180) + 'px', top: Math.min(innerHeight - 200, r.top + 44) + 'px', right: 'auto', bottom: 'auto', width: '380px' }); }
  UI.$('#pClose').onclick = PANEL.close;
  UI.$('#pName').onchange = (e) => { ch.name = e.target.value.slice(0, 40) || ch.name; A.change('name', { rack: true }); };
  UI.$$('#panel [data-col]').forEach((b) => (b.onclick = () => { ch.color = b.dataset.col; A.change('col', { rack: true }); PANEL.open(id); }));
  const snd = UI.$('#pSound'); if (snd) snd.onchange = () => { A.setSound(ch, snd.value); PANEL.open(id); };
  const pre = UI.$('#pPreset'); if (pre) pre.onchange = () => { ch.preset = +pre.value; ch.p = JSON.parse(JSON.stringify(SOUND.SYNTHS[ch.preset][1])); A.change('preset', { rack: true }); A.eng.preview(id, ch.note || 60, M.DEF_VEL); PANEL.open(id); };
  const one = UI.$('#pOne'); if (one) one.onclick = () => { ch.p.oneshot = !ch.p.oneshot; A.change('oneshot'); PANEL.open(id); };
  const mono = UI.$('#pMono'); if (mono) mono.onclick = () => { ch.p.mono = !ch.p.mono; A.change('mono'); PANEL.open(id); };
};
