import { z } from 'zod'
import { nonEmptyString } from './common.schema.mjs'

export const risksSchema = z.object({
  risks: z.array(z.object({
    group: nonEmptyString,
    heading: nonEmptyString,
  }).passthrough()).min(1),
}).passthrough()
