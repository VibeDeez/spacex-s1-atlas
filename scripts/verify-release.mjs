#!/usr/bin/env node
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITE, canonicalSiteUrl } from './site-config.mjs'
import { validatePublicData } from './validate-public-data.mjs'
import { makePosterSvg } from '../src/poster/makePosterSvg.js'
import { AxeBuilder } from '@axe-core/playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function read(rel) {
  return readFileSync(path.join(dist, rel), 'utf8')
}

function json(rel) {
  return JSON.parse(read(rel))
}

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(full))
    else out.push(full)
  }
  return out
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.json')) return 'application/json'
  if (file.endsWith('.png')) return 'image/png'
  return 'application/octet-stream'
}

function fileForRawPath(rawPath) {
  return path.join(dist, rawPath === '/' ? 'index.html' : rawPath.replace(/^\//, ''))
}

function startStaticServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    const rawPath = decodeURIComponent(url.pathname)
    let file = fileForRawPath(rawPath)
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('not found')
      return
    }
    res.writeHead(200, { 'content-type': contentType(file) })
    res.end(readFileSync(file))
  })
  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      reject(err)
    })
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, origin: `http://127.0.0.1:${port}` })
    })
  })
}

async function staticChecks() {
  assert(existsSync(path.join(dist, 'index.html')), 'missing dist/index.html')
  validatePublicData({ baseDir: dist })
  const index = read('index.html')
  const jsAssets = [...index.matchAll(/src="(?:\.\/|\/)?(assets\/[^"<>]+\.js)"/g)].map((m) => m[1])
  const cssAssets = [...index.matchAll(/href="(?:\.\/|\/)?(assets\/[^"<>]+\.css)"/g)].map((m) => m[1])
  assert(jsAssets.length === 1, `expected one JS asset, found ${jsAssets.length}`)
  assert(cssAssets.length === 1, `expected one CSS asset, found ${cssAssets.length}`)
  const js = jsAssets.map(read).join('\n')
  const css = cssAssets.map(read).join('\n')
  assert(css.includes('mobile-tab-grid'), 'mobile grid nav CSS missing')
  assert(index.includes(SITE.title), 'root title missing')
  assert(index.includes(SITE.description), 'root description missing')
  assert(index.includes(`${canonicalSiteUrl('/')}`), 'root canonical URL missing or stale')
  assert(index.includes(SITE.socialImagePath), 'root social image path missing or stale')
  assert(index.includes(canonicalSiteUrl(SITE.socialImagePath)), 'root absolute social image URL missing or stale')
  assert(!index.includes('henry.here.now'), 'stale root metadata host present')
  assert(!index.includes('spacex-s1-elon-rocket-og.png'), 'stale OG image filename present')

  for (const rel of ['summary.json', 'financials.json', 'risks.json', 'atlas-index.json', 'debate-lenses.json', 'jared-kubin-model.json', 'jared-kubin-spacex-ipo-model.xlsx', 'source-main.json', 'source-exhibits.json', 'ocr.json', 'social/spacex-s1-atlas-card.png', 'robots.txt', 'sitemap.xml']) {
    assert(existsSync(path.join(dist, rel)), `missing ${rel}`)
  }
  assert(!existsSync(path.join(dist, 'buzz-lenses.json')), 'retired buzz-lenses.json is still present')

  const summary = json('summary.json')
  const financials = json('financials.json')
  const risks = json('risks.json').risks
  const atlas = json('atlas-index.json').rows
  const debate = json('debate-lenses.json')
  const sourceCounts = summary.sourceCounts || {}
  const riskPackets = atlas.filter((row) => row.type === 'risk')

  assert(sourceCounts.sections === 22, 'section count drift')
  assert(sourceCounts.exhibits === 17, 'exhibit count drift')
  assert(sourceCounts.graphics === 82, 'graphics/OCR count drift')
  assert(sourceCounts.risk_headings === risks.length, 'risk heading count does not match risks.json')
  assert(sourceCounts.risk_headings === riskPackets.length, 'risk heading count does not match atlas risk packets')
  assert(sourceCounts.glossary_terms === atlas.filter((row) => row.type === 'glossary').length, 'glossary count does not match atlas')
  assert(debate.lenses?.length === 8, 'expected 8 debate lenses')

  const ids = new Set()
  for (const row of atlas) {
    for (const key of ['id', 'type', 'title', 'detail', 'source', 'hash', 'sharePath']) assert(row[key] !== undefined && row[key] !== '', `atlas row ${row.id || row.title} missing ${key}`)
    assert(!ids.has(row.id), `duplicate atlas id ${row.id}`)
    ids.add(row.id)
    assert(row.hash === `/packet/${row.type}/${row.id}`, `bad hash for ${row.id}`)
    assert(row.sharePath === `/share/packet/${row.id}/`, `bad sharePath for ${row.id}`)
    assert(existsSync(path.join(dist, row.sharePath, 'index.html')), `missing share page for ${row.id}`)
  }

  const sharePages = (await walk(path.join(dist, 'share'))).filter((p) => p.endsWith('index.html'))
  assert(sharePages.length === atlas.length + 4, `share page count drift: ${sharePages.length}`)
  for (const rel of ['share/business-stack/index.html', 'share/financial-telemetry/index.html', 'share/risk-radar/index.html', 'share/governance-control/index.html']) {
    const html = read(rel)
    assert(html.includes('/#/poster/'), `${rel} has non-canonical poster redirect`)
    assert(html.includes('og:image'), `${rel} missing og:image`)
    assert(html.includes('og:url'), `${rel} missing og:url`)
    assert(html.toLowerCase().includes('not investment advice'), `${rel} missing investment advice disclaimer`)
    assert(html.toLowerCase().includes('not affiliated with spacex'), `${rel} missing SpaceX affiliation disclaimer`)
  }
  const packetHtml = read(atlas[0].sharePath.replace(/^\//, '') + 'index.html')
  assert(packetHtml.includes('/#/packet/'), 'packet share page has non-canonical packet redirect')
  assert(packetHtml.toLowerCase().includes('external model assumptions are separate from filed facts'), 'packet share page missing external model caveat')
  const readme = readFileSync(path.join(root, 'README.md'), 'utf8').toLowerCase()
  const publicDisclaimerText = [index, js, packetHtml].join('\n').toLowerCase()
  for (const [fragment, label] of [
    ['not investment advice', 'investment advice disclaimer'],
    ['not affiliated with spacex', 'SpaceX affiliation disclaimer'],
    ['source-cited filing map', 'source-cited filing map description'],
    ['external model assumptions are separate from filed facts', 'external model separation caveat'],
  ]) {
    assert(readme.includes(fragment), `README missing ${label}`)
    assert(publicDisclaimerText.includes(fragment), `public app/share output missing ${label}`)
  }

  const robots = read('robots.txt')
  const sitemap = read('sitemap.xml')
  assert(robots.includes(`Sitemap: ${canonicalSiteUrl('/sitemap.xml')}`), 'robots.txt missing canonical sitemap URL')
  assert(!robots.includes('\n\nSitemap:'), 'robots.txt keeps sitemap in a separate block that production edge may strip')
  assert(sitemap.includes(canonicalSiteUrl('/share/risk-radar/')), 'sitemap missing poster share route')
  assert(sitemap.includes('/share/packet/'), 'sitemap missing packet routes')
  assert((sitemap.match(/<url>/g) || []).length === atlas.length + 5, 'sitemap URL count drift')

  const forbiddenAppText = ['Reddit', 'reddit', 'buzz', 'Buzz', 'social media', 'social-media', 'redditThemes', 'sampleThreads', 'buzz-lenses', 'External Reddit prompt', 'IPO Flight Deck', 'Copy X caption', 'mission-control', 'Investor-grade', 'profit engine', 'capital sink', 'command center', 'Operating KPI terminal']
  const appAuthored = [index, js, read('debate-lenses.json')].join('\n')
  const bad = forbiddenAppText.filter((term) => appAuthored.includes(term))
  assert(bad.length === 0, `retired app-authored strings present: ${bad.join(', ')}`)
  const appSource = readFileSync(path.join(root, 'src/App.jsx'), 'utf8')
  assert(!appSource.includes('dangerouslySetInnerHTML'), 'unnecessary dangerouslySetInnerHTML present in app source')
  const posterData = { ...summary, financials, risks, atlasRows: atlas }
  const svg = makePosterSvg({ variant: 'business-stack', data: posterData, packet: atlas[0] })
  const forbiddenSvgTokens = ['<script', 'javascript:', 'onload=', 'onerror=', '<foreignObject']
  for (const token of forbiddenSvgTokens) {
    assert(!svg.toLowerCase().includes(token.toLowerCase()), `unsafe SVG token present: ${token}`)
  }
  const staleDomains = ['henry.here.now', 'jade-serenity-vhqv.here.now', 'brave-fennel-ghck.here.now', 'sentient-ravine-9vxe.here.now', 'mossy-petal-6adt.here.now', 'stellar-nirvana-tvwp.here.now']
  const distNonSource = [index, js, css, read('debate-lenses.json')].join('\n')
  const stale = staleDomains.filter((term) => distNonSource.includes(term))
  assert(stale.length === 0, `stale domains present: ${stale.join(', ')}`)

  const jsSizeKb = statSync(path.join(dist, jsAssets[0])).size / 1024
  const cssSizeKb = statSync(path.join(dist, cssAssets[0])).size / 1024
  assert(jsSizeKb < 700, `JS bundle too large: ${jsSizeKb.toFixed(1)} KB`)

  return { jsAsset: jsAssets[0], cssAsset: cssAssets[0], jsSizeKb: Number(jsSizeKb.toFixed(1)), cssSizeKb: Number(cssSizeKb.toFixed(1)), atlasCount: atlas.length, sharePageCount: sharePages.length, riskCount: risks.length }
}

async function installDistRoutes(page) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const rawPath = decodeURIComponent(url.pathname)
    let file = fileForRawPath(rawPath)
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
      await route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'not found' })
      return
    }
    await route.fulfill({ status: 200, contentType: contentType(file), path: file })
  })
}

