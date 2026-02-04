/**
 * Vercel catch-all: forwards all /api/* requests to the Express app.
 * On Vercel, req.url can be the path without /api (e.g. /conversations/xxx); normalize so Express sees /api/...
 */
import app from '../server/index.js';

export default function handler(req, res) {
  const raw = req.url || '/';
  const method = req.method || 'GET';
  if (process.env.NODE_ENV !== 'production') {
    const pathOnly = (raw.split('?')[0] || '/');
    console.log('[naomedical-api] handler hit', { method, path: pathOnly });
  }

  const [pathPart, qs] = raw.split('?');
  const path = pathPart || '/';
  const normalized = path.startsWith('/api') ? raw : '/api' + (path === '/' ? '' : path) + (qs ? `?${qs}` : '');
  if (normalized !== raw) req.url = normalized;

  try {
    return app(req, res);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[naomedical-api] error', err?.message || err);
    res.setHeader('Content-Type', 'application/json');
    const message = process.env.NODE_ENV === 'production' ? 'Something went wrong' : (err?.message || 'Serverless handler error');
    res.status(500).end(JSON.stringify({ error: message }));
  }
}
