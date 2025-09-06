import { escapeHtml } from './security.js';

const KING = 'King of Carts';

export function render(text: string, player: string): string {
  return escapeHtml(text.replace(/{{KING}}/g, KING).replace(/{{PLAYER}}/g, player));
}

export function renderKingQuote(): string {
  const quotes = [
    'Colora il dubbio e appare il varco.',
    'Respira: il grigiore si scioglie al calore del tuo sorriso.',
    'Ogni scelta è un pennello che dipinge la realtà.',
    'L\'arcobaleno nasce dove la luce incontra la tempesta.',
    'Nel caos psichedelico si nasconde l\'ordine dell\'anima.',
    'Vedi oltre il velo: la magia è sempre stata qui.',
    'Il coraggio è il primo ingrediente della pozione della libertà.',
    'Danza con l\'incertezza, è la musica dell\'universo.'
  ];
  
  return quotes[Math.floor(Math.random() * quotes.length)];
}

export function formatStats(stats: any): string {
  const { xp, pp, pioneer, totalChoices, username } = stats;
  
  let text = `🎮 <b>${escapeHtml(username)}</b>\n\n`;
  text += `✨ <b>XP:</b> ${xp}\n`;
  text += `🌈 <b>Punti Personalità:</b> ${pp > 0 ? '+' : ''}${pp}\n`;
  text += `🏆 <b>Pioniere:</b> ${pioneer} rami\n`;
  text += `🎯 <b>Scelte totali:</b> ${totalChoices}\n\n`;
  
  if (pioneer > 0) {
    text += `🌟 <i>Esploratore di nuovi sentieri!</i>\n`;
  }
  
  if (pp > 10) {
    text += `🔥 <i>Spirito libero e coraggioso!</i>\n`;
  } else if (pp < -10) {
    text += `🌙 <i>Anima riflessiva e prudente.</i>\n`;
  }
  
  return text;
}

export function formatLeaderboard(leaderboard: any[]): string {
  let text = `🏆 <b>Classifica Avventurieri</b>\n\n`;
  
  leaderboard.forEach((user, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    text += `${medal} <b>${escapeHtml(user.username)}</b>\n`;
    text += `   ✨ ${user.xp} XP • 🌈 ${user.pp > 0 ? '+' : ''}${user.pp} PP`;
    if (user.pioneer > 0) {
      text += ` • 🏆 ${user.pioneer}`;
    }
    text += `\n\n`;
  });
  
  return text;
}
