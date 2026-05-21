import { z } from 'zod'
import { nonEmptyString } from './common.schema.mjs'

export const debateSchema = z.object({
  lenses: z.array(z.object({ id: nonEmptyString }).passthrough()).min(1),
  filedFacts: z.unknown(),
  scanCaveat: nonEmptyString,
}).passthrough()
