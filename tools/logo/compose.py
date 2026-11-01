import sys, numpy as np, cv2
S=sys.argv[1]; out=sys.argv[2]; tile=sys.argv[3]; beretc=sys.argv[4] if len(sys.argv)>4 else ''
def hx(h): h=h.lstrip('#'); return np.array([int(h[i:i+2],16) for i in (0,2,4)],np.float32)/255
ink=np.load(S+'/ink.npy'); sil=np.load(S+'/sil.npy'); beret,mug,scarf,tux,eyes=np.load(S+'/regions.npy')
N=ink.shape[0]; K=N//600
# cross on the mug
cross=np.zeros_like(ink); cx,cy,a,t=336*K,450*K,25*K,9*K
cv2.rectangle(cross,(cx-t,cy-a),(cx+t,cy+a),1.0,-1); cv2.rectangle(cross,(cx-a,cy-t),(cx+a,cy+t),1.0,-1)
cross=cv2.GaussianBlur(cross,(0,0),0.8)
crossline=(cv2.morphologyEx((cross>0.5).astype(np.uint8),cv2.MORPH_GRADIENT,np.ones((5,5),np.uint8))).astype(np.float32)
ink=np.maximum(ink*(1-cross),crossline)
# eye irises: knock ink out a little, keep pupils
cream=hx('#F6F0E4'); inkc=hx('#1B1A17')
col=np.ones((N,N,3),np.float32)*cream
if beretc:
    col=col*(1-beret[...,None])+hx(beretc)*beret[...,None]
    # beret gets lighter ink so the colour reads
    ink=ink*(1-beret)+ink*0.85*beret
col=col*(1-eyes[...,None])+hx('#9BCB3C')*eyes[...,None]
col=col*(1-cross[...,None])+hx('#2FA05A')*cross[...,None]
subj=col*(1-ink[...,None])+inkc*ink[...,None]
# pupils: vertical slit, sleepy
ic=tuple(map(float,inkc))
exec(open(S+'/poly.py').read())
def Pk(pts): return np.array([(x*K,y*K) for x,y in pts],np.int32)
for eye,(px,py,rx,ry) in ((EYE_L,PUPILS[0]),(EYE_R,PUPILS[1])):
    em=np.zeros((N,N),np.uint8); cv2.fillPoly(em,[Pk(eye)],1)
    pm=np.zeros((N,N),np.uint8); cv2.ellipse(pm,(px*K,py*K),(rx*K,ry*K),0,0,360,1,-1)
    subj[(pm&em)>0]=ic
    # eye outline, with a heavy upper lid
    cv2.polylines(subj,[Pk(eye)],True,ic,int(1.2*K),cv2.LINE_AA)
    cv2.polylines(subj,[Pk(eye[:6])],False,ic,int(3*K),cv2.LINE_AA)
np.save(S+'/subj.npy',subj.astype(np.float32))
# tile
T=1024; R=228; s=0.9
sub=cv2.resize(subj,(int(N*s),int(N*s)),interpolation=cv2.INTER_AREA)
m=cv2.resize(sil,(int(N*s),int(N*s)),interpolation=cv2.INTER_AREA)
canvas=np.ones((T,T,3),np.float32)*hx(tile)
ox,oy=0,70
h=min(sub.shape[0],T-oy); w=min(sub.shape[1],T-ox)
mm=m[:h,:w,None]
canvas[oy:oy+h,ox:ox+w]=canvas[oy:oy+h,ox:ox+w]*(1-mm)+sub[:h,:w]*mm
# rounded mask
rm=np.zeros((T*4,T*4),np.uint8); r=R*4
cv2.rectangle(rm,(r,0),(T*4-r,T*4),255,-1); cv2.rectangle(rm,(0,r),(T*4,T*4-r),255,-1)
for c in ((r,r),(T*4-r,r),(r,T*4-r),(T*4-r,T*4-r)): cv2.circle(rm,c,r,255,-1)
rm=cv2.resize(rm,(T,T),interpolation=cv2.INTER_AREA)
rgba=np.dstack([(canvas[...,::-1]*255).astype(np.uint8),rm])
cv2.imwrite(out,rgba)
