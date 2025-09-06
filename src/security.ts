import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from './env.js';

export function checkTelegramHeader(req: Request, res: Response, next: NextFunction) {
  const token = req.get('X-Telegram-Bot-Api-Secret-Token');
  if (!token) {
    console.warn('⚠️ Missing X-Telegram-Bot-Api-Secret-Token header');
    res.status(403).end();
    return;
  }
  if (token !== env.TELEGRAM_SECRET_TOKEN) {
    console.warn(`⚠️ Invalid Telegram secret token: ${token}`);
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

const cooldown = new Map<number, number>();
export function checkCooldown(userId: number): boolean {
  const now = Date.now();
  const last = cooldown.get(userId) ?? 0;
  if (now - last < env.COOLDOWN_MS) return false;
  cooldown.set(userId, now);
  return true;
}
