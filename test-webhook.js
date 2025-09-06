import express from 'express';
const app = express();

app.use(express.json());

// Log di debug per tutti i request
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Endpoint per il webhook
app.post('/telegram/:path', (req, res) => {
  console.log('🔔 Webhook ricevuto!');
  console.log('Path:', req.params.path);
  console.log('Update:', JSON.stringify(req.body, null, 2));
  
  // Risposta semplice
  res.json({ ok: true });
});

// Health check
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

// Debug endpoint
app.get('/debug', (req, res) => {
  res.send('<h1>Debug Test Server</h1><p>Server is running!</p>');
});

const PORT = process.env.PORT || 8085;
app.listen(PORT, () => {
  console.log(`🚀 Test server listening on port ${PORT}`);
  console.log(`📡 Webhook endpoint: /telegram/:path`);
  console.log(`🔍 Debug endpoint: /debug`);
});