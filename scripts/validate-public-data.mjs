#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { atlasSchema } from './schemas/atlas.schema.mjs'
import { debateSchema } from './schemas/debate.schema.mjs'
import { financialsSchema } from './schemas/financials.schema.mjs'
import { kubinModelSchema } from './schemas/kubin-model.schema.mjs'
import { risksSchema } from './schemas/risks.schema.mjs'
import { summarySchema } from './schemas/summary.schema.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function readJson(baseDir, rel) {
  const file = path.join(baseDir, rel)
  assert(existsSync(file), `missing ${rel}`)
  return JSON.parse(readFileSync(file, 'utf8'))
}

function parseWith(schema, value, rel) {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ')
    fail(`${rel} failed schema validation: ${details}`)
  }
  return parsed.data
}

export function validatePublicData({ baseDir = path.join(root, 'public') } = {}) {
  const summary = parseWith(summarySchema, readJson(baseDir, 'summary.json'), 'summary.json')
  const financials = parseWith(financialsSchema, readJson(baseDir, 'financials.json'), 'financials.json')
  const risks = parseWith(risksSchema, readJson(baseDir, 'risks.json'), 'risks.json')
  const atlas = parseWith(atlasSchema, readJson(baseDir, 'atlas-index.json'), 'atlas-index.json')
  const debate = parseWith(debateSchema, readJson(baseDir, 'debate-lenses.json'), 'debate-lenses.json')
  const kubinModel = parseWith(kubinModelSchema, readJson(baseDir, 'jared-kubin-model.json'), 'jared-kubin-model.json')

  assert(atlas.count === atlas.rows.length, 'atlas-index.count does not match rows.length')
  const riskRows = atlas.rows.filter((row) => row.type === 'risk')
  assert(summary.sourceCounts.risk_headings === risks.risks.length, 'summary risk heading count does not match risks.json')
  assert(summary.sourceCounts.risk_headings === riskRows.length, 'summary risk heading count does not match atlas risk rows')

  const ids = new Set()
  for (const row of atlas.rows) {
    assert(!ids.has(row.id), `duplicate atlas id ${row.id}`)
    ids.add(row.id)
    assert(row.hash === `/packet/${row.type}/${row.id}`, `bad hash for ${row.id}`)
    assert(row.sharePath === `/share/packet/${row.id}/`, `bad sharePath for ${row.id}`)
    assert(existsSync(path.join(baseDir, row.sharePath, 'index.html')), `missing share page for ${row.id}`)
  }

  for (const rel of [
    'summary.json',
    'financials.json',
    'risks.json',
    'atlas-index.json',
    'debate-lenses.json',
    'jared-kubin-model.json',
    'jared-kubin-spacex-ipo-model.xlsx',
    'social/spacex-s1-atlas-card.png',
    'robots.txt',
    'sitemap.xml',
  ]) {
    assert(existsSync(path.join(baseDir, rel)), `missing required public asset ${rel}`)
  }

  return {
    ok: true,
    facts: summary.facts.length,
    financialRows: financials.consolidated.length + financials.segments.length + financials.balance.length + financials.cash_flows.length,
    risks: risks.risks.length,
    atlasRows: atlas.rows.length,
    debateLenses: debate.lenses.length,
    kubinComponents: kubinModel.shareCount.components.length,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(validatePublicData(), null, 2))
}
