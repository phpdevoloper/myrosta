#!/bin/zsh
# deliver.sh — copies the finished run-through films and chapters (caption-free since 9 Oct 2026, a .vtt beside each) into the delivery folder beside the walkthrough film
set -e
W="/Users/ranjithkandavelu/Desktop/Myrosta film/runthrough/work"; V="$W/vid"; OUT="/Users/ranjithkandavelu/Desktop/Myrosta film/runthrough"
mkdir -p "$OUT/films" "$OUT/chapters" "$OUT/chapters-720p" "$OUT/staff-9x16" "$OUT/captions"
for k in staff staff-rolling staff-basket admin admin-rolling director; do cp "$V/rt-$k.mp4" "$OUT/films/myrosta-$k.mp4"; cp "$V/rt-$k-720p.mp4" "$OUT/films/myrosta-$k-720p.mp4"; cp "$V/rt-$k.vtt" "$OUT/captions/myrosta-$k.vtt"; done
for f in "$V"/rt-*.mp4; do b=$(basename "$f"); case "$b" in *9x16*|*720p*|rt-staff*|rt-admin*|rt-director*) ;; *) cp "$f" "$OUT/chapters/$b";; esac; done
for f in "$V"/rt-*-720p.mp4; do b=$(basename "$f"); case "$b" in *9x16*|rt-staff*|rt-admin*|rt-director*) ;; *) cp "$f" "$OUT/chapters-720p/$b";; esac; done
for f in "$V"/rt-*-9x16-720p.mp4; do cp "$f" "$OUT/staff-9x16/"; done
for f in "$V"/rt-*.vtt; do b=$(basename "$f"); case "$b" in rt-staff*|rt-admin*|rt-director*) ;; *) cp "$f" "$OUT/captions/$b";; esac; done
python3 "$W/rt/page.py" "$OUT/index.html" --root "$OUT"
du -sh "$OUT"; ls "$OUT"
