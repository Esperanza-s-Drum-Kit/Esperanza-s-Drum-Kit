// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Josh Wilk. Part of Esperanza's Drum Kit; see LICENSE for terms (no warranty).
// Playlist: pattern clips placed on free tracks along a bar ruler. Click to place, drag to move,
// drag the right edge to resize (a clip longer than its pattern repeats it), right-click to delete.
'use strict';
const PL = { zoom: 6, songPos: 0, name: 110 }; // zoom = pixels per step

PL.width = () => {
  const L = M.songLen(A.proj);
  return Math.max(L + 8 * 16, 32 * 16);
};
PL.render = () => {
  const p = A.proj, el = UI.$('#plBody'), Z = PL.zoom, W = PL.width();
  PL.name = innerWidth <= 760 ? 72 : 110;
  const bars = W / 16;
  let ruler = '';
  const every = Z * 16 < 40 ? 4 : Z * 16 < 70 ? 2 : 1;
  for (let b = 0; b < bars; b += every) ruler += `<span style="left:${b * 16 * Z}px">${b + 1}</span>`;
  let tracks = '';
  for (let t = 0; t < p.playlist.tracks; t++) tracks += `<div class="ptrack"><div class="ptname">${UI.esc(p.playlist.names[t] || 'Track ' + (t + 1))}</div></div>`;
  const clips = p.playlist.clips.map((c) => {
    const pat = M.pat(p, c.pat); if (!pat) return '';
    return `<div class="clip${c.pat === p.cur ? ' cur' : ''}" data-clip="${c.id}" style="--pc:${pat.color};left:${c.start * Z}px;top:${c.track * 41}px;width:${c.len * Z - 1}px"><div class="ctitle">${UI.esc(pat.name)}</div><canvas></canvas><div class="rz"></div></div>`;
  }).join('');
  const grid = `background-image:linear-gradient(90deg, rgba(243,230,204,0.10) 1px, transparent 1px),linear-gradient(90deg, rgba(243,230,204,0.035) 1px, transparent 1px);background-size:${16 * Z}px 100%, ${4 * Z}px 100%`;
  const lp = p.loop;
  const loopBand = lp.len > 0 ? `<div class="loopband${lp.on ? ' on' : ''}" style="left:${lp.start * Z}px;width:${lp.len * Z}px"></div>` : '';
  const secs = p.sections.map((x) => `<div class="sec" data-sec="${x.id}" style="--sc:${x.color};left:${x.start * Z}px;width:${x.len * Z - 1}px" title="${UI.esc(x.name)} · bars ${x.start / 16 + 1}–${(x.start + x.len) / 16}"><span>${UI.esc(x.name)}</span><div class="rz"></div></div>`).join('');
  const empty = p.playlist.clips.length ? '' : `<div class="plempty">Click anywhere here to place <b>${UI.esc(M.pat(p).name)}</b>. Switch the transport to <b>SONG</b> to hear the arrangement.</div>`;
  el.innerHTML = `<div class="pl" style="width:${PL.name + W * Z}px"><div class="plhead"><div class="plcorner">Bars</div><div class="ruler" id="ruler">${loopBand}${ruler}<div class="songpos" style="left:${PL.songPos * Z}px"></div></div></div>
    <div class="plsecs"><div class="plcorner">Sections</div><div class="seclane" id="secLane" title="Click an empty spot to add a section">${secs}</div></div>
    <div class="pltracks">${tracks}<div class="plgrid" id="plGrid" style="left:${PL.name}px;${grid}">${clips}<div class="playhead hidden" id="playhead"></div></div></div>${empty}</div>`;
  UI.$$('#plGrid .clip').forEach(PL.drawClip);
  UI.$('#plZoom').value = String(PL.zoom);
  const lb = UI.$('#loopBtn'); if (lb) lb.classList.toggle('on', p.loop.on);
};

