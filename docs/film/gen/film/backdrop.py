# Draws phone_backdrop.png: the 1920x1080 plate a phone recording sits on (dark teal, a soft glow, a thin rounded outline
# hugging a 468x957 video — a 1170x2532 capture with the demo banner cropped off, scaled). Run: uv run --with pillow python backdrop.py
from PIL import Image, ImageDraw, ImageFilter
W,H=1920,1080; ph_w,ph_h=468,957
img=Image.new("RGB",(W,H),(11,42,51))
glow=Image.new("L",(W,H),0); ImageDraw.Draw(glow).ellipse([W/2-700,H/2-520,W/2+700,H/2+520],fill=120); glow=glow.filter(ImageFilter.GaussianBlur(220))
img=Image.composite(Image.new("RGB",(W,H),(15,59,69)),img,glow)
pad=16; x0=(W-ph_w)//2-pad; y0=(H-ph_h)//2-pad; x1=x0+ph_w+2*pad; y1=y0+ph_h+2*pad
sh=Image.new("L",(W,H),0); ImageDraw.Draw(sh).rounded_rectangle([x0,y0+18,x1,y1+18],radius=64,fill=160); sh=sh.filter(ImageFilter.GaussianBlur(40))
img=Image.composite(Image.new("RGB",(W,H),(4,18,24)),img,sh)
ImageDraw.Draw(img).rounded_rectangle([x0,y0,x1,y1],radius=64,fill=(14,32,40),outline=(120,190,180),width=3)
img.save("phone_backdrop.png"); print("backdrop written")
