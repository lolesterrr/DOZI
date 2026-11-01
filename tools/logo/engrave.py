import sys, numpy as np, cv2
S=sys.argv[1]; exec(open(S+'/poly.py').read())
im=cv2.imread(S+'/cat.jpg'); H0=600
K=2  # upscale factor
N=H0*K
def P(pts): return np.array([(x*K,y*K) for x,y in pts],np.int32)
def poly(pts,blur=0):
    m=np.zeros((N,N),np.float32); cv2.fillPoly(m,[P(pts)],1.0)
    if blur: m=cv2.GaussianBlur(m,(0,0),blur)
    return m
big=cv2.resize(im,(N,N),interpolation=cv2.INTER_CUBIC)
big=cv2.bilateralFilter(big,9,40,7)
g=cv2.cvtColor(big,cv2.COLOR_BGR2GRAY).astype(np.float32)/255
sil=(cv2.GaussianBlur(poly(SIL),(0,0),9)>0.5).astype(np.float32)
HEAD=[(160,178),(240,168),(330,160),(420,135),(440,100),(470,75),(498,74),(470,130),(458,170),(462,235),(445,275),(420,280),(395,258),(330,250),(260,252),(232,282),(212,300),(188,290),(168,250)]
BLAZE=[(326,178),(342,178),(372,228),(398,258),(380,305),(295,305),(276,262),(298,228)]
EARIN=[(455,95),(490,80),(470,118),(458,140)]
GLASSL=[(250,205),(290,195),(330,215),(335,250),(310,272),(268,270),(250,245)]
GLASSR=[(380,215),(420,208),(455,225),(458,262),(435,280),(398,278),(382,250)]
tux=np.clip(poly(HEAD,4)-poly(BLAZE,5),0,1)
# keep eyes visible (inside glasses: eyes stay as photographed tone, lightly)
tone=1-g  # darkness
fur_black=0.72+0.22*(1-g)
tone=tone*(1-tux)+fur_black*tux
ear=poly(EARIN,3); tone=tone*(1-ear)+0.45*ear
# lift the background-ish wall bits / contrast curve
tone=np.clip((tone-0.08)/0.9,0,1)**1.15
# regions for hatch angle
BERET=[(100,150),(98,128),(110,105),(140,78),(180,50),(215,22),(240,10),(300,2),(370,2),(420,15),(455,40),(470,70),(440,110),(400,150),(330,168),(240,172),(160,178)]
MUG=[(258,350),(300,345),(370,345),(415,360),(460,395),(465,420),(430,425),(412,445),(405,520),(380,548),(300,550),(272,520),(258,420)]
SCARF_L=[(36,600),(36,400),(45,320),(62,262),(90,215),(125,190),(165,185),(170,260),(185,310),(180,600)]
SCARF_R=[(260,300),(330,320),(430,290),(470,260),(512,320),(540,430),(545,500),(548,600),(400,600),(420,530),(490,520),(495,420),(470,395)]
beret=poly(BERET,2); mug=poly(MUG,1.5); scarf=np.clip(poly(SCARF_L,2)+poly(SCARF_R,2),0,1)
clahe=cv2.createCLAHE(2.5,(8,8))
gl=clahe.apply((g*255).astype(np.uint8)).astype(np.float32)/255
gl=cv2.GaussianBlur(gl,(0,0),1.2)
dl=1-gl
# per-region tones
tone_beret=0.35+0.55*np.clip((dl-0.5)/0.5,0,1)
tone_scarf=0.12+0.5*np.clip((dl-0.35)/0.65,0,1)
tone=tone*(1-beret)+tone_beret*beret
tone=tone*(1-scarf)+tone_scarf*scarf
# dark coat / shadow outside named regions: cap
other=np.clip(1-beret-scarf-mug-tux,0,1)
tone=np.minimum(tone,0.6*other+1.0*(1-other))
eyes=np.zeros((N,N),np.float32)
cv2.fillPoly(eyes,[P(EYE_L),P(EYE_R)],1.0)
eyes=cv2.GaussianBlur(eyes,(0,0),0.8)
tone=tone*(1-eyes)+0.05*eyes
yy,xx=np.mgrid[0:N,0:N].astype(np.float32)
warp=cv2.GaussianBlur(g,(0,0),18*K/2)*28*K/2
def hatch(theta,period,warpk=1.0,curve=None):
    t=np.deg2rad(theta)
    u=xx*np.cos(t)+yy*np.sin(t)+warp*warpk
    if curve is not None: u=u+curve
    v=(u/period)%1.0
    return np.abs(v-0.5)*2  # 0 at line centre, 1 between
