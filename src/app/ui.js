// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Josh Wilk. Part of Esperanza's Drum Kit; see LICENSE for terms (no warranty).
// Small UI kit: knobs, menus, tooltip, toast, icons.
'use strict';
const UI = {};
UI.$ = (s, r) => (r || document).querySelector(s);
UI.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
UI.esc = U.esc;
UI.ICONS = {
  play: '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5z"/></svg>',
  stop: '<svg viewBox="0 0 16 16"><rect x="3.5" y="3.5" width="9" height="9" rx="1"/></svg>',
  rec: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/></svg>',
  undo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4L2 7l3 3"/><path d="M2.5 7H10a3.5 3.5 0 010 7H7"/></svg>',
  redo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4l3 3-3 3"/><path d="M13.5 7H6a3.5 3.5 0 000 7h3"/></svg>',
  wav: '<svg class="wav" viewBox="0 0 14 10" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 5h1.5l1.5-4 2 8 2-6 1.5 4L11 5h2"/></svg>',
  synth: '<svg class="wav" viewBox="0 0 14 10" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 8V2h3v6h3V2h3v6h3"/></svg>',
  // a percolator with steam: the app mark (original drawing)
  cup: '<svg class="cup" viewBox="0 0 32 32"><path d="M11 3c-1 2 1 3 0 5M16 2c-1 2 1 3 0 5M21 3c-1 2 1 3 0 5" stroke="#f0c46a" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M7 11h18l-2 16a3 3 0 01-3 2.5h-8A3 3 0 019 27z" fill="#f3e6cc"/><path d="M25 14h2.5a3 3 0 010 6H24" stroke="#f3e6cc" stroke-width="2.2" fill="none"/><rect x="9" y="17" width="14" height="5" fill="#9e1b22"/><path d="M11.5 19.5h2l1-1.5 1.5 3 1-1.5h3.5" stroke="#f0c46a" stroke-width="1" fill="none"/></svg>',
};

// ---- knobs: drag up/down (shift for fine), wheel, double-click resets ----
UI.specs = new Map();
let knobSeq = 0;
// spec: { min, max, def, get(), set(v, done), fmt(v), step, log, bipolar }
UI.knob = (spec, cls) => {
  const id = 'k' + (++knobSeq); UI.specs.set(id, spec);
  return `<div class="knob ${cls || ''}" data-knob="${id}" title="${UI.esc(spec.name || '')}">${UI.knobSvg(spec)}</div>`;
};
UI.knobLabeled = (label, spec, cls) => `<div class="kwrap"><label>${UI.esc(label)}</label>${UI.knob(Object.assign({ name: label }, spec), cls)}<output>${UI.esc((spec.fmt || UI.fmtNum)(spec.get()))}</output></div>`;
UI.fmtNum = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
UI.norm = (s, v) => (s.log ? Math.log(v / s.min) / Math.log(s.max / s.min) : (v - s.min) / (s.max - s.min));
UI.denorm = (s, n) => { n = U.clamp(n, 0, 1); let v = s.log ? s.min * Math.pow(s.max / s.min, n) : s.min + n * (s.max - s.min); if (s.step) v = Math.round(v / s.step) * s.step; return v; };
UI.knobSvg = (s) => {
  const n = U.clamp(UI.norm(s, s.get()), 0, 1), a0 = -135, a = a0 + n * 270, R = 11;
  const pt = (deg, r) => [16 + r * Math.sin(deg * Math.PI / 180), 16 - r * Math.cos(deg * Math.PI / 180)];
  const arc = (from, to) => { if (Math.abs(to - from) < 0.5) return ''; const [x0, y0] = pt(from, R + 3), [x1, y1] = pt(to, R + 3); return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R + 3} ${R + 3} 0 ${Math.abs(to - from) > 180 ? 1 : 0} ${to > from ? 1 : 0} ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
  const from = s.bipolar ? 0 : a0; const [px, py] = pt(a, R - 3);
  return `<svg viewBox="0 0 32 32"><path class="trk" d="${arc(a0, 135)}"/><path class="val" d="${arc(Math.min(from, a), Math.max(from, a))}"/><circle class="cap" cx="16" cy="16" r="${R}"/><line class="ptr" x1="16" y1="16" x2="${px.toFixed(2)}" y2="${py.toFixed(2)}"/></svg>`;
};
UI.refreshKnob = (el) => {
  const s = UI.specs.get(el.dataset.knob); if (!s) return;
  el.innerHTML = UI.knobSvg(s);
  const out = el.parentElement && el.parentElement.querySelector('output'); if (out) out.textContent = (s.fmt || UI.fmtNum)(s.get());
};
UI.tip = (x, y, text) => { let t = UI.$('#tip'); if (!t) { t = document.createElement('div'); t.id = 'tip'; document.body.appendChild(t); } t.style.left = x + 'px'; t.style.top = y + 'px'; t.textContent = text; t.classList.remove('hidden'); };
UI.untip = () => { const t = UI.$('#tip'); if (t) t.classList.add('hidden'); };
UI.initKnobs = () => {
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.knob'); if (!el || e.button > 0) return;
    const s = UI.specs.get(el.dataset.knob); if (!s) return;
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    let n = UI.norm(s, s.get()), y = e.clientY;
    const r = el.getBoundingClientRect();
    const show = () => UI.tip(r.left + r.width / 2, r.top, (s.name ? s.name + ' ' : '') + (s.fmt || UI.fmtNum)(s.get()));
    show();
    const mv = (ev) => { const dy = y - ev.clientY; y = ev.clientY; n = U.clamp(n + dy / (ev.shiftKey ? 600 : 150), 0, 1); s.set(UI.denorm(s, n), false); UI.refreshKnob(el); show(); };
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); UI.untip(); s.set(s.get(), true); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
  document.addEventListener('dblclick', (e) => {
    const el = e.target.closest('.knob'); if (!el) return; const s = UI.specs.get(el.dataset.knob);
    if (s && s.def !== undefined) { s.set(s.def, true); UI.refreshKnob(el); }
  });
  document.addEventListener('wheel', (e) => {
    const el = e.target.closest('.knob'); if (!el) return; const s = UI.specs.get(el.dataset.knob); if (!s) return;
    e.preventDefault();
    const n = U.clamp(UI.norm(s, s.get()) - Math.sign(e.deltaY) * (e.shiftKey ? 0.005 : 0.03), 0, 1);
    s.set(UI.denorm(s, n), true); UI.refreshKnob(el);
  }, { passive: false });
};

