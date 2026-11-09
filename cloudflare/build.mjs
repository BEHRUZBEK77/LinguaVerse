import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { builtinModules } from 'node:module';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'out');
await fs.mkdir(output, { recursive:true });
const names = (await fs.readdir(path.join(root,'netlify/functions'))).filter(x => x.endsWith('.js') && !x.startsWith('_')).map(x => x.slice(0,-3));
const scheduled = new Set(['renew-subscriptions','update-leaderboard','partnership']);
await fs.writeFile(path.join(output,'handlers.mjs'), names.map((n,i)=>`import h${i} from '../netlify/functions/${n}.js';`).join('\n') + '\n' +
  ['handlers','scheduledHandlers'].map((group)=>`export const ${group} = {${names.map((n,i)=>({n,i})).filter(({n})=>scheduled.has(n)===(group==='scheduledHandlers')).map(({n,i})=>`${JSON.stringify(n)}:h${i}.handler`).join(',')}};`).join('\n'));
await build({entryPoints:[path.join(root,'cloudflare/worker.mjs')], outfile:path.join(output,'worker.mjs'), bundle:true, format:'esm', platform:'node', target:'es2022',
  external:builtinModules.flatMap(m=>[m,`node:${m}`]),
  banner:{js:"import { createRequire } from 'node:module'; const require = createRequire('/worker.mjs'); const __dirname = '/bundle/netlify/functions';"}});

// Only explicitly public directories and root HTML are published. Never publish
// backend sources, lesson answers, credentials, build tools, or repository files.
const publicDirs = ['admin','auth','css','js','languages-html','locales','media','world','downloads','mobile-web'];
const allowed = new Set(['.html','.css','.js','.mjs','.json','.svg','.png','.jpg','.jpeg','.gif','.webp','.ico','.woff','.woff2','.ttf','.mp4','.mp3','.wav','.webmanifest','.pdf','.apk','.exe','.dmg','.AppImage']);
const files = [];
async function walk(dir) {
  for (const entry of await fs.readdir(path.join(root,dir), {withFileTypes:true})) {
    if (entry.name.startsWith('.')) continue;
    const name = path.posix.join(dir,entry.name);
    if (entry.isDirectory()) await walk(name);
    else if (allowed.has(path.extname(name))) files.push(name);
  }
}
for (const dir of publicDirs) { try { await walk(dir); } catch(e) {if(e.code!=='ENOENT')throw e;} }
for (const f of await fs.readdir(root)) if(f.endsWith('.html')) files.push(f);
// Cloudflare-only asset layer: no source HTML or Netlify site changes.
const cloudflareOnlyAssets = new Map([
  ['cloudflare/site-assets/brand.css','/lv-cloudflare-brand.css'],
  ['cloudflare/site-assets/brand.js','/lv-cloudflare-brand.js'],
  ['cloudflare/site-assets/partners.css','/lv-cloudflare-partners.css'],
  ['cloudflare/site-assets/partners.js','/lv-cloudflare-partners.js']
]);
files.push(...cloudflareOnlyAssets.keys());
const manifest = {}, sources = {};
for (const file of files) {
  let bytes = await fs.readFile(path.join(root,file));
  let sourcePath = file;
  const publicPath = cloudflareOnlyAssets.get(file) || '/'+file;
  if (file.endsWith('.html')) {
    let html = bytes.toString('utf8');
    // Remove only the old bottom-right CTA. A safe bottom-left dock is injected via JS.
    if (file === 'index.html') {
      html = html.replace(/<a href="\/languages-html\/partners\.html" style="position:fixed;bottom:17px;right:18px;[^>]*>[\s\S]*?<\/a>\s*/g, '');
    }
    if (html.includes('</head>') && !html.includes('data-lv-cloudflare-ui')) {
      const partners = file === 'languages-html/partners.html';
      const injection = `\n<link rel="icon" type="image/webp" href="/media/linguaverse-mark.webp" data-lv-cloudflare-ui>\n`+
        (partners ? '<link rel="stylesheet" href="/css/lv-theme.css">\n' : '') +
        '<link rel="stylesheet" href="/lv-cloudflare-brand.css">\n'+
        '<script src="/lv-cloudflare-brand.js" defer></script>\n'+
        (partners ? '<link rel="stylesheet" href="/lv-cloudflare-partners.css">\n<script type="module" src="/lv-cloudflare-partners.js"></script>\n' : '');
      html = html.replace(/<\/head>/i, injection+'</head>');
    }
    bytes = Buffer.from(html,'utf8');
    sourcePath = 'out/cloudflare-pages/'+file;
    await fs.mkdir(path.dirname(path.join(root, sourcePath)),{recursive:true});
    await fs.writeFile(path.join(root, sourcePath), bytes);
  }
  if(bytes.length>25*1024*1024) throw new Error(`Asset exceeds 25 MiB: ${file}`);
  const hash = createHash('sha256').update(bytes).update(path.extname(file)).digest('hex').slice(0,32);
  manifest[publicPath] = {hash,size:bytes.length};
  sources[hash] = sourcePath;
}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest));
await fs.writeFile(path.join(output,'asset-sources.json'),JSON.stringify(sources));
console.log(`Built ${names.length} functions and ${files.length} public assets.`);
