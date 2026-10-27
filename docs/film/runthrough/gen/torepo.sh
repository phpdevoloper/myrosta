#!/bin/zsh
# torepo.sh — copies the run-through tooling from the durable work folder into docs/film/runthrough/gen (no frames, clips or audio renders; synthetic data only)
set -e
W="/Users/ranjithkandavelu/Desktop/Myrosta film/runthrough/work"; R=/Users/ranjithkandavelu/Desktop/Claude/Myrosta; G="$R/docs/film/runthrough/gen"
mkdir -p "$G/logs" "$G/takes" "$G/aud"
cp "$W/rt/"{build.py,sync.py,qa.py,page.py,deliver.sh,stage-upload.sh,manifest.py,encode.py,narrate.py,vtt.py,mk.sh,words_rt.py,torepo.sh,chapters.json,anchors.json,cards.json} "$G/"
cp "$W/rt/lib.js" "$G/lib.js"; cp "$W/rt/logs/"*.json "$G/logs/"; cp "$W/rt/takes/"*.js "$G/takes/"; cp "$W/rt/aud/lines.json" "$W/rt/aud/words.json" "$G/aud/"
cp "$W/vid/assemble.py" "$G/assemble.py"
echo "docs/film/runthrough/gen refreshed from $W"
