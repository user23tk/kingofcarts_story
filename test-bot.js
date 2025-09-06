// Script per testare la connessione al bot Telegram
import { fetch } from 'undici';
import { config } from 'dotenv';

// Leggi le variabili d'ambiente dal file .env
config();

async function testBot() {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!BOT_TOKEN || BOT_TOKEN === 'placeholder_token') {
    console.log('❌ TELEGRAM_BOT_TOKEN non configurato o è un placeholder');
    console.log('   Configura il tuo bot token reale nel file .env');
    return;
  }

  console.log('🤖 Test connessione bot Telegram...');
  
  try {
    // Test getMe
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Bot connesso correttamente!');
      console.log('   Username:', data.result.username);
      console.log('   Nome:', data.result.first_name);
      console.log('   ID:', data.result.id);
      console.log('   Can join groups:', data.result.can_join_groups);
      console.log('   Can read all group messages:', data.result.can_read_all_group_messages);
      console.log('   Supports inline queries:', data.result.supports_inline_queries);
    } else {
      console.log('❌ Errore bot:', data.description);
      console.log('   Error code:', data.error_code);
    }
  } catch (error) {
    console.log('❌ Errore di rete:', error.message);
  }

  // Test webhook info
  console.log('\n📡 Info webhook corrente...');
  try {
    const webhookResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const webhookData = await webhookResponse.json();
    
    if (webhookData.ok) {
      const info = webhookData.result;
      console.log('   URL:', info.url || 'Non impostato');
      console.log('   Has custom certificate:', info.has_custom_certificate);
      console.log('   Pending update count:', info.pending_update_count);
      console.log('   Max connections:', info.max_connections);
      console.log('   Allowed updates:', info.allowed_updates?.join(', ') || 'Tutti');
      
      if (info.last_error_message) {
        console.log('   ⚠️ Ultimo errore:', info.last_error_message);
        console.log('   Data ultimo errore:', new Date(info.last_error_date * 1000));
      } else {
        console.log('   ✅ Nessun errore recente');
      }
    }
  } catch (error) {
    console.log('❌ Errore recupero info webhook:', error.message);
  }
}

testBot();