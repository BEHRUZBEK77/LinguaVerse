'use strict';
// A single server-side entitlement table. Levels b2 (0-99), c2 (100-149), pro (separate purchase).
const VIDEO_LIMITS = Object.freeze({ free: 10, nova: 30, mega: 50, premium: 70, ultra: 150, youtuber: 150 });
const ACTIVE = new Set(['nova', 'mega', 'premium', 'ultra']);
function toTime(v) { if (v instanceof Date) return v.getTime(); if (v && typeof v === 'object') return Date.parse(v.$t || v.iso || '') || 0; return Date.parse(v || '') || 0; }
function validPaidPlan(user, now = Date.now()) {
  if (!user || !ACTIVE.has(user.plan)) return 'free';
  return !user.planExpiry || toTime(user.planExpiry) > now ? user.plan : 'free';
}
function creatorActive(user, now = Date.now()) {
  return user?.creator?.status === 'active' && toTime(user.creator.activeUntil) > now;
}
function effectivePlan(user, now = Date.now()) {
  const paid = validPaidPlan(user, now);
  if (paid === 'ultra') return 'ultra';
  if (creatorActive(user, now)) return 'youtuber';
  return paid;
}
function videoLimit(user, now = Date.now()) { return VIDEO_LIMITS[effectivePlan(user, now)] || 10; }
function owns(user, lang, level) {
  const o = user?.courses || {};
  return !!o[`${lang}_${level}`] || (level === 'b2' && !!o[`${lang}_c2`]);
}
function canWatch(user, lang, level, index, now = Date.now()) {
  if (!Number.isInteger(index) || index < 0) return false;
  if ((level === 'b2' && index >= 100) || (level !== 'b2' && index >= 50)) return false;
  if (owns(user, lang, level) || effectivePlan(user, now) === 'ultra') return true;
  if (level === 'pro') return false; // PRO is a separate lifetime product.
  if (level !== 'b2' && level !== 'c2') return false;
  return (level === 'c2' ? 100 + index : index) < videoLimit(user, now);
}
/**
 * Kontent yaratuvchi imtiyozi FAQAT serverdagi partnerAccounts/{uid} hujjatidan olinadi.
 * users/{uid}.creator maydoni mijoz tomonidan yozilishi mumkin — unga ishonilmaydi.
 */
async function withServerPerks(fsdb, uid, user) {
  const acc = await fsdb.getDoc(`partnerAccounts/${uid}`).catch(() => null);
  return { ...(user || {}), creator: acc && acc.status === 'active' && acc.creator ? acc.creator : null };
}
module.exports = { VIDEO_LIMITS, effectivePlan, creatorActive, videoLimit, canWatch, owns, withServerPerks };
