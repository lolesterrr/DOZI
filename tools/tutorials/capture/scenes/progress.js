const L=async(n=30)=>console.log((await texts(p)).split('\n').slice(-n).join(' | '));
const vis=(l)=>l.filter({visible:true}).last();
await r.shot('today',{wait:1500});
await p.mouse.wheel(0,500);await r.shot('today scrolled',{wait:800});
await r.tap(p.getByText('Me',{exact:true}),'me',{last:true});await p.waitForTimeout(1200);await r.shot('me');
await p.mouse.wheel(0,700);await r.shot('badges',{wait:800});await p.mouse.wheel(0,700);await r.shot('badges2',{wait:800});
await p.mouse.wheel(0,-3000);await p.waitForTimeout(500);
await r.tap(p.getByText('See your stats',{exact:true}),'stats',{last:true});await p.waitForTimeout(2000);await r.shot('stats');
await p.mouse.wheel(0,700);await r.shot('stats2',{wait:800});await L(40);
await p.goBack();await p.waitForTimeout(1200);
await r.tap(p.getByText('Settings',{exact:true}),'settings',{last:true});await p.waitForTimeout(1500);await r.shot('settings');
await p.mouse.wheel(0,700);await r.shot('settings2',{wait:800});
// quiz export menu
await p.goBack();await p.waitForTimeout(800);
await vis(p.getByText('Library',{exact:true})).click();await p.waitForTimeout(800);
await vis(p.getByText('Quizzes',{exact:true})).click();await p.waitForTimeout(800);
await vis(p.getByText('SAMPLE · Terms check')).click();await p.waitForTimeout(1500);
await r.tap(p.getByLabel('More quiz options'),'quiz menu',{last:true});await r.shot('quiz menu');
await r.tap(p.getByText('Export as PDF',{exact:true}),'pdf',{last:true});await r.shot('pdf sheet');await L(10);
