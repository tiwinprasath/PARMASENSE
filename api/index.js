import app from '../server/index.js';

export default function handler(req, res) {
  const routePath = req.query?.path;
  if (typeof routePath === 'string') {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'path') continue;
      if (Array.isArray(value)) {
        value.forEach((item) => query.append(key, String(item)));
      } else if (value !== undefined) {
        query.set(key, String(value));
      }
    }

    const suffix = query.size ? `?${query.toString()}` : '';
    req.url = `/api/${routePath.replace(/^\/+/, '')}${suffix}`;
  }

  return app(req, res);
}
