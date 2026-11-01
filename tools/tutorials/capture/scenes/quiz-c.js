const L=async(n=30)=>console.log((await texts(p)).split('\n').slice(-n).join(' | '));
const vis=(l)=>l.filter({visible:true}).last();
await p.getByText('Library',{exact:true}).last().click();await p.waitForTimeout(800);
await vis(p.getByText('Quizzes',{exact:true})).click();await p.waitForTimeout(800);
await r.tap(p.getByText('SAMPLE · Terms check'),'open quiz',{last:true});await p.waitForTimeout(1500);
await r.tap(p.getByText('Start quiz',{exact:true}),'start',{last:true});await p.waitForTimeout(1500);await r.shot('intro');await L(10);
await r.tap(p.getByText('Start',{exact:true}),'begin',{last:true});await p.waitForTimeout(1200);await r.shot('q1');await L(14);
await r.tap(p.getByText(/Uganda Clinical Guidelines$/),'pick',{last:true});await r.shot('picked');
await r.tap(p.getByText('Check',{exact:true}),'check',{last:true});await p.waitForTimeout(800);await r.shot('feedback');await L(14);
await r.tap(p.getByText('Next question',{exact:true}),'next',{last:true});await p.waitForTimeout(1200);await r.shot('q2');
const ans=[1,1,1,0,1];for(let i=0;i<5;i++){const lab=p.getByLabel('Statement '+(i+1)+': '+(ans[i]?'true':'false'),{exact:true});if(i<3)await r.tap(lab,'mark',{last:true,wait:200});else await vis(lab).click();await p.waitForTimeout(200);}
await r.shot('marked');
await r.tap(p.getByText('Check',{exact:true}),'check',{last:true});await p.waitForTimeout(800);await r.shot('feedback2');
await r.tap(p.getByText('See results',{exact:true}),'results',{last:true});await p.waitForTimeout(2500);await r.shot('results');await L(30);
