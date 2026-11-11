// ═══════════════════════════════════════════════════════════════════════════
// _storage.js — MP4 darslarni saqlash: Cloudflare R2 (bepul) yoki Firebase
//
// R2: 10 GB bepul, ko'rish trafigi (egress) umuman bepul. S3 bilan mos —
// imzolangan (presigned) havolalar AWS SigV4 bilan, qo'shimcha kutubxonasiz.
// Env (Netlify + GitHub Secrets):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
// R2 sozlanmagan bo'lsa — avvalgidek Firebase Storage (_gcs.js).
//
// Video pullik kontent: ochiq havola emas, qisqa muddatli imzolangan havola.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const crypto = require('crypto');

const r2 = () => {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: keyId, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket } = process.env;
  return account && keyId && secret && bucket ? { host: `${account}.r2.cloudflarestorage.com`, keyId, secret, bucket, region: 'auto' } : null;
};

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
// RFC 3986 (SigV4 talabi); '/' yo'l ichida saqlanadi
const rfc3986 = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const encPath = p => p.split('/').map(rfc3986).join('/');

/**
 * AWS SigV4 presigned URL (S3 / R2). Path-style: https://host/bucket/key
 * Sinov vektori AWS hujjatidan (scripts testida tekshiriladi).
 */
function presign({ method = 'GET', host, path, region, keyId, secret, expires = 3600, date = new Date(), service = 's3' }) {
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');        // 20130524T000000Z
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${region}/${service}/aws4_request`;
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${keyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host'
  };
  const query = Object.keys(params).sort().map(k => `${rfc3986(k)}=${rfc3986(params[k])}`).join('&');
  const canonical = [method, encPath(path), query, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac('AWS4' + secret, day), region), service), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(toSign).digest('hex');
  return `https://${host}${encPath(path)}?${query}&X-Amz-Signature=${signature}`;
}

// GitHub Releases (R2 bo'lmaganda vaqtinchalik): VIDEO_STORE=github, GITHUB_TOKEN, GITHUB_REPOSITORY
// Repoda "immutable releases" yoqilgan: e'lon qilingan relizga fayl qo'shib bo'lmaydi.
// Shuning uchun har bir video o'z relizida: qoralama (draft) → fayl yuklash → e'lon qilish.
// Saqlangan yo'l: "gh:<tag>#<objectName>". Eski "gh:<objectName>" yozuvlari videos-v1 ga qaraydi.
const GH_TAG = 'videos-v1';
// VIDEO_REPO — videolar uchun alohida YOPIQ repo (masalan BEHRUZBEK77/LinguaVerse-videos), token: VIDEO_REPO_TOKEN
const ghRepo = () => process.env.VIDEO_REPO || process.env.GITHUB_VIDEO_REPO || process.env.GITHUB_REPOSITORY || 'BEHRUZBEK77/LinguaVerse';
const ghName = objectName => objectName.replace(/\//g, '__');
const ghTag = (objectName, date = new Date()) =>
  'vid-' + objectName.replace(/^courseVideos\//, '').replace(/\.mp4$/, '').replace(/[^\w.-]+/g, '-') + '-' + date.toISOString().replace(/\D/g, '').slice(0, 14);
const provider = () => (process.env.VIDEO_STORE === 'github' ? 'gh' : r2() ? 'r2' : 'gcs');

async function ghUpload(objectName, buffer, contentType) {
  const token = process.env.VIDEO_REPO ? process.env.VIDEO_REPO_TOKEN : process.env.GITHUB_TOKEN;
  if (!token) throw new Error(process.env.VIDEO_REPO ? 'VIDEO_REPO_TOKEN yo\'q' : 'GITHUB_TOKEN yo\'q');
  const api = `https://api.github.com/repos/${ghRepo()}`;
  const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'linguaverse-video' };
  const tag = ghTag(objectName);
  const rel = await fetch(`${api}/releases`, { method: 'POST', headers: h, body: JSON.stringify({ tag_name: tag, name: `Video: ${objectName.split('/').pop()}`, body: 'Avtomatik yaratilgan dars videosi.', draft: true, prerelease: true, make_latest: 'false' }) });
  if (!rel.ok) throw new Error(`GitHub release: ${rel.status} ${(await rel.text()).slice(0, 200)}`);
  const release = await rel.json();
  const name = ghName(objectName);
  try {
    const up = await fetch(`https://uploads.github.com/repos/${ghRepo()}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { ...h, 'Content-Type': contentType }, body: buffer });
    if (!up.ok) throw new Error(`GitHub yuklash: ${up.status} ${(await up.text()).slice(0, 200)}`);
    const pub = await fetch(`${api}/releases/${release.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ draft: false, make_latest: 'false' }) });
    if (!pub.ok) throw new Error(`GitHub e'lon: ${pub.status} ${(await pub.text()).slice(0, 200)}`);
  } catch (e) {
    await fetch(`${api}/releases/${release.id}`, { method: 'DELETE', headers: h }).catch(() => {});   // chala qoralama qolmasin
    throw e;
  }
  return { name, tag, size: buffer.length, provider: 'gh', stored: `gh:${tag}#${objectName}` };
}

