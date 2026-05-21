import { money } from './formatters.js'

export function pctChange(current, previous) {
  const c = Number(current)
  const p = Number(previous)
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null
  return ((c - p) / Math.abs(p)) * 100
}

export function margin(numerator, denominator) {
  const n = Number(numerator)
  const d = Number(denominator)
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null
  return (n / d) * 100
}

export function signedClass(value, neutral = 'text-white/84') {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return neutral
  return n < 0 ? 'text-red' : 'text-cyan'
}

export function opMarginLabel(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'Op. margin'
  return n < -100 ? 'Op. loss / revenue' : 'Op. margin'
}

export function opMarginExplainer(row, value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n >= -100) return null
  return `Loss exceeds revenue: ${money(row.op_income)} operating income on ${money(row.revenue)} revenue.`
}

export function periodRow(rows, period) {
  return rows?.find((row) => row.period === period)
}

export function balanceRow(rows, date) {
  return rows?.find((row) => row.date === date)
}

export function capitalValue(data, label) {
  return data.capital?.actual_mar_31_2026?.find((row) => row.label === label)?.value
}

export function segmentRowsFor(data, period) {
  return data.financials.segments.filter((row) => row.period === period)
}

export function segmentTotal(data, period, key) {
  return segmentRowsFor(data, period).reduce((sum, row) => sum + Number(row[key] || 0), 0)
}

export function financialPacket(data, matcher) {
  if (!data?.atlasRows) return null
  if (matcher instanceof RegExp) return data.atlasRows.find((row) => row.type === 'financial' && matcher.test(row.title))
  return data.atlasRows.find((row) => row.type === 'financial' && row.title === matcher)
}
