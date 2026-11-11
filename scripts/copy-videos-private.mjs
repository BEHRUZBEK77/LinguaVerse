#!/usr/bin/env node
// Ochiq repodagi dars video relizlarini (vid-*) YOPIQ video repoga xuddi shu tag bilan ko'chiradi.
// Bazadagi videoPath ("gh:<tag>#<obj>") o'zgarmaydi — Worker'da VIDEO_REPO ni almashtirish kifoya.
//   SRC=BEHRUZBEK77/LinguaVerse DST=BEHRUZBEK77/LinguaVerse-videos VIDEO_REPO_TOKEN=... SHARD=0 SHARDS=10 node scripts/copy-videos-private.mjs
//   DELETE_SRC=1 — ko'chirish tasdiqlangan relizlarni ochiq repodan O'CHIRADI (qaytarib bo'lmaydi)
const SRC = process.env.SRC || 'BEHRUZBEK77/LinguaVerse', DST = process.env.DST || 'BEHRUZBEK77/LinguaVerse-videos';
const TOKEN = process.env.VIDEO_REPO_TOKEN, SRC_TOKEN = process.env.SRC_TOKEN || process.env.GITHUB_TOKEN;
const SHARD = Number(process.env.SHARD || 0), SHARDS = Number(process.env.SHARDS || 1), DELETE_SRC = process.env.DELETE_SRC === '1';
if (!TOKEN) { console.error('VIDEO_REPO_TOKEN kerak'); process.exit(1); }
const H = t => ({ Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json', 'User-Agent': 'linguaverse-video' });
const gh = async (url, t, opt = {}) => {
  for (let i = 1; ; i++) {
    const r = await fetch(url, { ...opt, headers: { ...H(t), ...(opt.headers || {}) } });
    if (r.status === 403 || r.status === 429 || r.status >= 500) { if (i >= 5) return r; await new Promise(s => setTimeout(s, 15000 * i)); continue; }
    return r;
  }
};

// Oldindan tekshiruv: token yopiq repoga kira oladimi va yozish huquqi bormi
{
  const r = await gh(`https://api.github.com/repos/${DST}`, TOKEN);
  if (!r.ok) {
    console.error(`❌ Token ${DST} repozitoriyni ko'rmayapti (HTTP ${r.status}). Tekshiring:\n` +
      `  1) repo nomi aynan "${DST}" (github.com/${DST} ochiladimi)\n` +
      `  2) token sozlamasida "Repository access" → shu repo tanlangan\n` +
      `  3) token egasi (Resource owner) — ${DST.split('/')[0]}`);
    process.exit(1);
  }
  const repo = await r.json();
  const perms = repo.permissions ? Object.entries(repo.permissions).filter(([, v]) => v).map(([k]) => k).join(', ') : "noma'lum";
  console.log(`Yopiq repo: ${repo.full_name}, private=${repo.private}, ruxsatlar: ${perms}`);
  if (repo.permissions && !repo.permissions.push) { console.error('❌ Tokenda yozish huquqi yo\'q: Permissions → Contents → "Read and write" qiling (token o\'zgarmaydi, qayta qo\'shish shart emas)'); process.exit(1); }
}

// Manba relizlari (sahifalab)
const src = [];
for (let p = 1; ; p++) {
  const r = await gh(`https://api.github.com/repos/${SRC}/releases?per_page=100&page=${p}`, SRC_TOKEN || TOKEN);
  const list = await r.json(); if (!Array.isArray(list) || !list.length) break;
  for (const x of list) if (x.tag_name.startsWith('vid-')) { const a = x.assets.find(a => a.name.endsWith('.mp4')); if (a) src.push({ id: x.id, tag: x.tag_name, name: x.name, asset: a }); }
}
src.sort((a, b) => a.tag.localeCompare(b.tag));
const mine = src.filter((_, i) => i % SHARDS === SHARD);
console.log(`Ochiq repoda ${src.length} ta video reliz; bu bo'lak (${SHARD}/${SHARDS}): ${mine.length}`);

let copied = 0, skipped = 0, deleted = 0; const failed = [];
for (const x of mine) {
  try {
    const ex = await gh(`https://api.github.com/repos/${DST}/releases/tags/${x.tag}`, TOKEN);
    let ok = false;
    if (ex.ok) ok = (await ex.json()).assets?.some(a => a.name === x.asset.name && a.size === x.asset.size && a.state === 'uploaded');
    if (!ok) {
      const dl = await fetch(x.asset.browser_download_url, { redirect: 'follow' });
      if (!dl.ok) throw new Error(`yuklab olish ${dl.status}`);
      const buf = Buffer.from(await dl.arrayBuffer());
      if (buf.length !== x.asset.size) throw new Error('hajm mos emas');
      const rel = await gh(`https://api.github.com/repos/${DST}/releases`, TOKEN, { method: 'POST', body: JSON.stringify({ tag_name: x.tag, name: x.name, draft: true, prerelease: true, make_latest: 'false' }) });
      if (!rel.ok) throw new Error(`reliz ${rel.status} ${(await rel.text()).slice(0, 150)}`);
      const R = await rel.json();
      const up = await gh(`https://uploads.github.com/repos/${DST}/releases/${R.id}/assets?name=${encodeURIComponent(x.asset.name)}`, TOKEN, { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: buf });
      if (!up.ok) { await gh(`https://api.github.com/repos/${DST}/releases/${R.id}`, TOKEN, { method: 'DELETE' }); throw new Error(`yuklash ${up.status}`); }
      const pub = await gh(`https://api.github.com/repos/${DST}/releases/${R.id}`, TOKEN, { method: 'PATCH', body: JSON.stringify({ draft: false, make_latest: 'false' }) });
      if (!pub.ok) throw new Error(`e'lon ${pub.status}`);
      copied++; console.log(`✅ ${x.tag} (${(buf.length / 1048576).toFixed(0)} MB)`);
    } else { skipped++; }
    if (DELETE_SRC) {
      const d = await gh(`https://api.github.com/repos/${SRC}/releases/${x.id}`, SRC_TOKEN, { method: 'DELETE' });
      if (d.ok || d.status === 404) deleted++; else console.log(`⚠️ ochiq relizni o'chirib bo'lmadi: ${x.tag} ${d.status}`);
    }
  } catch (e) { failed.push(`${x.tag}: ${e.message}`); console.log(`❌ ${x.tag}: ${e.message}`); }
}
console.log(`\nKo'chirildi: ${copied}, avval ko'chgan: ${skipped}${DELETE_SRC ? `, ochiq repodan o'chirildi: ${deleted}` : ''}, xato: ${failed.length}`);
if (failed.length) { console.log(failed.join('\n')); process.exitCode = 1; }
