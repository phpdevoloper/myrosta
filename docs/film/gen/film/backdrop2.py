# Draws phone_backdrop2.png: the 1920x1080 plate for TWO phone recordings side by side (each 400x818, the same
# 1170x2532 capture with the demo banner cropped off, scaled), with a small label under each. Run: uv run --with pillow python backdrop2.py
from PIL import Image, ImageDraw, ImageFilter, ImageFont
W,H=1920,1080; pw,ph=400,818; gap=120; pad=16
xl=(W-(2*pw+gap))//2; xr=xl+pw+gap; y=(H-ph)//2
img=Image.new("RGB",(W,H),(11,42,51))
glow=Image.new("L",(W,H),0); ImageDraw.Draw(glow).ellipse([W/2-900,H/2-520,W/2+900,H/2+520],fill=120); glow=glow.filter(ImageFilter.GaussianBlur(220))
img=Image.composite(Image.new("RGB",(W,H),(15,59,69)),img,glow)
slots=((xl,"Emma"),(xr,"Sam · rota lead"))
for x,_ in slots:
    x0=x-pad; y0=y-pad; x1=x+pw+pad; y1=y+ph+pad
    sh=Image.new("L",(W,H),0); ImageDraw.Draw(sh).rounded_rectangle([x0,y0+18,x1,y1+18],radius=56,fill=160); sh=sh.filter(ImageFilter.GaussianBlur(40))
    img=Image.composite(Image.new("RGB",(W,H),(4,18,24)),img,sh)
font=ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc",30)
d=ImageDraw.Draw(img)
for x,label in slots:
    x0=x-pad; y0=y-pad; x1=x+pw+pad; y1=y+ph+pad
    d.rounded_rectangle([x0,y0,x1,y1],radius=56,fill=(14,32,40),outline=(120,190,180),width=3)
    tw=d.textlength(label,font=font); d.text((x+pw/2-tw/2,y0-52),label,font=font,fill=(159,227,212))  # above the phone, clear of the caption band
img.save("phone_backdrop2.png"); print("backdrop2 written", xl, xr, y)
