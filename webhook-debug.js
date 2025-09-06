// Script per debuggare il webhook di Telegram
import { fetch } from 'undici';

// Sostituisci con i tuoi valori reali
const BOT_TOKEN = 'IL_TUO_BOT_TOKEN_REALE';
const PUBLIC_BASE_URL = 'https://tuodominio.com'; // Il tuo dominio reale
const WEBHOOK_PATH_SECRET = 'webhook_secret_path_123'; // Un path segreto
const TELEGRAM_SECRET_TOKEN = 'secret_token_123'; // Un token segreto

async function debugWebhook() {
  console.log('🔍 Debug Webhook Telegram');
  
  // 1. Verifica info bot
  console.log('\n1. Verifica info bot...');
  try {
    const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const botData = await botInfo.json();
    if (botData.ok) {
      console.log('✅ Bot valido:', botData.result.username);
    } else {
      console.log('❌ Bot token non valido:', botData.description);
      return;
    }
  } catch (error) {
    console.log('❌ Errore verifica bot:', error.message);
    return;
  }

  // 2. Rimuovi webhook esistente
  console.log('\n2. Rimozione webhook esistente...');
  try {
    const deleteResult = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
    const deleteData = await deleteResult.json();
    console.log('🗑️ Rimozione webhook:', deleteData.ok ? '✅' : '❌', deleteData.description || '');
  } catch (error) {
    console.log('❌ Errore rimozione webhook:', error.message);
  }

  // 3. Imposta nuovo webhook
  console.log('\n3. Impostazione nuovo webhook...');
  const webhookUrl = `${PUBLIC_BASE_URL}/telegram/${WEBHOOK_PATH_SECRET}`;
  console.log('📡 URL webhook:', webhookUrl);
  
  try {
    const setResult = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: webhookUrl, 
        secret_token: TELEGRAM_SECRET_TOKEN,
        max_connections: 40,
        allowed_updates: ["message", "callback_query"]
      }),
    });
    
    const setData = await setResult.json();
    console.log('🔗 Impostazione webhook:', setData.ok ? '✅' : '❌');
    if (!setData.ok) {
      console.log('❌ Errore:', setData.description);
    } else {
      console.log('✅ Webhook impostato correttamente!');
    }
  } catch (error) {
    console.log('❌ Errore impostazione webhook:', error.message);
  }

  // 4. Verifica webhook
  console.log('\n4. Verifica webhook...');
  try {
    const infoResult = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const infoData = await infoResult.json();
    if (infoData.ok) {
      console.log('📋 Info webhook:');
      console.log('   URL:', infoData.result.url);
      console.log('   Pending updates:', infoData.result.pending_update_count);
      console.log('   Last error:', infoData.result.last_error_message || 'Nessuno');
      console.log('   Last error date:', infoData.result.last_error_date ? new Date(infoData.result.last_error_date * 1000) : 'Mai');
    }
  } catch (error) {
    console.log('❌ Errore verifica webhook:', error.message);
  }
}

debugWebhook();