/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pharmacy Management Platform - Backend API
 *
 * A small Express server that exposes the application's data
 * (medicines, inventory, sales, suppliers, customers, prescriptions,
 * notifications and scheduler logs) as a REST API backed by a JSON
 * file on disk (see db.js). The frontend (Vite dev server) proxies
 * `/api/*` requests to this server - see vite.config.ts.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Simple request log, useful when debugging the integration
app.use((req, _res, next) => {
  console.log(`[api] ${req.method} ${req.originalUrl}`);
  next();
});

// --- Serve built frontend (production) ---------------------------------
const distPath = path.resolve(__dirname, '..', 'dist');
const hasDist = fs.existsSync(distPath);
if (hasDist) {
  app.use(express.static(distPath));
}

// --- Root route: status page or redirect to frontend ------------------
app.get('/', (_req, res) => {
  if (hasDist) {
    return res.sendFile(path.join(distPath, 'index.html'));
  }
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>PharmeSense API Server</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 40px 48px; max-width: 480px; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
        h1 { color: #2dd4bf; margin: 0 0 8px; font-size: 1.5rem; }
        p { color: #94a3b8; margin: 0 0 24px; }
        .badge { display: inline-block; background: #14532d; color: #4ade80; border: 1px solid #166534; border-radius: 999px; padding: 4px 14px; font-size: 0.8rem; font-weight: 600; margin-bottom: 24px; }
        a { display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 1rem; transition: background 0.2s; }
        a:hover { background: #0f766e; }
        .routes { text-align: left; margin-top: 28px; background: #0f172a; border-radius: 10px; padding: 16px 20px; font-size: 0.82rem; color: #64748b; }
        .routes code { color: #7dd3fc; }
      </style>
    </head>
    <body>
      <div class="card">
        <div style="font-size:2.5rem; margin-bottom:12px;">✚</div>
        <h1>PharmeSense — API Server</h1>
        <p>Backend is running successfully on port ${PORT}</p>
        <span class="badge">● Online</span><br/>
        <a href="http://localhost:3000">Open App → localhost:3000</a>
        <div class="routes">
          <strong style="color:#94a3b8;">Available API routes:</strong><br/><br/>
          <code>GET  /api/health</code><br/>
          <code>GET  /api/state</code><br/>
          <code>PUT  /api/state</code><br/>
          <code>POST /api/state/reset</code><br/>
          <code>POST /api/state/seed</code><br/>
          <code>GET  /api/:collection</code><br/>
          <code>PUT  /api/:collection</code>
        </div>
      </div>
    </body>
    </html>
  `);
});

// --- Health check -----------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pharmasense-api', time: new Date().toISOString() });
});

// --- Auth Endpoints ----------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const state = db.readState();
    const users = state.users || [];
    const matched = users.find(
      (u) => u.email.toLowerCase() === String(email).trim().toLowerCase() && u.passwordHash === password
    );
    if (!matched) {
      return res.status(401).json({ error: 'Invalid email or passcode credentials.' });
    }
    res.json({
      success: true,
      user: {
        email: matched.email,
        name: matched.name,
        role: matched.role
      }
    });
  } catch (err) {
    console.error('[auth] Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    const state = db.readState();
    const users = state.users || [];
    const exists = users.some((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
    if (exists) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }
    const newUser = {
      email: String(email).trim(),
      passwordHash: String(password),
      role: role || 'Admin',
      name: String(name).trim()
    };
    const updatedUsers = [...users, newUser];
    db.writeCollection('users', updatedUsers);
    res.json({
      success: true,
      message: 'Account registered successfully',
      user: {
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error('[auth] Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// --- Whole-state endpoints ---------------------------------------------
// GET  /api/state  -> returns every collection in one payload (used on app load)
app.get('/api/state', (_req, res) => {
  try {
    const state = db.readState();
    res.json(state);
  } catch (err) {
    console.error('Failed to read state:', err);
    res.status(500).json({ error: 'Failed to read application state' });
  }
});

// PUT /api/state -> bulk-replace every collection at once
app.put('/api/state', (req, res) => {
  try {
    const incoming = req.body || {};
    const state = db.readState();
    for (const key of db.COLLECTIONS) {
      if (Array.isArray(incoming[key])) {
        state[key] = incoming[key];
      }
    }
    db.writeState(state);
    res.json(state);
  } catch (err) {
    console.error('Failed to write state:', err);
    res.status(500).json({ error: 'Failed to persist application state' });
  }
});

// POST /api/state/reset -> wipe all collections (keeps schema)
app.post('/api/state/reset', (_req, res) => {
  try {
    const state = db.resetToEmpty();
    res.json(state);
  } catch (err) {
    console.error('Failed to reset state:', err);
    res.status(500).json({ error: 'Failed to reset application state' });
  }
});

// POST /api/state/seed -> restore the original showcase/demo dataset
app.post('/api/state/seed', (_req, res) => {
  try {
    const state = db.resetToSeed();
    res.json(state);
  } catch (err) {
    console.error('Failed to seed state:', err);
    res.status(500).json({ error: 'Failed to seed application state' });
  }
});

// --- Per-collection endpoints -------------------------------------------
// GET /api/:collection -> read a single collection
// PUT /api/:collection -> replace a single collection (array body)
db.COLLECTIONS.forEach((collection) => {
  app.get(`/api/${collection}`, (_req, res) => {
    try {
      const state = db.readState();
      res.json(state[collection]);
    } catch (err) {
      console.error(`Failed to read ${collection}:`, err);
      res.status(500).json({ error: `Failed to read ${collection}` });
    }
  });

  app.put(`/api/${collection}`, (req, res) => {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: `Request body for ${collection} must be an array` });
      }
      const updated = db.writeCollection(collection, req.body);
      res.json(updated);
    } catch (err) {
      console.error(`Failed to write ${collection}:`, err);
      res.status(500).json({ error: `Failed to persist ${collection}` });
    }
  });
});

// --- 404 + error handling ------------------------------------------------
app.use('/api', (req, res) => {
  res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl}` });
});

// SPA fallback: serve index.html for any non-API route (when dist exists)
if (hasDist) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('[api] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`PharmeSense API listening on http://localhost:${PORT}`);
});
