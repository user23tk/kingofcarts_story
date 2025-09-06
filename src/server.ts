import { Request, Response } from 'express';
import { env } from './env.js';
import { render, renderKingQuote, formatStats, formatLeaderboard } from './renderer.js';
import { fetch } from 'undici';
import { 
  getOrCreateUser, 
  applyChoice, 
  getUserStats, 
  getLeaderboard, 
  checkPioneerReward,
  parseBranchKey,
  prewarm,
  buildNextBranchKey
} from './game/engine.js';
import { ensureChapter, getChapter } from './game/generation.js';
import { 
  createPendingToken, 
  consumePendingToken, 
  checkCooldown, 
  checkDailyLimit, 
  incrementDailyQuota,
  verifyStartPayload,
  createStartSignature
} from './security.js';

interface InlineKeyboard {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

interface ReplyKeyboard {
  keyboard: Array<Array<{ text: string }>>;
  resize_keyboard: boolean;
  one_time_keyboard?: boolean;
}

async function sendMessage(chatId: number, text: string, keyboard?: InlineKeyboard | ReplyKeyboard) {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = keyboard;
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      console.error('Telegram API error:', await response.text());
    }
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        callback_query_id: callbackQueryId,
        text: text || '✅',
        show_alert: false
      }),
    });
  } catch (error) {
    console.error('Failed to answer callback query:', error);
  }
}

