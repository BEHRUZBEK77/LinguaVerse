// ═══════════════════════════════════════════════════════════════════════════
// _auth.js — Firebase ID-TOKEN TEKSHIRUVI (umumiy yordamchi)
//
// payment.js dagi tasdiqlash mantig'i bilan bir xil — shu yerga chiqarildi,
// chunki community.js kabi boshqa funksiyalar ham "bu so'rov haqiqatan ham
// shu userdan keldimi" tekshirishi kerak.
// ═══════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');

let certCache = null, certCachedUntil = 0;

async function googleCerts() {
  if (certCache && Date.now() < certCachedUntil) return certCache;
  const r = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('Google sertifikatlari olinmadi');
  certCache = await r.json();
  const maxAge = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
  certCachedUntil = Date.now() + (maxAge ? +maxAge[1] : 3600) * 1000;
  return certCache;
}

async function verifyIdToken(idToken) {
  if (!idToken) throw new Error('Token yuborilmagan');

  const [h, p, s] = idToken.split('.');
  if (!h || !p || !s) throw new Error("Token ko'rinishi noto'g'ri");

  const header = JSON.parse(Buffer.from(h, 'base64url').toString());
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  const projectId = process.env.FIREBASE_PROJECT_ID || 'linguaverse-81b52';

  if (payload.aud !== projectId) throw new Error('Token boshqa loyihaga tegishli');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("Token manbasi noto'g'ri");
  if (payload.exp * 1000 < Date.now()) throw new Error('Token muddati tugagan');
  if (!payload.sub) throw new Error("Tokenda foydalanuvchi yo'q");

  const certs = await googleCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Token kaliti topilmadi');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${h}.${p}`);
  if (!verifier.verify(cert, Buffer.from(s, 'base64url'))) {
    throw new Error("Token imzosi noto'g'ri");
  }

  return {
    uid: payload.sub,
    email: payload.email || '',
    name: payload.name || (payload.email ? payload.email.split('@')[0] : "O'quvchi")
  };
}

module.exports = { verifyIdToken };