// tiny picture of the pattern's steps inside each clip
PL.drawClip = (el) => {
  const c = A.proj.playlist.clips.find((x) => x.id === el.dataset.clip), pat = M.pat(A.proj, c.pat), cv = el.querySelector('canvas');
  const w = Math.max(1, Math.round(c.len * PL.zoom)), h = 18, dpr = devicePixelRatio || 1;
  cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const used = A.proj.channels.filter((ch) => (pat.grid[ch.id] || []).some(Boolean));
  if (!used.length) return;
  const rh = Math.max(1, Math.min(4, h / used.length));
  g.fillStyle = 'rgba(243,230,204,0.85)';
  used.forEach((ch, r) => { for (let s = 0; s < c.len; s++) { const cell = M.cell(pat, ch.id, s % pat.len); if (cell) g.fillRect(s * PL.zoom + 0.5, r * rh + (h - used.length * rh) / 2, Math.max(1, PL.zoom - 1), Math.max(1, rh - 0.6)); } });
};

PL.showHead = (pos) => {
  const ph = UI.$('#playhead'); if (!ph) return;
  if (pos === null || A.proj.mode !== 'song') { ph.classList.add('hidden'); return; }
  ph.classList.remove('hidden'); ph.style.left = (ENG.songPos(A.proj, Math.floor(pos)) + (pos - Math.floor(pos))) * PL.zoom + 'px';
};

