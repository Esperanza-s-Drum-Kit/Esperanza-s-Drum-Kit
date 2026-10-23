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
  const empty = p.playlist.clips.length ? '' : `<div class="plempty">Click anywhere here to place <b>${UI.esc(M.pat(p).name)}</b>. Switch the transport to <b>SONG</b> to hear the arrangement.</div>`;
  el.innerHTML = `<div class="pl" style="width:${PL.name + W * Z}px"><div class="plhead"><div class="plcorner">Bars</div><div class="ruler" id="ruler">${ruler}<div class="songpos" style="left:${PL.songPos * Z}px"></div></div></div>
    <div class="pltracks">${tracks}<div class="plgrid" id="plGrid" style="left:${PL.name}px;${grid}">${clips}<div class="playhead hidden" id="playhead"></div></div></div>${empty}</div>`;
  UI.$$('#plGrid .clip').forEach(PL.drawClip);
  UI.$('#plZoom').value = String(PL.zoom);
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
  ph.classList.remove('hidden'); ph.style.left = (pos % M.songLen(A.proj)) * PL.zoom + 'px';
};

PL.init = () => {
  const body = UI.$('#plBody');
  const snap = (steps, fine) => { const q = fine ? 4 : 16; return Math.max(0, Math.round(steps / q) * q); };
  body.addEventListener('pointerdown', (e) => {
    if (e.button === 1) return;
    const grid = UI.$('#plGrid'), ruler = e.target.closest('#ruler');
    if (ruler) { // set the song start position
      const x = e.clientX - ruler.getBoundingClientRect().left;
      PL.songPos = Math.max(0, Math.floor(x / PL.zoom / 16) * 16);
      UI.$('#ruler .songpos').style.left = PL.songPos * PL.zoom + 'px';
      if (A.eng.playing && A.proj.mode === 'song') A.eng.play(PL.songPos);
      return;
    }
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
  body.addEventListener('contextmenu', (e) => e.preventDefault());
  UI.longPress(body, (x, y, e) => {
    const clipEl = e.target.closest && e.target.closest('.clip'); if (!clipEl) return;
    const p = A.proj, c = p.playlist.clips.find((k) => k.id === clipEl.dataset.clip);
    UI.menu(x, y, [
      ['Delete clip', () => { p.playlist.clips = p.playlist.clips.filter((k) => k !== c); A.change('clipdel', { pl: true }); }],
      ['Open pattern', () => { p.cur = c.pat; A.change('cur', { rack: true, pl: true, top: true }); A.view('rack'); }],
    ]);
  });
  UI.$('#plZoom').addEventListener('input', (e) => { PL.zoom = +e.target.value; PL.render(); });
};
