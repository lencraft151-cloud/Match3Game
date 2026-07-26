#!/bin/bash
# =============================================================================
#  Baut Gem Cascade als Android-App — ohne Gradle, direkt mit den
#  SDK-Werkzeugen. Fuer eine App aus einer Activity ohne Abhaengigkeiten sind
#  das sieben nachvollziehbare Schritte statt eines halben Build-Systems.
# =============================================================================
set -euo pipefail

SDK=/opt/android-sdk
BT=$SDK/build-tools/34.0.0
JAR=$SDK/platforms/android-34/android.jar

PROJ=/tmp/claude-0/android
APP=$PROJ/app
WORK=$PROJ/build
REPO=/home/user/Match3Game
OUT=$REPO/download/GemCascade.apk

rm -rf "$WORK"
mkdir -p "$WORK/res" "$WORK/classes" "$WORK/assets/www"

echo "== 1/7  Ressourcen uebersetzen =="
find "$APP/res" -type f | while read -r f; do
  "$BT/aapt2" compile "$f" -o "$WORK/res"
done
ls "$WORK/res" | sed 's/^/     /'

echo "== 2/7  Manifest und Ressourcen verlinken =="
"$BT/aapt2" link \
  -o "$WORK/base.apk" \
  -I "$JAR" \
  --manifest "$APP/AndroidManifest.xml" \
  --java "$WORK/gen" \
  --min-sdk-version 23 \
  --target-sdk-version 34 \
  $(find "$WORK/res" -name '*.flat' | sort)
mkdir -p "$WORK/gen"

echo "== 3/7  Java uebersetzen =="
mkdir -p "$WORK/gen"
javac -source 8 -target 8 -nowarn \
  -bootclasspath "$JAR" \
  -classpath "$JAR" \
  -d "$WORK/classes" \
  $(find "$APP/src" "$WORK/gen" -name '*.java' 2>/dev/null | sort) 2>&1 | grep -v "^Note:" || true
find "$WORK/classes" -name '*.class' | sed 's/^/     /'

echo "== 4/7  Nach Dex uebersetzen =="
"$BT/d8" --release --min-api 23 --lib "$JAR" \
  --output "$WORK" \
  $(find "$WORK/classes" -name '*.class' | sort)
ls -la "$WORK/classes.dex" | sed 's/^/     /'

echo "== 5/7  Das Spiel als Assets dazulegen =="
# Nur das, was das Spiel wirklich braucht. Kein Test, kein Server, kein
# Service Worker: in der App gibt es nichts zu cachen, alles ist schon da.
cd "$REPO"
cp index.html "$WORK/assets/www/"
cp manifest.webmanifest "$WORK/assets/www/"
mkdir -p "$WORK/assets/www/css" "$WORK/assets/www/js" "$WORK/assets/www/icons"
cp css/style.css "$WORK/assets/www/css/"
cp js/*.js "$WORK/assets/www/js/"
cp icons/*.png icons/icon.svg "$WORK/assets/www/icons/"
find "$WORK/assets/www" -type f | wc -l | sed 's/^/     Dateien: /'

cd "$WORK"
zip -q -r base.apk assets classes.dex
echo "     eingepackt"

echo "== 6/7  Ausrichten =="
rm -f aligned.apk
"$BT/zipalign" -p -f 4 base.apk aligned.apk

echo "== 7/7  Signieren =="
KEY=$PROJ/gemcascade.keystore
if [ ! -f "$KEY" ]; then
  keytool -genkeypair -v -keystore "$KEY" \
    -alias gemcascade -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass gemcascade -keypass gemcascade \
    -dname "CN=Gem Cascade, OU=Game, O=Gem Cascade, L=-, ST=-, C=DE" 2>&1 | tail -2
fi

"$BT/apksigner" sign \
  --ks "$KEY" --ks-pass pass:gemcascade --key-pass pass:gemcascade \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$OUT" aligned.apk

# apksigner legt daneben eine .idsig fuer das v4-Schema ab. Die braucht nur,
# wer per `adb install --incremental` installiert — fuer einen Download ist
# sie nutzlos und hat im Repo nichts verloren.
rm -f "$OUT.idsig"

echo
echo "fertig: $OUT  ($(du -h "$OUT" | cut -f1))"
