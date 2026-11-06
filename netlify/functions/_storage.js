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
const GH_TAG = 'videos-v1';
const ghRepo = () => process.env.GITHUB_REPOSITORY || process.env.GITHUB_VIDEO_REPO || 'BEHRUZBEK77/LinguaVerse';
const ghName = objectName => objectName.replace(/\//g, '__');
const provider = () => (process.env.VIDEO_STORE === 'github' ? 'gh' : r2() ? 'r2' : 'gcs');

async function ghUpload(objectName, buffer, contentType) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN yo\'q');
  const api = `https://api.github.com/repos/${ghRepo()}`;
  const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'linguaverse-video' };
  let rel = await fetch(`${api}/releases/tags/${GH_TAG}`, { headers: h });
  if (rel.status === 404) rel = await fetch(`${api}/releases`, { method: 'POST', headers: h, body: JSON.stringify({ tag_name: GH_TAG, name: 'LinguaVerse video darslar', body: 'Avtomatik yaratilgan dars videolari.', prerelease: true }) });
  if (rel.status === 422) rel = await fetch(`${api}/releases/tags/${GH_TAG}`, { headers: h });   // parallel runner yaratib bo'ldi
  if (!rel.ok) throw new Error(`GitHub release: ${rel.status} ${(await rel.text()).slice(0, 200)}`);
  const release = await rel.json();
  const name = ghName(objectName);
  for (const a of release.assets || []) if (a.name === name) await fetch(`${api}/releases/assets/${a.id}`, { method: 'DELETE', headers: h });
  const up = await fetch(`https://uploads.github.com/repos/${ghRepo()}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { ...h, 'Content-Type': contentType }, body: buffer });
  if (!up.ok) throw new Error(`GitHub yuklash: ${up.status} ${(await up.text()).slice(0, 200)}`);
  return { name, size: buffer.length, provider: 'gh' };
}

async function upload(objectName, buffer, contentType = 'video/mp4') {
  if (provider() === 'gh') return ghUpload(objectName, buffer, contentType);
  const c = r2();
  if (!c) return require('./_gcs.js').upload(objectName, buffer, contentType);
  const url = presign({ method: 'PUT', host: c.host, path: `/${c.bucket}/${objectName}`, region: c.region, keyId: c.keyId, secret: c.secret, expires: 900 });
  const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: buffer });
  if (!r.ok) throw new Error(`R2 ga yuklanmadi: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return { bucket: c.bucket, name: objectName, size: buffer.length, provider: 'r2' };
}

/** Vaqtinchalik ko'rish havolasi. "r2:" / "gcs:" prefiksi videoning qayerdaligini bildiradi. */
function signedUrl(storedPath, ttlSec = 3 * 3600) {
  const m = /^(r2|gcs|gh):(.+)$/.exec(storedPath);
  const where = m ? m[1] : 'gcs';                    // eski yozuvlar — Firebase
  const name = m ? m[2] : storedPath;
  if (where === 'gcs') return require('./_gcs.js').signedUrl(name, ttlSec);
  if (where === 'gh') return `https://github.com/${ghRepo()}/releases/download/${GH_TAG}/${ghName(name)}`;
  const c = r2();
  if (!c) throw new Error('R2 sozlanmagan');
  return presign({ method: 'GET', host: c.host, path: `/${c.bucket}/${name}`, region: c.region, keyId: c.keyId, secret: c.secret, expires: Math.min(ttlSec, 604800) });
}

/** Saqlangan yo'l (dars hujjatiga yoziladi) */
const storedPath = (objectName, where = provider()) => `${where}:${objectName}`;

module.exports = { upload, signedUrl, storedPath, provider, presign };
