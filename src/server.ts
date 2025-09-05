import { Request, Response } from 'express';
import { env } from './env.js';
import { render } from './renderer.js';
import { fetch } from 'undici';

async function sendMessage(chatId: number, text: string, keyboard?: any) {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = keyboard;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function handleUpdate(req: Request, res: Response) {
  const update = req.body;
  if (update.message) {
    const chatId = update.message.chat.id;
    const text: string = update.message.text || '';
    if (text.startsWith('/start')) {
      const name = update.message.from?.first_name || 'avventuriero';
      await sendMessage(chatId, render('Benvenuto {{PLAYER}}! Io sono {{KING}}.', name), {
        keyboard: [[{ text: '\u25B6\uFE0F Inizia' }, { text: '\ud83d\udcca Statistiche' }, { text: '\ud83d\udce3 Condividi' }]],
        resize_keyboard: true,
      });
    }
  } else if (update.callback_query) {
    const chatId = update.callback_query.message.chat.id;
    await sendMessage(chatId, 'Scelta registrata.');
  }
  res.json({ ok: true });
}
