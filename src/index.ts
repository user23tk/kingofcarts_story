import express from 'express';
import { env, mask } from './env.js';
import { handleUpdate } from './server.js';
import { checkTelegramHeader } from './security.js';
import { fetch } from 'undici';

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

app.get('/debug', (req, res) => {
  const auth = req.headers.authorization;
  const expected = 'Basic ' + Buffer.from(`admin:${env.ADMIN_KEY}`).toString('base64');
  if (auth !== expected) {
    res.set('WWW-Authenticate', 'Basic realm="Debug"');
    res.status(401).end();
    return;
  }
  res.send('<h1>Debug</h1>');
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
