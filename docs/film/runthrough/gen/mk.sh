#!/bin/zsh
# mk.sh <frames dir> <out.mp4> [fps_in] [width]   frames f00000.jpg… captured at a constant rate (default 12.5 fps) → 25 fps H.264, even dimensions
# width (e.g. 1920): a 2x laptop capture is downscaled to it with Lanczos, so the text is supersampled rather than captured soft
FF=$(cat "$(dirname "$0")/ffmpeg.path"); IN="$1"; OUT="$2"; FPS="${3:-12.5}"; W="${4:-}"
if [ -n "$W" ]; then VF="scale=$W:-2:flags=lanczos"; else VF="scale=trunc(iw/2)*2:trunc(ih/2)*2"; fi
"$FF" -y -loglevel error -framerate "$FPS" -i "$IN/f%05d.jpg" -vf "$VF" -r 25 -c:v libx264 -preset medium -crf 14 -pix_fmt yuv420p "$OUT" && "$FF" -loglevel error -i "$OUT" -f null - 2>&1 | tail -1; ls -la "$OUT" | awk '{print $5, $9}'