// ---- menus ----
UI.closeMenu = () => { UI.$$('.menu').forEach((m) => m.remove()); };
// items: [[label, fn], 'hr', ...]
UI.menu = (x, y, items) => {
  UI.closeMenu();
  const m = document.createElement('div'); m.className = 'menu';
  m.innerHTML = items.map((it, i) => (it === 'hr' ? '<hr>' : `<button data-i="${i}">${UI.esc(it[0])}</button>`)).join('');
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px'; m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
  m.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; UI.closeMenu(); items[+b.dataset.i][1](); });
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!m.contains(e.target)) { UI.closeMenu(); document.removeEventListener('pointerdown', off, true); } }, true), 0);
};
UI.toast = (msg, ms) => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms || 2200); };
// long-press for touch screens: calls fn(x, y) after 480 ms without movement
UI.longPress = (el, fn) => {
  let tm = null, sx = 0, sy = 0;
  el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; sx = e.clientX; sy = e.clientY; clearTimeout(tm); tm = setTimeout(() => { tm = null; fn(sx, sy, e); }, 480); });
  const cancel = () => { clearTimeout(tm); tm = null; };
  el.addEventListener('pointermove', (e) => { if (tm && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) cancel(); });
  el.addEventListener('pointerup', cancel); el.addEventListener('pointercancel', cancel);
};
UI.noteName = (n) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][((n % 12) + 12) % 12] + Math.floor(n / 12);

// ---- in-page dialogs (pop-up prompt/confirm are blocked in some hosts) ----
UI.dialog = (title, opts) => new Promise((res) => {
  opts = opts || {};
  const d = document.createElement('div'); d.className = 'dlg-back';
  d.innerHTML = `<form class="dlg" role="dialog" aria-label="${UI.esc(title)}"><h3>${UI.esc(title)}</h3>${opts.text ? `<p>${UI.esc(opts.text)}</p>` : ''}${opts.input !== undefined ? `<input id="dlgIn" value="${UI.esc(opts.input)}" ${opts.number ? 'inputmode="decimal"' : ''} autocomplete="off">` : ''}<div class="dlg-btns"><button type="button" class="btn" data-x="0">Cancel</button><button type="submit" class="btn on">${UI.esc(opts.ok || 'OK')}</button></div></form>`;
  document.body.appendChild(d);
  const inp = d.querySelector('#dlgIn'); if (inp) { inp.focus(); inp.select(); } else d.querySelector('[type=submit]').focus();
  const done = (v) => { d.remove(); res(v); };
  d.querySelector('form').onsubmit = (e) => { e.preventDefault(); done(inp ? inp.value : true); };
  d.querySelector('[data-x]').onclick = () => done(opts.input !== undefined ? null : false);
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(opts.input !== undefined ? null : false); } });
  d.addEventListener('pointerdown', (e) => { if (e.target === d) done(opts.input !== undefined ? null : false); });
});
UI.ask = (title, value, opts) => UI.dialog(title, Object.assign({ input: value === undefined ? '' : String(value) }, opts));
UI.confirm = (title, text, ok) => UI.dialog(title, { text, ok });
