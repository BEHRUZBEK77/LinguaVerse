// Repeatable direct API deployment. Existing Worker secrets are preserved.
// Set CLOUDFLARE_API_TOKEN locally or in CI; never commit its value.
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const account=process.env.CLOUDFLARE_ACCOUNT_ID || 'a298e2629afd0b9496b4c1d366a2626e';
const name='linguaverse';
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw new Error('CLOUDFLARE_API_TOKEN is required');
async function api(method,endpoint,body) {
 const multipart=body instanceof FormData;
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${endpoint}`,{method,headers:{Authorization:`Bearer ${token}`,...(!multipart?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:multipart?body:JSON.stringify(body)});
 const result=await r.json();
 if(!r.ok||!result.success)throw new Error(`Cloudflare ${method} ${endpoint}: HTTP ${r.status}; codes ${result.errors?.map(e=>e.code).join(',')}`);
 return result.result;
}
function run(file){const r=spawnSync(process.execPath,[file],{cwd:root,stdio:'inherit'});if(r.status!==0)throw new Error(`${file} failed`);}
run('cloudflare/build.mjs');
const manifest=JSON.parse(await fs.readFile(path.join(root,'out/manifest.json'),'utf8'));
const session=await api('POST',`workers/scripts/${name}/assets-upload-session`,{manifest});
await fs.writeFile(path.join(root,'out/upload-session.json'),JSON.stringify({...session,accountId:account}));
run('cloudflare/upload-assets.mjs');
const {jwt}=JSON.parse(await fs.readFile(path.join(root,'out/assets-completion.json'),'utf8'));
const config=JSON.parse(await fs.readFile(path.join(root,'cloudflare/metadata.json'),'utf8'));
config.assets.jwt=jwt;
const form=new FormData();
form.append('metadata',new Blob([JSON.stringify(config)],{type:'application/json'}));
form.append('worker.mjs',new Blob([await fs.readFile(path.join(root,'out/worker.mjs'))],{type:'application/javascript+module'}),'worker.mjs');
await api('PUT',`workers/scripts/${name}`,form);
await api('POST',`workers/scripts/${name}/subdomain`,{enabled:true,previews_enabled:false});
await fs.unlink(path.join(root,'out/assets-completion.json'));
console.log('Published https://linguaverse.akromovbehruz7.workers.dev/');
