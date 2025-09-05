import { env } from '../src/env.js';
import { fetch } from 'undici';

const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteWebhook`);
console.log(await res.json());
