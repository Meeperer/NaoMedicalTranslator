/**
 * Standalone health check so we can verify /api/* is routed on Vercel.
 * If GET /api/health returns 200, the api folder is deployed. If it 404s, api routes aren't being invoked.
 */
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).end(
    JSON.stringify({
      ok: true,
      message: 'API is reachable',
      vercel: Boolean(process.env.VERCEL),
      timestamp: new Date().toISOString(),
    })
  );
}
