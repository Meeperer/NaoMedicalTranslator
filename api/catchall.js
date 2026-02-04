/**
 * Vercel: single API handler for all /api/* (via rewrite in vercel.json).
 * Rewrite sends /api/:path* -> /api/catchall?path=:path* so this file receives every API request.
 */
import app from '../server/index.js';

export default function handler(req, res) {
  const raw = req.url || '/';
  const method = req.method || 'GET';

  // Rewrite sends /api/:path* -> /api/catchall?path=:path*; preserve other query params (e.g. ?q=foo)
  const [pathname, queryString] = raw.split('?');
  const params = new URLSearchParams(queryString || '');
  const pathFromQuery = params.get('path');
  const pathPart = pathFromQuery !== null && pathFromQuery !== undefined
    ? pathFromQuery
    : pathname.replace(/^\/api\/?/, '').replace(/^\/catchall\/?/, '');
  const path = pathPart === '' ? '' : pathPart.startsWith('/') ? pathPart.slice(1) : pathPart;
  const rest = [];
  params.forEach((v, k) => { if (k !== 'path') rest.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`); });
  const qs = rest.length ? rest.join('&') : '';
  const normalized = '/api' + (path ? '/' + path : '') + (qs ? '?' + qs : '');

  req.url = normalized;
  if (process.env.NODE_ENV !== 'production') {
    const pathOnly = normalized.split('?')[0];
    console.log('[naomedical-api] catchall', { method, path: pathOnly });
  }

  try {
    return app(req, res);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[naomedical-api] error', err?.message || err);
    res.setHeader('Content-Type', 'application/json');
    const message = process.env.NODE_ENV === 'production' ? 'Something went wrong' : (err?.message || 'Serverless handler error');
    res.status(500).end(JSON.stringify({ error: message }));
  }
}
