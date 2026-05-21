import { z } from 'zod'
import { packetRowSchema } from './common.schema.mjs'

export const atlasSchema = z.object({
  rows: z.array(packetRowSchema).min(1),
  count: z.number().int().nonnegative(),
}).passthrough()
