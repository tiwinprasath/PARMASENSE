/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight JSON-file backed persistence layer.
 * Acts as the single source of truth for the pharmacy platform's data.
 * No external database engine is required, which keeps the backend
 * dependency-free (only uses Node's built-in `fs` module) and easy to
 * run anywhere Node.js is available.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_FILE = path.join(__dirname, 'seedData.json');

const COLLECTIONS = [
  'medicines',
  'inventory',
  'sales',
  'suppliers',
  'customers',
  'prescriptions',
  'notifications',
  'schedulerLogs',
  'users',
  'medicineRequests',
  'refillRequests',
  'reminders',
  'supportTickets',
  'feedback'
  , 'auditLogs'
];

function emptyState() {
  return COLLECTIONS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
}

function loadSeed() {
  try {
    const raw = fs.readFileSync(SEED_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[db] Failed to load seed data, falling back to empty state:', err.message);
    return emptyState();
  }
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seeded = loadSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), 'utf-8');
  }
}

function readState() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const state = emptyState();
    const seeded = loadSeed();
    for (const key of COLLECTIONS) {
      if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
        state[key] = parsed[key];
      } else if (Array.isArray(seeded[key])) {
        state[key] = seeded[key];
      } else {
        state[key] = [];
      }
    }
    return state;
  } catch (err) {
    console.error('[db] Failed to read state, resetting to seed data:', err.message);
    const seeded = loadSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), 'utf-8');
    return seeded;
  }
}

function writeState(state) {
  ensureDataFile();
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  return state;
}

function writeCollection(name, records) {
  if (!COLLECTIONS.includes(name)) {
    throw new Error(`Unknown collection: ${name}`);
  }
  const state = readState();
  state[name] = Array.isArray(records) ? records : [];
  writeState(state);
  return state[name];
}

function resetToEmpty() {
  return writeState(emptyState());
}

function resetToSeed() {
  return writeState(loadSeed());
}

export default {
  COLLECTIONS,
  readState,
  writeState,
  writeCollection,
  resetToEmpty,
  resetToSeed
};
