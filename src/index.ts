import express from 'express';
import { env, mask } from './env.js';
import { handleUpdate } from './server.js';
import { checkTelegramHeader } from './security.js';
import { fetch } from 'undici';

// in-memory log buffer
const logs: string[] = [];
function pushLog(level: string, args: any[]) {
  logs.push(`${new Date().toISOString()} [${level}] ${args.join(' ')}`);
  if (logs.length > 100) logs.shift();
}
const originalLog = console.log;
console.log = (...args: any[]) => {
  pushLog('log', args);
  originalLog(...args);
};
const originalError = console.error;
console.error = (...args: any[]) => {
  pushLog('error', args);
  originalError(...args);
};
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  pushLog('warn', args);
  originalWarn(...args);
};

const app = express();
app.use(express.json());

app.get('/healthz', (_req, res) => res.status(200).send('ok'));

const webhookPath = env.WEBHOOK_PATH_SECRET ? `/telegram/${env.WEBHOOK_PATH_SECRET}` : undefined;
if (webhookPath) {
  app.post(webhookPath, checkTelegramHeader, (req, res) => {
    handleUpdate(req, res).catch((e) => {
      console.error('update error', e.message);
      res.status(500).end();
    });
  });
}

app.get('/debug', async (req, res) => {
  const auth = req.headers.authorization;
  const expected = 'Basic ' + Buffer.from(`admin:${env.ADMIN_KEY}`).toString('base64');
  if (auth !== expected) {
    res.set('WWW-Authenticate', 'Basic realm="Debug"');
    res.status(401).end();
    return;
  }

  const webhookUrl = env.PUBLIC_BASE_URL && env.WEBHOOK_PATH_SECRET
    ? `${env.PUBLIC_BASE_URL}/telegram/${env.WEBHOOK_PATH_SECRET}`
    : undefined;

  let webhookInfo: any;
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    webhookInfo = await r.json();
  } catch (e) {
    const err = e as Error;
    webhookInfo = { ok: false, error: err.message };
  }

  res.json({
    webhookUrl,
    webhookInfo,
    env: {
      PUBLIC_BASE_URL: mask(env.PUBLIC_BASE_URL),
      WEBHOOK_PATH_SECRET: mask(env.WEBHOOK_PATH_SECRET),
      TELEGRAM_BOT_TOKEN: mask(env.TELEGRAM_BOT_TOKEN),
      TELEGRAM_SECRET_TOKEN: mask(env.TELEGRAM_SECRET_TOKEN),
      ADMIN_KEY: mask(env.ADMIN_KEY),
    },
    logs: logs.slice(-20),
  });
});

app.listen(env.PORT, () => {
  console.log(`Listening on :${env.PORT}`);
  if (env.PUBLIC_BASE_URL && env.WEBHOOK_PATH_SECRET) {
    const url = `${env.PUBLIC_BASE_URL}/telegram/${env.WEBHOOK_PATH_SECRET}`;
    console.log(`Setting webhook to: ${url}`);
    
    fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url, 
        secret_token: env.TELEGRAM_SECRET_TOKEN,
        max_connections: 40,
        allowed_updates: ["message", "callback_query"]
      }),
    }).then((r) => r.json()).then((j: any) => {
      console.log('setWebhook result:', j.ok ? '✅ SUCCESS' : '❌ FAILED');
      if (!j.ok) {
        console.error('setWebhook error:', j.description);
        console.error('Error code:', j.error_code);
      } else {
        console.log('✅ Webhook configured successfully!');
      }
    }).catch((error) => {
      console.error('❌ Network error setting webhook:', error.message);
    });
  } else {
    console.warn('⚠️ Webhook not configured: missing PUBLIC_BASE_URL or WEBHOOK_PATH_SECRET');
  }
});
