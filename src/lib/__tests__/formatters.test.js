import { describe, expect, it } from 'vitest'
import { formatPct, formatPlainPct, fmtMetric, money, number, trimText } from '../formatters.js'

describe('formatters', () => {
  it('renders missing values with an em dash fallback', () => {
    expect(money(null)).toBe('—')
    expect(number(undefined)).toBe('—')
  })

  it('renders values under 1000 as millions', () => {
    expect(money(999)).toBe('$999M')
  })

  it('renders values at or above 1000 as billions', () => {
    expect(money(1000)).toBe('$1.0B')
  })

  it('uses the intended unicode minus for negative money values', () => {
    expect(money(-42)).toBe('−$42M')
  })

  it('formats signed and plain percentages separately', () => {
    expect(formatPct(12.345, 1)).toBe('+12.3%')
    expect(formatPct(-12.345, 1)).toBe('-12.3%')
    expect(formatPlainPct(12.345, 1)).toBe('12.3%')
  })

  it('formats dashboard metric units consistently', () => {
    expect(fmtMetric(1250, 'money')).toBe('$1.3B')
    expect(fmtMetric(7.891, 'multiple', 2)).toBe('7.89x')
    expect(fmtMetric(1234.56, 'number', 1)).toBe('1,234.6')
    expect(fmtMetric(null, 'money')).toBe('—')
  })

  it('trims long text without keeping repeated whitespace', () => {
    expect(trimText('alpha     beta gamma', 12)).toBe('alpha beta…')
  })
})
