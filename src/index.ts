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
    fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, secret_token: env.TELEGRAM_SECRET_TOKEN }),
    }).then((r) => r.json()).then((j: any) => {
      console.log('setWebhook result', j.ok);
    }).catch(() => {});
  }
});
