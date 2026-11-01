const L=async(n=30)=>console.log((await texts(p)).split('\n').slice(-n).join(' | '));
const vis=(l)=>l.filter({visible:true}).last();
await vis(p.getByText('Me',{exact:true})).click();await p.waitForTimeout(1000);
await vis(p.getByText('My timetable',{exact:true})).click();await p.waitForTimeout(2000);
await r.shot('tt empty');
await r.tap(p.getByText('Add class',{exact:true}),'add class',{last:true});await p.waitForTimeout(1200);await r.shot('editor');
await r.type(p.getByPlaceholder('e.g. Pharmacology II'),'SAMPLE · Pharmacology II','name',{chunks:2});
await r.type(p.getByPlaceholder('e.g. PHA 2101'),'PHA 2101','code',{chunks:1});
await r.tap(p.getByText('Mon',{exact:true}),'mon',{last:true});await r.tap(p.getByText('Wed',{exact:true}),'wed',{last:true});await r.shot('days');
await r.type(p.getByPlaceholder('e.g. Lecture Theatre 2'),'Lecture Theatre 2','room',{chunks:1});
await r.tap(p.getByText('Day before at 20:00',{exact:true}),'reminder',{last:true});await r.shot('reminders');
await r.tap(p.getByText('Save',{exact:true}),'save',{last:true});await p.waitForTimeout(2000);await r.shot('saved');await L(20);
// a practical
await vis(p.getByText('Add class',{exact:true})).click();await p.waitForTimeout(1200);
await p.getByPlaceholder('e.g. Pharmacology II').filter({visible:true}).first().fill('SAMPLE · Pharmacology practical');
await vis(p.getByText('Practical',{exact:true})).click();await vis(p.getByText('Thu',{exact:true})).click();
const blue=p.getByLabel('Violet',{exact:true}).filter({visible:true});if(await blue.count())await blue.last().click();
await r.shot('practical');await vis(p.getByText('Save',{exact:true})).click();await p.waitForTimeout(2000);await r.shot('day view');
await r.tap(p.getByText('Week',{exact:true}),'week',{last:true});await p.waitForTimeout(1500);await r.shot('week view');await L(30);