# curved field for mug (cylinder) and beret (dome)
cx,cy=335*K,450*K
mugcurve=((xx-cx)/(80*K))**2*14*K
bx,by=290*K,120*K
beretcurve=-((xx-bx)/(190*K))**2*40*K
per=8.0*K/2
def layer(h,d,lo,hi):
    # ink where hatch distance < width; width grows with darkness in [lo,hi]
    w=np.clip((d-lo)/(hi-lo),0,1)
    return (h<w).astype(np.float32)
fur1=hatch(-35,per); fur2=hatch(55,per*1.1); fur3=hatch(10,per*0.9)
sc1=hatch(0,per*0.9,0.15); sc2=hatch(80,per*1.3,0.3)
be1=hatch(90,per,0.2,beretcurve)  # 'horizontal' lines (theta 90 => lines along x)
be2=hatch(30,per*1.2,0.2)
mg1=hatch(90,per*1.1,0.0,mugcurve)
d=tone
ink_fur=np.maximum.reduce([layer(fur1,d,0.12,1.05),layer(fur2,d,0.5,1.2),layer(fur3,d,0.78,1.3)])
ink_sc=np.maximum.reduce([layer(sc1,d,0.15,1.05),layer(sc2,d,0.55,1.25)])
ink_be=np.maximum.reduce([layer(be1,d,0.1,1.0),layer(be2,d,0.55,1.15)])
ink_mg=np.maximum(layer(mg1,d,0.06,0.9),layer(hatch(0,per*1.2,0,None),d,0.6,1.3))
ink=ink_fur
for m,lay in((scarf,ink_sc),(beret,ink_be),(mug,ink_mg)):
    ink=ink*(1-m)+lay*m
# edges
sm=cv2.GaussianBlur((g*255).astype(np.uint8),(0,0),2.2)
ed=cv2.Canny(sm,22,60).astype(np.float32)/255
ed=cv2.dilate(ed,np.ones((2,2),np.uint8))
# skip edges inside black fur (they look noisy)
ed=ed*(1-tux*0.85)
ink=np.maximum(ink,ed)
# solid near-black areas
ink=np.maximum(ink,(d>0.93).astype(np.float32))
# outline
silm=(sil*255).astype(np.uint8)
outline=(cv2.morphologyEx(silm,cv2.MORPH_GRADIENT,np.ones((5,5),np.uint8))>0).astype(np.float32)
ink=ink*sil
# clean-up: drop tiny specks that turn to noise at icon size
b=(ink>0.5).astype(np.uint8)
n,lab,st,_=cv2.connectedComponentsWithStats(b,8)
small=np.isin(lab,np.where(st[:,cv2.CC_STAT_AREA]<10)[0]); small[lab==0]=False
ink[small]=0
outline=(cv2.morphologyEx(silm,cv2.MORPH_GRADIENT,np.ones((7,7),np.uint8))>0).astype(np.float32)
ink=np.maximum(ink,outline)
ink=cv2.GaussianBlur(ink,(0,0),0.6)
np.save(S+'/ink.npy',ink.astype(np.float32)); np.save(S+'/sil.npy',sil)
np.save(S+'/regions.npy',np.stack([beret,mug,scarf,tux,eyes]))
cv2.imwrite(S+'/ink.png',((1-ink)*255).astype(np.uint8))
