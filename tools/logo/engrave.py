"""Turn the developer's edited Pierre photo into an engraving: cream paper, black ink hatching,
spot colours (red beret, gold glasses, amber eyes, green cross) kept from the photo."""
import sys, numpy as np, cv2
W=sys.argv[1]
im=cv2.imread(W+'/cat.jpg'); N=im.shape[0]
SIL=[(168,252),(172,212),(205,170),(255,125),(318,82),(362,42),(402,18),(470,13),(560,10),(650,12),(720,24),(760,50),(772,92),(812,108),(856,114),(830,150),(805,205),(800,260),(808,330),(800,400),(812,450),(848,480),(885,525),(912,600),(930,700),(936,800),(932,900),(928,1024),(58,1024),(54,900),(58,760),(78,610),(108,505),(150,432),(200,384),(250,338),(288,312),(240,302),(190,296)]
MUG=[(435,630),(470,600),(560,590),(680,600),(712,630),(712,690),(760,684),(792,704),(786,732),(742,732),(706,760),(700,860),(690,910),(660,935),(560,942),(490,925),(470,880),(450,760),(435,660)]
GLASSBOX=(395,330,805,490)
EYES=[[(452,372),(470,362),(495,358),(518,364),(532,378),(528,394),(508,400),(482,398),(462,390)],
      [(664,384),(680,376),(698,376),(708,384),(704,398),(688,404),(672,400)]]
def poly(pts,blur=0):
    m=np.zeros((N,N),np.float32); cv2.fillPoly(m,[np.array(pts,np.int32)],1.0)
    return cv2.GaussianBlur(m,(0,0),blur) if blur else m
sil=(cv2.GaussianBlur(poly(SIL),(0,0),8)>0.5).astype(np.float32)
sm=cv2.bilateralFilter(im,9,40,7)
hsv=cv2.cvtColor(sm,cv2.COLOR_BGR2HSV).astype(np.float32); h,s,v=hsv[...,0],hsv[...,1],hsv[...,2]
def clean(m,k=3,minarea=30):
    m=cv2.morphologyEx(m.astype(np.uint8),cv2.MORPH_OPEN,np.ones((k,k),np.uint8))
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((k+2,k+2),np.uint8))
    n,lab,st,_=cv2.connectedComponentsWithStats(m,8)
    return np.isin(lab,[i for i in range(1,n) if st[i,4]>=minarea]).astype(np.float32)
red=clean(((h<9)|(h>168))&(s>90)&(v>50),5,2000)*sil
green=clean((h>50)&(h<90)&(s>90),3,500)
gbox=np.zeros((N,N),bool); x0,y0,x1,y1=GLASSBOX; gbox[y0:y1,x0:x1]=True
eyes=poly(EYES[0])+poly(EYES[1])
gold=clean((h>=8)&(h<=32)&(s>55)&(v>70)&gbox&(eyes<0.5),2,12)
gold=cv2.morphologyEx(gold,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9)))
gold=cv2.dilate(gold,np.ones((2,2),np.uint8))*gbox
scarf=clean((h>95)&(h<130)&(s>25)&(v>55),5,3000)*sil
mug=poly(MUG,1.5)
g=cv2.cvtColor(sm,cv2.COLOR_BGR2GRAY).astype(np.float32)/255
gl=cv2.createCLAHE(2.0,(8,8)).apply((g*255).astype(np.uint8)).astype(np.float32)/255
d=np.clip((1-gl-0.1)/0.85,0,1)**1.1
# region tone tweaks: lighter beret/scarf so the hatching (and spot colour) reads
d=d*(1-red)+(0.15+0.6*np.clip((d-0.3)/0.7,0,1))*red
d=d*(1-scarf)+(0.12+0.55*np.clip((d-0.2)/0.8,0,1))*scarf
d=d*(1-eyes)+0.0*eyes
d=d*(1-green)
yy,xx=np.mgrid[0:N,0:N].astype(np.float32)
warp=cv2.GaussianBlur(g,(0,0),16)*24
per=7.0
def hatch(theta,period,wk=1.0,curve=0):
    t=np.deg2rad(theta); u=xx*np.cos(t)+yy*np.sin(t)+warp*wk+curve
    return np.abs((u/period)%1.0-0.5)*2
