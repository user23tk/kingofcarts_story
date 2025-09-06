import express from 'express';
import { env, mask } from './env.js';
import { handleUpdate } from './server.js';
import { checkTelegramHeader, basicAuth } from './security.js';
import { getUserStats, getLeaderboard } from './game/engine.js';
import { db } from './db.js';
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

app.get('/debug', basicAuth, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    const totalChapters = db.prepare('SELECT COUNT(*) as count FROM chapters').get() as any;
    const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get() as any;
    const pendingTokens = db.prepare('SELECT COUNT(*) as count FROM pending_options WHERE expires_at > ?').get(Date.now()) as any;
    const leaderboard = getLeaderboard(5);
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>King of Carts - Debug</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a1a; color: #fff; }
        .card { background: #2d2d2d; padding: 20px; margin: 10px 0; border-radius: 8px; }
        .stat { display: inline-block; margin: 10px 20px 10px 0; }
        .stat-value { font-size: 24px; font-weight: bold; color: #4CAF50; }
        .stat-label { font-size: 14px; color: #ccc; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #444; }
        th { background: #333; }
        .rainbow { background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #ffeaa7, #dda0dd); 
                   -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      </style>
    </head>
    <body>
      <h1 class="rainbow">🎮 King of Carts - Debug Panel</h1>
      
      <div class="card">
        <h2>📊 Statistiche Sistema</h2>
        <div class="stat">
          <div class="stat-value">${totalUsers.count}</div>
          <div class="stat-label">Utenti Totali</div>
        </div>
        <div class="stat">
          <div class="stat-value">${totalChapters.count}</div>
          <div class="stat-label">Capitoli Generati</div>
        </div>
        <div class="stat">
          <div class="stat-value">${totalEvents.count}</div>
          <div class="stat-label">Scelte Totali</div>
        </div>
        <div class="stat">
          <div class="stat-value">${pendingTokens.count}</div>
          <div class="stat-label">Token Attivi</div>
        </div>
      </div>

      <div class="card">
        <h2>🏆 Top Avventurieri</h2>
        <table>
          <tr><th>Username</th><th>XP</th><th>PP</th><th>Pioniere</th></tr>
          ${leaderboard.map((user: any) => `
            <tr>
              <td>${user.username}</td>
              <td>${user.xp}</td>
              <td>${user.pp > 0 ? '+' : ''}${user.pp}</td>
              <td>${user.pioneer}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <div class="card">
        <h2>⚙️ Configurazione</h2>
        <p><strong>Environment:</strong> ${env.NODE_ENV}</p>
        <p><strong>Port:</strong> ${env.PORT}</p>
        <p><strong>Webhook Path:</strong> ${webhookPath || 'Non configurato'}</p>
        <p><strong>AI Model:</strong> ${env.AI_MODEL}</p>
        <p><strong>Cooldown:</strong> ${env.COOLDOWN_MS}ms</p>
        <p><strong>Token TTL:</strong> ${env.TOKENS_TTL_MIN} minuti</p>
        <p><strong>Daily Limits:</strong> ${env.DAILY_CHOICES_LIMIT} scelte, ${env.DAILY_PREWARMS_LIMIT} prewarms</p>
      </div>
    </body>
    </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).send('Error loading debug info');
  }
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
