import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {toEvent,toResponse} from './worker.mjs';

test('adapter keeps exact webhook body and trusts only Cloudflare IP',async()=>{
 const req=new Request('https://example.com/.netlify/functions/payment/webhook?a=1&a=2',{method:'POST',headers:{'cf-connecting-ip':'203.0.113.1','x-nf-client-connection-ip':'spoof','x-forwarded-for':'spoof'},body:'{"amount": 100}'});
 const e=await toEvent(req); assert.equal(e.body,'{"amount": 100}');assert.equal(e.path,'/.netlify/functions/payment/webhook');assert.equal(e.headers['x-nf-client-connection-ip'],'203.0.113.1');assert.deepEqual(e.multiValueQueryStringParameters.a,['1','2']);
});
test('adapter preserves binary responses and multiple cookies',async()=>{
 const r=toResponse({statusCode:200,body:'aGVsbG8=',isBase64Encoded:true,multiValueHeaders:{'set-cookie':['a=1','b=2']}},'GET');assert.equal(await r.text(),'hello');assert.equal(r.headers.getSetCookie().length,2);
});
test('scheduled and private functions are not exposed over HTTP',async()=>{
 for(const n of ['renew-subscriptions','update-leaderboard','partners-cron','partnership','_keys','constructor','__proto__']) {
  const r=await worker.fetch(new Request('https://example.com/.netlify/functions/'+n),{});assert.equal(r.status,404,n);
 }
});
test('course GET and unauthorized lesson requests still work',async()=>{
 assert.equal((await worker.fetch(new Request('https://example.com/.netlify/functions/course'),{})).status,200);
 assert.equal((await worker.fetch(new Request('https://example.com/.netlify/functions/course',{method:'POST',body:'{"action":"lesson"}'}),{})).status,401);
});
test('catalog is bundled and loads on Workers',async()=>{
 const {default:course}=await import('../netlify/functions/course.js');const c=await course.catalog();assert.ok(Object.keys(c).length>0);
});
test('robots.txt, sitemap.xml va 404 sahifasi',async()=>{
 const assets={fetch:async(r)=>{const u=new URL(r.url);if(u.pathname==='/404.html')return new Response('<h1>404</h1>',{status:200,headers:{'content-type':'text/html'}});return new Response('nf',{status:404});}};
 const rb=await worker.fetch(new Request('https://x.dev/robots.txt'),{ASSETS:assets});assert.match(await rb.text(),/Sitemap: https:\/\/x\.dev\/sitemap\.xml/);
 const sm=await (await worker.fetch(new Request('https://x.dev/sitemap.xml'),{ASSETS:assets})).text();assert.match(sm,/lugat\.html/);assert.doesNotMatch(sm,/admin/);
 const nf=await worker.fetch(new Request('https://x.dev/yoq-sahifa',{headers:{accept:'text/html'}}),{ASSETS:assets});assert.equal(nf.status,404);assert.match(await nf.text(),/404/);
 const js=await worker.fetch(new Request('https://x.dev/yoq.js'),{ASSETS:assets});assert.equal(await js.text(),'nf');
});
