import { z } from 'zod'
import { keyedTextSchema, nonEmptyString, sourceCountsSchema } from './common.schema.mjs'

export const summarySchema = z.object({
  sourceUrl: z.string().url(),
  generatedFrom: nonEmptyString,
  sourceCounts: sourceCountsSchema,
  facts: z.array(keyedTextSchema),
  segments: z.array(z.object({ name: nonEmptyString }).passthrough()),
  governance: z.array(z.object({ name: nonEmptyString }).passthrough()),
  related: z.array(z.object({ party: nonEmptyString }).passthrough()),
  offering: z.array(z.object({}).passthrough()),
  capital: z.object({}).passthrough(),
  sections: z.array(z.object({ title: nonEmptyString }).passthrough()),
}).passthrough()
