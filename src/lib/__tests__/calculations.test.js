import { describe, expect, it } from 'vitest'
import {
  balanceRow,
  capitalValue,
  financialPacket,
  margin,
  opMarginExplainer,
  opMarginLabel,
  pctChange,
  segmentRowsFor,
  segmentTotal,
  signedClass,
} from '../calculations.js'

const data = {
  capital: {
    actual_mar_31_2026: [{ label: 'Debt', value: 22896 }],
  },
  financials: {
    balance: [{ date: 'Mar 31 2026', cash: 100 }],
    segments: [
      { period: 'Q1 2026', segment: 'Space', revenue: 200, capex: 50 },
      { period: 'Q1 2026', segment: 'AI', revenue: 50, capex: 150 },
      { period: '2025', segment: 'Space', revenue: 700, capex: 200 },
    ],
  },
  atlasRows: [
    { type: 'financial', title: 'Consolidated · Q1 2026' },
    { type: 'risk', title: 'Launch risk' },
  ],
}

describe('calculations', () => {
  it('returns null for percentage changes with zero or invalid denominator', () => {
    expect(pctChange(10, 0)).toBeNull()
    expect(pctChange(10, null)).toBeNull()
  })

  it('calculates percentage changes against the absolute previous value', () => {
    expect(pctChange(150, 100)).toBe(50)
    expect(pctChange(-50, -100)).toBe(50)
  })

  it('returns null for margins with missing or zero denominator', () => {
    expect(margin(10, 0)).toBeNull()
    expect(margin(undefined, 10)).toBeNull()
  })

  it('calculates stable segment totals and ratios', () => {
    expect(segmentRowsFor(data, 'Q1 2026')).toHaveLength(2)
    expect(segmentTotal(data, 'Q1 2026', 'capex')).toBe(200)
    expect(margin(150, segmentTotal(data, 'Q1 2026', 'capex'))).toBe(75)
  })

  it('labels extreme operating losses clearly', () => {
    const row = { op_income: -150, revenue: 100 }
    expect(opMarginLabel(-150)).toBe('Op. loss / revenue')
    expect(opMarginExplainer(row, -150)).toContain('Loss exceeds revenue')
  })

  it('finds financial rows, capital values, and signed display classes', () => {
    expect(balanceRow(data.financials.balance, 'Mar 31 2026')?.cash).toBe(100)
    expect(capitalValue(data, 'Debt')).toBe(22896)
    expect(financialPacket(data, /Q1 2026/)?.title).toBe('Consolidated · Q1 2026')
    expect(signedClass(-1)).toBe('text-red')
    expect(signedClass(1)).toBe('text-cyan')
  })
})