async function handleStartCommand(chatId: number, userId: number, username: string, payload?: string) {
  // Verifica deep-link se presente
  if (payload) {
    const [data, sig] = payload.split('.');
    if (!sig || !verifyStartPayload(data, sig)) {
      await sendMessage(chatId, '❌ Link non valido o scaduto.');
      return;
    }
  }

  const user = getOrCreateUser(userId, username);
  const quote = renderKingQuote();
  
  const welcomeText = render(
    `Benvenuto {{PLAYER}}! Io sono {{KING}}, il tuo mentore psichedelico.\n\n💫 <i>"${quote}"</i>\n\nScegli la tua avventura:`,
    user.username
  );

  const keyboard: ReplyKeyboard = {
    keyboard: [
      [{ text: '▶️ Inizia Avventura' }, { text: '📊 Statistiche' }],
      [{ text: '🏆 Classifica' }, { text: '📣 Condividi' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };

  await sendMessage(chatId, welcomeText, keyboard);
}

async function handleGameStart(chatId: number, userId: number, username: string) {
  if (!checkCooldown(userId)) {
    await sendMessage(chatId, '⏳ Aspetta un momento prima di fare un\'altra scelta...');
    return;
  }

  if (!checkDailyLimit(userId, 'choices')) {
    await sendMessage(chatId, '📊 Hai raggiunto il limite giornaliero di scelte. Torna domani!');
    return;
  }

  const user = getOrCreateUser(userId, username);
  await showCurrentScene(chatId, user.userId, user.currentBranchKey);
}

async function showCurrentScene(chatId: number, userId: number, branchKey: string) {
  try {
    const { chapterIndex, sceneIndex } = parseBranchKey(branchKey);
    
    // Genera il prompt per questo capitolo
    const prompt = await buildPromptForChapter(branchKey, chapterIndex);
    const chapter = await ensureChapter(branchKey, prompt);
    
    // Verifica reward pioniere
    const isPioneer = checkPioneerReward(userId, branchKey);
    if (isPioneer) {
      await sendMessage(chatId, '🌟 <b>Pioniere!</b> Sei il primo a esplorare questo sentiero! +5 XP bonus!');
    }

    const user = getOrCreateUser(userId);
    const scene = chapter.scenes[sceneIndex - 1];
    
    if (!scene) {
      await sendMessage(chatId, '❌ Errore: scena non trovata.');
      return;
    }

    let messageText = `🎮 <b>${chapter.title}</b>\n\n`;
    messageText += render(scene.text, user.username) + '\n\n';
    
    // Aggiungi info XP/PP
    messageText += `✨ XP: ${user.totalXP} • 🌈 PP: ${user.totalPP > 0 ? '+' : ''}${user.totalPP}`;

    if (scene.options && scene.options.length > 0) {
      // Scena con scelte
      const keyboard: InlineKeyboard = {
        inline_keyboard: scene.options.map(option => [{
          text: `${option.label} (${option.pp_delta > 0 ? '+' : ''}${option.pp_delta} PP)`,
          callback_data: createPendingToken(userId, option.id, branchKey)
        }])
      };
      
      await sendMessage(chatId, messageText, keyboard);
    } else {
      // Scena senza scelte (intermezzo)
      const keyboard: InlineKeyboard = {
        inline_keyboard: [[{
          text: 'Continua →',
          callback_data: createPendingToken(userId, 'continue', branchKey)
        }]]
      };
      
      await sendMessage(chatId, messageText, keyboard);
    }

    // Pre-warm alla scena 6
    if (sceneIndex === 6 && chapter.finale) {
      const nextBranchKeys = chapter.finale.options.map(opt => 
        buildNextBranchKey(branchKey, chapterIndex + 1, opt.id)
      );
      prewarm(nextBranchKeys);
    }

  } catch (error) {
    console.error('Error showing scene:', error);
    await sendMessage(chatId, '❌ Errore nel caricamento della scena. Riprova più tardi.');
  }
}

async function buildPromptForChapter(branchKey: string, chapterIndex: number): Promise<string> {
  // Implementazione semplificata - in produzione useresti la logica completa del game engine
  return `branch_key: ${branchKey}, chapter_index: ${chapterIndex}`;
}

async function handleCallbackQuery(callbackQuery: any) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const username = callbackQuery.from.first_name || 'Avventuriero';
  const token = callbackQuery.data;

  await answerCallbackQuery(callbackQuery.id);

  const pending = consumePendingToken(token);
  if (!pending) {
    await sendMessage(chatId, '⏳ Scelta scaduta. Riprova con /start');
    return;
  }

  if (pending.userId !== userId) {
    await sendMessage(chatId, '❌ Questa scelta non è per te!');
    return;
  }

  if (!checkCooldown(userId)) {
    await sendMessage(chatId, '⏳ Aspetta un momento prima di fare un\'altra scelta...');
    return;
  }

  if (!checkDailyLimit(userId, 'choices')) {
    await sendMessage(chatId, '📊 Hai raggiunto il limite giornaliero di scelte. Torna domani!');
    return;
  }

  incrementDailyQuota(userId, 'choices');

  try {
    if (pending.optionId === 'continue') {
      // Continua alla prossima scena
      const { chapterIndex, sceneIndex } = parseBranchKey(pending.branchKey);
      const nextSceneIndex = sceneIndex + 1;
      
      if (nextSceneIndex <= 8) {
        // Prossima scena nello stesso capitolo
        await showCurrentScene(chatId, userId, pending.branchKey);
      } else {
        // Fine capitolo, mostra finale
        await showFinale(chatId, userId, pending.branchKey);
      }
    } else {
      // Applica la scelta e vai al prossimo capitolo/scena
      const newState = await applyChoice(userId, pending.optionId, pending.branchKey);
      await showCurrentScene(chatId, userId, newState.currentBranchKey);
    }
  } catch (error) {
    console.error('Error handling choice:', error);
    await sendMessage(chatId, '❌ Errore nell\'elaborazione della scelta. Riprova.');
  }
}

async function showFinale(chatId: number, userId: number, branchKey: string) {
  try {
    const chapter = getChapter(branchKey);
    if (!chapter || !chapter.finale) {
      await sendMessage(chatId, '❌ Finale non trovato.');
      return;
    }

    const user = getOrCreateUser(userId);
    let messageText = `🎭 <b>Finale: ${chapter.title}</b>\n\n`;
    messageText += render(chapter.finale.text, user.username) + '\n\n';
    messageText += `✨ XP: ${user.totalXP} • 🌈 PP: ${user.totalPP > 0 ? '+' : ''}${user.totalPP}`;

    const keyboard: InlineKeyboard = {
      inline_keyboard: chapter.finale.options.map(option => [{
        text: `${option.label} (${option.pp_delta > 0 ? '+' : ''}${option.pp_delta} PP)`,
        callback_data: createPendingToken(userId, option.id, branchKey)
      }])
    };

    await sendMessage(chatId, messageText, keyboard);
  } catch (error) {
    console.error('Error showing finale:', error);
    await sendMessage(chatId, '❌ Errore nel caricamento del finale.');
  }
}

async function handleStats(chatId: number, userId: number) {
  const stats = getUserStats(userId);
  const text = formatStats(stats);
  await sendMessage(chatId, text);
}

async function handleLeaderboard(chatId: number) {
  const leaderboard = getLeaderboard(10);
  const text = formatLeaderboard(leaderboard);
  await sendMessage(chatId, text);
}

async function handleShare(chatId: number, userId: number) {
  const stats = getUserStats(userId);
  const payload = `user_${userId}_${Date.now()}`;
  const signature = createStartSignature(payload);
  const deepLink = `https://t.me/${env.TELEGRAM_BOT_TOKEN.split(':')[0]}?start=${payload}.${signature}`;
  
  const shareText = `🎮 Unisciti a me nell'avventura psichedelica di King of Carts!\n\n` +
    `✨ Ho ${stats.xp} XP e ${stats.pp > 0 ? '+' : ''}${stats.pp} Punti Personalità!\n\n` +
    `🌈 Clicca qui per iniziare: ${deepLink}`;

  const keyboard: any = {
    inline_keyboard: [[{
      text: '📤 Condividi',
      url: `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`
    }]]
  };

  await sendMessage(chatId, shareText, keyboard);
}

export async function handleUpdate(req: Request, res: Response) {
  try {
    const update = req.body;
    
    if (update.message) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const username = update.message.from.first_name || 'Avventuriero';
      const text: string = update.message.text || '';

      if (text.startsWith('/start')) {
        const payload = text.split(' ')[1]; // Deep-link payload
        await handleStartCommand(chatId, userId, username, payload);
      } else if (text === '▶️ Inizia Avventura') {
        await handleGameStart(chatId, userId, username);
      } else if (text === '📊 Statistiche') {
        await handleStats(chatId, userId);
      } else if (text === '🏆 Classifica') {
        await handleLeaderboard(chatId);
      } else if (text === '📣 Condividi') {
        await handleShare(chatId, userId);
      } else {
        // Messaggio non riconosciuto
        await sendMessage(chatId, '🤔 Non ho capito. Usa i pulsanti o /start per iniziare!');
      }
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
  } catch (error) {
    console.error('Error handling update:', error);
  }
  
  res.json({ ok: true });
}
