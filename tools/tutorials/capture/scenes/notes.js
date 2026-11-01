const L=async(n=30)=>console.log((await texts(p)).split('\n').slice(-n).join(' | '));
await p.getByText('Library',{exact:true}).last().click();await p.waitForTimeout(800);
await r.shot('library',{wait:300});
await r.tap(p.getByText('New folder',{exact:true}).first(),'new folder');
await r.type(p.getByPlaceholder('e.g. Autonomic pharmacology'),'SAMPLE · Pharmacology I','folder name',{chunks:3});
await r.tap(p.getByText('Create',{exact:true}),'create folder',{last:true});await p.waitForTimeout(1200);await r.shot('folder created');
await r.tap(p.getByText('SAMPLE · Pharmacology I').first(),'open folder');await p.waitForTimeout(1200);await r.shot('in folder');await L(15);
await r.tap(p.getByText('New note',{exact:true}).first(),'new note');await p.waitForTimeout(800);await r.shot('templates');
await r.tap(p.getByText('Lecture notes',{exact:true}).last(),'lecture template');await p.waitForTimeout(4000);await r.shot('editor');
await r.type(p.getByPlaceholder('Title'),'SAMPLE · Lecture 1: key terms','title',{chunks:3});
const f=p.frameLocator('iframe');
const para=f.locator('h2:has-text("Key points") + p, h3:has-text("Key points") + p').first();
await r.tap(para,'tap key points');
for(const line of ['ADR means adverse drug reaction.','MOA means mechanism of action.']){await p.keyboard.type(line);await r.shot('typed',{wait:300});await p.keyboard.press('Enter');}
await L(25);
