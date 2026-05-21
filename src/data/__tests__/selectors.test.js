import { describe, expect, it } from 'vitest'
import {
  factFor,
  findRelatedPackets,
  riskFactorCount,
  riskPacketFor,
  rowFor,
  sourceCountLine,
  sourceCounts,
} from '../selectors.js'

const data = {
  sourceCounts: { sections: 2, exhibits: 1, graphics: 3, risk_headings: 4, glossary_terms: 5 },
  risks: [{ heading: 'fallback risk' }],
  facts: [{ k: 'Ticker requested', v: 'SPCX' }],
  atlasRows: [
    { id: 'risk-starship', type: 'risk', title: 'Starship launch operations', detail: 'launch cadence and vehicle risk', source: 'Risk Factors' },
    { id: 'risk-network', type: 'risk', title: 'Starlink network operations', detail: 'network cadence', source: 'Risk Factors' },
    { id: 'fact-ticker', type: 'fact', title: 'Ticker requested', detail: 'SPCX ticker', source: 'Cover' },
  ],
}

describe('selectors', () => {
  it('returns source counts and a human-readable count line', () => {
    expect(sourceCounts(data).sections).toBe(2)
    expect(sourceCountLine(sourceCounts(data))).toBe('2 sections · 1 exhibits · 3 graphics/OCR · 4 risk factors · 5 glossary terms')
  })

  it('uses risk source counts before falling back to risk rows', () => {
    expect(riskFactorCount(data)).toBe(4)
    expect(riskFactorCount({ risks: data.risks })).toBe(1)
  })

  it('finds facts, rows, and risk packets', () => {
    expect(rowFor(data.atlasRows, 'id', 'fact-ticker')?.title).toBe('Ticker requested')
    expect(factFor(data, 'Ticker requested')?.v).toBe('SPCX')
    expect(riskPacketFor(data, /Starship/)?.id).toBe('risk-starship')
  })

  it('finds related packets by shared meaningful tokens', () => {
    const related = findRelatedPackets(data.atlasRows[0], data, 1)
    expect(related).toEqual([data.atlasRows[1]])
  })
})
