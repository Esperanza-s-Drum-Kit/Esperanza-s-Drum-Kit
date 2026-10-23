// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Josh Wilk. Part of Esperanza's Drum Kit; see LICENSE for terms (no warranty).
// Channel rack: one row per channel, mute / pan / volume / mixer target / name, then the step grid of the current pattern.
'use strict';
const RACK = {};

RACK.render = () => {
  const p = A.proj, pat = M.pat(p), el = UI.$('#rackBody');
  const len = pat.len, bars = Math.ceil(len / 16);
  const anySolo = p.channels.some((c) => c.solo);
  const rows = p.channels.map((ch) => {
    const ledCls = ch.solo ? 'solo' : (ch.mute || (anySolo && !ch.solo)) ? 'off' : '';
    let steps = '';
    for (let b = 0; b < bars; b++) {
      steps += '<div class="bar">';
      for (let s = b * 16; s < Math.min(len, b * 16 + 16); s++) {
        const c = M.cell(pat, ch.id, s);
        steps += `<button class="st${Math.floor(s / 4) % 2 ? ' b' : ''}${c ? ' on' : ''}" data-s="${s}" aria-label="Step ${s + 1}">${c && c.v < 0.99 * M.DEF_VEL ? `<span class="vel" style="width:${Math.round(c.v * 100)}%"></span>` : ''}</button>`;
      }
      steps += '</div>';
    }
    return `<div class="crow${ch.id === p.sel ? ' sel' : ''}" data-ch="${ch.id}" style="--cc:${ch.color}">
      <div class="cctl"><button class="ledbtn" data-act="mute" title="Mute (right-click: solo)"><span class="led ${ledCls}"></span></button>
      ${UI.knob({ name: 'Pan', min: -1, max: 1, def: 0, bipolar: true, get: () => ch.pan, set: (v, done) => { ch.pan = Math.abs(v) < 0.02 ? 0 : v; A.change('pan' + ch.id, { quiet: !done }); }, fmt: RACK.fmtPan })}
      ${UI.knob({ name: 'Volume', min: 0, max: 1.25, def: 0.78, get: () => ch.vol, set: (v, done) => { ch.vol = v; A.change('vol' + ch.id, { quiet: !done }); }, fmt: (v) => Math.round(v * 100) + '%' })}
      <span class="tgt" title="Mixer track (mixer arrives in 0.4)">--</span>
      <button class="cname" data-act="name" title="${UI.esc(ch.name)}">${UI.esc(ch.name)}</button></div>
      <div class="steps">${steps}</div></div>`;
  }).join('');
  el.innerHTML = `<div class="rack">${rows}<div class="rackfoot"><button class="btn" data-act="add">+ Add channel</button><span class="hide-phone">Click a step to add a hit · drag to paint · right-click to remove · drop sounds or audio files on a name</span></div></div>`;
  RACK.nowCol = -1;
  UI.$('#swingK').innerHTML = UI.knob({ name: 'Swing', min: 0, max: 1, def: 0, get: () => p.swing, set: (v, done) => { p.swing = v; A.change('swing', { quiet: !done }); }, fmt: (v) => Math.round(v * 100) + '%' });
  UI.$('#patLen').value = String(len);
};
RACK.fmtPan = (v) => (Math.abs(v) < 0.01 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100));

// light the column that is playing now
RACK.nowCol = -1;
RACK.showNow = (col) => {
  if (col === RACK.nowCol) return;
  UI.$$('#rackBody .st.now').forEach((b) => b.classList.remove('now'));
  if (col >= 0) UI.$$(`#rackBody .st[data-s="${col}"]`).forEach((b) => b.classList.add('now'));
  RACK.nowCol = col;
};

