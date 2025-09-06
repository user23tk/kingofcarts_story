import express from 'express';
import { config } from 'dotenv';

// Carica le variabili d'ambiente
config();

const app = express();
app.use(express.json());

// Middleware di logging dettagliato
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🕐 ${timestamp}`);
  console.log(`📍 ${req.method} ${req.path}`);
  console.log(`🔗 User-Agent: ${req.get('User-Agent') || 'N/A'}`);
  console.log(`🌐 IP: ${req.ip || req.connection.remoteAddress}`);
  
  // Log headers importanti
  const importantHeaders = ['x-telegram-bot-api-secret-token', 'content-type', 'content-length'];
  importantHeaders.forEach(header => {
    const value = req.get(header);
    if (value) {
      console.log(`📋 ${header}: ${value}`);
    }
  });
  
  // Log del body se presente
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  
  next();
});

// Health check
app.get('/healthz', (req, res) => {
  console.log('✅ Health check OK');
  res.status(200).send('ok');
});

// Debug page
app.get('/debug', (req, res) => {
  const auth = req.headers.authorization;
  const expected = 'Basic ' + Buffer.from(`admin:${process.env.ADMIN_KEY || 'test'}`).toString('base64');
  
  if (auth !== expected) {
    console.log('🔐 Debug access denied - wrong credentials');
    res.set('WWW-Authenticate', 'Basic realm="Debug"');
    res.status(401).end();
    return;
  }
  
  console.log('🔍 Debug page accessed');
  res.send(`
    <h1>🐛 Debug Server</h1>
    <p><strong>Status:</strong> ✅ Running</p>
    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
    <p><strong>Port:</strong> ${process.env.PORT || 8085}</p>
    <p><strong>Webhook URL:</strong> ${process.env.PUBLIC_BASE_URL || 'Not set'}/telegram/${process.env.WEBHOOK_PATH_SECRET || 'Not set'}</p>
    <hr>
    <h2>🔧 Configuration Check</h2>
    <ul>
      <li>TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing'}</li>
      <li>TELEGRAM_SECRET_TOKEN: ${process.env.TELEGRAM_SECRET_TOKEN ? '✅ Set' : '❌ Missing'}</li>
      <li>WEBHOOK_PATH_SECRET: ${process.env.WEBHOOK_PATH_SECRET ? '✅ Set' : '❌ Missing'}</li>
      <li>PUBLIC_BASE_URL: ${process.env.PUBLIC_BASE_URL ? '✅ Set' : '❌ Missing'}</li>
    </ul>
  `);
});

// Webhook endpoint con logging dettagliato
const webhookPath = process.env.WEBHOOK_PATH_SECRET ? `/telegram/${process.env.WEBHOOK_PATH_SECRET}` : '/telegram/test';
app.post(webhookPath, (req, res) => {
  console.log('🎯 WEBHOOK HIT!');
  
  // Verifica secret token
  const secretToken = req.get('X-Telegram-Bot-Api-Secret-Token');
  const expectedSecret = process.env.TELEGRAM_SECRET_TOKEN;
  
  if (expectedSecret && secretToken !== expectedSecret) {
    console.log('❌ Secret token mismatch!');
    console.log(`   Expected: ${expectedSecret}`);
    console.log(`   Received: ${secretToken}`);
    res.status(403).json({ error: 'Invalid secret token' });
    return;
  }
  
  console.log('✅ Secret token verified');
  
  // Analizza l'update
  const update = req.body;
  if (update.message) {
    const msg = update.message;
    console.log(`💬 Message received:`);
    console.log(`   From: ${msg.from?.first_name} ${msg.from?.last_name} (@${msg.from?.username})`);
    console.log(`   User ID: ${msg.from?.id}`);
    console.log(`   Chat ID: ${msg.chat?.id}`);
    console.log(`   Text: "${msg.text}"`);
    console.log(`   Date: ${new Date(msg.date * 1000).toISOString()}`);
  } else if (update.callback_query) {
    const cb = update.callback_query;
    console.log(`🔘 Callback query received:`);
    console.log(`   From: ${cb.from?.first_name} ${cb.from?.last_name} (@${cb.from?.username})`);
    console.log(`   Data: "${cb.data}"`);
    console.log(`   Message ID: ${cb.message?.message_id}`);
  } else {
    console.log('❓ Unknown update type:', Object.keys(update));
  }
  
  // Risposta semplice
  res.json({ ok: true, message: 'Update received and logged' });
});

// Catch-all per altri path
app.all('*', (req, res) => {
  console.log(`❓ Unknown endpoint: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 8085;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Debug server started on port ${PORT}`);
  console.log(`📡 Webhook endpoint: ${webhookPath}`);
  console.log(`🔍 Debug page: http://localhost:${PORT}/debug`);
  console.log(`❤️  Health check: http://localhost:${PORT}/healthz`);
  console.log(`\n⚙️  Environment check:`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`   TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'NOT SET'}`);
  console.log(`   TELEGRAM_SECRET_TOKEN: ${process.env.TELEGRAM_SECRET_TOKEN ? 'set' : 'NOT SET'}`);
  console.log(`   WEBHOOK_PATH_SECRET: ${process.env.WEBHOOK_PATH_SECRET ? 'set' : 'NOT SET'}`);
  console.log(`   PUBLIC_BASE_URL: ${process.env.PUBLIC_BASE_URL || 'NOT SET'}`);
  console.log(`\n🎯 Ready to receive webhooks!`);
});