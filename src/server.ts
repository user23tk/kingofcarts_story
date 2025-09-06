import { Request, Response } from 'express';
import { env } from './env.js';
import { render } from './renderer.js';
import { fetch } from 'undici';

async function sendMessage(chatId: number, text: string, keyboard?: any) {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = keyboard;
  console.debug('➡️ Sending message payload:', JSON.stringify(body));
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ Telegram API error ${res.status}: ${err}`);
    throw new Error(`Telegram API responded with ${res.status}`);
  }
  console.log(`✅ Message sent to chat ${chatId}`);
}

export async function handleUpdate(req: Request, res: Response) {
  try {
    const update = req.body;
    console.log('📨 Received update:', JSON.stringify(update, null, 2));
    
    if (update.message) {
      const chatId = update.message.chat.id;
      const text: string = update.message.text || '';
      const userId = update.message.from?.id;
      
      console.log(`💬 Message from ${userId}: "${text}"`);
      
      if (text.startsWith('/start')) {
        const name = update.message.from?.first_name || 'avventuriero';
        await sendMessage(chatId, render('Benvenuto {{PLAYER}}! Io sono {{KING}}.', name), {
          keyboard: [
            [
              { text: '\u25B6\uFE0F Inizia' },
              { text: '\ud83d\udcca Statistiche' },
              { text: '\ud83d\udce3 Condividi' },
            ],
          ],
          resize_keyboard: true,
        });
      } else if (text === '\u25B6\uFE0F Inizia') {
        await sendMessage(chatId, 'Iniziamo la tua avventura! 🏰\n\nTi trovi davanti al castello del Re dei Carrelli...');
      } else if (text === '\ud83d\udcca Statistiche') {
        await sendMessage(chatId, 'Le tue statistiche:\n\n🏆 XP: 0\n💎 PP: 0\n🎯 Livello: Principiante');
      } else if (text === '\ud83d\udce3 Condividi') {
        await sendMessage(chatId, 'Condividi King of Carts con i tuoi amici! 🎮');
      } else {
        // Risposta generica per altri messaggi
        await sendMessage(chatId, 'Usa i pulsanti per interagire con il gioco! 🎮');
      }
    } else if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const callbackData = update.callback_query.data;
      console.log(`🔘 Callback query: ${callbackData}`);
      
      await sendMessage(chatId, 'Scelta registrata: ' + callbackData);

      // Rispondere al callback query per rimuovere il loading
      const answerRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: update.callback_query.id }),
      });
      if (!answerRes.ok) {
        const err = await answerRes.text();
        console.error(`❌ answerCallbackQuery error ${answerRes.status}: ${err}`);
      } else {
        console.log('✅ Callback query answered');
      }
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error handling update:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ ok: false, error: errorMessage });
  }
}
