// ═══════════════════════════════════════════════════════════════════════════
// js/fb/client.js — Supabase ulanishi (Firebase o'rnini bosuvchi qatlam uchun)
//
// Butun sayt Firebase SDK o'rniga js/fb/firebase-*.js modullaridan import
// qiladi. Ular aynan Firebase API'sini (getAuth, doc, getDoc, setDoc ...)
// beradi, lekin ichkarida Supabase bilan ishlaydi. Shu sabab 30 dan ortiq
// sahifa kodi o'zgarmadi — faqat import manzili almashdi.
//
// Bu kalit OCHIQ (publishable) — brauzerda bo'lishi normal. Xavfsizlik
// Supabase'dagi RLS va lv_write() qoidalarida (supabase/migrations/).
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm';

export const SUPABASE_URL = 'https://gdifhnsffhscuetpyqwx.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_YwXEa5EH0NGSde9sn2L0Hg_o_MNhvu2';
export const STORAGE_KEY = 'sb-gdifhnsffhscuetpyqwx-auth-token';

// Bir sahifada bir nechta modul import qilsa ham bitta mijoz
const g = globalThis;
export const supabase = g.__lvSupabase || (g.__lvSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: STORAGE_KEY, flowType: 'implicit' },
  realtime: { params: { eventsPerSecond: 10 } }
}));

/** Netlify funksiyalari uchun bazaviy manzil (sayt ildizi). */
export const FN_BASE = new URL('../../.netlify/functions/', import.meta.url).href;

/** Firebase uslubidagi xato: e.code ('permission-denied', 'auth/invalid-credential' ...). */
export class FirebaseError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
    this.name = 'FirebaseError';
  }
}
