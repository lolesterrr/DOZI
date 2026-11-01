import sys, numpy as np, cv2
S,OUT=sys.argv[1],sys.argv[2]
TEAL=np.array([0x0B,0x6B,0x68],np.float32)/255
subj=np.load(S+'/subj.npy'); sil=np.load(S+'/sil.npy'); ink=np.load(S+'/ink.npy')
N=subj.shape[0]
def place(T,scale,ox,oy,bg=True):
    """Subject (bleeding off the bottom) on a TxT canvas; returns rgb, alpha."""
    sz=int(round(T*scale)); sub=cv2.resize(subj,(sz,sz),interpolation=cv2.INTER_AREA)
    m=cv2.resize(sil,(sz,sz),interpolation=cv2.INTER_AREA)
    rgb=np.zeros((T,T,3),np.float32)+TEAL; a=np.zeros((T,T),np.float32)
    x0,y0=int(ox*T),int(oy*T); h=min(sz,T-y0); w=min(sz-max(0,-x0),T-max(0,x0))
    sx=max(0,-x0); dx=max(0,x0)
    mm=m[:h,sx:sx+w]
    rgb[y0:y0+h,dx:dx+w]=rgb[y0:y0+h,dx:dx+w]*(1-mm[...,None])+sub[:h,sx:sx+w]*mm[...,None]
    a[y0:y0+h,dx:dx+w]=mm
    if bg: a[:]=1
    return rgb,a
def save(path,rgb,a):
    out=np.dstack([(rgb[...,::-1]*255+.5).astype(np.uint8),(a*255+.5).astype(np.uint8)])
    cv2.imwrite(path,out,[cv2.IMWRITE_PNG_COMPRESSION,9])
def rounded(T,R):
    k=4; t=T*k; r=R*k; m=np.zeros((t,t),np.uint8)
    cv2.rectangle(m,(r,0),(t-r,t),255,-1); cv2.rectangle(m,(0,r),(t,t-r),255,-1)
    for c in ((r,r),(t-r,r),(r,t-r),(t-r,t-r)): cv2.circle(m,c,r,255,-1)
    return cv2.resize(m,(T,T),interpolation=cv2.INTER_AREA).astype(np.float32)/255
# 1. iOS / store icon: full-bleed square, the OS rounds the corners
rgb,a=place(1024,0.9,0.0,70/1024)
save(OUT+'/icon.png',rgb,a)
# 2. Android adaptive: launchers show only the middle ~2/3, so shrink the cat to fit
rgb,a=place(1024,0.74,0.15,0.26,bg=False); save(OUT+'/android-icon-foreground.png',rgb,a)
bg=np.zeros((512,512,3),np.float32)+TEAL; save(OUT+'/android-icon-background.png',bg,np.ones((512,512),np.float32))
# 3. themed (monochrome) icon: the launcher tints the alpha. Cream parts of the drawing stay solid, ink lines are cut out.
T=432; sz=int(T*0.74); x0,y0=int(0.15*T),int(0.26*T)
m=cv2.resize(sil,(sz,sz),interpolation=cv2.INTER_AREA); ik=cv2.resize(ink,(sz,sz),interpolation=cv2.INTER_AREA)
a=np.zeros((T,T),np.float32); h=min(sz,T-y0); a[y0:y0+h,x0:x0+sz]=(m*(1-np.clip(ik*1.3,0,1)))[:h]
save(OUT+'/android-icon-monochrome.png',np.ones((T,T,3),np.float32),a)
# 4. splash: the rounded tile, shown on the cream (light) or dark app background
T=512; rgb,a=place(T,0.9,0.0,70/1024); save(OUT+'/splash-icon.png',rgb,rounded(T,114))
# 5. favicon
rgb,a=place(48,0.9,0.0,70/1024); save(OUT+'/favicon.png',rgb,rounded(48,11))
