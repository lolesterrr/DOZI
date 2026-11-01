// Exploration: run the steps file given as argv[2] (a JS body with p, r, t in scope).
const {open,recorder,texts}=require('./lib');const fs=require('fs');
(async()=>{const {p,c,logs}=await open(process.argv[4]||'light');const r=recorder(p,process.argv[3]||'explore');
const t=async(l='')=>console.log('----- '+l+'\n'+await texts(p));
try{await eval('(async()=>{'+fs.readFileSync(process.argv[2],'utf8')+'})()')}catch(e){console.log('E',e.message.slice(0,400))}
console.log(logs.filter(l=>!/Sync operation/.test(l)).slice(0,8).join('\n'));await c.close();})();
