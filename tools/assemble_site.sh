#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Josh Wilk. Part of Esperanza's Drum Kit; see LICENSE for terms (no warranty).
# Assemble the public website into _site/: the marketing page at / and the web app at /app/.
set -e
cd "$(dirname "$0")/.."
python3 build.py
rm -rf _site && mkdir -p _site/app
cp -r site/. _site/
cp dist/edk.html _site/app/index.html
cp LICENSE _site/LICENSE.txt
touch _site/.nojekyll
du -sh _site
