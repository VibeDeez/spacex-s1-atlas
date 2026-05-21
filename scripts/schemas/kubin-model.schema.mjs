import { z } from 'zod'

export const kubinModelSchema = z.object({
  source: z.object({}).passthrough(),
  offering: z.object({}).passthrough(),
  shareCount: z.object({
    components: z.array(z.object({}).passthrough()).min(1),
  }).passthrough(),
  kpis: z.object({
    rows: z.array(z.object({}).passthrough()).min(1),
  }).passthrough(),
  tam: z.unknown(),
  bullBear: z.unknown(),
  burningQuestions: z.unknown(),
  checks: z.unknown(),
}).passthrough()
