// Cloudflare signed private MP4 proxy. The course API must authorize the user before issuing this URL.
import { createHmac, timingSafeEqual } from 'node:crypto';
const REPO = 'BEHRUZBEK77/LinguaVerse';
const metadataCache = new Map();
const signature = (path, expires, key) => createHmac('sha256', key).update(`${expires}\n${path}`).digest('hex');
export function validTicket(path, expires, sig, key, now = Math.floor(Date.now() / 1000)) {
  if (!key || !/^gh:[\w.-]+#courseVideos\/v3\/uz\/[a-z]+_(b2|c2|pro)_\d+\.mp4$/.test(path)
      || !/^\d{10}$/.test(expires) || Number(expires) <= now || Number(expires) > now + 10800
      || !/^[a-f0-9]{64}$/.test(sig)) return false;
  return timingSafeEqual(Buffer.from(signature(path, expires, key), 'hex'), Buffer.from(sig, 'hex'));
}
export async function privateVideo(request, env) {
  const url = new URL(request.url), path = url.searchParams.get('path') || '', expires = url.searchParams.get('expires') || '', sig = url.searchParams.get('sig') || '';
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers });
  if (!validTicket(path, expires, sig, env.VIDEO_SIGNING_SECRET)) return new Response('Video link expired or invalid', { status: 403, headers });
  if (!env.GITHUB_VIDEO_TOKEN) return new Response('Video temporarily unavailable', { status: 503, headers });
  const [tag, object] = path.slice(3).split('#'), name = object.replaceAll('/', '__');
  const range = request.headers.get('range');
  if (range && !/^bytes=\d*-\d*$/.test(range)) return new Response(null, { status: 416, headers });
  try {
    const auth = { Authorization: `Bearer ${env.GITHUB_VIDEO_TOKEN}`, 'User-Agent': 'LinguaVerse-video', 'X-GitHub-Api-Version': '2022-11-28' };
    let asset = metadataCache.get(path);
    if (!asset || asset.until < Date.now()) {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${encodeURIComponent(tag)}`, { headers: { ...auth, Accept: 'application/vnd.github+json' } });
      if (!r.ok) return new Response('Video temporarily unavailable', { status: r.status === 404 ? 404 : 502, headers });
      const release = await r.json();
      const found = release.assets?.find(a => a.name === name && a.state === 'uploaded');
      if (!found) return new Response('Video not found', { status: 404, headers });
      asset = { id: found.id, until: Date.now() + 300000 };
      if (metadataCache.size > 1500) metadataCache.clear();
      metadataCache.set(path, asset);
    }
    const mediaHeaders = { ...(range ? { Range: range } : {}), ...(request.headers.has('if-range') ? { 'If-Range': request.headers.get('if-range') } : {}) };
    let upstream = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${asset.id}`, { headers: { ...auth, ...mediaHeaders, Accept: 'application/octet-stream' }, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = new URL(upstream.headers.get('location'));
      if (location.protocol !== 'https:' || !['release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(location.hostname)) throw new Error('Invalid asset host');
      await upstream.body?.cancel();
      upstream = await fetch(location, { method: request.method, headers: mediaHeaders, redirect: 'error' });
    }
    if (![200, 206, 304, 416].includes(upstream.status)) {
      await upstream.body?.cancel();
      return new Response('Video temporarily unavailable', { status: 502, headers });
    }
    for (const key of ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
      const value = upstream.headers.get(key);
      if (value) headers[key] = value;
    }
    headers['Content-Type'] = 'video/mp4'; headers['Content-Disposition'] = 'inline';
    if (request.method === 'HEAD' || upstream.status === 304) {
      await upstream.body?.cancel();
      return new Response(null, { status: upstream.status, headers });
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return new Response('Video temporarily unavailable', { status: 502, headers });
  }
}
