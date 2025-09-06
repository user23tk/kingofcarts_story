import { db } from '../db.js';
import { cleanupPending } from '../db.js';
import { env } from '../env.js';
import { ensureChapter } from './generation.js';
import { Chapter } from '../ai/schema.js';

export interface GameState {
  userId: number;
  username: string;
  currentBranchKey: string;
  sceneIndex: number;
  chapterIndex: number;
  totalPP: number;
  totalXP: number;
}

export interface GameChoice {
  optionId: string;
  label: string;
  ppDelta: number;
  goto?: number;
}

// Temi disponibili per la generazione AI
export const THEMES = ['fantasy', 'sci-fi', 'mistero', 'avventura', 'romantico', 'horror'] as const;
export type Theme = typeof THEMES[number];

// Antagonisti emotivi per ogni tema
export const ANTAGONISTS = {
  fantasy: 'Consiglio del Grigiore',
  'sci-fi': 'Nebbia dell\'Indifferenza', 
  mistero: 'Ansia Parlante',
  avventura: 'Ruggine del Cinismo',
  romantico: 'Ombra della Solitudine',
  horror: 'Vuoto dell\'Apatia'
} as const;

// Motivi ricorrenti per ogni tema
export const MOTIFS = {
  fantasy: 'foreste di cristallo, troni al neon, pozioni arcobaleno',
  'sci-fi': 'deserti di specchi, cieli di gelatina, portali luminosi',
  mistero: 'labirinti di nebbia, specchi parlanti, chiavi danzanti',
  avventura: 'montagne fluttuanti, fiumi di stelle, ponti arcobaleno',
  romantico: 'giardini di luce, fontane cantanti, petali di cristallo',
  horror: 'ombre sussurranti, corridoi infiniti, maschere sorridenti'
} as const;

