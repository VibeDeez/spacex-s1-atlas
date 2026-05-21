export function number(value) {
  return value?.toLocaleString?.() ?? value ?? '—'
}

export function money(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—'
  const sign = value < 0 ? '−' : ''
  const abs = Math.abs(Number(value))
  return `${sign}$${abs >= 1000 ? `${(abs / 1000).toFixed(1)}B` : `${abs.toLocaleString()}M`}`
}

export function formatPct(value, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  const n = Number(value)
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`
}

export function formatPlainPct(value, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  return `${Number(value).toFixed(digits)}%`
}

export function trimText(value, n = 220) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text
}

export function hasNumber(value) {
  return value !== undefined && value !== null && Number.isFinite(Number(value))
}

export function fmtMetric(value, unit = 'money', digits = 1) {
  if (!hasNumber(value)) return '—'
  if (unit === 'money') return money(value)
  if (unit === 'pct') return formatPlainPct(value, digits)
  if (unit === 'signedPct') return formatPct(value, digits)
  if (unit === 'multiple') return `${Number(value).toFixed(digits)}x`
  if (unit === 'number') return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits })
  return String(value)
}
