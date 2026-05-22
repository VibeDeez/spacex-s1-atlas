import { SEGMENT_COLORS } from '../lib/constants.js'
import { balanceRow, margin, pctChange, periodRow, segmentRowsFor, segmentTotal } from '../lib/calculations.js'
import { formatPct, formatPlainPct, money } from '../lib/formatters.js'
import { inferRiskTheme, RISK_THEME_META } from '../lib/riskThemes.js'
import { riskFactorCount, sourceCountLine, sourceCounts } from '../data/selectors.js'

export function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]))
}

export function makePosterSvg({ variant, data }) {
  if (variant === 'financial-telemetry') {
    const y2024 = periodRow(data.financials.consolidated, '2024')
    const y2025 = periodRow(data.financials.consolidated, '2025')
    const q12025 = periodRow(data.financials.consolidated, 'Q1 2025')
    const q12026 = periodRow(data.financials.consolidated, 'Q1 2026')
    const latest = balanceRow(data.financials.balance, 'Mar 31 2026')
    const cashAndSec = Number(latest?.cash || 0) + Number(latest?.marketable_securities || 0)
    const q1Segments = segmentRowsFor(data, 'Q1 2026')
    const q1Revenue = segmentTotal(data, 'Q1 2026', 'revenue')
    const q1Capex = segmentTotal(data, 'Q1 2026', 'capex')
    const aiQ1 = q1Segments.find((row) => row.segment === 'AI')
    const stars = Array.from({ length: 48 }, (_, i) => `<circle cx="${(61 + i * 227) % 1130 + 36}" cy="${(31 + i * 113) % 560 + 28}" r="${i % 8 === 0 ? 1.9 : 1.05}" fill="#fff" opacity="${i % 6 === 0 ? .78 : .38}"/>`).join('')
    const metricCards = [
      ['2025 revenue', money(y2025?.revenue), `${formatPct(pctChange(y2025?.revenue, y2024?.revenue), 1)} YoY`],
      ['Q1 revenue', money(q12026?.revenue), `${formatPct(pctChange(q12026?.revenue, q12025?.revenue), 1)} YoY`],
      ['Q1 op. margin', formatPlainPct(margin(q12026?.op_income, q12026?.revenue), 1), 'op income / revenue'],
      ['Cash + securities', money(cashAndSec), 'Mar. 31 2026'],
      ['AI capex share', formatPlainPct(margin(aiQ1?.capex, q1Capex), 1), 'Q1 segment capex'],
      ['Q1 Adj. EBITDA, as filed margin', formatPlainPct(margin(q12026?.adjusted_ebitda, q12026?.revenue), 1), 'filed Adj. EBITDA, as filed'],
    ].map((m, i) => {
      const x = 64 + (i % 3) * 225
      const y = 244 + Math.floor(i / 3) * 126
      return `<rect x="${x}" y="${y}" width="196" height="94" rx="18" fill="#090a0d" stroke="rgba(255,255,255,.10)"/><text x="${x + 18}" y="${y + 30}" fill="#8b94a3" font-size="11" font-family="ui-monospace,Menlo,monospace" font-weight="700" letter-spacing="1.2">${escapeXml(m[0]).toUpperCase()}</text><text x="${x + 18}" y="${y + 62}" fill="#f7f8f8" font-size="28" font-family="Inter,system-ui,sans-serif" font-weight="720">${escapeXml(m[1])}</text><text x="${x + 18}" y="${y + 82}" fill="#b7d8ff" font-size="12" font-family="Inter,system-ui,sans-serif">${escapeXml(m[2])}</text>`
    }).join('')
    const segmentBars = q1Segments.map((row, i) => {
      const y = 288 + i * 70
      const revW = Math.max(8, margin(row.revenue, q1Revenue) * 2.2)
      const capexW = Math.max(8, margin(row.capex, q1Capex) * 2.2)
      return `<text x="748" y="${y}" fill="${SEGMENT_COLORS[row.segment]}" font-size="18" font-family="Inter,system-ui,sans-serif" font-weight="700">${row.segment}</text><rect x="748" y="${y + 12}" width="250" height="9" rx="5" fill="rgba(255,255,255,.08)"/><rect x="748" y="${y + 12}" width="${revW}" height="9" rx="5" fill="${SEGMENT_COLORS[row.segment]}"/><text x="1010" y="${y + 20}" fill="#c6d0dd" font-size="13" font-family="ui-monospace,Menlo,monospace">rev ${formatPlainPct(margin(row.revenue, q1Revenue), 1)}</text><rect x="748" y="${y + 32}" width="250" height="9" rx="5" fill="rgba(255,255,255,.08)"/><rect x="748" y="${y + 32}" width="${capexW}" height="9" rx="5" fill="#F3BE63"/><text x="1010" y="${y + 40}" fill="#c6d0dd" font-size="13" font-family="ui-monospace,Menlo,monospace">capex ${formatPlainPct(margin(row.capex, q1Capex), 1)}</text>`
    }).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs><radialGradient id="bg" cx="50%" cy="110%" r="88%"><stop offset="0" stop-color="#18283f"/><stop offset=".42" stop-color="#080a0e"/><stop offset="1" stop-color="#030304"/></radialGradient></defs>
      <rect width="1200" height="630" fill="url(#bg)"/>${stars}<circle cx="590" cy="760" r="630" fill="none" stroke="#b7d8ff" opacity=".13" stroke-width="2"/><text x="56" y="104" fill="#f7f8f8" font-size="74" font-family="Inter,system-ui,sans-serif" font-weight="650" letter-spacing="-4">SpaceX S‑1 Atlas</text><text x="62" y="162" fill="#b7d8ff" font-size="31" font-family="Inter,system-ui,sans-serif" font-weight="560">Financial workbench</text><text x="62" y="210" fill="#8b94a3" font-size="19" font-family="Inter,system-ui,sans-serif">Derived from filing values · no market data · no valuation layer</text>${metricCards}<rect x="704" y="218" width="416" height="272" rx="26" fill="#090a0d" stroke="#27303c"/><text x="748" y="262" fill="#f3be63" font-size="25" font-family="Inter,system-ui,sans-serif" font-weight="700">Q1 segment mix</text>${segmentBars}<text x="56" y="580" fill="#8b94a3" font-size="18" font-family="Inter,system-ui,sans-serif">Revenue growth · margins · capex intensity · balance sheet · source packets</text><text x="56" y="608" fill="#b7d8ff" font-size="17" font-family="Inter,system-ui,sans-serif">Source-grounded from the S‑1 package</text>
    </svg>`
  }
  const starSvg = Array.from({ length: 52 }, (_, i) => {
    const x = (73 + i * 211) % 1160 + 20
    const y = (41 + i * 97) % 570 + 24
    const r = i % 11 === 0 ? 2.1 : i % 5 === 0 ? 1.45 : 0.95
    const opacity = i % 7 === 0 ? 0.86 : i % 3 === 0 ? 0.58 : 0.38
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="${opacity}"/>`
  }).join('')
  const shellSvg = data.segments.map((s, i) => {
    const color = SEGMENT_COLORS[s.name]
    const y = 300 + i * 62
    return `<rect x="62" y="${y}" width="390" height="46" rx="14" fill="#0b0c10" stroke="${color}" opacity=".96"/><circle cx="88" cy="${y + 23}" r="6" fill="${color}"/><text x="108" y="${y + 29}" fill="${color}" font-size="20" font-family="ui-monospace,Menlo,monospace" font-weight="700">${escapeXml(s.name)}</text>`
  }).join('')
  const themed = data.risks.map((risk) => ({ ...risk, theme: inferRiskTheme(risk.heading, risk.group) }))
  const riskNodes = RISK_THEME_META.map((theme, i) => {
    const angle = (i / RISK_THEME_META.length) * Math.PI * 2 - Math.PI / 2
    const x = 872 + Math.cos(angle) * 100
    const y = 382 + Math.sin(angle) * 100
    const lx = 872 + Math.cos(angle) * 128
    const ly = 382 + Math.sin(angle) * 128
    const count = themed.filter((r) => r.theme === theme.name).length
    const anchor = Math.cos(angle) > 0.35 ? 'start' : Math.cos(angle) < -0.35 ? 'end' : 'middle'
    return `<line x1="872" y1="382" x2="${x}" y2="${y}" stroke="rgba(255,255,255,.08)"/><circle cx="${x}" cy="${y}" r="12" fill="${theme.color}" opacity=".92" stroke="#050506" stroke-width="2"/><text x="${x}" y="${y + 4}" text-anchor="middle" fill="#050506" font-size="11" font-family="ui-monospace,Menlo,monospace" font-weight="800">${count}</text><text x="${lx}" y="${ly + 4}" text-anchor="${anchor}" fill="${theme.color}" opacity=".78" font-size="10" font-family="ui-monospace,Menlo,monospace" font-weight="700">${theme.label}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <radialGradient id="bg" cx="50%" cy="112%" r="86%"><stop offset="0" stop-color="#1b2b43"/><stop offset=".40" stop-color="#080a0e"/><stop offset="1" stop-color="#030304"/></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    ${starSvg}
    <circle cx="620" cy="720" r="650" fill="none" stroke="#b7d8ff" opacity=".13" stroke-width="2"/>
    <circle cx="620" cy="720" r="470" fill="none" stroke="#ffffff" opacity=".08" stroke-dasharray="8 18"/>
    <text x="56" y="112" fill="#f7f8f8" font-size="78" font-family="Inter,system-ui,sans-serif" font-weight="650" letter-spacing="-4">SpaceX S‑1 Atlas</text>
    <text x="62" y="172" fill="#b7d8ff" font-size="30" font-family="Inter,system-ui,sans-serif" font-weight="520">Business stack · financials · risks · sources</text>
    <text x="62" y="224" fill="#8b94a3" font-size="20" font-family="Inter,system-ui,sans-serif">A filing map built from the S‑1 package.</text>
    ${shellSvg}
    <rect x="688" y="188" width="370" height="332" rx="26" fill="#090a0d" stroke="#27303c"/>
    <text x="728" y="236" fill="#ef7d7d" font-size="28" font-family="Inter,system-ui,sans-serif" font-weight="650">Risk Radar</text>
    <circle cx="872" cy="382" r="126" fill="none" stroke="rgba(255,255,255,.13)"/>
    <circle cx="872" cy="382" r="88" fill="none" stroke="rgba(255,255,255,.10)" stroke-dasharray="7 12"/>
    <circle cx="872" cy="382" r="48" fill="none" stroke="rgba(255,255,255,.08)"/>
    ${riskNodes}
    <text x="872" y="374" text-anchor="middle" fill="#f7f8f8" font-size="34" font-family="Inter,system-ui,sans-serif" font-weight="700">${riskFactorCount(data)}</text>
    <text x="872" y="398" text-anchor="middle" fill="#a6adb9" font-size="10" font-family="ui-monospace,Menlo,monospace" font-weight="700" letter-spacing="1.1">RISK</text>
    <text x="872" y="412" text-anchor="middle" fill="#a6adb9" font-size="10" font-family="ui-monospace,Menlo,monospace" font-weight="700" letter-spacing=".7">FACTORS</text>
    <text x="56" y="580" fill="#8b94a3" font-size="18" font-family="Inter,system-ui,sans-serif">${escapeXml(sourceCountLine(sourceCounts(data)))}</text>
    <text x="56" y="608" fill="#b7d8ff" font-size="17" font-family="Inter,system-ui,sans-serif">Source-grounded from the S‑1 package</text>
  </svg>`
}

export async function exportPoster({ variant, data, packet: _packet, share = false }) {
  const svg = makePosterSvg({ variant, data })
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = url
  })
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(url)
  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!pngBlob) throw new Error('PNG export failed')
  const file = new File([pngBlob], `spacex-s1-${variant}.png`, { type: 'image/png' })
  if (share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'SpaceX S‑1 Atlas', text: 'A source-cited map of SpaceX’s S‑1.' })
      return
    } catch {
      // User canceled or the browser rejected file sharing; fall through to download.
    }
  }
  const pngUrl = URL.createObjectURL(pngBlob)
  const link = document.createElement('a')
  link.download = file.name
  link.href = pngUrl
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(pngUrl), 5000)
}
