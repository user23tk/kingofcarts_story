import { env } from '../src/env.js';
import { fetch } from 'undici';

if (!env.PUBLIC_BASE_URL || !env.WEBHOOK_PATH_SECRET) {
  console.error('PUBLIC_BASE_URL and WEBHOOK_PATH_SECRET required');
  process.exit(1);
}

const url = `${env.PUBLIC_BASE_URL}/telegram/${env.WEBHOOK_PATH_SECRET}`;
const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url, secret_token: env.TELEGRAM_SECRET_TOKEN }),
});
console.log(await res.json());
