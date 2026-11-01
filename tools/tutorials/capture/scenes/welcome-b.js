await r.tap(p.getByText('Create',{exact:true}).first(),'create');await r.shot('create menu');
await p.keyboard.press('Escape');await p.waitForTimeout(600);
await r.tap(p.getByLabel(/search/i).first(),'search');await r.shot('search');