async function assertA11y(page, routeLabel) {
  await page.waitForTimeout(250)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  const violations = results.violations.filter((violation) => violation.impact !== 'minor')
  const details = violations
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 3)
        .map((node) => `${node.target.join(' ')} :: ${node.failureSummary || node.html}`)
        .join(' | ')
      return `${violation.id} (${violation.nodes.length}) ${nodes}`
    })
    .join('; ')
  assert(
    violations.length === 0,
    `axe violations on ${routeLabel}: ${details}`,
  )
}

async function browserChecks(origin, { routeAssets = false } = {}) {
  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch (err) {
    fail(`Playwright unavailable for adversarial route checks: ${err.message}`)
  }
  let browser
  try {
    browser = await chromium.launch({ headless: true })
  } catch (err) {
    await browserlessRouteChecks(err)
    return
  }
  let context
  let mobileContext
  try {
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    if (routeAssets) await installDistRoutes(page)
    const errors = []
    const sourceFetches = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
    page.on('request', (req) => {
      const url = req.url()
      if (/\/(source-main|source-exhibits|ocr)\.json$/.test(url)) sourceFetches.push(url)
    })
    const routes = [
      ['#/flight-deck', 'SpaceX S‑1 Atlas'],
      ['#/debate?lens=valuation', 'Question lenses'],
      ['#/debate?lens=treasury', 'Treasury Oddities'],
      ['#/segments', 'Space, Connectivity, AI'],
      ['#/financials', 'Financial filing workbench'],
      ['#/risks', 'Risk Radar'],
      ['#/governance', 'Control, management'],
      ['#/model', 'Scenario Workbench'],
      ['#/atlas?q=Starlink', 'Disclosure Atlas'],
      ['#/poster/risk-radar', 'Poster mode'],
    ]
    const a11yRoutes = new Set(['#/flight-deck', '#/financials', '#/risks', '#/atlas?q=Starlink', '#/poster/risk-radar'])
    for (const [hash, marker] of routes) {
      await page.goto(`${origin}/${hash}`, { waitUntil: 'networkidle', timeout: 60000 })
      await page.waitForFunction((m) => document.body.innerText.toLowerCase().includes(String(m).toLowerCase()), marker, { timeout: 30000 })
      const text = await page.locator('body').innerText()
      assert(!/Reddit|buzz|IPO Flight Deck|Copy X caption|mission-control/.test(text), `retired public text on ${hash}`)
      if (a11yRoutes.has(hash)) await assertA11y(page, hash)
    }
    assert(sourceFetches.length === 0, `source payload fetched before Source route: ${sourceFetches.join(', ')}`)

    await page.goto(`${origin}/#/sources?q=Starship`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('source') && document.body.innerText.toLowerCase().includes('visible chars'), null, { timeout: 30000 })
    await assertA11y(page, '#/sources?q=Starship')
    assert(sourceFetches.length === 3, `expected 3 source payload fetches after Source route, saw ${sourceFetches.length}`)

    const packetHref = json('atlas-index.json').rows.find((row) => row.type === 'risk').hash
    await page.goto(`${origin}/#${packetHref}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase()
      return text.includes('disclosure packet') && text.includes('src · risk factors')
    }, null, { timeout: 30000 })

    await page.goto(`${origin}/#/packet/risk/not-real`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForFunction(() => document.body.innerText.includes('Packet not found'), null, { timeout: 30000 })

    mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
    const mobile = await mobileContext.newPage()
    if (routeAssets) await installDistRoutes(mobile)
    const mobileErrors = []
    mobile.on('pageerror', (e) => mobileErrors.push(String(e)))
    mobile.on('console', (msg) => { if (msg.type() === 'error') mobileErrors.push(msg.text()) })
    await mobile.goto(`${origin}/#/debate?lens=valuation`, { waitUntil: 'networkidle', timeout: 60000 })
    await mobile.waitForFunction(() => document.body.innerText.toLowerCase().includes('question lenses'), null, { timeout: 30000 })
    const nav = await mobile.locator('nav').first().evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, text: el.innerText }))
    assert(nav.scrollWidth <= nav.clientWidth + 1, `mobile nav overflow: ${JSON.stringify(nav)}`)
    const fonts = await mobile.locator('input').evaluateAll((nodes) => nodes.slice(0, 4).map((n) => getComputedStyle(n).fontSize))
    assert(fonts.length >= 3 && fonts.every((f) => parseFloat(f) >= 16), `mobile input fonts too small: ${fonts.join(', ')}`)
    const mobileBody = await mobile.locator('body').innerText()
    assert(!/Reddit|buzz|External Reddit prompt/.test(mobileBody), 'retired public text on mobile debate route')
    assert(mobileErrors.length === 0, `mobile browser errors: ${mobileErrors.join('\n')}`)
    assert(errors.length === 0, `browser errors: ${errors.join('\n')}`)
  } finally {
    if (mobileContext) await mobileContext.close()
    if (context) await context.close()
    await browser.close()
  }
}

