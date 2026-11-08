#!/usr/bin/env node
// Foydalanuvchini sayt admini qilish: admins/{uid} hujjatini yaratadi.
// Admin barcha video kurslarni (hamma til va daraja) ochiq ko'radi va admin panelga kiradi.
//
//   ADMIN_EMAIL=siz@mail.com SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/make-admin.mjs
//
// Email jurnalga chiqarilmaydi (repo ochiq) — faqat natija yoziladi.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fsdb = require('../netlify/functions/_firestore.js');

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!email || !URL_ || !KEY) { console.error('ADMIN_EMAIL, SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY kerak'); process.exit(1); }

let user = null;
for (let page = 1; page <= 50 && !user; page++) {
  const r = await fetch(`${URL_}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) { console.error(`Supabase auth: ${r.status}`); process.exit(1); }
  const body = await r.json();
  const list = body.users || body || [];
  user = list.find(u => (u.email || '').toLowerCase() === email) || null;
  if (list.length < 1000) break;
}
if (!user) {
  console.error("❌ Bu email bilan saytda hisob topilmadi. Avval saytga shu email bilan kiring (ro'yxatdan o'ting), keyin qayta ishga tushiring.");
  process.exit(1);
}
const uid = (user.app_metadata && user.app_metadata.legacy_uid) || user.id;
const prev = await fsdb.getDoc(`admins/${uid}`).catch(() => null);
await fsdb.setDoc(`admins/${uid}`, { role: 'admin', email, ...(prev || {}), updatedAt: new Date() });
console.log(prev ? '✅ Bu hisob allaqachon admin edi — yangilandi.' : '✅ Hisob admin qilindi: barcha kurslar ochiq, admin panelga kirish mumkin.');
