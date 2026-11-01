// Opens the real Dozi web build in a persistent profile and records screenshots plus the
// box of every tapped element, so the video can show taps in the right place.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const S=path.resolve(__dirname,'..');
async function open(scheme='light'){
  const c=await chromium.launchPersistentContext(S+'/profile-'+(process.env.PROFILE||scheme),{viewport:{width:390,height:844},deviceScaleFactor:2,colorScheme:scheme,timezoneId:'Africa/Kampala',locale:'en-GB'});
  await c.addInitScript(()=>{try{delete Atomics.pause}catch(e){};document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent='*:focus,*:focus-visible{outline:none!important}';document.head.appendChild(st)})});
  const p=c.pages()[0]||await c.newPage();const logs=[];
  p.on('console',m=>{if(m.type()==='error')logs.push(m.text().slice(0,200))});p.on('pageerror',e=>logs.push('ERR '+e.message));
  await p.goto('http://localhost:8099/');
  const retry=p.getByRole('button',{name:'Try again'});
  for(let i=0;i<40;i++){await p.waitForTimeout(1000);if(await retry.count())break;}
  if(await retry.count()){await p.waitForTimeout(15000);await retry.click();}
  await p.waitForTimeout(3000);
  return {p,c,logs};
}
function recorder(p,scene){
  const dir=S+'/shots/'+scene;fs.mkdirSync(dir,{recursive:true});const steps=[];let n=0;
  const r={
    async shot(label,extra={}){await p.waitForTimeout(extra.wait??700);const f=String(++n).padStart(2,'0')+'.png';await p.screenshot({path:dir+'/'+f});steps.push({f,label,...extra});fs.writeFileSync(dir+'/steps.json',JSON.stringify(steps,null,1));return f;},
    // screenshot first with the tap target marked, then tap it
    async tap(loc,label,opts={}){let l=(typeof loc==='string'?p.getByText(loc,{exact:true}):loc).filter({visible:true});l=opts.last?l.last():l.first();await l.waitFor({timeout:8000});const b=await l.boundingBox();await r.shot(label,{tap:b,wait:opts.wait});await l.click();},
    // types in a few chunks, one screenshot each, so the video can show the text appearing
    async type(loc,text,label,opts={}){const l=(typeof loc==='string'?p.getByPlaceholder(loc):loc).filter({visible:true}).first();await l.waitFor({timeout:8000});const b=await l.boundingBox();await r.shot(label+' focus',{tap:b,wait:300});await l.click();
      const n=opts.chunks??4;const words=text.split(' ');for(let i=1;i<=n;i++){const part=words.slice(0,Math.ceil(words.length*i/n)).join(' ');
        if(opts.keys){await p.keyboard.type(part.slice((words.slice(0,Math.ceil(words.length*(i-1)/n)).join(' ')).length))}else{await l.fill(part)}
        await r.shot(label,{typing:i<n,wait:200});}},
  };return r;
}
async function texts(p){return (await p.locator('body').innerText()).slice(0,1500);}
module.exports={open,recorder,texts,S};