async function browserlessRouteChecks(launchError) {
  const index = read('index.html')
  const jsAssets = [...index.matchAll(/src="(?:\.\/|\/)?(assets\/[^"<>]+\.js)"/g)].map((m) => m[1])
  const cssAssets = [...index.matchAll(/href="(?:\.\/|\/)?(assets\/[^"<>]+\.css)"/g)].map((m) => m[1])
  const js = jsAssets.map(read).join('\n').toLowerCase()
  const css = cssAssets.map(read).join('\n')
  const requiredMarkers = [
    'spacex s',
    'question lenses',
    'treasury oddities',
    'space, connectivity, ai',
    'financial filing workbench',
    'risk radar',
    'control, management',
    'disclosure atlas',
    'poster mode',
    'packet not found',
    'visible chars',
  ]
  for (const marker of requiredMarkers) assert(js.includes(marker), `browserless route marker missing: ${marker}`)
  for (const sourceFile of ['source-main.json', 'source-exhibits.json', 'ocr.json']) assert(js.includes(sourceFile), `lazy source route missing ${sourceFile}`)
  assert(css.includes('mobile-tab-grid'), 'browserless mobile nav CSS missing')
  assert(css.includes('repeat(4,minmax(0,1fr))') || css.includes('repeat(4, minmax(0, 1fr))'), 'browserless mobile nav grid changed')
  console.warn(`Playwright launch unavailable; completed browserless route checks instead: ${launchError.message.split('\n')[0]}`)
}

