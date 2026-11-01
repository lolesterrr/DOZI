const L=async(n=30)=>console.log((await texts(p)).split('\n').slice(-n).join(' | '));
const vis=(l)=>l.filter({visible:true}).last();
await r.tap(p.getByText('Create',{exact:true}),'create',{});await r.shot('menu');
await r.tap(p.getByText('New quiz',{exact:true}),'new quiz',{last:true});
await r.type(p.getByPlaceholder('e.g. Autonomic drugs, week 3'),'SAMPLE · Terms check','name',{chunks:2});
await r.tap(p.getByText('Create',{exact:true}),'create',{last:true});await p.waitForTimeout(1500);await r.shot('quiz');
await r.tap(p.getByText('Add question',{exact:true}),'add q',{last:true});await r.shot('add sheet');
await r.tap(p.getByText('Write a new question',{exact:true}),'write',{last:true});await r.shot('types');
await r.tap(p.getByText('SBA',{exact:true}),'sba',{last:true});await p.waitForTimeout(1500);await r.shot('sba editor');
await r.type(p.getByPlaceholder('Write the question. You can add a diagram or photo too.'),'SAMPLE: What does UCG stand for?','stem',{chunks:2});
const opts=['Uganda Clinical Guidelines','Uganda Care Guide','Universal Clinical Guide','Uganda Clinical Glossary'];
const fields=p.getByPlaceholder('Answer text').filter({visible:true});
for(let i=0;i<4;i++){if(i<2)await r.type(fields.nth(i),opts[i],'opt',{chunks:1});else await fields.nth(i).fill(opts[i]);}
await r.shot('options');
await r.tap(p.getByText('Correct',{exact:true}),'correct',{});await r.shot('marked');
await r.tap(p.getByText('Save question',{exact:true}),'save',{last:true});await p.waitForTimeout(1500);await r.shot('quiz 1q');await L(12);
// MTF
await vis(p.getByText('Add question',{exact:true})).click();await p.waitForTimeout(600);await vis(p.getByText('Write a new question',{exact:true})).click();await p.waitForTimeout(600);
await r.tap(p.getByText('MTF',{exact:true}),'mtf',{last:true});await p.waitForTimeout(1500);await r.shot('mtf editor');await L(30);
