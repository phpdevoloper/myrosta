#!/bin/zsh
# stage-upload.sh — the files for the private "videos" bucket, named as the app's VIDEOS manifest expects: <id>.mp4 (720p) and, for staff chapters, <id>-9x16.mp4 — and since 9 Oct 2026 a <id>.vtt / <id>-9x16.vtt caption file beside each
set -e
OUT="/Users/ranjithkandavelu/Desktop/Myrosta film/runthrough"; U="$OUT/videos-upload"; rm -rf "$U"; mkdir -p "$U"
for k in staff staff-rolling staff-basket admin admin-rolling director; do cp "$OUT/films/myrosta-$k-720p.mp4" "$U/$k.mp4"; cp "$OUT/captions/myrosta-$k.vtt" "$U/$k.vtt"; done
for id in S1 S2a S2b S2c S3 S4 S5 S6 S7 M1 M2 M3 M4 M5 M6 A1 A2 A3a A3b A4 A5 A6 A7 A8 A9 AM1 AM2 AM3 AM4 AM5 AM6; do cp "$OUT/chapters-720p/rt-$id-720p.mp4" "$U/$id.mp4"; cp "$OUT/captions/rt-$id.vtt" "$U/$id.vtt"; done
for id in S1 S2a S2b S2c S3 S4 S5 S6 S7 M1 M2 M3 M4 M5 M6; do cp "$OUT/staff-9x16/rt-$id-9x16-720p.mp4" "$U/$id-9x16.mp4"; cp "$OUT/captions/rt-$id-9x16.vtt" "$U/$id-9x16.vtt"; done
ls "$U" | wc -l; du -sh "$U"