RACK.init = () => {
  const body = UI.$('#rackBody');
  let paint = null; // { ch, on, done:Set }
  const applyStep = (btn, on) => {
    const row = btn.closest('.crow'), ch = M.chan(A.proj, row.dataset.ch), s = +btn.dataset.s, pat = M.pat(A.proj);
    const has = !!M.cell(pat, ch.id, s);
    if (on && !has) M.setCell(pat, ch.id, s, M.newCell(ch));
    if (!on && has) M.setCell(pat, ch.id, s, null);
    btn.classList.toggle('on', on); if (!on) btn.innerHTML = '';
  };
  body.addEventListener('pointerdown', (e) => {
    const st = e.target.closest('.st');
    if (st) {
      e.preventDefault();
      const row = st.closest('.crow'), pat = M.pat(A.proj);
      const on = e.button === 2 ? false : !M.cell(pat, row.dataset.ch, +st.dataset.s);
      paint = { ch: row.dataset.ch, on, last: st };
      applyStep(st, on);
      body.setPointerCapture(e.pointerId);
      return;
    }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const row = b.closest('.crow'), ch = row && M.chan(A.proj, row.dataset.ch);
    if (b.dataset.act === 'mute' && ch) {
      if (e.button === 2 || e.ctrlKey || e.metaKey) { const was = ch.solo; A.proj.channels.forEach((c) => (c.solo = false)); ch.solo = !was; ch.mute = false; } else ch.mute = !ch.mute;
      A.change('mute', { rack: true });
    }
  });
  body.addEventListener('pointermove', (e) => {
    if (!paint) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), st = el && el.closest('.st');
    if (!st || st === paint.last || st.closest('.crow').dataset.ch !== paint.ch) return;
    paint.last = st; applyStep(st, paint.on);
  });
  const end = () => { if (paint) { paint = null; A.change('steps', { pl: true }); } };
  body.addEventListener('pointerup', end); body.addEventListener('pointercancel', end);
  body.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const nm = e.target.closest('.cname'); if (nm) RACK.chanMenu(nm.closest('.crow').dataset.ch, e.clientX, e.clientY);
  });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'name') {
      const id = b.closest('.crow').dataset.ch, ch = M.chan(A.proj, id);
      if (A.proj.sel !== id) { A.proj.sel = id; UI.$$('#rackBody .crow').forEach((r) => r.classList.toggle('sel', r.dataset.ch === id)); A.change('sel'); }
      A.eng.preview(id, ch.note || 60, M.DEF_VEL);
    }
    if (b.dataset.act === 'add') { const r = b.getBoundingClientRect(); RACK.addMenu(r.left, r.bottom + 4); }
  });
  body.addEventListener('dblclick', (e) => { const nm = e.target.closest('.cname'); if (nm) PANEL.open(nm.closest('.crow').dataset.ch); });
  UI.longPress(body, (x, y, e) => { const nm = e.target.closest && e.target.closest('.cname'); if (nm) RACK.chanMenu(nm.closest('.crow').dataset.ch, x, y); });

  // sounds and audio files dropped on a channel name replace its sound; dropped elsewhere they become new channels
  body.addEventListener('dragover', (e) => { e.preventDefault(); UI.$$('#rackBody .crow.drop').forEach((r) => r.classList.remove('drop')); const r = e.target.closest('.crow'); if (r) r.classList.add('drop'); });
  body.addEventListener('dragleave', (e) => { if (!body.contains(e.relatedTarget)) UI.$$('#rackBody .crow.drop').forEach((r) => r.classList.remove('drop')); });
  body.addEventListener('drop', async (e) => {
    e.preventDefault(); UI.$$('#rackBody .crow.drop').forEach((r) => r.classList.remove('drop'));
    const row = e.target.closest('.crow'), target = row ? M.chan(A.proj, row.dataset.ch) : null;
    const sid = e.dataTransfer.getData('text/edk-sound');
    if (sid) { if (target) A.setSound(target, sid); else A.addSoundChannel(sid); return; }
    const files = Array.from(e.dataTransfer.files || []).filter((f) => /audio|\.(wav|mp3|ogg|flac|m4a|aif+)$/i.test(f.type + f.name));
    for (let i = 0; i < files.length; i++) await A.loadSampleFile(files[i], i === 0 ? target : null);
  });

  UI.$('#patLen').addEventListener('change', (e) => {
    const pat = M.pat(A.proj); pat.len = +e.target.value;
    for (const id in pat.grid) if (pat.grid[id].length > pat.len) pat.grid[id].length = pat.len;
    A.change('len', { rack: true, pl: true });
  });
};

RACK.chanMenu = (id, x, y) => {
  const p = A.proj, ch = M.chan(p, id), i = p.channels.indexOf(ch), pat = M.pat(p);
  const fill = (every) => () => { for (let s = 0; s < pat.len; s++) M.setCell(pat, id, s, s % every === 0 ? M.newCell(ch) : null); A.change('fill', { rack: true, pl: true }); };
  UI.menu(x, y, [
    ['Channel settings…', () => PANEL.open(id)],
    ['Rename…', () => { const n = prompt('Channel name', ch.name); if (n) { ch.name = n.slice(0, 40); A.change('name', { rack: true }); } }],
    ['Clone channel', () => { const c = JSON.parse(JSON.stringify(ch)); c.id = U.uid('c'); c.name = ch.name + ' 2'; c.solo = false; p.channels.splice(i + 1, 0, c); for (const pt of p.patterns) if (pt.grid[id]) pt.grid[c.id] = JSON.parse(JSON.stringify(pt.grid[id])); A.change('clone', { rack: true }); }],
    'hr',
    ['Fill every 2 steps', fill(2)], ['Fill every 4 steps', fill(4)], ['Fill every 8 steps', fill(8)],
    ['Clear steps', () => { delete pat.grid[id]; A.change('clear', { rack: true, pl: true }); }],
    'hr',
    ['Move up', () => { if (i > 0) { p.channels.splice(i, 1); p.channels.splice(i - 1, 0, ch); A.change('move', { rack: true }); } }],
    ['Move down', () => { if (i < p.channels.length - 1) { p.channels.splice(i, 1); p.channels.splice(i + 1, 0, ch); A.change('move', { rack: true }); } }],
    ['Delete channel', () => { p.channels.splice(i, 1); for (const pt of p.patterns) delete pt.grid[id]; if (p.sel === id) p.sel = p.channels[0] && p.channels[0].id; PANEL.close(); A.change('del', { rack: true, pl: true }); }],
  ]);
};

RACK.addMenu = (x, y) => {
  UI.menu(x, y, [
    ['Drum sound (Dark Roast kick)…', () => A.addSoundChannel('roast/kick', true)],
    ['808 bass', () => A.addSoundChannel('bass/808long', true)],
    ['Audio file…', async () => { const files = await U.pickFile('audio/*,.wav,.mp3,.ogg,.flac,.m4a', true); for (const f of files) await A.loadSampleFile(f, null); }],
    'hr',
    ...SOUND.SYNTHS.map((s, i) => ['Synth: ' + s[0], () => A.addSynthChannel(i)]),
  ]);
};
