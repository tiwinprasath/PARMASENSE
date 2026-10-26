import app from '../server/index.js';

export default function handler(req, res) {
  // Preserve the API prefix if Vercel passes only the catch-all route suffix.
  if (req.url && !req.url.startsWith('/api/')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return app(req, res);
}
