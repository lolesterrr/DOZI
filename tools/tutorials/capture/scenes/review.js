const L=async(n=30)=>console.log((await texts(p)).split('\n').slice(-n).join(' | '));
const vis=(l)=>l.filter({visible:true}).last();
await r.shot('today',{wait:1500});
await r.tap(p.getByText('Library',{exact:true}),'library',{last:true});await p.waitForTimeout(800);
await vis(p.getByText('Decks',{exact:true})).click();await p.waitForTimeout(800);
await r.tap(p.getByText('SAMPLE · Pharmacology terms'),'open deck',{last:true});await p.waitForTimeout(1500);
await r.tap(p.getByText(/^Study now/),'study',{last:true});await p.waitForTimeout(1500);
let shots=0;
for(let i=0;i<14;i++){
  const t=await texts(p);
  if(/Session complete/.test(t))break;
  const detail=shots<4;
  if(detail)await r.shot('front');
  const typeField=p.getByPlaceholder('Type the answer').filter({visible:true});
  if(await typeField.count()){await r.type(typeField.first(),'National Drug Authority','typed',{chunks:2});await r.tap(p.getByText('Check',{exact:true}),'check',{last:true});await r.shot('checked');}
  else{const sa=p.getByText('Show answer',{exact:true}).filter({visible:true});if(!(await sa.count()))break;if(detail)await r.tap(p.getByText('Show answer',{exact:true}),'show',{last:true});else await sa.last().click();await p.waitForTimeout(500);if(detail)await r.shot('answer');}
  const rating=shots===0?'Good':'Easy';
  if(detail)await r.tap(p.getByText(rating,{exact:true}),rating,{last:true});else await vis(p.getByText(rating,{exact:true})).click();
  await p.waitForTimeout(900);shots++;
}
await p.waitForTimeout(2000);await r.shot('summary');await L(20);