PL.init = () => {
  const body = UI.$('#plBody');
  const snap = (steps, fine) => { const q = fine ? 4 : 16; return Math.max(0, Math.round(steps / q) * q); };
  body.addEventListener('pointerdown', (e) => {
    if (e.button === 1) return;
    const grid = UI.$('#plGrid'), ruler = e.target.closest('#ruler');
    if (ruler) { // click: song start position · drag: loop region (bar snap)
      e.preventDefault();
      const rl = ruler.getBoundingClientRect().left, bar = (cx) => Math.max(0, Math.floor((cx - rl) / PL.zoom / 16));
      const b0 = bar(e.clientX); let dragged = false;
      ruler.setPointerCapture(e.pointerId);
      const mv = (ev) => {
        const b1 = bar(ev.clientX); if (b1 === b0 && !dragged) return;
        dragged = true; const a = Math.min(b0, b1), z = Math.max(b0, b1) + 1;
        A.proj.loop = { on: true, start: a * 16, len: (z - a) * 16 }; PL.render();
      };
      const up = () => {
        ruler.removeEventListener('pointermove', mv); ruler.removeEventListener('pointerup', up);
        if (dragged) { A.change('loop', { pl: true }); if (A.proj.mode !== 'song') A.setMode('song'); return; }
        PL.songPos = b0 * 16; UI.$('#ruler .songpos').style.left = PL.songPos * PL.zoom + 'px';
        A.showTime(null); if (A.eng.playing && A.proj.mode === 'song') A.eng.play(PL.songPos);
      };
      ruler.addEventListener('pointermove', mv); ruler.addEventListener('pointerup', up);
      return;
    }
    const lane = e.target.closest('#secLane');
    if (lane) { PL.secDown(e, lane); return; }
    if (!grid || !grid.contains(e.target)) return;
    const gr = grid.getBoundingClientRect(), p = A.proj;
    const clipEl = e.target.closest('.clip');
    if (clipEl) {
      const c = p.playlist.clips.find((x) => x.id === clipEl.dataset.clip);
      if (e.button === 2) { p.playlist.clips = p.playlist.clips.filter((x) => x !== c); A.change('clipdel', { pl: true }); return; }
      e.preventDefault();
      const resize = e.target.classList.contains('rz'), sx = e.clientX, sy = e.clientY, s0 = c.start, t0 = c.track, l0 = c.len;
      let moved = false;
      clipEl.setPointerCapture(e.pointerId);
      const mv = (ev) => {
        const dx = (ev.clientX - sx) / PL.zoom, dy = ev.clientY - sy;
        if (!moved && Math.hypot(ev.clientX - sx, dy) < 4) return;
        moved = true;
        if (resize) { c.len = Math.max(4, snap(l0 + dx, true) || 4); clipEl.style.width = c.len * PL.zoom - 1 + 'px'; }
        else {
          c.start = snap(s0 + dx, ev.altKey || ev.shiftKey); c.track = U.clamp(t0 + Math.round(dy / 41), 0, p.playlist.tracks - 1);
          clipEl.style.left = c.start * PL.zoom + 'px'; clipEl.style.top = c.track * 41 + 'px';
        }
      };
      const up = () => {
        clipEl.removeEventListener('pointermove', mv); clipEl.removeEventListener('pointerup', up); clipEl.removeEventListener('pointercancel', up);
        if (moved) A.change('clipmove', { pl: true });
        else if (p.cur !== c.pat) { p.cur = c.pat; A.change('cur', { rack: true, pl: true, top: true }); }
      };
      clipEl.addEventListener('pointermove', mv); clipEl.addEventListener('pointerup', up); clipEl.addEventListener('pointercancel', up);
      return;
    }
    if (e.button !== 0) return;
    // empty grid: place the current pattern at the bar under the pointer
    const x = e.clientX - gr.left, y = e.clientY - gr.top;
    const track = U.clamp(Math.floor(y / 41), 0, p.playlist.tracks - 1), pat = M.pat(p);
    const start = Math.floor(x / PL.zoom / 16) * 16;
    if (p.playlist.clips.some((c) => c.track === track && start < c.start + c.len && start + pat.len > c.start)) return;
    p.playlist.clips.push({ id: U.uid('k'), pat: pat.id, track, start, len: pat.len });
    A.change('clipadd', { pl: true });
  });
  body.addEventListener('contextmenu', (e) => { e.preventDefault(); const sec = e.target.closest('.sec'); if (sec) PL.secMenu(sec.dataset.sec, e.clientX, e.clientY); });
  body.addEventListener('dblclick', async (e) => { const sec = e.target.closest('.sec'); if (!sec) return; const x = A.proj.sections.find((q) => q.id === sec.dataset.sec); const n = await UI.ask('Section name', x.name); if (n) { x.name = n.slice(0, 30); A.change('secname', { pl: true }); } });
  UI.$('#loopBtn').onclick = () => { const lp = A.proj.loop; if (!lp.on && lp.len <= 0) { lp.start = 0; lp.len = M.songLen(A.proj); } lp.on = !lp.on; A.change('loopon', { pl: true }); };
  UI.$('#secBtn').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); const end = A.proj.sections.reduce((m, x) => Math.max(m, x.start + x.len), 0); PL.addSecMenu(r.left, r.bottom + 4, end); };
  UI.longPress(body, (x, y, e) => {
    const sec = e.target.closest && e.target.closest('.sec'); if (sec) { PL.secMenu(sec.dataset.sec, x, y); return; }
    const clipEl = e.target.closest && e.target.closest('.clip'); if (!clipEl) return;
    const p = A.proj, c = p.playlist.clips.find((k) => k.id === clipEl.dataset.clip);
    UI.menu(x, y, [
      ['Delete clip', () => { p.playlist.clips = p.playlist.clips.filter((k) => k !== c); A.change('clipdel', { pl: true }); }],
      ['Open pattern', () => { p.cur = c.pat; A.change('cur', { rack: true, pl: true, top: true }); A.view('rack'); }],
    ]);
  });
  UI.$('#plZoom').addEventListener('input', (e) => { PL.zoom = +e.target.value; PL.render(); });
};

