import { db } from '../src/db.js';

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT,
  xp INTEGER DEFAULT 0,
  pp INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  branch_key TEXT,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS chapters (
  branch_key TEXT PRIMARY KEY,
  content_json TEXT
);
CREATE TABLE IF NOT EXISTS pending_options (
  token TEXT PRIMARY KEY,
  user_id INTEGER,
  option_id TEXT,
  branch_key TEXT,
  expires_at INTEGER
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  option_id TEXT,
  branch_key TEXT,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS quotas (
  user_id INTEGER PRIMARY KEY,
  count INTEGER,
  day TEXT
);
CREATE TABLE IF NOT EXISTS generation_jobs (
  id INTEGER PRIMARY KEY,
  branch_key TEXT,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS user_rewards (
  user_id INTEGER PRIMARY KEY,
  pioneer INTEGER DEFAULT 0
);
`);

console.log('Migration complete');
