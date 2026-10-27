#!/bin/zsh
cd "$(dirname "$0")"
run(){ uv run --python 3.11 --with "mediapipe==0.10.14" --with "opencv-contrib-python==4.10.0.84" --with "protobuf<5" --with numpy python lipline.py "$@" 2>&1 | grep -v "^Installed\|^Resolved\|^Prepared\|^Audited\|WARNING\|INFO\|^I0000\|^W0000\|UserWarning\|warnings.warn"; }
run veo3_1/F01.mp4 3.42 5.10 "F01 Sam 'three swaps'"
run veo3_1/F02.mp4 1.10 3.98 "F02 Emma 'on the fridge'"
run veo3_1/F04.mp4 0.00 3.98 "F04 Emma cafe"
run veo3_1/F05.mp4 3.60 4.84 "F05 Sam 'half full'"
run veo3_1/F06.mp4 0.74 4.80 "F06 Emma corridor"
run veo3_1/F08.mp4 0.42 1.30 "F08 Alex car park"
run veo3_1/F09.mp4 3.30 5.10 "F09 Sam 'approved'"
run veo3_1/F10.mp4 0.00 1.90 "F10 Morgan"
run veo3_1/F10.mp4 2.00 3.98 "F10 Sam 'five rosters'"
run kling3_0/F11.mp4 5.44 7.74 "F11 Sam garden"
run veo3_1/F13.mp4 2.34 3.62 "F13 Emma 'calendar'"
