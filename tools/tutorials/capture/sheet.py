import sys,glob,json
from PIL import Image,ImageDraw
d=sys.argv[1];fs=sorted(glob.glob(d+'/*.png'));a=int(sys.argv[2]) if len(sys.argv)>2 else 0;fs=fs[a:a+12]
W=Image.new('RGB',(200*len(fs),433+20),'white');dr=ImageDraw.Draw(W)
for i,f in enumerate(fs):W.paste(Image.open(f).resize((200,433)),(i*200,20));dr.text((i*200+4,4),f.split('/')[-1],fill='black')
W.save(sys.argv[3] if len(sys.argv)>3 else d+'/../sheet.png')
