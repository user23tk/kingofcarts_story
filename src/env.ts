import { z } from 'zod';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('production'),
  PORT: z.coerce.number().default(8085),
  PUBLIC_BASE_URL: z.string().url().optional(),
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_SECRET_TOKEN: z.string(),
  WEBHOOK_PATH_SECRET: z.string().optional(),
  START_SIGNATURE_SECRET: z.string(),
  ADMIN_KEY: z.string(),
  DB_PATH: z.string().default('./data/bot.db'),
  TOKENS_TTL_MIN: z.coerce.number().default(8),
  COOLDOWN_MS: z.coerce.number().default(2500),
  DAILY_CHOICES_LIMIT: z.coerce.number().default(200),
  DAILY_PREWARMS_LIMIT: z.coerce.number().default(60),
  AI_BASE_URL: z.string().url().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('grok-4'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
});

export const env = envSchema.parse(process.env);

export function mask(value?: string) {
  if (!value) return value;
  return value.slice(0, 3) + '***';
}
