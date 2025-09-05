import Database from 'better-sqlite3';
import { env } from './env.js';

export const db = new Database(env.DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export function cleanupPending(now: number) {
  db.prepare('DELETE FROM pending_options WHERE expires_at < ?').run(now);
}
