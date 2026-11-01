const L=async(n=30)=>console.log((await texts(p)).split('\n').slice(-n).join(' | '));
await p.getByText('Library',{exact:true}).last().click();await p.waitForTimeout(800);
await r.tap(p.getByText('Decks',{exact:true}),'decks segment');await r.shot('decks');
await r.tap(p.getByText('New deck',{exact:true}),'new deck');
await r.type(p.getByPlaceholder('e.g. Cholinergic drugs'),'SAMPLE · Pharmacology terms','deck name',{chunks:3});
await r.tap(p.getByText('Create',{exact:true}),'create',{last:true});await p.waitForTimeout(1500);await r.shot('deck empty');
await r.tap(p.getByText('Add cards',{exact:true}),'add cards');await p.waitForTimeout(1200);await r.shot('editor');
await r.type(p.getByPlaceholder('Question or term'),'SAMPLE: What does ADR stand for?','front',{chunks:3});
await r.type(p.getByPlaceholder('Answer'),'Adverse drug reaction','back',{chunks:2});
await r.tap(p.getByText('Keep adding',{exact:true}),'keep adding');
await r.tap(p.getByText('Save card',{exact:true}),'save');await p.waitForTimeout(1200);await r.shot('fresh card');
// cloze
await r.tap(p.getByText('Cloze',{exact:true}),'cloze type');await r.shot('cloze editor');await L(25);