async function upload(objectName, buffer, contentType = 'video/mp4') {
  if (provider() === 'gh') {
    // tarmoq uzilishi bo'lsa 3 marta urinadi
    for (let i = 1; ; i++) {
      try { return await ghUpload(objectName, buffer, contentType); }
      catch (e) { if (i >= 3) throw e; await new Promise(r => setTimeout(r, 5000 * i)); }
    }
  }
  const c = r2();
  if (!c) return require('./_gcs.js').upload(objectName, buffer, contentType);
  const url = presign({ method: 'PUT', host: c.host, path: `/${c.bucket}/${objectName}`, region: c.region, keyId: c.keyId, secret: c.secret, expires: 900 });
  const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: buffer });
  if (!r.ok) throw new Error(`R2 ga yuklanmadi: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return { bucket: c.bucket, name: objectName, size: buffer.length, provider: 'r2', stored: `r2:${objectName}` };
}

/** Vaqtinchalik ko'rish havolasi. "r2:" / "gcs:" prefiksi videoning qayerdaligini bildiradi. */
function signedUrl(storedPath, ttlSec = 3 * 3600) {
  const m = /^(r2|gcs|gh):(.+)$/.exec(storedPath);
  const where = m ? m[1] : 'gcs';                    // eski yozuvlar — Firebase
  const name = m ? m[2] : storedPath;
  if (where === 'gcs') return require('./_gcs.js').signedUrl(name, ttlSec);
  if (where === 'gh') {
    const hash = name.indexOf('#');
    const [tag, obj] = hash > 0 ? [name.slice(0, hash), name.slice(hash + 1)] : [GH_TAG, name];
    if (process.env.VIDEO_SIGNING_SECRET && process.env.VIDEO_PROXY_URL) {
      const expires = String(Math.floor(Date.now() / 1000) + Math.max(1, Math.min(ttlSec, 10800)));
      const sig = crypto.createHmac('sha256', process.env.VIDEO_SIGNING_SECRET).update(`${expires}\n${storedPath}`).digest('hex');
      return `${process.env.VIDEO_PROXY_URL}?path=${encodeURIComponent(storedPath)}&expires=${expires}&sig=${sig}`;
    }
    return `https://github.com/${ghRepo()}/releases/download/${tag}/${ghName(obj)}`;
  }
  const c = r2();
  if (!c) throw new Error('R2 sozlanmagan');
  return presign({ method: 'GET', host: c.host, path: `/${c.bucket}/${name}`, region: c.region, keyId: c.keyId, secret: c.secret, expires: Math.min(ttlSec, 604800) });
}

/** Saqlangan yo'l (dars hujjatiga yoziladi) */
const storedPath = (objectName, where = provider()) => `${where}:${objectName}`;

module.exports = { upload, signedUrl, storedPath, provider, presign, ghTag };
