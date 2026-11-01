const L=async(n=30)=>console.log((await texts(p)).split('\n').slice(-n).join(' | '));
const vis=(l)=>l.filter({visible:true}).first();
await p.getByText('Library',{exact:true}).last().click();await p.waitForTimeout(800);
await vis(p.getByText('SAMPLE · Pharmacology I')).click();await p.waitForTimeout(1200);
await L(12);
await r.shot('in folder',{wait:2500});
await r.tap(p.getByText('New note',{exact:true}),'new note');await p.waitForTimeout(800);await r.shot('templates');
await r.tap(p.getByText('Lecture notes',{exact:true}),'lecture template');await p.waitForTimeout(4000);await r.shot('editor');
await r.type(p.getByPlaceholder('Title'),'SAMPLE · Lecture 1: key terms','title',{chunks:3});
const f=p.frameLocator('iframe');
await r.tap(f.locator(':is(h1,h2,h3):has-text("Key points") + p').first(),'tap key points');
for(const line of ['ADR means adverse drug reaction.','MOA means mechanism of action.']){await p.keyboard.type(line);await r.shot('typed',{wait:300});await p.keyboard.press('Enter');}
await p.keyboard.press('Backspace');
// exam tip callout
await r.tap(f.locator('[data-callout] p, .callout p, div[class*=callout] p').last(),'tap exam tip');
await p.keyboard.type('SAMPLE: learn the common abbreviations first.');await r.shot('tip typed',{wait:400});
// select a phrase
const sel=async(text)=>{await p.frames()[1].evaluate((t)=>{const w=document.createTreeWalker(document.querySelector('.ProseMirror'),NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const i=n.data.indexOf(t);if(i>=0){const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+t.length);const s=getSelection();s.removeAllRanges();s.addRange(r);return}}},text);await p.waitForTimeout(800);};
await sel('ADR');await r.shot('selected ADR');
await r.tap(p.getByLabel('Bold',{exact:true}),'bold');await r.shot('bolded');
await r.tap(p.getByLabel('Highlight',{exact:true}),'highlight');await r.shot('highlight row');
await r.tap(p.getByLabel('Gold',{exact:true}),'gold');await r.shot('highlighted');
await sel('adverse drug reaction');await r.shot('selected phrase');await L(20);
