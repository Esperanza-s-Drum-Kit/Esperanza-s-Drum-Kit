# Contributing to Esperanza's Drum Kit

Thanks for helping. Esperanza's Drum Kit is free software under the GPL-3.0-or-later, part of the DAWters and Son
suite, and it stays free: no paid tiers, no sign-up and no tracking. Contributions must keep it that way: nothing
that sends data over the network, and nothing that only works for paying users.

- **Bugs:** open an issue with your device (Android, browser and version), the app version from File › About,
  and the steps to reproduce. A small `.edk` project that shows the problem helps a lot.
- **Code:** `python3 build.py` builds `dist/edk.html`; open it in Chrome to test (Safari needs the local launcher in
  `web/`). Keep the plain-JS, no-framework style and add the SPDX header to new files. Run `python3 tools/verify.py`
  and `python3 tools/verify02.py` (Playwright + Chromium) before sending a pull request.
- **Sounds:** factory sounds are synthesised by the app. Recorded samples are accepted only under CC0 or CC-BY, with
  an entry in a credits file; never non-commercial licences.
- **Shared code:** `src/core/` is shared with DAWters and Son. Fix it in both projects, or open an issue in each.

By contributing you agree that your work is licensed under the GPL-3.0-or-later.
