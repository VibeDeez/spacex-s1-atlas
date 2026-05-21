import { loadJson } from '../lib/assets.js'

export async function loadAtlasData() {
  const [summary, financials, riskPayload, atlasPayload, debatePayload, kubinModel] = await Promise.all([
    loadJson('/summary.json'),
    loadJson('/financials.json'),
    loadJson('/risks.json'),
    loadJson('/atlas-index.json'),
    loadJson('/debate-lenses.json'),
    loadJson('/jared-kubin-model.json'),
  ])
  return { ...summary, financials, risks: riskPayload.risks, atlasRows: atlasPayload.rows, debate: debatePayload, kubinModel }
}

export async function loadSourcePayload() {
  const [main, exhibits, ocr] = await Promise.all([
    loadJson('/source-main.json'),
    loadJson('/source-exhibits.json'),
    loadJson('/ocr.json'),
  ])
  return { ...main, exhibits: exhibits.exhibits, ocr: ocr.ocr, ocrItems: ocr.items }
}
