import { z } from 'zod'
import { finiteNumber, nonEmptyString } from './common.schema.mjs'

const consolidatedRowSchema = z.object({
  period: nonEmptyString,
  revenue: finiteNumber,
  op_income: finiteNumber,
  net_income: finiteNumber,
  source: nonEmptyString,
}).passthrough()

const segmentRowSchema = z.object({
  period: nonEmptyString,
  segment: nonEmptyString,
  revenue: finiteNumber,
  op_income: finiteNumber,
  adj_ebitda: finiteNumber,
  capex: finiteNumber,
}).passthrough()

export const financialsSchema = z.object({
  consolidated: z.array(consolidatedRowSchema).min(1),
  segments: z.array(segmentRowSchema).min(1),
  balance: z.array(z.object({ date: nonEmptyString }).passthrough()).min(1),
  cash_flows: z.array(z.object({ period: nonEmptyString }).passthrough()).min(1),
  metrics: z.object({
    starlink: z.array(z.object({ period: nonEmptyString }).passthrough()),
    falcon_launches: z.array(z.object({ period: nonEmptyString }).passthrough()),
    mass_to_orbit: z.array(z.object({ period: nonEmptyString }).passthrough()),
  }).passthrough(),
}).passthrough()
