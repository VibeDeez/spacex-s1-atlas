import { z } from 'zod'

export const nonEmptyString = z.string().min(1)
export const optionalString = z.string().nullable().optional()
export const finiteNumber = z.number().finite()

export const sourceCountsSchema = z.object({
  sections: z.number().int().nonnegative(),
  exhibits: z.number().int().nonnegative(),
  graphics: z.number().int().nonnegative(),
  risk_headings: z.number().int().nonnegative(),
  glossary_terms: z.number().int().nonnegative(),
}).passthrough()

export const keyedTextSchema = z.object({
  k: nonEmptyString,
  v: nonEmptyString,
  src: nonEmptyString,
}).passthrough()

export const packetRowSchema = z.object({
  id: nonEmptyString,
  type: nonEmptyString,
  title: nonEmptyString,
  detail: nonEmptyString,
  source: nonEmptyString,
  hash: nonEmptyString,
  sharePath: nonEmptyString,
}).passthrough()