def layer(hh,lo,hi): return (hh<np.clip((d-lo)/(hi-lo),0,1)).astype(np.float32)
cx=575; mugc=((xx-cx)/140)**2*22
bc=-((xx-470)/320)**2*60
fur=np.maximum.reduce([layer(hatch(-35,per),0.12,1.05),layer(hatch(55,per*1.1),0.5,1.2),layer(hatch(10,per*0.9),0.8,1.3)])
sc=np.maximum(layer(hatch(0,per*0.9,0.15),0.12,1.05),layer(hatch(80,per*1.3,0.3),0.55,1.25))
be=np.maximum(layer(hatch(90,per,0.2,bc),0.1,1.0),layer(hatch(30,per*1.2,0.2),0.6,1.2))
mg=np.maximum(layer(hatch(90,per*1.1,0,mugc),0.06,0.9),layer(hatch(0,per*1.2,0),0.6,1.3))
ink=fur
for m,l in ((scarf,sc),(red,be),(mug,mg)): ink=ink*(1-m)+l*m
ed=cv2.Canny(cv2.GaussianBlur((g*255).astype(np.uint8),(0,0),2.0),22,60).astype(np.float32)/255
ed=cv2.dilate(ed,np.ones((2,2),np.uint8))
dark=(cv2.GaussianBlur(1-g,(0,0),3)>0.75).astype(np.float32)
ink=np.maximum(ink,ed*(1-0.85*dark))
ink=np.maximum(ink,(d>0.94).astype(np.float32))
# white whiskers on black fur: keep the photo's bright thin lines clear of ink
wh=((g-cv2.GaussianBlur(g,(0,0),3))>0.12)&(dark>0)
ink[wh]=0
ink=ink*sil
b=(ink>0.5).astype(np.uint8); n,lab,st,_=cv2.connectedComponentsWithStats(b,8)
small=np.isin(lab,np.where(st[:,4]<10)[0]); small[lab==0]=False; ink[small]=0
outline=(cv2.morphologyEx((sil*255).astype(np.uint8),cv2.MORPH_GRADIENT,np.ones((6,6),np.uint8))>0).astype(np.float32)
ink=np.maximum(ink,outline)
ink=cv2.GaussianBlur(ink,(0,0),0.6)
# spot colours: flat colours sampled from the photo
def hx(c): c=c.lstrip('#'); return np.array([int(c[i:i+2],16) for i in (0,2,4)],np.float32)/255
cream=hx('#F6F0E4'); inkc=hx('#1B1A17')
col=np.ones((N,N,3),np.float32)*cream
def spot(m,c,soft=1.0):
    m=cv2.GaussianBlur(m,(0,0),soft)[...,None]; return col*(1-m)+c*m
col=spot(red,hx('#C8232E')); col=spot(green,hx('#1E9A55'),0.6)
col=spot(eyes,hx('#D9B44A'),0.8); col=spot(gold,hx('#D4A441'),0.5)
# spot areas get lighter ink so the colour shows; frames and cross stay clean
ink=ink*(1-0.25*red)*(1-gold)*(1-cv2.erode(green,np.ones((3,3),np.uint8)))
# crisp ink rim on the gold frames and the cross
for m in (gold,green):
    rim=cv2.morphologyEx((m>0.5).astype(np.uint8),cv2.MORPH_GRADIENT,np.ones((3,3),np.uint8)).astype(np.float32)
    rim=rim*(1-m) if m is gold else rim
    ink=np.maximum(ink,rim*0.9)
subj=col*(1-ink[...,None])+inkc*ink[...,None]
# pupils: sharp ink from the photo's darkest eye pixels
pup=((g<0.25)&(eyes>0.5)).astype(np.float32); subj=subj*(1-pup[...,None])+inkc*pup[...,None]
np.save(W+'/subj.npy',subj.astype(np.float32)); np.save(W+'/sil.npy',sil); np.save(W+'/ink.npy',ink.astype(np.float32))
cv2.imwrite(W+'/subj.png',(np.where(sil[...,None]>0,subj,np.ones(3)*0.5)[...,::-1]*255).astype(np.uint8))
