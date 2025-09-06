import { fetch } from 'undici';
import { env } from '../env.js';
import { chapterSchema, Chapter } from './schema.js';

const SYSTEM_PROMPT = 'Sei autore per un bot Telegram a bottoni. Stile psichedelico/ironico, maturo ma sicuro (no illegalità/sesso esplicito/violenza grafica). Mentore = {{KING}}, eroe = {{PLAYER}}. Genera 8 scene brevi (≤80 parole) + Finale. Scelte solo in scene 1/3/5/7 (A/B con pp_delta −2..+2 e goto), Finale con 3 opzioni A/B/C (solo pp_delta). Mantieni i placeholder {{KING}}/{{PLAYER}}. Output SOLO JSON {title, theme, scenes[], finale}.';

async function callApi(base: string, key: string, model: string, userPrompt: string): Promise<Chapter> {
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const json: any = await res.json();
  const content = json.choices?.[0]?.message?.content ?? '';
  return chapterSchema.parse(JSON.parse(content));
}

export async function generateChapterPrompt(userPrompt: string): Promise<Chapter> {
  if (env.AI_API_KEY && env.AI_BASE_URL) {
    try {
      return await callApi(env.AI_BASE_URL, env.AI_API_KEY, env.AI_MODEL, userPrompt);
    } catch (err) {
      if (env.OPENAI_API_KEY) {
        return callApi('https://api.openai.com', env.OPENAI_API_KEY, env.OPENAI_MODEL, userPrompt);
      }
      throw err;
    }
  }
  if (env.OPENAI_API_KEY) {
    return callApi('https://api.openai.com', env.OPENAI_API_KEY, env.OPENAI_MODEL, userPrompt);
  }
  throw new Error('No AI provider configured');
}
