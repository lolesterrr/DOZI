const http=require('http'),fs=require('fs'),path=require('path');
const root=process.argv[2];const port=+process.argv[3]||8099;
const types={'.js':'application/javascript','.html':'text/html','.wasm':'application/wasm','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.json':'application/json','.ico':'image/x-icon','.svg':'image/svg+xml','.gif':'image/gif','.jpg':'image/jpeg','.mp4':'video/mp4'};
http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);let f=path.join(root,p);
if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(root,'index.html');
r.setHeader('Cross-Origin-Opener-Policy','same-origin');r.setHeader('Cross-Origin-Embedder-Policy','require-corp');
r.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(r);}).listen(port);
