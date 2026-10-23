#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Josh Wilk. Part of Esperanza's Drum Kit; see LICENSE for terms (no warranty).
# Build Esperanza's Drum Kit for Android offline with Debian/Ubuntu SDK packages:
#   apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk
set -e
cd "$(dirname "$0")"
SDK=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
DX=$(command -v dx || command -v dalvik-exchange)
rm -rf build assets && mkdir -p build/gen build/classes build/apk assets
cp ../dist/edk.html assets/index.html
aapt package -f -m -J build/gen -M AndroidManifest.xml -S res -I "$SDK" --min-sdk-version 24 --target-sdk-version 28
unset JAVA_TOOL_OPTIONS
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$SDK" -d build/classes build/gen/com/wilk/edk/R.java src/com/wilk/edk/MainActivity.java
$DX --dex --min-sdk-version=24 --output=build/apk/classes.dex build/classes
aapt package -f -M AndroidManifest.xml -S res -A assets -I "$SDK" --min-sdk-version 24 --target-sdk-version 28 -F build/unsigned.apk
(cd build/apk && aapt add ../unsigned.apk classes.dex >/dev/null)
zipalign -f 4 build/unsigned.apk build/aligned.apk
# Release key: EDK_KEYSTORE (default tools/edk.keystore) + EDK_KS_PASS. Neither belongs in the repository.
# Without them the APK is signed with a throwaway development key (fine for testing; it won't update a release install).
KS=${EDK_KEYSTORE:-tools/edk.keystore}; PASS=${EDK_KS_PASS:-}
if [ ! -f "$KS" ] || [ -z "$PASS" ]; then
  echo "No release key (set EDK_KEYSTORE and EDK_KS_PASS) - signing with a development key."
  KS=build/dev.keystore; PASS=android
  keytool -genkeypair -keystore "$KS" -alias edk -keyalg RSA -keysize 2048 -validity 12000 -storepass $PASS -keypass $PASS -dname "CN=Esperanza's Drum Kit development" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-key-alias edk --ks-pass "pass:$PASS" --key-pass "pass:$PASS" --out "build/Esperanzas-Drum-Kit.apk" build/aligned.apk
apksigner verify --print-certs "build/Esperanzas-Drum-Kit.apk" | head -2
ls -la "build/Esperanzas-Drum-Kit.apk"
