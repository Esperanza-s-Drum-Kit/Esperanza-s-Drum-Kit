# Esperanza's Drum Kit

*The best part of breaking down.*

A free, open-source, pattern-based beat studio in the DAWters and Son suite: a channel rack of step-sequenced
sounds, patterns arranged on a playlist, and a studio-grade audio engine. One codebase (plain HTML + Web Audio +
AudioWorklet, no libraries, works offline) runs in a browser and ships as an Android app, with Mac, Windows and
Linux builds to follow from the same Electron shell DAWters uses.

**Free software.** Copyright (C) 2026 Josh Wilk. GNU General Public License, version 3 or (at your option) any later
version — see [LICENSE](LICENSE). No price, no tiers, no sign-up, no tracking: the app makes no network requests.

## 0.1 — Foundations (this release)

- **Channel rack:** one row per channel with mute (right-click or Ctrl-click to solo), pan, volume and name;
  1–4 bar step grid, click to add, drag to paint, right-click to remove, steps shaded by beat. Swing.
- **Patterns:** any number; new, clone, rename, delete; step through with ‹ › or `[` `]` / numpad ±.
- **Playlist:** place pattern clips on 12 tracks; drag to move (bar snap, Alt/Shift for beats), drag the right edge
  to resize (a longer clip repeats its pattern), right-click or long-press to delete; click the ruler to set the song start.
- **Transport:** pattern / song mode (`L`), play/stop (`Space`), tempo 10–522 BPM (drag, wheel, double-click),
  bar:beat:step readout, master volume and peak meter.
- **Sounds:** five synthesised drum kits (Dark Roast, Espresso, Cold Brew, Drip Machine, Night Shift — 10 sounds
  each), three tuned 808s, 14 synth presets, and your own audio files (drop them on the rack or a channel name).
  Every factory sound is rendered by our own drum engine at start-up, so the library is ours outright.
- **Channel settings:** colour, volume, pan, home note; samplers get pitch, one-shot/note-length, ADSR, filter,
  velocity and level; synths get presets, filter, envelopes, detune, glide, vibrato, mono/poly.
- **Files:** `.edk` project files (zip of project JSON + your samples), autosave on the device, export song or
  pattern as 24-bit WAV, undo/redo (Ctrl+Z / Ctrl+Y), demo beat in File.
- **Layouts:** docked windows on desktop (F5 playlist, F6 rack, Alt+F8 sounds); one view at a time with bottom tabs on phones.

## Build

```
python3 build.py              # -> dist/edk.html (single self-contained file; open it in Chrome, Edge or Firefox)
sh android/build-apk.sh       # -> android/build/Esperanzas-Drum-Kit.apk (offline: aapt, javac, dx, zipalign, apksigner)
```

APK: package `com.wilk.edk`, minSdk 24, targetSdk 28, **no INTERNET permission**. The page is served to the
WebView from the APK's assets on `https://appassets.androidplatform.net` so AudioWorklet gets a secure context.
Saves and exports go to `Music/Esperanza's Drum Kit/`. Release builds are signed with the maintainer's key, passed in
as `EDK_KEYSTORE` (path, default `android/tools/edk.keystore`) and `EDK_KS_PASS`; the key is never in the repository.
Without them the script signs with a throwaway development key that won't install over a release build.

## Test

```
python3 tools/verify.py       # timing, swing, song arrangement, mute, tuning, file round trip, undo, live transport
python3 tools/ui_check.py /tmp   # real clicks: steps, paint, playlist clip, song play, panel, browser, undo
python3 tools/smoke.py /tmp      # console errors + desktop and phone screenshots
```

Verified in headless Chromium for 0.1: 16 kicks over 4 bars at 140 BPM land with **0 samples** of drift; 50% swing
moves the off-16th by exactly a quarter step; a clip longer than its pattern repeats it; a muted channel renders at
−240 dBFS; an 808 on A2 plays 110 Hz and a synth on A4 plays 440 Hz; project zip round-trips byte-exact; undo/redo;
the live transport runs. **Not yet run on a physical Android device.**

## Layout

- `src/core/` — shared with DAWters and Son: `worklet.js` (channel strip, limiter, fader), `inst-worklet.js`
  (synth, drum and sampler voices), `fx-worklet.js` (studio effects, used from 0.4), `util.js` (WAV, zip, storage)
- `src/app/model.js` — project model (time unit: one 16th-note step), undo history
- `src/app/sounds.js` — factory kits, 808s, synth presets, start-up rendering of the kit samples
- `src/app/engine.js` — audio graph, look-ahead step scheduler, offline render
- `src/app/rack.js`, `playlist.js`, `browser.js` (browser + channel settings), `ui.js` (knobs, menus), `app.js` (controller)
- `src/style.css` — "Percolator" design system; fonts Alfa Slab One, Barlow Condensed, DM Mono (SIL OFL 1.1, `src/fonts/`)
- `android/` — WebView shell, manifest, icons, build script

## Roadmap

0.2 sampler channel depth and browser · 0.3 piano roll · 0.4 mixer (inserts, effect slots, sends, sidechain) and
compressed export · 0.5 instruments · 0.6 automation clips · 0.7 audio recording, sample editor, slicer ·
0.8 chord tools · 0.9 MIDI and controller mapping · 1.0 MVP on all five platforms. After 1.0: preset player,
performance mode, more synths and effects; a native VST3/AU host for the desktop builds.
