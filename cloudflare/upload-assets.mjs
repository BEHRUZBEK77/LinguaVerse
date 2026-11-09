import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname,'..');
const session = JSON.parse(await fs.readFile(path.join(root,'out/upload-session.json'),'utf8'));
const sources = JSON.parse(await fs.readFile(path.join(root,'out/asset-sources.json'),'utf8'));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.mp4':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.pdf':'application/pdf'};
let complete = session.buckets.length ? null : session.jwt;
for (const [i,bucket] of session.buckets.entries()) {
  for(let attempt=1;;attempt++) {
    const form = new FormData();
    for(const hash of bucket) {
      const name=sources[hash];
      if(!name)throw new Error('Unknown asset hash');
      const bytes=await fs.readFile(path.join(root,name));
      form.append(hash,new Blob([bytes.toString('base64')],{type:types[path.extname(name)]||'application/octet-stream'}),hash);
    }
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${session.accountId}/workers/assets/upload?base64=true`,{method:'POST',headers:{Authorization:`Bearer ${session.jwt}`},body:form});
    const data=await r.json();
    if(!r.ok||!data.success){if(attempt<3){await new Promise(r=>setTimeout(r,2000));continue;}throw new Error(`Asset upload HTTP ${r.status}`);}
    if(data.result?.jwt)complete=data.result.jwt;
    console.log(`Uploaded asset group ${i+1}/${session.buckets.length}`);
    break;
  }
}
if(!complete)throw new Error('No completion token received');
await fs.writeFile(path.join(root,'out/assets-completion.json'),JSON.stringify({jwt:complete}));
await fs.unlink(path.join(root,'out/upload-session.json'));
