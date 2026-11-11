// Bepul ikkinchi manzil: https://linguaverse.pages.dev
// Pages loyihasi faqat kichik "eshik" (_worker.js): har bir so'rovni service binding orqali
// asosiy "linguaverse" Worker'iga ichkaridan uzatadi. Sayt bitta, manzil ikkita —
// alohida deploy kerak emas. Ba'zi provayderlar *.workers.dev ni to'sganda kerak bo'ladi.
const account = process.env.CLOUDFLARE_ACCOUNT_ID || 'a298e2629afd0b9496b4c1d366a2626e';
const token = process.env.CLOUDFLARE_API_TOKEN;
const project = process.env.PAGES_PROJECT || 'linguaverse';
if (!token) throw new Error('CLOUDFLARE_API_TOKEN kerak');
const base = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects`;
async function api(method, url, body) {
  const multipart = body instanceof FormData;
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) throw Object.assign(new Error(`Cloudflare ${method} ${url.replace(base, 'pages')}: HTTP ${r.status} ${JSON.stringify(j.errors || [])}`), { status: r.status });
  return j.result;
}
const binding = { services: { APP: { service: 'linguaverse', environment: 'production' } }, compatibility_date: '2025-09-01' };
let p = await api('GET', `${base}/${project}`).catch(e => { if (e.status === 404) return null; throw e; });
if (!p) {
  p = await api('POST', base, { name: project, production_branch: 'main', deployment_configs: { production: binding, preview: binding } });
  console.log('Pages loyihasi yaratildi:', p.subdomain);
} else {
  await api('PATCH', `${base}/${project}`, { deployment_configs: { production: binding, preview: binding } });
}
const worker = `export default { fetch(request, env) { return env.APP.fetch(request); } };\n`;
const form = new FormData();
form.append('manifest', '{}');
form.append('branch', 'main');
form.append('_worker.js', new Blob([worker], { type: 'application/javascript+module' }), '_worker.js');
const d = await api('POST', `${base}/${project}/deployments`, form);
console.log('Joylandi:', d.url, '→ asosiy manzil: https://' + (p.subdomain || `${project}.pages.dev`));
