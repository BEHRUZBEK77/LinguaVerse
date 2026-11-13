import { handlers, scheduledHandlers } from '../out/handlers.mjs';
import { privateVideo } from './private-video.mjs';

const security = {
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), interest-cohort=()'
};

// Qidiruv tizimlari uchun ochiq sahifalar (admin, to'lov, kirish sahifalari kiritilmaydi)
export const SITEMAP_PAGES = ['/', '/select-language.html', '/languages-html/courses.html', '/languages-html/lugat.html',
  '/languages-html/fanlar.html', '/languages-html/English.html', '/languages-html/Russia.html', '/languages-html/Turkish.html',
  '/languages-html/German.html', '/languages-html/Spain.html', '/languages-html/Arabic.html', '/languages-html/Chinese.html',
  '/languages-html/Korean.html', '/languages-html/ielts-prep.html', '/languages-html/ielts-examiner.html',
  '/languages-html/speaking-coach.html', '/languages-html/writing-coach.html', '/languages-html/certificate-center.html',
  '/languages-html/partners.html', '/downloads.html', '/order.html', '/offer.html'];
export const robots = (origin) => `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin/\nDisallow: /.netlify/\nDisallow: /payment-result.html\nDisallow: /payment-sandbox.html\nSitemap: ${origin}/sitemap.xml\n`;
export const sitemap = (origin) => '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + SITEMAP_PAGES.map(p => `  <url><loc>${origin}${p}</loc></url>`).join('\n') + '\n</urlset>\n';

export async function toEvent(request) {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers);
  // Never trust caller-supplied forwarding headers for rate limiting.
  headers['x-nf-client-connection-ip'] = request.headers.get('cf-connecting-ip') || 'unknown';
  headers['x-forwarded-for'] = headers['x-nf-client-connection-ip'];
  headers.host = url.host;
  const body = ['GET', 'HEAD'].includes(request.method) ? null : await request.text();
  return { httpMethod: request.method, path: url.pathname, rawUrl: url.href,
    rawQuery: url.search.slice(1), headers, body, isBase64Encoded: false,
    queryStringParameters: Object.fromEntries(url.searchParams),
    multiValueQueryStringParameters: Object.fromEntries([...new Set(url.searchParams.keys())].map(k => [k, url.searchParams.getAll(k)])) };
}

export function toResponse(result, method) {
  const headers = new Headers({ ...security, ...result.headers });
  for (const [key, values] of Object.entries(result.multiValueHeaders || {})) {
    headers.delete(key);
    for (const value of values) headers.append(key, value);
  }
  const status = result.statusCode || 200;
  const body = method === 'HEAD' || [204, 205, 304].includes(status) ? null
    : result.isBase64Encoded ? Buffer.from(result.body || '', 'base64') : result.body || '';
  return new Response(body, { status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/.netlify/functions/private-video') {
      // Bu Worker'da video kaliti bo'lmasa — videoni sozlangan proksi manziliga yo'naltiramiz
      if (!env.GITHUB_VIDEO_TOKEN && env.VIDEO_PROXY_URL && new URL(env.VIDEO_PROXY_URL).host !== url.host) return Response.redirect(env.VIDEO_PROXY_URL + url.search, 302);
      return privateVideo(request, env);
    }
    const match = /^\/\.netlify\/functions\/([^/]+)(?:\/.*)?$/.exec(url.pathname);
    if (match) {
      const handler = Object.hasOwn(handlers, match[1]) ? handlers[match[1]] : null;
      if (typeof handler !== 'function') return new Response('Not found', {status:404, headers:security});
      try {
        return toResponse(await handler(await toEvent(request), {}), request.method);
      } catch (error) {
        console.error(JSON.stringify({event:'handler_error', route:match[1], name:error.name}));
        return Response.json({error:'Internal server error'}, {status:500, headers:security});
      }
    }
    if (url.pathname === '/admin') {
      url.pathname = '/admin/admin.html';
      return withSecurity(await env.ASSETS.fetch(new Request(url, request)));
    }
    if (url.pathname === '/languages-html/ai-coach.html') {
      url.pathname = '/languages-html/speaking-coach.html';
      return Response.redirect(url, 301);
    }
    if (url.pathname === '/sw.js' || url.pathname === '/favicon.ico' || url.pathname === '/manifest.webmanifest') {
      const map = { '/sw.js': '/js/sw.js', '/favicon.ico': '/media/favicon.ico', '/manifest.webmanifest': '/media/site.webmanifest' };
      const r = await env.ASSETS.fetch(new Request(new URL(map[url.pathname], url), request));
      const h = new Headers(r.headers);
      if (url.pathname === '/sw.js') { h.set('Cache-Control', 'no-cache'); h.set('Service-Worker-Allowed', '/'); }
      if (url.pathname === '/manifest.webmanifest') h.set('Content-Type', 'application/manifest+json');
      return withSecurity(new Response(r.body, { status: r.status, headers: h }));
    }
    if (url.pathname === '/robots.txt') return withSecurity(new Response(robots(url.origin), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } }));
    if (url.pathname === '/sitemap.xml') return withSecurity(new Response(sitemap(url.origin), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } }));
    const res = await env.ASSETS.fetch(request);
    // Topilmagan sahifa: brauzerga chiroyli 404 sahifasi (status 404 qoladi)
    if (res.status === 404 && request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html')) {
      const page = await env.ASSETS.fetch(new Request(new URL('/404.html', url), { headers: { accept: 'text/html' } }));
      if (page.ok) return withSecurity(new Response(page.body, { status: 404, headers: page.headers }));
    }
    // Lug'at bo'laklari va fanlar ro'yxati kam o'zgaradi — brauzer 1 kun keshlaydi
    if (res.ok && (url.pathname.startsWith('/vocab/') || url.pathname === '/subjects/catalog.json')) {
      const h = new Headers(res.headers); h.set('Cache-Control', 'public, max-age=86400');
      return withSecurity(new Response(res.body, { status: res.status, headers: h }));
    }
    return withSecurity(res);
  },
  async scheduled(controller, env, ctx) {
    const name = controller.cron === '0 5 * * *' ? 'renew-subscriptions'
      : controller.cron === '*/15 * * * *' ? 'update-leaderboard'
      : controller.cron === '15 3 * * *' ? 'partners-cron' : null;
    if (!name) throw new Error('Unknown schedule');
    ctx.waitUntil(scheduledHandlers[name]());
  }
};

// Statik sahifalarga ham xavfsizlik sarlavhalari (clickjacking, MIME sniffing, HTTPS majburiy)
function withSecurity(res) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(security)) if (!r.headers.has(k)) r.headers.set(k, v);
  return r;
}