// ---------------- sections ----------------
PL.addSecMenu = (x, y, start) => UI.menu(x, y, [
  ...M.SECTION_KINDS.map(([k]) => [k, () => { const def = /Intro|Outro|Breakdown|Interlude/.test(k) ? 64 : 128; const sec = M.newSection(A.proj, k, start, def); A.proj.sections.push(sec); A.proj.sections.sort((a, b) => a.start - b.start); A.change('secadd', { pl: true }); }]),
  'hr', ['Custom name…', async () => { const n = await UI.ask('Section name', ''); if (n) { const sec = M.newSection(A.proj, n.slice(0, 30), start, 128); A.proj.sections.push(sec); A.change('secadd', { pl: true }); } }],
]);
PL.secDown = (e, lane) => {
  const p = A.proj, el = e.target.closest('.sec'), lr = lane.getBoundingClientRect();
  if (!el) { if (e.button === 0) PL.addSecMenu(e.clientX, e.clientY + 8, Math.floor((e.clientX - lr.left) / PL.zoom / 16) * 16); return; }
  if (e.button === 2) return;
  e.preventDefault();
  const x = p.sections.find((q) => q.id === el.dataset.sec), resize = e.target.classList.contains('rz'), sx = e.clientX, s0 = x.start, l0 = x.len;
  let moved = false; el.setPointerCapture(e.pointerId);
  const mv = (ev) => {
    const dx = (ev.clientX - sx) / PL.zoom; if (!moved && Math.abs(ev.clientX - sx) < 4) return; moved = true;
    if (resize) { x.len = Math.max(16, Math.round((l0 + dx) / 16) * 16); el.style.width = x.len * PL.zoom - 1 + 'px'; }
    else { x.start = Math.max(0, Math.round((s0 + dx) / 16) * 16); el.style.left = x.start * PL.zoom + 'px'; }
  };
  const up = () => {
    el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up);
    if (moved) { p.sections.sort((a, b) => a.start - b.start); A.change('secmove', { pl: true }); return; }
    PL.songPos = x.start; UI.$('#ruler .songpos').style.left = PL.songPos * PL.zoom + 'px'; A.showTime(null);
    if (A.eng.playing && p.mode === 'song') A.eng.play(PL.songPos);
  };
  el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
};
PL.inside = (c, x) => c.start >= x.start && c.start < x.start + x.len;
PL.secMenu = (id, mx, my) => {
  const p = A.proj, x = p.sections.find((q) => q.id === id); if (!x) return;
  UI.menu(mx, my, [
    ['Loop this section', () => { p.loop = { on: true, start: x.start, len: x.len }; PL.songPos = x.start; if (p.mode !== 'song') p.mode = 'song'; A.change('loopsec', { pl: true, top: true }); if (A.eng.playing) A.play(); }],
    ['Play from here', () => { PL.songPos = x.start; if (p.mode !== 'song') A.setMode('song'); A.play(); }],
    'hr',
    ['Rename…', async () => { const n = await UI.ask('Section name', x.name); if (n) { x.name = n.slice(0, 30); A.change('secname', { pl: true }); } }],
    ['Duplicate after it (with its clips)', () => {
      // everything from the section's end moves right by its length; its clips and the section are copied into the gap
      const end = x.start + x.len, L = x.len;
      for (const c of p.playlist.clips) if (c.start >= end) c.start += L;
      for (const q of p.sections) if (q !== x && q.start >= end) q.start += L;
      const copies = p.playlist.clips.filter((c) => PL.inside(c, x)).map((c) => Object.assign({}, c, { id: U.uid('k'), start: c.start + L }));
      p.playlist.clips.push(...copies);
      const dup = Object.assign(M.newSection(p, x.kind, end, L), { color: x.color }); p.sections.push(dup); p.sections.sort((a, b) => a.start - b.start);
      A.change('secdup', { pl: true });
    }],
    ['Remove section (keep clips)', () => { p.sections = p.sections.filter((q) => q !== x); A.change('secdel', { pl: true }); }],
    ['Remove section and its clips', () => { p.playlist.clips = p.playlist.clips.filter((c) => !PL.inside(c, x)); p.sections = p.sections.filter((q) => q !== x); A.change('secdel', { pl: true }); }],
    'hr',
    ['Export this section as WAV', () => A.exportAudio('section', 'wav', x)],
    ['Export this section as MP3', () => A.exportAudio('section', 'mp3', x)],
  ]);
};
