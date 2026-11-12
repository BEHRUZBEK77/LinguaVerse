import { handlers, scheduledHandlers } from '../out/handlers.mjs';
import { privateVideo } from './private-video.mjs';

const security = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), interest-cohort=()'
};

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
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (url.pathname === '/languages-html/ai-coach.html') {
      url.pathname = '/languages-html/speaking-coach.html';
      return Response.redirect(url, 301);
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(controller, env, ctx) {
    const name = controller.cron === '0 5 * * *' ? 'renew-subscriptions'
      : controller.cron === '*/15 * * * *' ? 'update-leaderboard'
      : controller.cron === '15 3 * * *' ? 'partners-cron' : null;
    if (!name) throw new Error('Unknown schedule');
    ctx.waitUntil(scheduledHandlers[name]());
  }
};
