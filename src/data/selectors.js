import { SOURCE_COUNTS } from '../lib/constants.js'

export function sourceCounts(data) {
  return data?.sourceCounts || SOURCE_COUNTS
}

export function sourceCountLine(counts = SOURCE_COUNTS) {
  const c = counts || SOURCE_COUNTS
  return `${c.sections} sections · ${c.exhibits} exhibits · ${c.graphics} graphics/OCR · ${c.risk_headings} risk factors · ${c.glossary_terms} glossary terms`
}

export function riskFactorCount(data) {
  return data?.sourceCounts?.risk_headings || data?.risks?.length || SOURCE_COUNTS.risk_headings
}

export function rowFor(rows, key, value) {
  return rows?.find((row) => row[key] === value)
}

export function factFor(data, key) {
  return data.facts?.find((fact) => fact.k === key)
}

export function riskPacketFor(data, pattern) {
  return data.atlasRows?.find((row) => row.type === 'risk' && pattern.test(row.title))
}

export function findRelatedPackets(packet, data, limit = 3) {
  if (!packet || !data?.atlasRows?.length) return []
  const stop = new Set(['with', 'that', 'this', 'from', 'into', 'will', 'could', 'would', 'have', 'their', 'there', 'which', 'including', 'source', 'lines'])
  const tokens = new Set((`${packet.title} ${packet.detail}`.toLowerCase().match(/[a-z0-9]{4,}/g) || []).filter((token) => !stop.has(token)))
  return data.atlasRows
    .filter((row) => row.id !== packet.id)
    .map((row) => {
      const hay = `${row.type} ${row.title} ${row.detail}`.toLowerCase()
      let score = row.type === packet.type ? 2 : 0
      tokens.forEach((token) => { if (hay.includes(token)) score += 1 })
      return { row, score }
    })
    .filter(({ score }) => score >= 3)
    .sort((a, b) => b.score - a.score || a.row.title.localeCompare(b.row.title))
    .slice(0, limit)
    .map(({ row }) => row)
}
