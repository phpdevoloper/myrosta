# After frames.py: convert each 2k frame PNG in ~/Desktop/Myrosta film/frames-2k/ to a 1600-wide JPEG in
# docs/film/storyboard/img/ (F01.jpg … F12.jpg) and print the list the page's window.__generated should carry.
# Then republish docs/film/storyboard/index.html (with img/ as its files) to the storyboard Artifact.
import os,subprocess,json
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=os.path.expanduser("~/Desktop/Myrosta film/frames-2k"); IMG=os.path.normpath(os.path.join(HERE,"..","storyboard","img"))
done=[]
for n in range(1,13):
    src=f"{SRC}/F{n:02d}.png"; dst=f"{IMG}/F{n:02d}.jpg"
    if os.path.exists(src):
        subprocess.run(["sips","-s","format","jpeg","-s","formatOptions","84","-Z","1600",src,"--out",dst],capture_output=True); done.append(f"img/F{n:02d}.jpg")
print(json.dumps(done)); print("sizes:",[os.path.getsize(f"{IMG}/F{n:02d}.jpg")//1024 for n in range(1,13) if os.path.exists(f"{IMG}/F{n:02d}.jpg")],"KB")
