const vis=(l)=>l.filter({visible:true}).last();
await vis(p.getByText('Me',{exact:true})).click();await p.waitForTimeout(1200);await p.mouse.move(195,500);
for(let i=0;i<4;i++){await p.mouse.wheel(0,600);await r.shot('badges',{wait:900});}
console.log((await texts(p)).split('\n').slice(-40).join(' | '));
