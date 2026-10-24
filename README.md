# Esperanza's Drum Kit

*The best part of breaking down.*

A free, open-source, pattern-based beat studio in the DAWters and Son suite: a channel rack of step-sequenced
sounds, patterns arranged on a playlist, and a studio-grade audio engine. One codebase (plain HTML + Web Audio +
AudioWorklet, no libraries, works offline) runs in a browser and ships as an Android app, with Mac, Windows and
Linux builds to follow from the same Electron shell DAWters uses.

**Free software.** Copyright (C) 2026 Josh Wilk. GNU General Public License, version 3 or (at your option) any later
version — see [LICENSE](LICENSE). No price, no tiers, no sign-up, no tracking: the app makes no network requests (Send to DAWters opens the DAWters page, only when you choose it).

## 0.3.0 — inside DAWters (this release)

- **Beat tracks in DAWters and Son 2.4:** a whole Drum Kit project lives on a DAWters track. Its song, its
  sections and its patterns go on the DAWters timeline as clips, render sample-for-sample the same as here, and
  double-clicking one opens this editor inside DAWters.
- **Send to DAWters** (File menu): on the web it opens DAWters and puts this beat on a new Beat track; the
  Android app saves a `.dawsuite.json` for DAWters' File → Import from the suite (which also takes `.edk` files).
  This is the only time the app opens anything on the internet, and only when you choose it.

## 0.2.1 — synth fixes

- Turning a channel's **Home note** now moves the key of every step it already plays, in every pattern (before, it only set the note for new steps).
- Clicking a **synth** in the Sounds browser plays a short preview, as drums already did, and every knob in a channel's settings plays the sound when you let go, so each change is heard.

## 0.2 — Feel, sections, loops, MP3, your own samples

- **Feel (humanize):** one dial from *Machine* (exactly on the grid) to *Drunk*, with presets in between
  (Studio tight, In the pocket, Laid back, Live drummer, Rushing, Loose). **Push** lays the groove back or rushes it;
  **Dynamics** shapes velocity by where each hit falls in the bar. Each instrument plays its own part of the pocket:
  kicks stay tightest, snares and claps sit back or push, hats breathe most. Timing drifts smoothly the way a
  player's hands do, rather than as independent random jitter, and the same settings give the same performance
  every pass; *New take* gives a different one, and *Vary each pass* makes every loop slightly different.
  Every channel has its own Feel amount (0% keeps it on the grid). Each hit's shift shows as a tick inside its step.
  Measured at Laid back: a clap lands 9–16 ms behind the beat while the kick stays within ±5 ms.
- **Song sections:** a lane over the playlist for Intro, Verse, Pre-chorus, Chorus, Hook, Bridge, Breakdown, Drop,
  Interlude and Outro (or any name). Move and resize them, click one to jump there, and use its menu to loop it,
  play from it, duplicate it with its clips (everything after moves right), remove it, or export it as WAV or MP3.
- **Loops:** drag across the ruler to set a loop region; the Loop button switches it on and off. Patterns loop in
  pattern mode, the song (or its loop region) in song mode. Sampler channels can loop their sample.
- **MP3 export** (320 kbps, bundled LAME encoder) alongside 24-bit WAV, for the song, the pattern or a section.
- **Your own samples:** record from the microphone (silence trimmed, level set, named, straight into the rack; you
  can play the beat while you record), or load audio files. Sample tools on every sampler: reverse, normalize,
  loop, and *fit to 1/2/4/8 bars* at the project tempo.
- **Opens everywhere:** in-page dialogs instead of browser pop-ups; Safari needs the page served from a web
  address, so the web build now ships with a local launcher (`web/`), and a clear message explains it if audio can't start.

## 0.1 — Foundations

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
python3 build.py              # -> dist/edk.html (single file), dist/Esperanzas-Drum-Kit-web.zip (page + local launcher),
                              #    dist/edk-page.html (for publishing as a Claude page)
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
python3 tools/verify02.py     # loop region, sections, section export, MP3 round trip, Feel in a render, sample tools, mic recording,
                              # home-note transposing, synth preview
python3 tools/feel_check.py   # what every Feel preset does to timing and velocity, per instrument
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
- `src/app/rack.js` (rack + Feel panel), `playlist.js` (clips, sections, loop), `browser.js` (browser + channel settings),
  `record.js` (microphone recording + sample tools), `ui.js` (knobs, menus, dialogs), `app.js` (controller, files, export)
- `src/vendor/lame.min.js` — lamejs 1.2.1 MP3 encoder (LGPL-3.0, `src/vendor/lamejs-LICENSE.txt`)
- `web/` — local launcher (Python 3) for running the web build at `http://localhost:8748`
- `src/style.css` — "Percolator" design system, the late-show sibling of DAWters and Son's "On the Air" (shared type: Yesteryear, Oswald, Courier Prime; plus Alfa Slab One for the wordmark; SIL OFL 1.1, `src/fonts/`)
- `android/` — WebView shell, manifest, icons, build script

## Roadmap

0.3 Mac/Windows/Linux packages, layer channels, piano roll · 0.4 mixer (inserts, effect slots, sends, sidechain) and
compressed export · 0.5 instruments · 0.6 automation clips · 0.7 audio recording, sample editor, slicer ·
0.8 chord tools · 0.9 MIDI and controller mapping · 1.0 MVP on all five platforms. After 1.0: preset player,
performance mode, more synths and effects; a native VST3/AU host for the desktop builds.
