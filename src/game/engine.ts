import { db } from '../db.js';
import { cleanupPending } from '../db.js';

export function applyChoice(userId: number, optionId: string, branchKey: string) {
  const now = Date.now();
  cleanupPending(now);
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO events(user_id, option_id, branch_key, created_at) VALUES (?,?,?,?)').run(userId, optionId, branchKey, now);
  });
  tx();
}

export function prewarm(branchKeys: string[]) {
  // placeholder for async pre-generation
  setImmediate(() => {
    for (const key of branchKeys) {
      console.log('prewarm', key);
    }
  });
}
