const L=async(n=30)=>console.log((await texts(p)).split('\n').slice(-n).join(' | '));
const vis=(l)=>l.filter({visible:true}).last();
await p.getByText('Library',{exact:true}).last().click();await p.waitForTimeout(800);
await vis(p.getByText('Quizzes',{exact:true})).click();await p.waitForTimeout(800);
await vis(p.getByText('SAMPLE · Terms check')).click();await p.waitForTimeout(1500);
await vis(p.getByText('Add question',{exact:true})).click();await p.waitForTimeout(600);await vis(p.getByText('Write a new question',{exact:true})).click();await p.waitForTimeout(600);
await r.tap(p.getByText('MTF',{exact:true}),'mtf',{last:true});await p.waitForTimeout(1500);await r.shot('mtf editor');
await r.type(p.getByPlaceholder('Write the question. You can add a diagram or photo too.'),'SAMPLE: Are these abbreviations right?','stem',{chunks:2});
const st=[['PK means pharmacokinetics.',1],['PD means pharmacodynamics.',1],['ADR means adverse drug reaction.',1],['MOA means mode of administration.',0],['NDA means National Drug Authority.',1]];
const fields=p.getByPlaceholder('A statement that is true or false').filter({visible:true});
for(let i=0;i<5;i++){if(i<2)await r.type(fields.nth(i),st[i][0],'st',{chunks:1});else await fields.nth(i).fill(st[i][0]);}
const T=p.getByText('True',{exact:true}).filter({visible:true}),F=p.getByText('False',{exact:true}).filter({visible:true});
for(let i=0;i<5;i++){const b=st[i][1]?T.nth(i):F.nth(i);if(i<2){const bb=await b.boundingBox();await r.shot('mark',{tap:bb,wait:200});}await b.click();await p.waitForTimeout(200);}
await r.shot('marked');
await r.tap(p.getByText('Save question',{exact:true}),'save',{last:true});await p.waitForTimeout(1500);await r.shot('quiz 2q');await L(12);