async function httpChecks(origin) {
  const required = ['summary.json', 'financials.json', 'risks.json', 'atlas-index.json', 'debate-lenses.json', 'source-main.json', 'source-exhibits.json', 'ocr.json', 'social/spacex-s1-atlas-card.png', 'robots.txt', 'sitemap.xml', 'share/risk-radar/']
  for (const rel of required) {
    const res = await fetch(`${origin}/${rel}`)
    assert(res.status === 200, `${rel} returned ${res.status}`)
  }
  for (const rel of ['buzz-lenses.json', 'dashboard_data.json', 'share/packet/not-a-real-packet/']) {
    const res = await fetch(`${origin}/${rel}`)
    assert(res.status === 404, `${rel} should 404, got ${res.status}`)
  }
}

async function fileHttpChecks() {
  const required = ['summary.json', 'financials.json', 'risks.json', 'atlas-index.json', 'debate-lenses.json', 'source-main.json', 'source-exhibits.json', 'ocr.json', 'social/spacex-s1-atlas-card.png', 'robots.txt', 'sitemap.xml', 'share/risk-radar/']
  for (const rel of required) {
    let file = fileForRawPath(`/${rel}`)
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html')
    assert(existsSync(file) && statSync(file).isFile(), `${rel} returned 404 in file-backed fallback`)
  }
  for (const rel of ['buzz-lenses.json', 'dashboard_data.json', 'share/packet/not-a-real-packet/']) {
    let file = fileForRawPath(`/${rel}`)
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html')
    assert(!existsSync(file), `${rel} should 404 in file-backed fallback`)
  }
}

const summary = await staticChecks()
let server = null
let origin = 'http://spacex-s1-dashboard.local'
let routeAssets = false
try {
  ;({ server, origin } = await startStaticServer())
  await httpChecks(origin)
} catch (err) {
  if (!['EPERM', 'EACCES'].includes(err?.code)) throw err
  routeAssets = true
  await fileHttpChecks()
}
try {
  await browserChecks(origin, { routeAssets })
} finally {
  if (server) await new Promise((resolve) => server.close(resolve))
}
console.log(JSON.stringify({ ok: true, ...summary }, null, 2))
