import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from './env.js';
import { db, cleanupPending } from './db.js';

export function checkTelegramHeader(req: Request, res: Response, next: NextFunction) {
  const token = req.get('X-Telegram-Bot-Api-Secret-Token');
  if (token !== env.TELEGRAM_SECRET_TOKEN) {
    res.status(403).end();
    return;
  }
  next();
}

export function verifyStartPayload(payload: string, sig: string): boolean {
  const h = crypto.createHmac('sha256', env.START_SIGNATURE_SECRET);
  h.update(payload);
  const expected = h.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function createStartSignature(payload: string): string {
  return crypto.createHmac('sha256', env.START_SIGNATURE_SECRET)
    .update(payload)
    .digest('hex');
}

export function basicAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const credentials = Buffer.from(auth.slice(6), 'base64').toString();
  const [username, password] = credentials.split(':');
  
  if (username !== 'admin' || password !== env.ADMIN_KEY) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  next();
}

export function createPendingToken(userId: number, optionId: string, branchKey: string): string {
  const now = Date.now();
  const expiresAt = now + (env.TOKENS_TTL_MIN * 60 * 1000);
  const token = crypto.randomBytes(16).toString('hex');
  
  cleanupPending(now);
  
  db.prepare('INSERT INTO pending_options (token, user_id, option_id, branch_key, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(token, userId, optionId, branchKey, expiresAt);
  
  return token;
}

export function consumePendingToken(token: string): { userId: number; optionId: string; branchKey: string } | null {
  const now = Date.now();
  cleanupPending(now);
  
  const pending = db.prepare('SELECT * FROM pending_options WHERE token = ? AND expires_at > ?')
    .get(token, now) as any;
  
  if (!pending) return null;
  
  // Rimuovi il token (monouso)
  db.prepare('DELETE FROM pending_options WHERE token = ?').run(token);
  
  return {
    userId: pending.user_id,
    optionId: pending.option_id,
    branchKey: pending.branch_key
  };
}

export function checkCooldown(userId: number): boolean {
  const lastAction = db.prepare('SELECT MAX(created_at) as last FROM events WHERE user_id = ?')
    .get(userId) as any;
  
  if (!lastAction?.last) return true;
  
  const timeSinceLastAction = Date.now() - lastAction.last;
  return timeSinceLastAction >= env.COOLDOWN_MS;
}

export function checkDailyLimit(userId: number, type: 'choices' | 'prewarms'): boolean {
  const today = new Date().toISOString().split('T')[0];
  const limit = type === 'choices' ? env.DAILY_CHOICES_LIMIT : env.DAILY_PREWARMS_LIMIT;
  
  const quota = db.prepare('SELECT count FROM quotas WHERE user_id = ? AND day = ?')
    .get(userId, today) as any;
  
  return !quota || quota.count < limit;
}

export function incrementDailyQuota(userId: number, type: 'choices' | 'prewarms') {
  const today = new Date().toISOString().split('T')[0];
  
  db.prepare(`
    INSERT INTO quotas (user_id, count, day) VALUES (?, 1, ?)
    ON CONFLICT(user_id) DO UPDATE SET 
      count = CASE WHEN day = ? THEN count + 1 ELSE 1 END,
      day = ?
  `).run(userId, today, today, today);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}