export function getOrCreateUser(userId: number, username?: string): GameState {
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  
  if (!user) {
    db.prepare('INSERT INTO users (id, username, xp, pp) VALUES (?, ?, 0, 0)')
      .run(userId, username || 'Avventuriero');
    user = { id: userId, username: username || 'Avventuriero', xp: 0, pp: 0 };
  }

  // Trova l'ultimo run dell'utente
  const lastRun = db.prepare('SELECT branch_key FROM runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(userId) as any;

  const branchKey = lastRun?.branch_key || 'root';
  const { chapterIndex, sceneIndex } = parseBranchKey(branchKey);

  return {
    userId,
    username: user.username,
    currentBranchKey: branchKey,
    sceneIndex,
    chapterIndex,
    totalPP: user.pp,
    totalXP: user.xp
  };
}

export function parseBranchKey(branchKey: string): { chapterIndex: number; sceneIndex: number } {
  if (branchKey === 'root') return { chapterIndex: 0, sceneIndex: 1 };
  
  // Formato: parent|S1:A|S2:B -> estrae l'ultimo capitolo
  const parts = branchKey.split('|');
  const lastPart = parts[parts.length - 1];
  
  if (lastPart.startsWith('S')) {
    const match = lastPart.match(/S(\d+):([ABC])/);
    if (match) {
      const chapterIndex = parseInt(match[1]);
      return { chapterIndex, sceneIndex: 1 }; // Nuova scena inizia sempre da 1
    }
  }
  
  return { chapterIndex: 0, sceneIndex: 1 };
}

export function buildNextBranchKey(currentBranchKey: string, chapterIndex: number, optionId: string): string {
  if (currentBranchKey === 'root') {
    return `S${chapterIndex}:${optionId}`;
  }
  return `${currentBranchKey}|S${chapterIndex}:${optionId}`;
}

export async function applyChoice(userId: number, optionId: string, branchKey: string): Promise<GameState> {
  const now = Date.now();
  cleanupPending(now);
  
  const user = getOrCreateUser(userId);
  const { chapterIndex } = parseBranchKey(branchKey);
  const nextBranchKey = buildNextBranchKey(branchKey, chapterIndex + 1, optionId);
  
  // Ottieni il capitolo corrente per calcolare pp_delta
  const chapter = await ensureChapter(branchKey, await buildPrompt(branchKey, chapterIndex));
  let ppDelta = 0;
  
  // Trova pp_delta dalla scelta
  if (chapter.finale && chapter.finale.options) {
    const option = chapter.finale.options.find(opt => opt.id === optionId);
    ppDelta = option?.pp_delta || 0;
  } else {
    // Cerca nelle scene
    for (const scene of chapter.scenes) {
      if (scene.options) {
        const option = scene.options.find(opt => opt.id === optionId);
        if (option) {
          ppDelta = option.pp_delta;
          break;
        }
      }
    }
  }

  const tx = db.transaction(() => {
    // Salva l'evento
    db.prepare('INSERT INTO events(user_id, option_id, branch_key, created_at) VALUES (?,?,?,?)')
      .run(userId, optionId, branchKey, now);
    
    // Aggiorna il run corrente
    db.prepare('INSERT OR REPLACE INTO runs(user_id, branch_key, created_at) VALUES (?,?,?)')
      .run(userId, nextBranchKey, now);
    
    // Aggiorna PP e XP dell'utente
    const newPP = user.totalPP + ppDelta;
    const xpGain = 1; // +1 XP per ogni scelta
    const newXP = user.totalXP + xpGain;
    
    db.prepare('UPDATE users SET pp = ?, xp = ? WHERE id = ?')
      .run(newPP, newXP, userId);
  });
  
  tx();
  
  return {
    ...user,
    currentBranchKey: nextBranchKey,
    totalPP: user.totalPP + ppDelta,
    totalXP: user.totalXP + 1,
    chapterIndex: chapterIndex + 1,
    sceneIndex: 1
  };
}

export function checkPioneerReward(userId: number, branchKey: string): boolean {
  // Verifica se questo è il primo utente a generare questo ramo
  const existing = db.prepare('SELECT COUNT(*) as count FROM events WHERE branch_key = ?').get(branchKey) as any;
  
  if (existing.count === 0) {
    // Primo utente! Assegna reward pioniere
    db.prepare('INSERT OR REPLACE INTO user_rewards(user_id, pioneer) VALUES (?, COALESCE((SELECT pioneer FROM user_rewards WHERE user_id = ?), 0) + 1)')
      .run(userId, userId);
    
    // +5 XP bonus
    db.prepare('UPDATE users SET xp = xp + 5 WHERE id = ?').run(userId);
    return true;
  }
  
  return false;
}

export async function prewarm(branchKeys: string[]) {
  // Pre-genera capitoli in background (chiamato alla scena 6)
  setImmediate(async () => {
    for (const key of branchKeys) {
      try {
        const { chapterIndex } = parseBranchKey(key);
        const prompt = await buildPrompt(key, chapterIndex);
        await ensureChapter(key, prompt);
        console.log(`✅ Pre-warmed: ${key}`);
      } catch (error) {
        console.error(`❌ Pre-warm failed for ${key}:`, error);
      }
    }
  });
}

async function buildPrompt(branchKey: string, chapterIndex: number): Promise<string> {
  const theme = THEMES[chapterIndex % THEMES.length];
  const antagonist = ANTAGONISTS[theme];
  const motifs = MOTIFS[theme];
  
  // Costruisci il riassunto del capitolo precedente se esiste
  let summary = '';
  if (chapterIndex > 0) {
    const parentKey = branchKey.split('|').slice(0, -1).join('|') || 'root';
    try {
      const parentChapter = await ensureChapter(parentKey, '');
      summary = `Precedente: ${parentChapter.title} - ${parentChapter.scenes[0]?.text?.substring(0, 100) || ''}...`;
    } catch {
      summary = 'Continua l\'avventura psichedelica...';
    }
  }

  return `branch_key: ${branchKey}
chapter_index: ${chapterIndex}
tema: ${theme}
kit: {
  palette: "colori psichedelici, neon, cristalli",
  antagonista: "${antagonist}",
  artefatto: "oggetti magici arcobaleno",
  lessico: "ironico, empatico, visionario"
}
motivi: ${motifs}
riassunto: ${summary}`;
}

export function getUserStats(userId: number) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  const rewards = db.prepare('SELECT * FROM user_rewards WHERE user_id = ?').get(userId) as any;
  const totalChoices = db.prepare('SELECT COUNT(*) as count FROM events WHERE user_id = ?').get(userId) as any;
  
  return {
    xp: user?.xp || 0,
    pp: user?.pp || 0,
    pioneer: rewards?.pioneer || 0,
    totalChoices: totalChoices?.count || 0,
    username: user?.username || 'Avventuriero'
  };
}

export function getLeaderboard(limit: number = 10) {
  return db.prepare(`
    SELECT u.username, u.xp, u.pp, COALESCE(r.pioneer, 0) as pioneer
    FROM users u
    LEFT JOIN user_rewards r ON u.id = r.user_id
    ORDER BY u.xp DESC, u.pp DESC
    LIMIT ?
  `).all(limit);
}
