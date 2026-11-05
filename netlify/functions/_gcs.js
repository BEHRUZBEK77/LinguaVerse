// ═══════════════════════════════════════════════════════════════════════════
// _gcs.js — Firebase Storage (Google Cloud Storage): MP4 video darslar
//
//   upload(objectName, buffer, contentType)   → video renderi yuklaydi
//   signedUrl(objectName, ttlSec)             → vaqtinchalik ko'rish havolasi
//
// Video pullik kontent: ochiq havola emas, 3 soatlik IMZOLANGAN havola
// (V4 signed URL) beriladi — faqat kursga huquqi bor odam oladi va havola
// tez orada eskiradi. Kalitlar _firestore.js bilan bir xil service account.
// ═══════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');

const BUCKET = () => process.env.FIREBASE_STORAGE_BUCKET || 'linguaverse-81b52.firebasestorage.app';

function creds() {
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('FIREBASE_CLIENT_EMAIL yoki FIREBASE_PRIVATE_KEY sozlanmagan');
  return { email, key };
}

const b64url = s => Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

let cached = null, cachedUntil = 0;
async function token() {
  if (cached && Date.now() < cachedUntil - 60_000) return cached;
  const { email, key } = creds();
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: email, scope: 'https://www.googleapis.com/auth/devstorage.read_write',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  }));
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claims}`).sign(key, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${sig}` })
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Storage token olinmadi: ' + (d.error_description || d.error));
  cached = d.access_token; cachedUntil = Date.now() + d.expires_in * 1000;
  return cached;
}

async function upload(objectName, buffer, contentType = 'video/mp4') {
  const t = await token();
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(BUCKET())}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': contentType, 'Cache-Control': 'private, max-age=3600' },
    body: buffer
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Yuklanmadi: ' + (d.error?.message || r.status));
  return { bucket: BUCKET(), name: objectName, size: Number(d.size) || buffer.length };
}

// RFC 3986 bo'yicha kodlash (V4 imzo talabi)
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/**
 * V4 imzolangan GET havola. Tarmoq so'rovisiz — faqat lokal imzo.
 * https://cloud.google.com/storage/docs/access-control/signed-urls
 */
function signedUrl(objectName, ttlSec = 3 * 3600, now = new Date()) {
  const { email, key } = creds();
  const host = 'storage.googleapis.com';
  const path = `/${BUCKET()}/${objectName.split('/').map(enc).join('/')}`;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');   // 20261104T150000Z
  const day = stamp.slice(0, 8);
  const scope = `${day}/auto/storage/goog4_request`;

  const params = {
    'X-Goog-Algorithm': 'GOOG4-RSA-SHA256',
    'X-Goog-Credential': `${email}/${scope}`,
    'X-Goog-Date': stamp,
    'X-Goog-Expires': String(Math.min(604800, ttlSec)),
    'X-Goog-SignedHeaders': 'host'
  };
  const query = Object.keys(params).sort().map(k => `${enc(k)}=${enc(params[k])}`).join('&');
  const canonical = ['GET', path, query, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['GOOG4-RSA-SHA256', stamp, scope, crypto.createHash('sha256').update(canonical).digest('hex')].join('\n');
  const signature = crypto.createSign('RSA-SHA256').update(toSign).sign(key, 'hex');
  return `https://${host}${path}?${query}&X-Goog-Signature=${signature}`;
}

module.exports = { upload, signedUrl, BUCKET };
