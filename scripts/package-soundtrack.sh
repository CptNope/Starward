#!/usr/bin/env bash
# Packages music/ as an album: numbered MP3s with album tags and cover art, plus one zip.
# The audio itself is copied untouched (ffmpeg -c copy); only the ID3 tags change.
# Usage: scripts/package-soundtrack.sh <outdir> [version]
set -euo pipefail
OUT="${1:-release}"; VER="${2:-1.0}"
ALBUM="Starward (Original Soundtrack)"; ARTIST="Jeremy Anderson"; YEAR="2026"
COVER="docs/images/soundtrack-cover.jpg"
TRACKS=(
  "starward-main-theme|Starward (Main Theme)"
  "drift|Drift"
  "engage|Engage"
  "dreadnought|Dreadnought"
  "dockside|Dockside"
  "groundfall|Groundfall"
  "breach|Breach"
)
DIR="$OUT/Starward Original Soundtrack"
rm -rf "$DIR"; mkdir -p "$DIR"
n=0; total=${#TRACKS[@]}
for t in "${TRACKS[@]}"; do
  n=$((n + 1)); file="${t%%|*}"; title="${t#*|}"
  dest="$DIR/$(printf '%02d' "$n") - $title.mp3"
  ffmpeg -v error -y -i "music/$file.mp3" -i "$COVER" -map 0:a -map 1:v -c copy -id3v2_version 3 \
    -metadata title="$title" -metadata artist="$ARTIST" -metadata album_artist="$ARTIST" \
    -metadata album="$ALBUM" -metadata track="$n/$total" -metadata date="$YEAR" -metadata genre="Soundtrack" \
    -metadata comment="From the browser game Starward: https://cptnope.github.io/Starward/" \
    -metadata:s:v title="Album cover" -metadata:s:v comment="Cover (front)" "$dest"
done
cp "$COVER" "$DIR/cover.jpg"
# Web-safe copies for release downloads (GitHub rewrites spaces and brackets in asset names)
UP="$OUT/upload"; rm -rf "$UP"; mkdir -p "$UP"; n=0
for t in "${TRACKS[@]}"; do
  n=$((n + 1)); title="${t#*|}"
  slug=$(echo "$title" | tr -cd '[:alnum:] ' | tr ' ' '-' | sed 's/--*/-/g')
  cp "$DIR/$(printf '%02d' "$n") - $title.mp3" "$UP/Starward-OST-$(printf '%02d' "$n")-$slug.mp3"
done
cp "$COVER" "$UP/Starward-OST-Cover.jpg"
(cd "$OUT" && rm -f "Starward-Soundtrack-$VER.zip" && zip -qr "Starward-Soundtrack-$VER.zip" "Starward Original Soundtrack" && mv "Starward-Soundtrack-$VER.zip" upload/)
echo "Packaged $total tracks; release files are in $OUT/upload"
