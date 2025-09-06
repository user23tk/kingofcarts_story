import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { env } from './env.js';

// Ensure DB directory exists before opening the database
const dbDir = dirname(env.DB_PATH);
mkdirSync(dbDir, { recursive: true });

export const db = new Database(env.DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export function cleanupPending(now: number) {
  db.prepare('DELETE FROM pending_options WHERE expires_at < ?').run(now);
}
