// Persistent, atomic rate limiting for Netlify functions.
const fsdb = require('./_firestore');

async function checkRateLimit(key, opts = {}) {
  const windowMs = Number(opts.windowMs ?? 60_000);
  const max = Number(opts.max ?? 20);
  if (typeof key !== 'string' || !key || !Number.isSafeInteger(windowMs) || windowMs < 1
      || !Number.isSafeInteger(max) || max < 1) {
    throw new TypeError('Rate-limit key and limits must be valid');
  }

  if (!fsdb.configured()) {
    console.error('[ratelimit] Firestore credentials are not configured; rejecting request');
    return { ok: false, unavailable: true };
  }

  const path = `rate_limits/${encodeURIComponent(key)}`;
  const now = Date.now();
  let result;

  try {
    await fsdb.transact(path, current => {
      const currentStart = Number(current?.windowStart) || 0;
      const expired = now - currentStart >= windowMs;
      const windowStart = expired ? now : currentStart;
      const count = (expired ? 0 : Number(current?.count) || 0) + 1;
      result = {
        ok: count <= max,
        count,
        max,
        retryAfterMs: Math.max(0, windowMs - (now - windowStart))
      };
      return { windowStart, count, updatedAt: new Date(now) };
    });
    return result;
  } catch (error) {
    console.error('[ratelimit] Firestore check failed; rejecting request:', error.message);
    return { ok: false, unavailable: true };
  }
}

function clientIp(event) {
  const headers = event.headers || {};
  return headers['x-nf-client-connection-ip']
      || (headers['x-forwarded-for'] || '').split(',')[0].trim()
      || headers['client-ip']
      || 'unknown';
}

module.exports = { checkRateLimit, clientIp };
