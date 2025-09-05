import { z } from 'zod';

const sceneOptionSchema = z.object({
  id: z.enum(['A', 'B']),
  label: z.string().min(1).max(50),
  pp_delta: z.number().int().min(-2).max(2),
  goto: z.number().int().min(1).max(8),
});

const sceneSchema = z.object({
  id: z.number().int().min(1).max(8),
  text: z.string().max(400),
  options: z.array(sceneOptionSchema).optional(),
});

const finaleOptionSchema = z.object({
  id: z.enum(['A', 'B', 'C']),
  label: z.string().min(1).max(60),
  pp_delta: z.number().int().min(-3).max(3),
});

export const chapterSchema = z.object({
  title: z.string().min(1).max(120),
  theme: z.string(),
  scenes: z.array(sceneSchema).length(8),
  finale: z.object({
    text: z.string().max(120),
    options: z.array(finaleOptionSchema).length(3),
  }),
});

export type Chapter = z.infer<typeof chapterSchema>;
