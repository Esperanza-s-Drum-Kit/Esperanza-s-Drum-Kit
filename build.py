#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Josh Wilk. Part of Esperanza's Drum Kit; see LICENSE for terms (no warranty).
"""Build Esperanza's Drum Kit into one self-contained HTML file: dist/edk.html"""
import base64, json, os, re
ROOT = os.path.dirname(os.path.abspath(__file__))
S = lambda p: open(os.path.join(ROOT, 'src', p), encoding='utf-8').read()
def font(m):
    data = open(os.path.join(ROOT, 'src', 'fonts', m.group(1) + '.woff2'), 'rb').read()
    return 'url(data:font/woff2;base64,' + base64.b64encode(data).decode() + ')'
css = re.sub(r'url\(FONT:([\w-]+)\)', font, S('style.css'))
worklet = '\n'.join(S('core/' + f) for f in ['worklet.js', 'inst-worklet.js', 'fx-worklet.js'])
order = ['core/util.js', 'app/ui.js', 'app/sounds.js', 'app/model.js', 'app/engine.js', 'app/rack.js', 'app/playlist.js', 'app/browser.js', 'app/app.js']
js = '"use strict";\nconst WORKLET_SRC = ' + json.dumps(worklet) + ';\n' + '\n'.join(S(f) for f in order)
js = js.replace("'use strict';", '')
icon = 'data:image/svg+xml;base64,' + base64.b64encode(open(os.path.join(ROOT, 'src', 'icon.svg'), 'rb').read()).decode()
html = S('index.html').replace('/*CSS*/', css).replace('/*JS*/', js.replace('</script', '<\\/script')).replace('ICON_DATAURL', icon)
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', 'edk.html')
open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, len(html) // 1024, 'KB')
