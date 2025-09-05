import { env } from '../src/env.js';
import { fetch } from 'undici';

const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
console.log(await res.json());
