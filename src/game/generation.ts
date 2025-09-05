import { db } from '../db.js';
import { generateChapterPrompt } from '../ai/provider.js';
import { Chapter } from '../ai/schema.js';

export function getChapter(branchKey: string): Chapter | undefined {
  const row = db.prepare('SELECT content_json FROM chapters WHERE branch_key=?').get(branchKey) as any;
  if (row) return JSON.parse(row.content_json);
  return undefined;
}

export async function ensureChapter(branchKey: string, prompt: string): Promise<Chapter> {
  const existing = getChapter(branchKey);
  if (existing) return existing;
  const chapter = await generateChapterPrompt(prompt);
  db.prepare('INSERT INTO chapters(branch_key, content_json) VALUES (?,?)').run(branchKey, JSON.stringify(chapter));
  return chapter;
}
