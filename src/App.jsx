import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { calculateKubinScenario, getScenarioDefaults } from './kubinScenario.js'
import { loadAtlasData, loadSourcePayload } from './data/loadAtlasData.js'
import { factFor, findRelatedPackets, riskFactorCount, riskPacketFor, rowFor, sourceCountLine, sourceCounts } from './data/selectors.js'
import { publicAsset } from './lib/assets.js'
import { balanceRow, capitalValue, financialPacket, margin, opMarginExplainer, opMarginLabel, pctChange, periodRow, segmentRowsFor, segmentTotal, signedClass } from './lib/calculations.js'
import { PACKET_LABELS, POSTERS, SEGMENT_COLORS } from './lib/constants.js'
import { formatPct, formatPlainPct, fmtMetric, hasNumber, money, number, trimText } from './lib/formatters.js'
import { inferRiskTheme } from './lib/riskThemes.js'
import { parseHash, setHash, scrollToId } from './lib/routing.js'
import { exportPoster, makePosterSvg } from './poster/makePosterSvg.js'
import { copyText, makeCaption, packetUrl, posterUrl, shareToDevice } from './share/shareActions.js'
import {
  ChevronRight,
  Clipboard,
  Database,
  Download,
  ExternalLink,
  FileSearch,
  Gauge,
  Landmark,
  Layers3,
  Link as LinkIcon,
  Orbit,
  Radar,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Table2,
  Users,
} from 'lucide-react'

const NAV = [
  { id: 'flight-deck', hash: '/flight-deck', label: 'Overview' },
  { id: 'debate', hash: '/debate', label: 'Debate Map', mobileLabel: 'Debate' },
  { id: 'segments', hash: '/segments', label: 'Segments' },
  { id: 'financials', hash: '/financials', label: 'Financials', mobileLabel: 'Fin.' },
  { id: 'risks', hash: '/risks', label: 'Risk Radar' },
  { id: 'governance', hash: '/governance', label: 'Governance' },
  { id: 'model', hash: '/model', label: 'External Model' },
  { id: 'atlas', hash: '/atlas', label: 'Atlas' },
  { id: 'sources', hash: '/sources', label: 'Source' },
]

const MOBILE_PRIMARY_NAV = new Set(['flight-deck', 'debate', 'financials', 'atlas'])

const EXECUTIVE_CONCLUSION = 'A Connectivity-led operating model is funding a capital-intensive Space/AI expansion under concentrated control.'


function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function useRoute() {
  const [route, setRoute] = useState(() => parseHash())
  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.history.replaceState(null, '', '#/flight-deck')
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [query])
  return matches
}

function useAtlasData() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let cancelled = false
    loadAtlasData()
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [])
  return { data, error }
}

function useSourcePayload(active) {
  const [source, setSource] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const load = async () => {
    if (source || loading) return source
    setLoading(true)
    try {
      const payload = await loadSourcePayload()
      setSource(payload)
      return payload
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (active === 'sources') load()
  }, [active])
  return { source, loading, error, load }
}

function Shell({ children }) {
  return (
    <div className="relative min-h-svh overflow-x-hidden bg-void text-ink">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-55">
        <div className="absolute inset-0 starfield" />
        <div className="absolute inset-0 mission-grid bg-mission-grid opacity-[0.045]" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function Header({ route }) {
  const [moreOpen, setMoreOpen] = useState(false)
  useEffect(() => { setMoreOpen(false) }, [route.view])
  const secondaryActive = !MOBILE_PRIMARY_NAV.has(route.view) && !['packet', 'poster'].includes(route.view)
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.075] bg-[#050506]/94 pt-safe backdrop-blur-md sm:backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1760px] items-center gap-2 px-safe py-2 sm:gap-3">
        <button onClick={() => setHash('/flight-deck')} className="flex shrink-0 items-center gap-3 rounded-xl px-2 py-1 text-left hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.035]"><Orbit size={17} className="text-spacex" /></div>
          <div className="hidden lg:block">
            <p className="text-sm font-[590] tracking-normal">SpaceX S‑1 Atlas</p>
            <p className="font-mono text-[10px] uppercase tracking-normal text-white/60">source-cited filing map</p>
          </div>
        </button>
        <nav className="mobile-tab-grid no-scrollbar flex flex-1 snap-x gap-1 overflow-x-auto px-1 [mask-image:linear-gradient(90deg,transparent,black_8px,black_calc(100%-24px),transparent)]">
          {NAV.map((tab) => {
            const active = route.view === tab.id || (route.view === 'packet' && tab.id === 'atlas') || (route.view === 'poster' && tab.id === 'flight-deck')
            return (
              <button key={tab.id} onClick={() => setHash(tab.hash)} className={cn('relative min-h-11 shrink-0 snap-start rounded-lg px-3 text-[12px] font-[560] transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60 sm:text-[13px]', !MOBILE_PRIMARY_NAV.has(tab.id) && 'max-sm:hidden', active ? 'text-spacex' : 'text-white/66')}>
                {active && <motion.span layoutId="tab-bg" className="absolute inset-0 rounded-lg border border-white/10 bg-white/[0.055]" />}
                <span className="relative z-10 whitespace-nowrap sm:hidden">{tab.mobileLabel || tab.label}</span>
                <span className="relative z-10 hidden whitespace-nowrap sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="relative sm:hidden">
          <button
            onClick={() => setMoreOpen((open) => !open)}
            className={cn('min-h-11 rounded-lg border px-3 text-[12px] font-[560] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60', secondaryActive || moreOpen ? 'border-spacex/30 bg-white/[0.07] text-spacex' : 'border-white/10 bg-white/[0.035] text-white/70')}
            aria-expanded={moreOpen}
            aria-label="More dashboard routes"
          >
            More
          </button>
          {moreOpen && (
            <div className="absolute right-0 top-[calc(100%+.45rem)] z-50 grid w-48 gap-1 rounded-xl border border-white/[0.11] bg-[#090B0E]/98 p-2 shadow-[0_18px_60px_rgba(0,0,0,.45)]">
              {NAV.filter((tab) => !MOBILE_PRIMARY_NAV.has(tab.id)).map((tab) => (
                <button key={tab.id} onClick={() => setHash(tab.hash)} className={cn('min-h-10 rounded-lg px-3 text-left text-xs font-[560] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60', route.view === tab.id ? 'bg-white/[0.07] text-spacex' : 'text-white/66 hover:bg-white/[0.045]')}>
                  {tab.label}
                </button>
              ))}
              <button onClick={() => setHash('/poster/business-stack')} className="min-h-10 rounded-lg px-3 text-left text-xs font-[560] text-white/66 hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
                Poster
              </button>
            </div>
          )}
        </div>
        <button onClick={() => setHash('/poster/business-stack')} className="hidden min-h-11 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-[12px] font-[560] text-white/78 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60 sm:inline-flex sm:text-[13px]">
          <Sparkles size={14} /> Poster
        </button>
      </div>
    </header>
  )
}

function Panel({ children, className = '', pad = 'p-4' }) {
  return <div className={cn('rounded-lg border border-white/[0.085] bg-[#0A0D10]/88 shadow-[inset_0_1px_0_rgba(255,255,255,.045)]', pad, className)}>{children}</div>
}

function Section({ eyebrow, title, aside, children, dense = false }) {
  return (
    <section className={cn('mx-auto max-w-[1760px] px-safe', dense ? 'py-3 md:py-4' : 'py-5 md:py-6')}>
      <div className="mb-3 flex flex-col gap-2 border-b border-white/[0.075] pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {eyebrow && <p className="font-mono text-[11px] font-semibold uppercase tracking-normal text-white/68">{eyebrow}</p>}
          <h2 className="mt-1 max-w-5xl text-[1.55rem] font-[620] leading-tight tracking-normal text-spacex sm:text-3xl">{title}</h2>
        </div>
        {aside && <p className="max-w-2xl text-[14px] leading-6 text-white/78">{aside}</p>}
      </div>
      {children}
    </section>
  )
}

function Source({ children }) {
  return (
    <p className="source-line mt-2 max-w-full rounded-md border border-white/[0.08] bg-white/[0.026] px-2 py-1 font-mono text-[11px] leading-4 text-white/72">
      <span className="font-semibold uppercase tracking-normal text-cyan/80">SRC</span>
      <span className="text-white/62"> · </span>
      <span className="break-words">{children}</span>
    </p>
  )
}

function SourceChip({ children, label = 'Source' }) {
  if (!children) return null
  return (
    <span title={String(children)} className="source-chip mt-2 inline-flex max-w-full items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.024] px-2 py-1 font-mono text-[10px] uppercase tracking-normal text-white/62">
      <span className="text-cyan/76">{label}</span> <span className="text-white/58">·</span> <span className="min-w-0 truncate normal-case tracking-normal text-white/70">{trimText(children, 74)}</span>
    </span>
  )
}

function MetricPill({ label, value, sub }) {
  return (
    <div className="min-h-[96px] rounded-lg border border-white/[0.09] bg-white/[0.035] p-3 sm:p-3.5">
      <p className="font-mono text-[10px] uppercase tracking-normal text-white/68">{label}</p>
      <p className="mt-1.5 text-2xl font-[700] tracking-normal text-spacex sm:text-3xl">{value}</p>
      {sub && <p className="mt-1.5 text-xs leading-5 text-white/74">{sub}</p>}
    </div>
  )
}

function DataTable({ columns, rows, mobileCard, className = '', maxHeight = 'max-h-[620px]', empty, ariaLabel = 'Disclosure data table' }) {
  return (
    <div className={cn('data-table-shell overflow-hidden rounded-lg border border-white/[0.085] bg-black/22', className)}>
      {mobileCard && (
        <div className="grid gap-2 p-2 md:hidden">
          {rows.map((row, idx) => <div key={row.id ?? idx}>{mobileCard(row, idx)}</div>)}
          {!rows.length && <div className="p-6 text-center text-sm text-white/62">{empty || 'No matching disclosures. Try a broader term or clear the filter.'}</div>}
        </div>
      )}
      <div className={cn(mobileCard && 'hidden md:block')}>
        <div className={cn('overflow-auto overscroll-x-contain', maxHeight)}>
          <table aria-label={ariaLabel} className="data-table min-w-full border-collapse text-left text-[13.5px]">
            <thead className="sticky top-0 z-10 bg-[#101318] text-[11px] uppercase tracking-normal text-white/68">
              <tr>{columns.map((col) => <th key={col.key} className="border-b border-white/[0.095] px-3 py-2.5 font-[650]">{col.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-white/[0.055]">
              {rows.map((row, idx) => (
                <tr key={row.id ?? idx} className="hover:bg-white/[0.035]">
                  {columns.map((col) => <td key={col.key} className={cn('px-3 py-3 align-top leading-6 text-white/82', col.className)}>{col.render ? col.render(row) : row[col.key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <div className="p-8 text-center text-sm text-white/62">{empty || 'No matching disclosures. Try a broader term or clear the filter.'}</div>}
        </div>
      </div>
    </div>
  )
}

function ShareActions({ packet, data, variant = 'business-stack', title, source, compact = false }) {
  const [copied, setCopied] = useState(false)
  const isPacket = Boolean(packet)
  const url = isPacket ? packetUrl(packet) : posterUrl(variant)
  const caption = makeCaption({ type: isPacket ? packet.type : 'poster', title: title || packet?.title || 'SpaceX S‑1 Atlas', source: source || packet?.source, url })
  const label = title || packet?.title || 'SpaceX S‑1 Atlas'
  return (
    <div className={cn('flex flex-wrap gap-2', compact && 'text-xs')}>
      <button onClick={() => shareToDevice({ title: label, caption, url, setCopied })} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-spacex px-4 text-sm font-[650] text-void hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60 sm:flex-none"><Share2 size={15} /> Share</button>
      <button onClick={() => copyText(url, setCopied)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs font-[560] text-white/74 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60"><LinkIcon size={14} /> Copy link</button>
      <button onClick={() => copyText(caption, setCopied)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs font-[560] text-white/74 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60"><Clipboard size={14} /> Copy caption</button>
      <button onClick={async () => { try { await exportPoster({ variant, data, packet, share: true }) } catch { await copyText(caption, setCopied) } }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs font-[560] text-white/74 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60"><Download size={14} /> PNG</button>
      {copied && <span className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs text-cyan">Copied</span>}
    </div>
  )
}

function DisclosurePacket({ packet, data, variant = 'risk-radar' }) {
  if (!packet) {
    return <Panel><p className="text-sm text-white/62">Select a disclosure packet to create a shareable, source-labeled card.</p></Panel>
  }
  const related = findRelatedPackets(packet, data)
  return (
    <Panel pad="p-4" className="relative overflow-hidden">
      <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full border border-white/[0.055]" />
      <p className="font-mono text-[10px] uppercase tracking-normal text-white/62">Disclosure packet · {PACKET_LABELS[packet.type] || packet.type}</p>
      <h3 className="mt-3 text-xl font-[640] leading-6 tracking-normal text-spacex">{packet.title}</h3>
      <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/25 p-3">
        <p className="font-mono text-[9px] uppercase tracking-normal text-white/62">Claim / extracted metric</p>
        <p className="mt-2 text-sm leading-6 text-white/76">{packet.detail}</p>
      </div>
      <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="font-mono text-[9px] uppercase tracking-normal text-white/62">Source context</p>
        <Source>{packet.source}</Source>
      </div>
      {related.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.018] p-3">
          <p className="font-mono text-[9px] uppercase tracking-normal text-white/62">Related packets</p>
          <div className="mt-2 grid gap-2">
            {related.map((item) => (
              <button key={item.id} onClick={() => setHash(item.hash)} className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-left text-xs leading-5 text-white/70 hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
                <span className="font-mono text-[9px] uppercase tracking-normal text-white/58">{PACKET_LABELS[item.type] || item.type}</span>
                <span className="mt-1 block text-white/78">{trimText(item.title, 110)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => setHash(packet.hash)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-spacex px-3 text-xs font-[650] text-void hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">Open packet <ChevronRight size={14} /></button>
        {packet.url && <a href={packet.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs font-[560] text-white/74 hover:bg-white/[0.06]"><ExternalLink size={14} /> SEC asset</a>}
      </div>
      <div className="mt-4 border-t border-white/[0.06] pt-4"><ShareActions packet={packet} data={data} variant={variant} /></div>
    </Panel>
  )
}

function FilingReadPanel({ data }) {
  const keys = ['Filing status', 'Ticker requested', 'Use of proceeds', 'Voting design', 'Dividend policy']
  const cards = keys.map((key) => factFor(data, key)).filter(Boolean)
  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-normal text-white/58">90-second filing read</p>
        <p className="hidden text-[11px] text-white/62 sm:block">What this S‑1 says before the tables</p>
      </div>
      <div className="grid gap-2">
        {cards.map((fact) => (
          <button key={fact.k} onClick={() => setHash('/atlas', { q: fact.k, type: 'fact' })} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3 text-left transition hover:border-white/16 hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
            <span className="block text-sm font-[650] leading-5 text-white/86">{fact.k}</span>
            <span className="mt-1 block text-xs leading-5 text-white/68">{fact.v}</span>
            <span className="mt-2 block font-mono text-[9px] leading-4 text-white/62">SRC · {fact.src}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function AuditCoverageRow({ data }) {
  const items = [
    ['Sections', data.sourceCounts.sections],
    ['Exhibits', data.sourceCounts.exhibits],
    ['Graphics / OCR', data.sourceCounts.graphics],
    ['Risk factors', data.sourceCounts.risk_headings],
  ]
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.018] px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-normal text-white/62">{label}</p>
          <p className="mt-1 text-lg font-[650] text-white/84">{value}</p>
        </div>
      ))}
    </div>
  )
}

function BriefingStat({ label, value, note, tone = 'default' }) {
  const color = tone === 'red' ? 'text-red' : tone === 'cyan' ? 'text-cyan' : tone === 'amber' ? 'text-amber' : 'text-spacex'
  return (
    <div className="rounded-lg border border-white/[0.09] bg-black/20 p-3">
      <p className="font-mono text-[10px] uppercase tracking-normal text-white/62">{label}</p>
      <p className={cn('mt-1 text-2xl font-[720] tracking-normal sm:text-3xl', color)}>{value}</p>
      <p className="mt-1.5 text-xs leading-5 text-white/70">{note}</p>
    </div>
  )
}

function BriefingReadout({ data }) {
  const y2024 = periodRow(data.financials.consolidated, '2024')
  const y2025 = periodRow(data.financials.consolidated, '2025')
  const q12025 = periodRow(data.financials.consolidated, 'Q1 2025')
  const q12026 = periodRow(data.financials.consolidated, 'Q1 2026')
  const aiQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'AI')
  const connectivityQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'Connectivity')
  const latest = balanceRow(data.financials.balance, 'Mar 31 2026')
  const cashAndSec = Number(latest?.cash || 0) + Number(latest?.marketable_securities || 0)
  const controlled = factFor(data, 'Controlled company')
  const voting = factFor(data, 'Voting design')
  const rows = [
    {
      label: 'Financial direction',
      value: `${formatPct(pctChange(y2025?.revenue, y2024?.revenue), 1)} FY revenue`,
      detail: `2025 revenue ${money(y2025?.revenue)}; Q1 revenue ${formatPct(pctChange(q12026?.revenue, q12025?.revenue), 1)} year over year.`,
      source: 'financials.consolidated revenue rows',
      tone: 'cyan',
    },
    {
      label: 'Profitability tension',
      value: `${formatPlainPct(margin(q12026?.op_income, q12026?.revenue), 1)} Q1 op. margin`,
      detail: `Q1 operating income ${money(q12026?.op_income)} and net income ${money(q12026?.net_income)} on ${money(q12026?.revenue)} revenue.`,
      source: q12026?.source,
      tone: 'red',
    },
    {
      label: 'Segment economics',
      value: `${money(connectivityQ1?.op_income)} vs ${money(aiQ1?.op_income)}`,
      detail: `Connectivity Q1 operating income compared with AI Q1 operating income; AI capex was ${money(aiQ1?.capex)}.`,
      source: 'financials.segments[period="Q1 2026"]',
      tone: 'amber',
    },
    {
      label: 'Governance / control',
      value: 'Controlled company',
      detail: `${voting?.v || 'Dual-class voting terms disclosed.'}`,
      source: `${controlled?.src || ''}${controlled?.src && voting?.src ? '; ' : ''}${voting?.src || ''}`,
      tone: 'default',
    },
    {
      label: 'Liquidity marker',
      value: money(cashAndSec),
      detail: 'Cash plus marketable securities at Mar. 31, 2026, before final offering proceeds are known.',
      source: 'financials.balance[date="Mar 31 2026"]',
      tone: 'default',
    },
  ]
  return (
    <Panel pad="p-4 sm:p-5" className="h-full border-white/[0.13] bg-[#0A0D12]/95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-normal text-cyan/78">Critical readout</p>
          <h2 className="mt-1 text-2xl font-[690] tracking-normal text-spacex">What to understand first</h2>
        </div>
        <FileSearch size={18} className="mt-1 text-white/58" />
      </div>
      <div className="mt-4 divide-y divide-white/[0.075]">
        {rows.map((row) => (
          <button key={row.label} onClick={() => setHash(row.label.includes('Governance') ? '/governance' : row.label.includes('Segment') || row.label.includes('Financial') || row.label.includes('Profitability') || row.label.includes('Liquidity') ? '/financials' : '/atlas')} className="grid w-full gap-2 py-3 text-left transition hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60 sm:grid-cols-[10rem_minmax(0,1fr)] sm:px-2">
            <p className="font-mono text-[10px] uppercase tracking-normal text-white/62">{row.label}</p>
            <div>
              <p className={cn('text-lg font-[700] leading-6 tracking-normal', row.tone === 'red' ? 'text-red' : row.tone === 'cyan' ? 'text-cyan' : row.tone === 'amber' ? 'text-amber' : 'text-spacex')}>{row.value}</p>
              <p className="mt-1 text-[13px] leading-6 text-white/76">{row.detail}</p>
              <p className="mt-1 font-mono text-[10px] leading-4 text-white/62">SRC · {row.source}</p>
            </div>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function FilingStatusStrip({ data }) {
  const filingStatus = factFor(data, 'Filing status')
  const ticker = factFor(data, 'Ticker requested')
  const basis = factFor(data, 'Basis of presentation')
  const counts = sourceCounts(data)
  const items = [
    { label: 'Filing status', value: 'Preliminary S-1', note: 'Share count and price fields remain blank.', source: filingStatus?.src },
    { label: 'Listing marker', value: 'SPCX requested', note: ticker?.v, source: ticker?.src },
    { label: 'Presentation basis', value: 'Recast financials', note: basis?.v, source: basis?.src },
    { label: 'Evidence base', value: 'S-1 package only', note: `${counts.sections} sections, ${counts.exhibits} exhibits, ${counts.risk_headings} risk factors.`, source: data.generatedFrom },
  ]
  return (
    <div className="mt-4 grid gap-2 border-t border-white/[0.075] pt-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-white/[0.065] bg-black/14 px-3 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-normal text-white/62">{item.label}</p>
          <p className="mt-1 text-sm font-[700] leading-5 text-white/88">{item.value}</p>
          <p className="mt-1 text-[12px] leading-5 text-white/70">{trimText(item.note, 118)}</p>
          <SourceChip>{item.source}</SourceChip>
        </div>
      ))}
    </div>
  )
}

function ExecutiveMemo({ data }) {
  const y2024 = periodRow(data.financials.consolidated, '2024')
  const y2025 = periodRow(data.financials.consolidated, '2025')
  const q12025 = periodRow(data.financials.consolidated, 'Q1 2025')
  const q12026 = periodRow(data.financials.consolidated, 'Q1 2026')
  const latest = balanceRow(data.financials.balance, 'Mar 31 2026')
  const q1CashFlow = periodRow(data.financials.cash_flows, 'Q1 2026')
  const connectivityQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'Connectivity')
  const aiQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'AI')
  const cashAndSec = Number(latest?.cash || 0) + Number(latest?.marketable_securities || 0)
  const filingStatus = factFor(data, 'Filing status')
  const voting = factFor(data, 'Voting design')
  const controlled = factFor(data, 'Controlled company')
  const proofPoints = [
    {
      label: 'Revenue scale',
      value: `${money(y2025?.revenue)} / ${money(q12026?.revenue)}`,
      detail: `2025 revenue grew ${formatPct(pctChange(y2025?.revenue, y2024?.revenue), 1)}; Q1 revenue grew ${formatPct(pctChange(q12026?.revenue, q12025?.revenue), 1)} year over year.`,
      basis: 'Filed values; growth rates derived.',
      source: 'financials.consolidated revenue rows',
      tone: 'cyan',
    },
    {
      label: 'Profitability tension',
      value: formatPlainPct(margin(q12026?.op_income, q12026?.revenue), 1),
      detail: `Q1 operating income moved from ${money(q12025?.op_income)} to ${money(q12026?.op_income)}; Q1 net income was ${money(q12026?.net_income)}.`,
      basis: 'Filed values; margin derived.',
      source: q12026?.source,
      tone: 'red',
    },
    {
      label: 'Segment split',
      value: `${money(connectivityQ1?.op_income)} vs ${money(aiQ1?.op_income)}`,
      detail: `Connectivity produced positive Q1 operating income; AI reported ${money(aiQ1?.capex)} of Q1 segment capex.`,
      basis: 'Filed segment values.',
      source: 'financials.segments[period="Q1 2026"]',
      tone: 'amber',
    },
    {
      label: 'Funding pressure',
      value: `${money(cashAndSec)} liquid assets`,
      detail: `Q1 operating cash flow was ${money(q1CashFlow?.operating)} against ${money(q1CashFlow?.investing)} of investing cash flow.`,
      basis: 'Filed cash flow and balance sheet values; liquid-assets sum derived.',
      source: 'financials.balance[date="Mar 31 2026"]; financials.cash_flows[period="Q1 2026"]',
      tone: 'default',
    },
    {
      label: 'Control and blanks',
      value: 'Controlled company',
      detail: `${voting?.v || 'Dual-class voting terms disclosed.'} Offering price and share-count fields remain blank.`,
      basis: 'Filed governance and preliminary offering language.',
      source: `${filingStatus?.src || ''}; ${voting?.src || ''}; ${controlled?.src || ''}`,
      tone: 'default',
    },
  ]
  return (
    <section className="mx-auto max-w-[1760px] px-safe py-3 md:py-4">
      <Panel pad="p-4 sm:p-5" className="memo-panel overflow-hidden border-spacex/14">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,.9fr)_minmax(500px,1.1fr)]">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-normal text-cyan/76">SpaceX S-1 Atlas · Executive memo</p>
            <h1 className="mt-2 max-w-5xl text-[2rem] font-[700] leading-[1.08] tracking-normal text-spacex sm:text-4xl lg:text-5xl">{EXECUTIVE_CONCLUSION}</h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-white/78">The filing shows revenue scale and a clearer Connectivity profit base, but Q1 losses, AI capital intensity, Starship execution, and controlled-company terms define the underwriting debate. This is a source-grounded filing review, not investment advice.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setHash('/financials')} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-spacex px-4 text-sm font-[700] text-void hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">Open financial workbench <ChevronRight size={15} /></button>
              <button onClick={() => scrollToId('question-tree')} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-4 text-sm font-[620] text-white/78 hover:bg-white/[0.065] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60"><FileSearch size={15} /> Open question tree</button>
              <button onClick={() => setHash('/atlas')} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/12 bg-white/[0.03] px-4 text-sm font-[620] text-white/72 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60"><Search size={15} /> Open source atlas</button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/16">
            {proofPoints.map((point) => (
              <button key={point.label} onClick={() => setHash(point.label === 'Control and blanks' ? '/governance' : point.label === 'Segment split' ? '/segments' : '/financials')} className="grid w-full gap-2 border-b border-white/[0.055] p-3 text-left transition last:border-b-0 hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                <span>
                  <span className="block font-mono text-[10px] uppercase tracking-normal text-white/66">{point.label}</span>
                  <span className={cn('mt-1 block text-xl font-[720] tracking-normal', point.tone === 'red' ? 'text-red' : point.tone === 'cyan' ? 'text-cyan' : point.tone === 'amber' ? 'text-amber' : 'text-spacex')}>{point.value}</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] leading-6 text-white/76">{point.detail}</span>
                  <span className="mt-1 block font-mono text-[10px] uppercase tracking-normal text-white/60">{point.basis}</span>
                  <SourceChip>{point.source}</SourceChip>
                </span>
              </button>
            ))}
          </div>
        </div>
        <FilingStatusStrip data={data} />
      </Panel>
    </section>
  )
}

function ThesisAntiThesisPanel({ data }) {
  const latest = balanceRow(data.financials.balance, 'Mar 31 2026')
  const cashAndSec = Number(latest?.cash || 0) + Number(latest?.marketable_securities || 0)
  const q12026 = periodRow(data.financials.consolidated, 'Q1 2026')
  const connectivityQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'Connectivity')
  const aiQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'AI')
  const starlink = periodRow(data.financials.metrics.starlink, 'Q1 2026')
  const thesisRows = [
    {
      title: 'Connectivity has the clearest filed economics.',
      body: `Q1 Connectivity revenue was ${money(connectivityQ1?.revenue)} with ${money(connectivityQ1?.op_income)} operating income and ${formatPlainPct(margin(connectivityQ1?.adj_ebitda, connectivityQ1?.revenue), 1)} Adjusted EBITDA margin, as filed.`,
      source: 'financials.segments[Connectivity · Q1 2026]',
      route: '/financials',
    },
    {
      title: 'Starlink scale is visible in the operating metrics.',
      body: `The Q1 2026 Starlink metric shows ${starlink?.subscribers_m}M subscribers.`,
      source: 'financials.metrics.starlink[period="Q1 2026"]',
      route: '/segments',
    },
    {
      title: 'Liquidity exists before final offering proceeds are known.',
      body: `Cash plus marketable securities were ${money(cashAndSec)} at Mar. 31, 2026.`,
      source: 'financials.balance[date="Mar 31 2026"]',
      route: '/financials',
    },
  ]
  const antiRows = [
    {
      title: 'Q1 profitability moved sharply negative.',
      body: `Q1 operating margin was ${formatPlainPct(margin(q12026?.op_income, q12026?.revenue), 1)} on ${money(q12026?.revenue)} revenue.`,
      source: q12026?.source,
      route: '/financials',
    },
    {
      title: 'AI changes the capital burden.',
      body: `Q1 AI capex was ${money(aiQ1?.capex)}, or ${formatPlainPct(margin(aiQ1?.capex, aiQ1?.revenue), 1)} of Q1 AI revenue.`,
      source: 'financials.segments[AI · Q1 2026]',
      route: '/financials',
    },
    {
      title: 'Execution and control limits are central, not footnotes.',
      body: 'Risk factors identify Starship cadence, AI execution, regulatory approvals, and controlled-company governance as constraints to inspect.',
      source: 'Risk Factors; ownership and capital-stock sections',
      route: '/risks',
    },
  ]
  const Column = ({ title, rows, tone }) => (
    <div className="rounded-lg border border-white/[0.08] bg-black/18 p-3">
      <p className={cn('font-mono text-[10px] uppercase tracking-normal', tone === 'cyan' ? 'text-cyan/72' : 'text-amber/78')}>{title}</p>
      <div className="mt-3 divide-y divide-white/[0.065]">
        {rows.map((row) => (
          <button key={row.title} onClick={() => setHash(row.route)} className="block w-full py-3 text-left first:pt-0 last:pb-0 hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
            <p className="text-base font-[700] leading-6 text-white/88">{row.title}</p>
            <p className="mt-1 text-[13px] leading-6 text-white/68">{row.body}</p>
            <SourceChip>{row.source}</SourceChip>
          </button>
        ))}
      </div>
    </div>
  )
  return (
    <Section dense eyebrow="Thesis / anti-thesis" title="The filing is a growth story paired with capital intensity, execution risk, and control limits.">
      <div className="grid gap-3 lg:grid-cols-2">
        <Column title="What the filed data supports" rows={thesisRows} tone="cyan" />
        <Column title="What the filed data complicates" rows={antiRows} tone="amber" />
      </div>
    </Section>
  )
}

function SegmentQualityMatrix({ data, onPacket }) {
  const period = 'Q1 2026'
  const rows = segmentRowsFor(data, period)
  const totalRevenue = segmentTotal(data, period, 'revenue')
  const totalCapex = segmentTotal(data, period, 'capex')
  const reads = {
    Connectivity: 'Economic base funding the story.',
    AI: 'Capital burden with option value still to prove in filed results.',
    Space: 'Strategic gate tied to Starship cadence and internal launch demand.',
  }
  const ordered = ['Connectivity', 'AI', 'Space'].map((name) => rows.find((row) => row.segment === name)).filter(Boolean)
  return (
    <Section dense eyebrow="Segment quality matrix" title="Connectivity funds the story; AI changes the capital burden." aside="Q1 2026 filed segment values with derived ratios. This is a matrix, not a scorecard.">
      <Panel pad="p-0" className="overflow-hidden">
        <div className="grid gap-2 p-2 md:hidden">
          {ordered.map((row) => {
            const packet = financialPacket(data, `${row.segment} segment · ${period}`)
            const revenueMix = margin(row.revenue, totalRevenue)
            const opMargin = margin(row.op_income, row.revenue)
            const capexIntensity = margin(row.capex, row.revenue)
            const opNote = opMarginExplainer(row, opMargin)
            return (
              <button key={row.segment} onClick={() => packet ? onPacket?.(packet) : setHash('/financials')} className="rounded-lg border border-white/[0.075] bg-white/[0.026] p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-[720]" style={{ color: SEGMENT_COLORS[row.segment] }}>{row.segment}</p>
                    <p className="mt-1 text-sm font-[650] leading-5 text-white/84">{reads[row.segment]}</p>
                  </div>
                  <span className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[10px] text-white/66">{period}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs leading-5">
                  <span className="text-white/70">Revenue <b className="block font-mono text-sm text-white/88">{money(row.revenue)}</b></span>
                  <span className="text-white/70">Rev. mix <b className="block font-mono text-sm text-white/88">{formatPlainPct(revenueMix, 1)}</b></span>
                  <span className="text-white/70">{opMarginLabel(opMargin)} <b className={cn('block font-mono text-sm', signedClass(opMargin))}>{formatPlainPct(opMargin, 1)}</b></span>
                  <span className="text-white/70">Capex / revenue <b className="block font-mono text-sm text-amber">{formatPlainPct(capexIntensity, 1)}</b></span>
                </div>
                {opNote && <p className="mt-2 rounded-md border border-red/18 bg-red/10 px-2 py-1.5 text-[11px] leading-4 text-white/72">{opNote}</p>}
                <SourceChip>{packet?.source || 'Segment tables / summary'}</SourceChip>
              </button>
            )
          })}
        </div>
        <div className="hidden overflow-auto overscroll-x-contain md:block">
          <table className="analyst-table min-w-[900px] w-full border-collapse text-left">
            <thead className="bg-[#101318] font-mono uppercase tracking-normal">
              <tr>
                {['Segment', 'Revenue', 'Rev. mix', 'Op. margin / loss', 'Adj. EBITDA margin', 'Capex / revenue', 'Capex mix', 'Filing read'].map((label, idx) => <th key={label} className={cn('border-b border-white/[0.08] px-3 py-2.5 font-[650]', idx === 0 && 'sticky-matrix-col')}>{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {ordered.map((row) => {
                const packet = financialPacket(data, `${row.segment} segment · ${period}`)
                const revenueMix = margin(row.revenue, totalRevenue)
                const opMargin = margin(row.op_income, row.revenue)
                const ebitdaMargin = margin(row.adj_ebitda, row.revenue)
                const capexIntensity = margin(row.capex, row.revenue)
                const capexMix = margin(row.capex, totalCapex)
                return (
                  <tr key={row.segment} className="hover:bg-white/[0.025]">
                    <td className="sticky-matrix-col px-3 py-3 align-top">
                      <button onClick={() => packet ? onPacket?.(packet) : setHash('/financials')} className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
                        <span className="block text-lg font-[720]" style={{ color: SEGMENT_COLORS[row.segment] }}>{row.segment}</span>
                        <span className="mt-1 block font-mono text-[10px] uppercase tracking-normal text-white/62">{period}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3 align-top font-mono text-white/84">{money(row.revenue)}</td>
                    <td className="px-3 py-3 align-top font-mono text-white/78">{formatPlainPct(revenueMix, 1)}</td>
                    <td className={cn('px-3 py-3 align-top font-mono', signedClass(opMargin))} title={opMarginExplainer(row, opMargin) || 'Operating income / revenue'}>{formatPlainPct(opMargin, 1)}</td>
                    <td className={cn('px-3 py-3 align-top font-mono', signedClass(ebitdaMargin))}>{formatPlainPct(ebitdaMargin, 1)}</td>
                    <td className="px-3 py-3 align-top font-mono text-amber">{formatPlainPct(capexIntensity, 1)}</td>
                    <td className="px-3 py-3 align-top font-mono text-amber">{formatPlainPct(capexMix, 1)}</td>
                    <td className="px-3 py-3 align-top">
                      <p className="max-w-sm text-sm font-[650] leading-5 text-white/82">{reads[row.segment]}</p>
                      <SourceChip>{packet?.source || 'Segment tables / summary'}</SourceChip>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-white/[0.07] px-3 py-2 text-xs leading-5 text-white/64">Filed values: revenue, operating income, Adjusted EBITDA, as filed, and capex. Derived values: revenue mix, operating margin/loss as operating income ÷ revenue, capex / revenue, and capex mix. Negative values below −100% mean the operating loss is larger than revenue.</div>
      </Panel>
    </Section>
  )
}

function ValueCreationBridge({ data }) {
  const y2024 = periodRow(data.financials.consolidated, '2024')
  const y2025 = periodRow(data.financials.consolidated, '2025')
  const q12025 = periodRow(data.financials.consolidated, 'Q1 2025')
  const q12026 = periodRow(data.financials.consolidated, 'Q1 2026')
  const q1CashFlow = periodRow(data.financials.cash_flows, 'Q1 2026')
  const aiQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'AI')
  const q1Capex = segmentTotal(data, 'Q1 2026', 'capex')
  const rows = [
    {
      title: 'Growth is real; operating income worsened in 2025.',
      metric: `${formatPct(pctChange(y2025?.revenue, y2024?.revenue), 1)} revenue`,
      detail: `Revenue moved ${money(y2024?.revenue)} to ${money(y2025?.revenue)} while operating income moved ${money(y2024?.op_income)} to ${money(y2025?.op_income)}.`,
      source: 'financials.consolidated[2024, 2025]',
      tone: 'cyan',
    },
    {
      title: 'Q1 revenue grew while losses widened.',
      metric: `${formatPct(pctChange(q12026?.revenue, q12025?.revenue), 1)} revenue`,
      detail: `Q1 operating income moved ${money(q12025?.op_income)} to ${money(q12026?.op_income)} and Q1 net income moved ${money(q12025?.net_income)} to ${money(q12026?.net_income)}.`,
      source: 'financials.consolidated[Q1 2025, Q1 2026]',
      tone: 'red',
    },
    {
      title: 'The buildout exceeded Q1 operating cash flow.',
      metric: `${money(q1CashFlow?.operating)} OCF`,
      detail: `Q1 operating cash flow was ${money(q1CashFlow?.operating)}; investing cash flow was ${money(q1CashFlow?.investing)} and Q1 segment capex totaled ${money(q1Capex)}.`,
      source: 'financials.cash_flows[Q1 2026]; financials.segments[Q1 2026].capex',
      tone: 'amber',
    },
    {
      title: 'AI dominated Q1 segment capex.',
      metric: formatPlainPct(margin(aiQ1?.capex, q1Capex), 1),
      detail: `AI capex was ${money(aiQ1?.capex)} of ${money(q1Capex)} total Q1 segment capex.`,
      source: 'financials.segments[AI · Q1 2026]',
      tone: 'amber',
    },
  ]
  return (
    <Section dense eyebrow="Value creation / capital intensity bridge" title="Revenue growth is not yet translating cleanly to operating income.">
      <div className="grid gap-3 lg:grid-cols-4">
        {rows.map((row) => (
          <Panel key={row.title} pad="p-3" className={cn(row.tone === 'red' && 'border-red/18 bg-red/10', row.tone === 'amber' && 'border-amber/18 bg-amber/10', row.tone === 'cyan' && 'border-cyan/18 bg-cyan/10')}>
            <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">Filed / derived bridge</p>
            <p className={cn('mt-1 text-2xl font-[720] tracking-normal', row.tone === 'red' ? 'text-red' : row.tone === 'amber' ? 'text-amber' : 'text-cyan')}>{row.metric}</p>
            <h3 className="mt-2 text-base font-[700] leading-6 text-white/88">{row.title}</h3>
            <p className="mt-2 text-[13px] leading-6 text-white/68">{row.detail}</p>
            <SourceChip>{row.source}</SourceChip>
          </Panel>
        ))}
      </div>
    </Section>
  )
}

function QuestionTree({ data }) {
  const lenses = data.debate?.lenses || []
  const facts = data.debate?.filedFacts || {}
  const lens = (id) => lenses.find((item) => item.id === id)
  const starshipRisk = riskPacketFor(data, /Starship at scale/i)
  const aiRisk = riskPacketFor(data, /AI segment is capital intensive/i)
  const controlRisk = riskPacketFor(data, /dual class structure concentrates voting control/i)
  const q1Rows = segmentRowsFor(data, 'Q1 2026')
  const totalCapex = segmentTotal(data, 'Q1 2026', 'capex')
  const aiQ1 = q1Rows.find((row) => row.segment === 'AI')
  const connectivityQ1 = q1Rows.find((row) => row.segment === 'Connectivity')
  const questions = [
    {
      id: 'segment-tug',
      question: 'Can Connectivity economics carry the model while AI consumes capital?',
      answer: `Connectivity Q1 operating income was ${money(connectivityQ1?.op_income)}; AI Q1 capex was ${money(aiQ1?.capex)} (${formatPlainPct(margin(aiQ1?.capex, totalCapex), 1)} of Q1 segment capex).`,
      source: 'financials.segments[Q1 2026]',
      route: '/debate?lens=segment-tug',
    },
    {
      id: 'supply-mechanics',
      question: 'What is still unknowable before final pricing?',
      answer: facts.ipoBlanks?.detail || 'Final share-count and pricing fields remain blank in the preliminary prospectus.',
      source: facts.ipoBlanks?.source,
      route: '/debate?lens=supply-mechanics',
    },
    {
      id: 'control',
      question: 'What do public Class A holders actually control?',
      answer: facts.voting?.detail || factFor(data, 'Voting design')?.v,
      source: facts.voting?.source || factFor(data, 'Voting design')?.src,
      route: '/debate?lens=control',
    },
    {
      id: 'risk-claims',
      question: 'Does Starship cadence gate the strategy?',
      answer: 'The risk-factor heading ties Starship delays to next-generation satellites, satellite-to-mobile connectivity, and orbital AI compute.',
      source: starshipRisk?.source || 'Risk Factors',
      route: starshipRisk?.hash || '/risks',
    },
    {
      id: 'valuation',
      question: 'What valuation math is allowed before offering terms are final?',
      answer: lens('valuation')?.question || 'Scenario math can compare user inputs against filed revenue, margins, capex, and losses; the filing does not provide a final valuation.',
      source: data.debate?.scanCaveat,
      route: '/debate?lens=valuation',
    },
    {
      id: 'ai-risk',
      question: 'How much does AI change capital intensity?',
      answer: aiRisk?.title || 'Risk factors identify the AI segment as capital intensive and operating in a nascent market.',
      source: aiRisk?.source || 'Risk Factors',
      route: aiRisk?.hash || '/risks',
    },
  ]
  return (
    <Section id="question-tree" dense eyebrow="Question tree" title="Start with the investor question, then open the evidence.">
      <div id="question-tree" className="grid gap-3 lg:grid-cols-[.62fr_1.38fr]">
        <Panel pad="p-4" className="self-start border-spacex/14">
          <p className="font-mono text-[10px] uppercase tracking-normal text-cyan/70">Debate lens scaffold</p>
          <h3 className="mt-2 text-2xl font-[700] leading-7 tracking-normal text-white">Question prompts are not evidence.</h3>
          <p className="mt-3 text-sm leading-6 text-white/68">{data.debate?.scanCaveat}</p>
          <button onClick={() => setHash('/debate')} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs font-[620] text-white/72 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">Open full Debate Map <ChevronRight size={14} /></button>
        </Panel>
        <div className="grid gap-2">
          {questions.map((item, idx) => (
            <button key={item.id} onClick={() => setHash(item.route)} className="grid gap-3 rounded-lg border border-white/[0.08] bg-black/18 p-3 text-left transition hover:border-white/18 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60 md:grid-cols-[4rem_minmax(0,1fr)_auto] md:items-start">
              <span className="font-mono text-[10px] uppercase tracking-normal text-white/58">Q{idx + 1}</span>
              <span>
                <span className="block text-base font-[720] leading-6 text-white/88">{item.question}</span>
                <span className="mt-1 block text-[13px] leading-6 text-white/66">{item.answer}</span>
                <SourceChip>{item.source}</SourceChip>
              </span>
              <span className="hidden min-h-9 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.025] px-2 font-mono text-[10px] uppercase tracking-normal text-white/62 md:inline-flex">Open <ChevronRight size={12} /></span>
            </button>
          ))}
        </div>
      </div>
    </Section>
  )
}

function RiskControlMap({ data }) {
  const starshipRisk = riskPacketFor(data, /Starship at scale/i)
  const spectrumRisk = riskPacketFor(data, /spectrum authorizations/i)
  const aiRisk = riskPacketFor(data, /AI segment is capital intensive/i)
  const capitalRisk = riskPacketFor(data, /significant capital expenditures/i)
  const controlRisk = riskPacketFor(data, /dual class structure concentrates voting control/i)
  const starlink = data.financials.metrics.starlink
  const sQ1 = periodRow(starlink, 'Q1 2026')
  const sQ1Prev = periodRow(starlink, 'Q1 2025')
  const aiQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'AI')
  const connectivityQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'Connectivity')
  const q1CashFlow = periodRow(data.financials.cash_flows, 'Q1 2026')
  const rows = [
    {
      dependency: 'Starship cadence must scale.',
      evidence: 'The filing ties Starship to V3 satellites, satellite-to-mobile connectivity, orbital AI compute, and lunar/interplanetary objectives.',
      metric: '40 Falcon launches in Q1 2026; Starship cadence is a risk-factor dependency, not quantified as a forecast here.',
      question: 'Which growth vectors are delayed if launch cadence does not scale?',
      packet: starshipRisk,
    },
    {
      dependency: 'Connectivity must keep compounding despite ARPU pressure.',
      evidence: `Starlink subscribers were ${sQ1?.subscribers_m}M in Q1 2026; ARPU moved from $${sQ1Prev?.arpu} to $${sQ1?.arpu} year over year.`,
      metric: `Connectivity Q1 operating income ${money(connectivityQ1?.op_income)}.`,
      question: 'Can subscriber growth offset lower ARPU while preserving operating income?',
      packet: spectrumRisk,
    },
    {
      dependency: 'AI compute spend must convert into durable filed economics.',
      evidence: `AI Q1 revenue was ${money(aiQ1?.revenue)} with operating income of ${money(aiQ1?.op_income)} and capex of ${money(aiQ1?.capex)}.`,
      metric: `AI capex / revenue ${formatPlainPct(margin(aiQ1?.capex, aiQ1?.revenue), 1)}.`,
      question: 'What evidence would show AI capex becoming operating income rather than only asset buildout?',
      packet: aiRisk,
    },
    {
      dependency: 'Capital access must remain available while investing outflows are high.',
      evidence: `Q1 operating cash flow was ${money(q1CashFlow?.operating)} and investing cash flow was ${money(q1CashFlow?.investing)}.`,
      metric: 'Filed risk factors warn on capital expenditures and financing availability.',
      question: 'How much of the buildout depends on operating cash flow versus external financing?',
      packet: capitalRisk,
    },
    {
      dependency: 'Public holders must accept limited control.',
      evidence: factFor(data, 'Voting design')?.v || 'Dual-class voting and controlled-company status are disclosed.',
      metric: factFor(data, 'Controlled company')?.v || 'Controlled-company status disclosed.',
      question: 'Which decisions can Class A holders influence after the offering?',
      packet: controlRisk,
    },
  ]
  return (
    <Section dense eyebrow="Risk / control map" title="Start with the operating dependencies; use the radar only to locate exact risk language.">
      <Panel pad="p-0" className="overflow-hidden">
        <div className="grid gap-2 p-2 md:hidden">
          {rows.map((row, idx) => (
            <button key={row.dependency} onClick={() => row.packet ? setHash(row.packet.hash) : setHash('/risks')} className="rounded-lg border border-white/[0.075] bg-white/[0.026] p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
              <div className="flex items-start gap-3">
                <span className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[10px] text-white/66">R{idx + 1}</span>
                <div>
                  <p className="text-base font-[720] leading-6 text-white/90">{row.dependency}</p>
                  <p className="mt-1 text-[13px] leading-6 text-white/74">{row.evidence}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 rounded-md bg-black/18 p-2 text-xs leading-5 text-white/72">
                <p><span className="font-mono uppercase text-white/62">Metric</span> · {row.metric}</p>
                <p><span className="font-mono uppercase text-white/62">Question</span> · {row.question}</p>
              </div>
              <SourceChip>{row.packet?.source || 'Risk Factors; financials tables'}</SourceChip>
            </button>
          ))}
        </div>
        <div className="hidden overflow-auto overscroll-x-contain md:block">
          <table className="analyst-table min-w-[920px] w-full border-collapse text-left">
            <thead className="bg-[#101318] font-mono uppercase tracking-normal">
              <tr>
                {['What must be true', 'Filed evidence', 'Related metric', 'Open question', 'Risk packet'].map((label, idx) => <th key={label} className={cn('border-b border-white/[0.08] px-3 py-2.5 font-[650]', idx === 0 && 'sticky-matrix-col')}>{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((row) => (
                <tr key={row.dependency} className="hover:bg-white/[0.025]">
                  <td className="sticky-matrix-col px-3 py-3 align-top text-base font-[720] leading-6 text-white/88">{row.dependency}</td>
                  <td className="px-3 py-3 align-top text-white/74">{row.evidence}</td>
                  <td className="px-3 py-3 align-top text-white/74">{row.metric}</td>
                  <td className="px-3 py-3 align-top text-white/74">{row.question}</td>
                  <td className="px-3 py-3 align-top">
                    {row.packet ? (
                      <button onClick={() => setHash(row.packet.hash)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[11px] text-white/68 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">Open packet <ChevronRight size={12} /></button>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-normal text-white/58">Risk Factors</span>
                    )}
                    <SourceChip>{row.packet?.source || 'Risk Factors; financials tables'}</SourceChip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-3 py-3">
          <p className="text-xs leading-5 text-white/62">No severity or probability score is assigned. Rows pair filed risk language with filed or derived operating metrics.</p>
          <button onClick={() => setHash('/risks')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red/20 bg-red/10 px-3 text-xs font-[620] text-white/78 hover:bg-red/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60"><Radar size={14} /> Open visual Risk Radar</button>
        </div>
      </Panel>
    </Section>
  )
}

function EvidenceDrilldown({ data, packet, onPacket }) {
  return (
    <Section dense eyebrow="Evidence workbench" title="Packets, source coverage, and share tools stay below the memo spine.">
      <details className="group rounded-lg border border-white/[0.08] bg-[#080B0E]/72">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
          <span>
            <span className="block text-sm font-[650] leading-5 text-white/84">Open the audit workbench when you need source rows, packet sharing, or the operating-stack reference.</span>
            <span className="mt-1 block text-xs leading-5 text-white/68">{sourceCountLine(sourceCounts(data))}</span>
          </span>
          <span className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.026] px-2 font-mono text-[10px] uppercase tracking-normal text-white/66">
            <span className="group-open:hidden">Open</span><span className="hidden group-open:inline">Close</span> <ChevronRight size={12} className="transition group-open:rotate-90" />
          </span>
        </summary>
        <div className="grid gap-3 border-t border-white/[0.07] p-3 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid gap-3 lg:grid-cols-2">
            <FilingReadPanel data={data} />
            <Panel pad="p-4" className="self-start">
              <p className="font-mono text-[10px] uppercase tracking-normal text-white/62">Audit coverage</p>
              <p className="mt-2 text-sm leading-6 text-white/72">Source plumbing is still available, but it is no longer the first reading flow.</p>
              <AuditCoverageRow data={data} />
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setHash('/sources')} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs font-[620] text-white/76 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60"><Database size={14} /> Full source text</button>
                <button onClick={() => setHash('/poster/business-stack')} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs font-[620] text-white/76 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60"><Sparkles size={14} /> Poster / share</button>
              </div>
              <div className="mt-4"><ShareActions data={data} variant="business-stack" title="SpaceX S-1 Atlas" compact /></div>
            </Panel>
            <div className="lg:col-span-2">
              <Panel pad="p-3">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-normal text-white/62">Operating stack reference</p>
                <BusinessStack data={data} onPacket={onPacket} />
              </Panel>
            </div>
          </div>
          <DisclosurePacket packet={packet} data={data} variant="business-stack" />
        </div>
      </details>
    </Section>
  )
}

function OverviewHero({ data }) {
  const filingStatus = factFor(data, 'Filing status')
  const ticker = factFor(data, 'Ticker requested')
  const y2025 = periodRow(data.financials.consolidated, '2025')
  const q12026 = periodRow(data.financials.consolidated, 'Q1 2026')
  const starlink = data.financials.metrics.starlink.find((x) => x.period === 'Q1 2026')
  return (
    <section className="mx-auto max-w-[1760px] px-safe py-4 md:py-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.06fr)_minmax(420px,.94fr)]">
        <Panel pad="p-5 sm:p-7" className="relative overflow-hidden border-spacex/18 bg-[radial-gradient(circle_at_12%_0%,rgba(183,216,255,.15),transparent_34%),linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.014)_52%,rgba(0,0,0,.22))]">
          <div className="absolute right-[-8rem] top-[-10rem] h-[24rem] w-[24rem] rounded-full border border-white/[0.06]" />
          <div className="relative">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-normal text-cyan/78">Preliminary S‑1 briefing</p>
            <h1 className="mt-4 max-w-4xl text-[48px] font-[690] leading-[0.92] tracking-normal text-spacex sm:text-[74px] lg:text-[92px]">SpaceX S‑1 Atlas</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-white/82">A source-cited filing map for the business stack, financial deltas, segment economics, risk factors and governance terms in the preliminary S‑1 package.</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <BriefingStat label="2025 revenue" value={money(y2025?.revenue)} note="Filed consolidated revenue" tone="cyan" />
              <BriefingStat label="Q1 revenue" value={money(q12026?.revenue)} note="Q1 2026 consolidated" />
              <BriefingStat label="Starlink subscribers" value={`${starlink?.subscribers_m}M`} note="As of Mar. 31, 2026" tone="cyan" />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={() => setHash('/financials')} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-spacex px-4 text-sm font-[700] text-void hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">Open financial workbench <ChevronRight size={15} /></button>
              <button onClick={() => setHash('/risks')} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/12 bg-white/[0.045] px-4 text-sm font-[620] text-white/82 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60"><ShieldAlert size={15} /> Risk radar</button>
              <button onClick={() => setHash('/atlas')} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/12 bg-white/[0.035] px-4 text-sm font-[620] text-white/76 hover:bg-white/[0.065] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60"><Search size={15} /> Search packets</button>
            </div>
            <div className="mt-6 grid gap-3 border-t border-white/[0.085] pt-4 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm leading-6 text-white/76">{filingStatus?.v}</p>
                <Source>{filingStatus?.src}</Source>
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-black/20 p-3 lg:w-[18rem]">
                <p className="font-mono text-[10px] uppercase tracking-normal text-white/62">Listing marker</p>
                <p className="mt-1 text-sm font-[650] leading-5 text-white/82">{ticker?.v}</p>
                <p className="mt-2 font-mono text-[10px] leading-4 text-white/62">SRC · {ticker?.src}</p>
              </div>
            </div>
          </div>
        </Panel>
        <BriefingReadout data={data} />
      </div>
    </section>
  )
}

function WhatChangedStrip({ data }) {
  const rows = data.financials.consolidated
  const y2024 = rowFor(rows, 'period', '2024')
  const y2025 = rowFor(rows, 'period', '2025')
  const q12025 = rowFor(rows, 'period', 'Q1 2025')
  const q12026 = rowFor(rows, 'period', 'Q1 2026')
  const deltas = [
    { label: '2025 revenue', value: `${formatPct(pctChange(y2025?.revenue, y2024?.revenue))} YoY`, note: `${money(y2024?.revenue)} → ${money(y2025?.revenue)}` },
    { label: 'Op. income swing', value: money((y2025?.op_income ?? 0) - (y2024?.op_income ?? 0)), note: `${money(y2024?.op_income)} → ${money(y2025?.op_income)}` },
    { label: 'Q1 revenue', value: `${formatPct(pctChange(q12026?.revenue, q12025?.revenue))} YoY`, note: `${money(q12025?.revenue)} → ${money(q12026?.revenue)}` },
    { label: 'Q1 net loss', value: money((q12026?.net_income ?? 0) - (q12025?.net_income ?? 0)), note: `${money(q12025?.net_income)} → ${money(q12026?.net_income)}` },
  ]
  return (
    <Panel pad="p-4" className="overflow-hidden border-spacex/14 bg-[linear-gradient(135deg,rgba(183,216,255,.07),rgba(255,255,255,.018)_42%,rgba(0,0,0,.18))]">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-normal text-white/66">Financial deltas</p>
          <h3 className="mt-1 text-2xl font-[690] tracking-normal text-spacex">The table movement that frames the filing</h3>
        </div>
        <p className="max-w-md text-sm leading-6 text-white/68">Derived calculations only; no forecast, market data or valuation layer.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
        {deltas.map((item) => (
          <div key={item.label} className="rounded-lg border border-white/[0.09] bg-black/20 p-3.5">
            <p className="font-mono text-[10px] uppercase tracking-normal text-white/62">{item.label}</p>
            <p className={cn('mt-1.5 text-3xl font-[720] tracking-normal', item.value.startsWith('−') ? 'text-red' : 'text-spacex')}>{item.value}</p>
            <p className="mt-1.5 text-[13px] leading-5 text-white/72">{item.note}</p>
          </div>
        ))}
      </div>
      <Source>financials.consolidated comparable periods; displayed ratios are derived from filed values</Source>
    </Panel>
  )
}

function SegmentEconomics({ data, onPacket }) {
  const q1Segments = data.financials.segments.filter((row) => row.period === 'Q1 2026')
  const q1Revenue = q1Segments.reduce((sum, row) => sum + Number(row.revenue || 0), 0)
  const q1Capex = q1Segments.reduce((sum, row) => sum + Number(row.capex || 0), 0)
  const callouts = {
    Space: 'Strategic launch layer, but Q1 revenue was below both operating loss and capex.',
    Connectivity: 'Only Q1 segment with positive operating income and the majority of Q1 segment revenue.',
    AI: 'Smaller Q1 revenue base with the largest Q1 segment capex and operating loss.',
  }
  return (
    <Panel pad="p-4" className="overflow-hidden">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-normal text-white/66">Q1 segment economics</p>
          <h3 className="mt-1 text-2xl font-[690] tracking-normal text-spacex">Three businesses, very different economics</h3>
        </div>
        <p className="max-w-lg text-sm leading-6 text-white/68">Revenue mix, operating income and capex intensity from the same Q1 segment table.</p>
      </div>
      <div className="grid gap-2 xl:grid-cols-3">
        {q1Segments.map((segment) => {
          const packet = data.atlasRows.find((row) => row.type === 'financial' && row.title === `${segment.segment} segment · Q1 2026`)
          const capexRatio = margin(segment.capex, segment.revenue)
          const mix = margin(segment.revenue, q1Revenue)
          const capexMix = margin(segment.capex, q1Capex)
          return (
            <button key={segment.segment} onClick={() => packet ? onPacket?.(packet) : undefined} className="rounded-lg border border-white/[0.09] bg-white/[0.03] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
              <div className="flex items-center justify-between gap-3">
                <p className="text-2xl font-[700] tracking-normal" style={{ color: SEGMENT_COLORS[segment.segment] }}>{segment.segment}</p>
                <span className="rounded-md border border-white/[0.09] bg-black/20 px-2 py-1 font-mono text-[10px] text-white/64">Q1 2026</span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div><dt className="font-mono text-[9px] uppercase tracking-normal text-white/62">Revenue</dt><dd className="mt-1 text-lg font-[700] text-white/90">{money(segment.revenue)}</dd></div>
                <div><dt className="font-mono text-[9px] uppercase tracking-normal text-white/62">Op. income</dt><dd className={cn('mt-1 text-lg font-[700]', segment.op_income < 0 ? 'text-red' : 'text-cyan')}>{money(segment.op_income)}</dd></div>
                <div><dt className="font-mono text-[9px] uppercase tracking-normal text-white/62">Capex</dt><dd className="mt-1 text-lg font-[700] text-amber">{money(segment.capex)}</dd></div>
              </dl>
              <div className="mt-4 grid gap-2">
                <MiniBar value={segment.revenue} max={q1Revenue} color={SEGMENT_COLORS[segment.segment]} label={`Revenue mix ${formatPlainPct(mix, 1)}`} />
                <MiniBar value={segment.capex} max={q1Capex} color="#F3BE63" label={`Capex mix ${formatPlainPct(capexMix, 1)}`} />
              </div>
              <p className="mt-4 text-[13px] leading-6 text-white/74">{callouts[segment.segment]} Capex / revenue: <span className="font-[650] text-white/88">{formatPlainPct(capexRatio, 1)}</span>.</p>
              <p className="mt-2 font-mono text-[10px] text-white/62">SRC · Segment tables / summary</p>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

function FilingTensions({ data }) {
  const starshipRisk = riskPacketFor(data, /Starship at scale/i)
  const tamRisk = riskPacketFor(data, /future market opportunity/i)
  const aiRisk = riskPacketFor(data, /AI segment is capital intensive/i)
  const controlRisk = riskPacketFor(data, /dual class structure concentrates voting control/i)
  const starlink = data.financials.metrics.starlink
  const arpuMove = formatPct(pctChange(rowFor(starlink, 'period', 'Q1 2026')?.arpu, rowFor(starlink, 'period', 'Q1 2025')?.arpu))
  const aiQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'AI')
  const cards = [
    {
      title: 'Starship is both enabler and gating item',
      a: 'Growth plan points to Starship for V3 satellites, mobile connectivity, orbital AI compute and lunar / Mars ambitions.',
      b: 'Risk Factors warn Starship delays would limit execution of that same growth strategy.',
      why: 'Several future narratives route through one launch system and cadence constraint.',
      sources: [data.segments.find((s) => s.name === 'Space')?.src, starshipRisk?.source],
      packets: [starshipRisk],
    },
    {
      title: 'Connectivity scales, but ARPU is falling',
      a: 'Starlink subscribers reached 10.3M in Q1 2026.',
      b: `ARPU moved ${arpuMove} year over year in Q1, from $86 to $66.`,
      why: 'Subscriber growth is clear; monetization per subscriber is the tension to watch.',
      sources: ['Starlink metrics table', data.segments.find((s) => s.name === 'Connectivity')?.src],
      packets: [],
    },
    {
      title: 'AI adds a large capital-intensity disclosure',
      a: 'The filing frames AI / X as an integral pillar and names orbital AI compute as a growth vector.',
      b: `Q1 AI revenue was ${money(aiQ1?.revenue)} against ${money(aiQ1?.op_income)} operating income and ${money(aiQ1?.capex)} capex.`,
      why: 'The story is not just “new segment”; it changes the capital intensity of the whole issuer.',
      sources: [data.segments.find((s) => s.name === 'AI')?.src, 'Segment tables / summary', aiRisk?.source],
      packets: [aiRisk],
    },
    {
      title: 'Public listing, controlled-company governance',
      a: factFor(data, 'Ticker requested')?.v,
      b: factFor(data, 'Voting design')?.v,
      why: 'The public-shareholder interface is constrained before pricing is even filled in.',
      sources: [factFor(data, 'Ticker requested')?.src, factFor(data, 'Voting design')?.src, controlRisk?.source],
      packets: [controlRisk],
    },
    {
      title: 'Huge TAM framing, explicit uncertainty',
      a: data.strategy.find((row) => row.title === 'Market opportunity framing')?.items?.[0],
      b: tamRisk?.title,
      why: 'The filing sells a very large opportunity set while warning the estimates may be wrong.',
      sources: [data.strategy.find((row) => row.title === 'Market opportunity framing')?.src, tamRisk?.source],
      packets: [tamRisk],
    },
  ]
  return (
    <Section dense eyebrow="Filing tensions" title="What matters beneath the headline" aside="Paired disclosures from the filing. These are not scores; they are the places a reader should slow down and verify.">
      <div className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Panel pad="p-4" className="self-start border-amber/18 bg-amber/10">
          <p className="font-mono text-[11px] uppercase tracking-normal text-amber/80">Reader discipline</p>
          <h3 className="mt-2 text-2xl font-[690] leading-7 tracking-normal text-white">The filing’s story is strongest where disclosures are read in pairs.</h3>
          <p className="mt-3 text-sm leading-6 text-white/72">Each row below connects a growth narrative to the filing language that can limit, qualify or complicate it.</p>
          <Source>summary, MD&A, Risk Factors, ownership and capital-stock sections</Source>
        </Panel>
        <div className="grid gap-2">
        {cards.map((card) => (
          <Panel key={card.title} pad="p-4" className="grid gap-3 lg:grid-cols-[minmax(0,.72fr)_minmax(0,1fr)]">
            <div>
              <h3 className="text-lg font-[700] leading-6 tracking-normal text-spacex">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/78">{card.why}</p>
            </div>
            <div>
              <div className="grid gap-2 sm:grid-cols-2">
                <p className="rounded-lg border border-white/[0.07] bg-black/18 p-3 text-[13px] leading-6 text-white/74"><span className="mb-1 block font-mono text-[10px] uppercase tracking-normal text-white/62">Disclosure A</span>{card.a}</p>
                <p className="rounded-lg border border-white/[0.07] bg-black/18 p-3 text-[13px] leading-6 text-white/74"><span className="mb-1 block font-mono text-[10px] uppercase tracking-normal text-white/62">Disclosure B</span>{card.b}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="font-mono text-[10px] leading-4 text-white/62">SRC · {card.sources.filter(Boolean).join(' · ')}</p>
                {card.packets.filter(Boolean).map((packet) => <button key={packet.id} onClick={() => setHash(packet.hash)} className="min-h-8 rounded-md border border-white/[0.09] bg-white/[0.04] px-2 text-[11px] text-white/72 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">Open packet</button>)}
              </div>
            </div>
          </Panel>
        ))}
        </div>
      </div>
    </Section>
  )
}

function BusinessStack({ data, onPacket }) {
  return (
    <div className="grid gap-3 2xl:grid-cols-3">
      {data.segments.map((segment) => {
        const packet = data.atlasRows.find((r) => r.type === 'financial' && r.title.startsWith(segment.name)) || data.atlasRows.find((r) => r.title.includes(segment.name))
        return (
          <button key={segment.name} onClick={() => packet && onPacket?.(packet)} className="group relative min-h-[250px] overflow-hidden rounded-xl border border-white/[0.085] bg-[#0A0B0D]/90 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.045)] transition hover:border-white/18 hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
            <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full border border-white/[0.06] transition group-hover:scale-105" />
            <div className="absolute right-5 top-5 h-3 w-3 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[segment.name], boxShadow: `0 0 22px ${SEGMENT_COLORS[segment.name]}` }} />
            <p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Operating shell</p>
            <h3 className="mt-2 text-3xl font-[560] tracking-normal text-spacex">{segment.name}</h3>
            <p className="mt-3 text-sm leading-6 text-white/68">{segment.one_liner}</p>
            <ul className="mt-3 space-y-1.5 text-xs leading-5 text-white/62">
              {segment.details.slice(0, 2).map((item) => <li key={item}>• {item}</li>)}
            </ul>
            <Source>{segment.src}</Source>
          </button>
        )
      })}
    </div>
  )
}

function OperatingMetrics({ data }) {
  const q1 = data.financials.consolidated.find((x) => x.period === 'Q1 2026')
  const y2025 = data.financials.consolidated.find((x) => x.period === '2025')
  const cash = data.financials.balance.find((x) => x.date === 'Mar 31 2026')
  const starlink = data.financials.metrics.starlink.find((x) => x.period === 'Q1 2026')
  const q1Segments = data.financials.segments.filter((x) => x.period === 'Q1 2026')
  return (
    <Panel pad="p-3" className="overflow-hidden">
      <div className="mb-3 flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Financials</p><Gauge size={16} className="text-white/40" /></div>
      <div className="grid gap-2 md:grid-cols-4">
        <MetricPill label="2025 revenue" value={money(y2025?.revenue)} sub="consolidated" />
        <MetricPill label="Q1 2026 revenue" value={money(q1?.revenue)} sub="consolidated" />
        <MetricPill label="Starlink subscribers" value={`${starlink?.subscribers_m}M`} sub="Mar. 31, 2026" />
        <MetricPill label="Cash + securities" value={money((cash?.cash || 0) + (cash?.marketable_securities || 0))} sub="Mar. 31, 2026" />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {q1Segments.map((row) => <div key={row.segment} className="rounded-lg border border-white/[0.06] bg-black/25 p-3"><p className="font-[650]" style={{ color: SEGMENT_COLORS[row.segment] }}>{row.segment}</p><p className="mt-2 text-xs leading-5 text-white/58">Revenue {money(row.revenue)} · Op. income {money(row.op_income)} · Capex {money(row.capex)}</p></div>)}
      </div>
    </Panel>
  )
}

function RiskRadar({ data, selected, onPacket, compact = false }) {
  const risks = data.risks
  const themeMeta = [
    { theme: 'Launch / Starship', color: '#B7D8FF' },
    { theme: 'Starlink / Network', color: '#74E3D4' },
    { theme: 'AI / Compute', color: '#F3BE63' },
    { theme: 'Regulatory', color: '#EF7D7D' },
    { theme: 'Operations / Market', color: '#C6D0DD' },
    { theme: 'Offering / Control', color: '#9DB9FF' },
  ]
  const themeNames = themeMeta.map((x) => x.theme)
  const themed = risks.map((risk, i) => ({ ...risk, i, theme: inferRiskTheme(risk.heading, risk.group), packet: data.atlasRows.find((r) => r.type === 'risk' && r.title === risk.heading) }))
  const counts = themeMeta.map((meta) => ({ ...meta, count: themed.filter((r) => r.theme === meta.theme).length }))
  const points = themed.map((risk) => {
    const themeIndex = themeNames.indexOf(risk.theme)
    const inTheme = themed.filter((r) => r.theme === risk.theme)
    const localIndex = inTheme.findIndex((r) => r.heading === risk.heading)
    const base = (themeIndex / themeNames.length) * Math.PI * 2 - Math.PI / 2
    const angle = base + ((localIndex - inTheme.length / 2) / Math.max(inTheme.length, 1)) * 0.72
    const radius = 72 + (localIndex % 5) * 18
    const meta = themeMeta[themeIndex] || themeMeta[3]
    return { ...risk, x: 180 + Math.cos(angle) * radius, y: 180 + Math.sin(angle) * radius, active: selected?.id === risk.packet?.id, color: meta.color }
  })
  return (
    <Panel pad="p-4" className="overflow-hidden">
      <div className="mb-3 flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Risk radar · risk factors</p><Radar size={16} className="text-red" /></div>
      <div className={cn('grid gap-4', compact ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'xl:grid-cols-[minmax(0,1fr)_420px]')}>
        <svg viewBox="0 0 360 360" className="order-2 aspect-square w-full rounded-xl border border-white/[0.06] bg-black/30 xl:sticky xl:top-24" role="img" aria-label="Risk radar grouped by S-1 risk factors">
          <defs>
            <radialGradient id="risk-core" cx="50%" cy="50%" r="52%">
              <stop offset="0%" stopColor="rgba(239,125,125,.18)" />
              <stop offset="64%" stopColor="rgba(183,216,255,.045)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="360" height="360" rx="18" fill="rgba(255,255,255,.012)" />
          <circle cx="180" cy="180" r="154" fill="url(#risk-core)" stroke="rgba(255,255,255,.10)" />
          <circle cx="180" cy="180" r="112" fill="none" stroke="rgba(255,255,255,.085)" strokeDasharray="7 11" />
          <circle cx="180" cy="180" r="68" fill="none" stroke="rgba(255,255,255,.07)" />
          {themeMeta.map((meta, i) => {
            const angle = (i / themeMeta.length) * Math.PI * 2 - Math.PI / 2
            return <line key={meta.theme} x1="180" y1="180" x2={180 + Math.cos(angle) * 154} y2={180 + Math.sin(angle) * 154} stroke="rgba(255,255,255,.06)" />
          })}
          <path d="M180 180 L180 30 A150 150 0 0 1 309 105 Z" fill="rgba(183,216,255,.055)" />
          {points.map((p) => <g key={p.heading} onClick={() => p.packet && onPacket?.(p.packet)} className="cursor-pointer"><circle cx={p.x} cy={p.y} r={16} fill="transparent" className="pointer-events-auto" /><circle cx={p.x} cy={p.y} r={p.active ? 6.5 : 3.7} fill={p.color} opacity={p.active ? 1 : 0.82} pointerEvents="none" /><title>{p.heading}</title></g>)}
          {counts.map((c, i) => {
            const angle = (i / counts.length) * Math.PI * 2 - Math.PI / 2
            const x = 180 + Math.cos(angle) * 128
            const y = 180 + Math.sin(angle) * 128
            return <g key={c.theme}><circle cx={x} cy={y} r="13" fill={c.color} opacity=".94" stroke="#050506" strokeWidth="1.6" /><text x={x} y={y + 4} textAnchor="middle" fill="#050506" fontSize="11" fontWeight="800">{c.count}</text></g>
          })}
          <circle cx="180" cy="180" r="46" fill="#08090c" stroke="rgba(255,255,255,.12)" />
          <text x="180" y="173" textAnchor="middle" fill="#f7f8f8" fontSize="22" fontWeight="700">{riskFactorCount(data)}</text>
          <text x="180" y="193" textAnchor="middle" fill="#a6adb9" fontSize="8.4" fontWeight="700" letterSpacing="0.9">RISK</text>
          <text x="180" y="205" textAnchor="middle" fill="#a6adb9" fontSize="8.4" fontWeight="700" letterSpacing="0.55">FACTORS</text>
        </svg>
        <div className="order-1 grid content-start gap-2 sm:grid-cols-2">
          {counts.map((c) => {
            const examples = themed.filter((risk) => risk.theme === c.theme).slice(0, compact ? 2 : 3)
            return (
              <div key={c.theme} className="rounded-xl border border-white/[0.075] bg-white/[0.025] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-[650] leading-5 text-white/84"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />{c.theme}</p>
                  <span className="rounded-md border border-white/[0.08] px-2 py-1 font-mono text-[10px] text-white/58">{c.count}</span>
                </div>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-white/68">
                  {examples.map((risk) => <li key={risk.heading}>• {trimText(risk.heading, compact ? 104 : 140)}</li>)}
                </ul>
                <button onClick={() => setHash('/risks', { group: c.theme })} className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-[560] text-white/72 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">Open all {c.count}</button>
              </div>
            )
          })}
          <p className="sm:col-span-2 mt-1 text-xs leading-5 text-white/62">Themes are keyword-derived navigation over exact filing headings. No severity or probability score is invented.</p>
        </div>
      </div>
    </Panel>
  )
}

function MobileOrbitStack({ segments }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-black/30 p-3">
      <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full border border-spacex/15" />
      <div className="grid gap-2">
        {segments.map((segment, idx) => (
          <div key={segment.name} className="relative rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
            <div className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[segment.name], boxShadow: `0 0 16px ${SEGMENT_COLORS[segment.name]}` }} />
            <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">Layer 0{idx + 1}</p>
            <p className="mt-1 text-lg font-[650] tracking-normal" style={{ color: SEGMENT_COLORS[segment.name] }}>{segment.name}</p>
            <p className="mt-1 text-xs leading-5 text-white/58">{trimText(segment.one_liner, 90)}</p>
            <p className="mt-2 font-mono text-[9px] leading-4 text-white/58">SRC · {trimText(segment.src, 72)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function MobileOrbitStackCompact({ segments }) {
  return (
    <div className="relative h-[148px] overflow-hidden rounded-xl border border-white/[0.07] bg-black/30 p-3">
      <div className="absolute left-1/2 top-[118px] h-[220px] w-[220px] -translate-x-1/2 rounded-full border border-spacex/20" />
      <div className="absolute left-1/2 top-[78px] h-[152px] w-[152px] -translate-x-1/2 rounded-full border border-cyan/25" />
      <div className="absolute left-1/2 top-[42px] h-[84px] w-[84px] -translate-x-1/2 rounded-full border border-amber/35" />
      <p className="relative z-10 font-mono text-[9px] uppercase tracking-normal text-white/58">Operating stack</p>
      <div className="relative z-10 mt-4 grid grid-cols-3 gap-2">
        {segments.map((segment, idx) => (
          <div key={segment.name} className="rounded-lg border border-white/[0.07] bg-[#0A0B0D]/88 p-2 text-center">
            <p className="font-mono text-[8px] uppercase tracking-normal text-white/62">L0{idx + 1}</p>
            <p className="mt-1 text-[13px] font-[650] tracking-normal" style={{ color: SEGMENT_COLORS[segment.name] }}>{segment.name}</p>
          </div>
        ))}
      </div>
      <p className="relative z-10 mt-3 font-mono text-[9px] leading-4 text-white/58">SRC · Business / segment disclosures</p>
    </div>
  )
}

function MobileFlightDeck({ data, packet, onPacket }) {
  const q1 = data.financials.consolidated.find((x) => x.period === 'Q1 2026')
  const q1Prev = data.financials.consolidated.find((x) => x.period === 'Q1 2025')
  const y2025 = data.financials.consolidated.find((x) => x.period === '2025')
  const cash = data.financials.balance.find((x) => x.date === 'Mar 31 2026')
  const starlink = data.financials.metrics.starlink.find((x) => x.period === 'Q1 2026')
  const aiQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'AI')
  const connectivityQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'Connectivity')
  const filingStatus = factFor(data, 'Filing status')
  return (
    <section className="px-safe py-3 md:hidden">
      <Panel pad="p-4" className="relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full border border-white/[0.06]" />
        <p className="font-mono text-[11px] font-semibold uppercase tracking-normal text-cyan/76">Preliminary S‑1 briefing</p>
        <h1 className="mt-2 text-[40px] font-[690] leading-[0.92] tracking-normal text-spacex">SpaceX S‑1 Atlas</h1>
        <p className="mt-3 text-[15px] leading-6 text-white/78">A source-cited filing map for financial deltas, segment economics, risks and control terms.</p>
        <div className="mt-4 rounded-lg border border-white/[0.085] bg-black/22 p-3">
          <p className="text-sm leading-6 text-white/76">{filingStatus?.v}</p>
          <p className="mt-2 font-mono text-[10px] leading-4 text-white/62">SRC · {filingStatus?.src}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <MetricPill label="2025 revenue" value={money(y2025?.revenue)} sub="SRC · consolidated" />
          <MetricPill label="Q1 revenue" value={money(q1?.revenue)} sub={`${formatPct(pctChange(q1?.revenue, q1Prev?.revenue), 1)} YoY · derived`} />
          <MetricPill label="Starlink subs" value={`${starlink?.subscribers_m}M`} sub="SRC · Starlink metrics" />
          <MetricPill label="Cash + sec." value={money((cash?.cash || 0) + (cash?.marketable_securities || 0))} sub="SRC · balance sheet" />
        </div>
        <div className="mt-3 grid gap-2">
          <button onClick={() => setHash('/financials')} className="rounded-lg border border-amber/20 bg-amber/10 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
            <span className="block font-mono text-[10px] uppercase tracking-normal text-amber/80">Segment tension</span>
            <span className="mt-1 block text-sm leading-5 text-white/82">Connectivity Q1 operating income {money(connectivityQ1?.op_income)}; AI Q1 operating income {money(aiQ1?.op_income)} with {money(aiQ1?.capex)} capex.</span>
          </button>
          <div><MobileOrbitStackCompact segments={data.segments} /></div>
        </div>
        <button onClick={() => setHash('/risks')} className="mt-3 flex min-h-12 w-full items-center justify-between rounded-xl border border-red/25 bg-red/10 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
          <span><span className="block text-sm font-[650] text-white/86">Risk radar</span><span className="block font-mono text-[10px] uppercase tracking-normal text-white/62">{riskFactorCount(data)} risk factors · SRC · Risk Factors</span>{packet && <span className="mt-1 block text-xs leading-4 text-spacex">Packet · {trimText(packet.title, 58)}</span>}</span>
          <ChevronRight size={16} className="text-white/62" />
        </button>
        <div className="mt-3"><ShareActions data={data} packet={packet} variant="business-stack" title="SpaceX S‑1 Atlas" /></div>
        {packet && (
          <button onClick={() => setHash(packet.hash)} className="mt-2 block min-h-14 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
            <span className="font-mono text-[10px] uppercase tracking-normal text-white/58">Disclosure packet</span>
            <span className="mt-1 block text-sm font-[620] leading-5 text-spacex">{trimText(packet.title, 92)}</span>
            <span className="mt-1 block font-mono text-[10px] leading-4 text-white/62">SRC · {trimText(packet.source, 84)}</span>
          </button>
        )}
      </Panel>
    </section>
  )
}

function FlightDeck({ data }) {
  const [packet, setPacket] = useState(() => data.atlasRows.find((r) => r.type === 'risk') || data.atlasRows[0])
  return (
    <>
      <ExecutiveMemo data={data} />
      <ThesisAntiThesisPanel data={data} />
      <SegmentQualityMatrix data={data} onPacket={setPacket} />
      <ValueCreationBridge data={data} />
      <QuestionTree data={data} />
      <RiskControlMap data={data} />
      <EvidenceDrilldown data={data} packet={packet} onPacket={setPacket} />
    </>
  )
}

function Atlas({ data, route }) {
  const [query, setQuery] = useState(route.params.q || '')
  const [type, setType] = useState(route.params.type || 'all')
  const types = useMemo(() => ['all', ...Array.from(new Set(data.atlasRows.map((r) => r.type)))], [data])
  useEffect(() => { setQuery(route.params.q || ''); setType(route.params.type || 'all') }, [route.params.q, route.params.type])
  const update = (next = {}) => {
    const q = next.q ?? query
    const t = next.type ?? type
    setHash('/atlas', { q, type: t })
  }
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.atlasRows.filter((r) => {
      const hay = `${r.type} ${r.subtype} ${r.title} ${r.detail} ${r.source}`.toLowerCase()
      return (type === 'all' || r.type === type) && (!q || hay.includes(q))
    })
  }, [data, query, type])
  const selected = filtered[0]
  return (
    <Section dense eyebrow="Disclosure atlas" title="Search, filter and share every packet" aside="This is the dense workbench. Each row is now a stable disclosure packet with a deep link, caption and exportable card.">
      <div className="grid gap-3 xl:grid-cols-[300px_1fr_440px]">
        <Panel pad="p-3" className="self-start">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-white/[0.1] bg-black/30 px-3 focus-within:border-white/24"><Search size={15} className="text-white/58" /><input aria-label="Search every indexed disclosure" value={query} onChange={(e) => { setQuery(e.target.value); update({ q: e.target.value }) }} placeholder="Search every indexed disclosure…" className="w-full bg-transparent text-base text-white/78 outline-none placeholder:text-white/36 sm:text-sm" /></label>
          <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-1">
            {types.map((t) => {
              const count = t === 'all' ? data.atlasRows.length : data.atlasRows.filter((r) => r.type === t).length
              return <button key={t} onClick={() => { setType(t); update({ type: t }) }} className={cn('flex min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60', type === t ? 'border-spacex/35 bg-white/[0.07] text-spacex' : 'border-white/[0.07] bg-white/[0.02] text-white/58 hover:bg-white/[0.04]')}><span>{t === 'all' ? 'All disclosures' : PACKET_LABELS[t]}</span><span className="font-mono text-[10px] text-white/58">{count}</span></button>
            })}
          </div>
        </Panel>
        <DataTable maxHeight="max-h-[760px]" empty="No matching disclosures. Try a broader term or clear the type filter." columns={[
          { key: 'type', label: 'Type', className: 'w-[145px]', render: (r) => <span className="rounded-md border border-white/[0.08] bg-white/[0.025] px-2 py-1 font-mono text-[10px] uppercase tracking-normal text-white/62">{r.type}</span> },
          { key: 'title', label: `Packets (${filtered.length})`, render: (r) => <button onClick={() => setHash(r.hash)} className="block max-w-4xl text-left text-[13px] font-[560] leading-5 text-white/82 hover:text-spacex focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">{r.title}</button> },
          { key: 'detail', label: 'Extract / metric', render: (r) => <span className="block max-w-4xl text-white/62">{trimText(r.detail, 180)}</span> },
          { key: 'source', label: 'Source', className: 'w-[180px] font-mono text-[10px] text-white/58', render: (r) => trimText(r.source, 80) },
        ]} rows={filtered} mobileCard={(r) => (
          <button onClick={() => setHash(r.hash)} className="block min-h-20 w-full rounded-lg border border-white/[0.07] bg-white/[0.025] p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
            <span className="font-mono text-[10px] uppercase tracking-normal text-white/62">{PACKET_LABELS[r.type] || r.type}</span>
            <span className="mt-1 block text-sm font-[620] leading-5 text-white/84">{r.title}</span>
            <span className="mt-2 block text-xs leading-5 text-white/58">{trimText(r.detail, 150)}</span>
            <span className="mt-2 block font-mono text-[10px] leading-4 text-white/58">SRC · {trimText(r.source, 80)}</span>
          </button>
        )} />
        {selected ? <DisclosurePacket packet={selected} data={data} /> : <Panel><p className="text-sm leading-6 text-white/58">No packet selected because the current query returned no matches.</p></Panel>}
      </div>
    </Section>
  )
}

function PacketPage({ data, route }) {
  const packet = data.atlasRows.find((r) => r.type === route.packetType && r.id === route.packetId) || data.atlasRows.find((r) => r.id === route.packetId)
  return (
    <Section dense eyebrow="Deep-linked packet" title={packet ? 'Shareable disclosure packet' : 'Packet not found'} aside="Deep links restore packet state directly, so a post can point at one exact filing-grounded object.">
      <div className="grid gap-3 lg:grid-cols-[1fr_420px]">
        <DisclosurePacket packet={packet} data={data} variant={packet?.type === 'risk' ? 'risk-radar' : 'business-stack'} />
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Why this is shareable</p>
          <p className="mt-3 text-sm leading-6 text-white/64">A packet is the atomic unit of the atlas: one claim, metric, risk heading, exhibit or source artifact with a stable URL and caption. It is meant to be quoted without losing the filing reference.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setHash('/atlas', { type: packet?.type })} className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-white/74 hover:bg-white/[0.06]">Back to atlas</button>
            <button onClick={() => setHash('/poster/risk-radar')} className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-white/74 hover:bg-white/[0.06]">Open poster mode</button>
          </div>
        </Panel>
      </div>
    </Section>
  )
}

function Segments({ data }) {
  return (
    <>
      <Section dense eyebrow="Business stack" title="Space, Connectivity, AI" aside="The S‑1 reads as a three-layer operating stack; this view keeps the source labels visible.">
        <BusinessStack data={data} onPacket={(p) => setHash(p.hash)} />
      </Section>
      <Section dense eyebrow="Operating metrics" title="Metrics behind the stack">
        <OperatingMetrics data={data} />
      </Section>
    </>
  )
}

function Value({ v }) {
  const n = Number(v)
  return <span className={n < 0 ? 'text-red' : n > 0 ? 'text-white/82' : 'text-white/64'}>{money(v)}</span>
}

function PanelTitle({ icon: Icon, title, kicker }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        {kicker && <p className="font-mono text-[10px] uppercase tracking-normal text-white/62">{kicker}</p>}
        <h3 className="text-base font-[650] tracking-normal text-spacex">{title}</h3>
      </div>
      <Icon size={16} className="mt-1 shrink-0 text-white/62" />
    </div>
  )
}

function inspectPayload({ title, value, formula, source, inputs = [], packet = null, note = '', tone = 'neutral', rawValue = null, status = 'derived' }) {
  return { title, value, formula, source, inputs, packet, note, tone, rawValue, status }
}

function FormulaPill({ children }) {
  return <p className="mt-2 font-mono text-[10px] leading-4 text-white/62">{children}</p>
}

function MetricButton({ metric, onInspect, tone = 'default', children }) {
  const normalizedTone = { negative: 'red', positive: 'cyan', warning: 'amber', neutral: 'default' }[tone] || tone
  const toneClass = normalizedTone === 'red'
    ? 'border-red/20 bg-red/10 hover:border-red/34'
    : normalizedTone === 'cyan'
      ? 'border-cyan/20 bg-cyan/10 hover:border-cyan/34'
      : normalizedTone === 'amber'
        ? 'border-amber/20 bg-amber/10 hover:border-amber/34'
        : 'border-white/[0.075] bg-white/[0.025] hover:border-white/16 hover:bg-white/[0.045]'
  return (
    <button onClick={() => onInspect?.(metric)} className={cn('min-h-24 rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60', toneClass)}>
      {children}
    </button>
  )
}

function MiniBar({ value, max, color = '#B7D8FF', label }) {
  const width = max ? Math.min(100, Math.abs(Number(value) || 0) / max * 100) : 0
  return (
    <div className="space-y-1">
      {label && <div className="flex justify-between gap-2 font-mono text-[10px] uppercase tracking-normal text-white/60"><span>{label}</span><span>{fmtMetric(value, 'money')}</span></div>}
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: color, opacity: 0.82 }} />
      </div>
    </div>
  )
}

function evidencePacket(data, pattern, type) {
  if (!data?.atlasRows?.length) return null
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i')
  return data.atlasRows.find((row) => (!type || row.type === type) && regex.test(`${row.title} ${row.detail} ${row.source}`))
}

function LensChip({ children, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('min-h-11 rounded-full border px-3 text-xs font-[580] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60', active ? 'border-spacex/40 bg-spacex/12 text-spacex shadow-[0_0_26px_rgba(183,216,255,.08)]' : 'border-white/[0.085] bg-white/[0.025] text-white/68 hover:bg-white/[0.05]')}
    >
      {children}
    </button>
  )
}

function EvidenceCard({ title, detail, source, packet, query }) {
  return (
    <div className="rounded-xl border border-white/[0.075] bg-black/24 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-normal text-white/60">Filed evidence</p>
          <p className="mt-1 text-sm font-[650] text-white/86">{title}</p>
        </div>
        {query && <button onClick={() => setHash('/atlas', { q: query })} className="shrink-0 rounded-lg border border-white/10 bg-white/[0.035] px-2 py-1.5 text-[10px] font-[560] text-white/62 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">Atlas</button>}
      </div>
      <p className="mt-2 text-xs leading-5 text-white/68">{detail}</p>
      <Source>{source || packet?.source}</Source>
      {packet && <button onClick={() => setHash(packet.hash)} className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[11px] text-white/64 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60"><FileSearch size={13} /> Open packet</button>}
    </div>
  )
}

function DebateHero({ data, active, setActive }) {
  const themes = data.debate?.lenses || []
  return (
    <Section
      eyebrow="Question map · S‑1-grounded"
      title="Debate Map"
      aside="This route turns common investor questions into source-cited filing lenses without adding facts outside the S‑1 package."
    >
      <Panel pad="p-3 sm:p-4" className="overflow-hidden border-spacex/15 bg-[radial-gradient(circle_at_15%_20%,rgba(183,216,255,.13),transparent_34%),linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.012))]">
        <div className="grid gap-4 xl:grid-cols-[.82fr_1.18fr]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-normal text-cyan/70">Claim-checking layer</p>
            <h3 className="mt-2 text-3xl font-[650] tracking-normal text-white sm:text-5xl">Key IPO questions — mapped to the filing.</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">{data.debate?.scanCaveat}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MetricPill label="Question lenses" value={themes.length} sub="filing map" />
              <MetricPill label="Evidence base" value="S‑1 only" sub="filing-backed calculations" />
              <MetricPill label="Packets" value={number(data.atlasRows?.length)} sub="openable source units" />
            </div>
          </div>
          <div className="grid content-start gap-2 sm:grid-cols-2">
            {themes.map((theme) => (
              <button key={theme.id} onClick={() => setActive(theme.id)} className={cn('min-h-28 rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60', active === theme.id ? 'border-cyan/32 bg-cyan/10' : 'border-white/[0.075] bg-black/24 hover:bg-white/[0.04]')}>
                <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">{theme.label}</p>
                <p className="mt-2 text-sm leading-5 text-white/78">{theme.question}</p>
              </button>
            ))}
          </div>
        </div>
      </Panel>
    </Section>
  )
}

function ValuationStressLab({ data }) {
  const [valuationB, setValuationB] = useState(1500)
  const [salesMultiple, setSalesMultiple] = useState(20)
  const [targetMargin, setTargetMargin] = useState(15)
  const y2025 = periodRow(data.financials.consolidated, '2025')
  const q1 = periodRow(data.financials.consolidated, 'Q1 2026')
  const revenue2025B = Number(y2025?.revenue || 0) / 1000
  const q1RunRateB = Number(q1?.revenue || 0) * 4 / 1000
  const requiredRevenueB = Number(valuationB || 0) / Math.max(Number(salesMultiple || 1), 0.1)
  const impliedMultiple = revenue2025B ? Number(valuationB || 0) / revenue2025B : null
  const requiredIncomeB = requiredRevenueB * Number(targetMargin || 0) / 100
  const filingStatus = factFor(data, 'Filing status')
  return (
    <Panel pad="p-3 sm:p-4" className="border-spacex/14">
      <div className="grid gap-4 xl:grid-cols-[.92fr_1.08fr]">
        <div>
          <PanelTitle icon={Gauge} title="Valuation Stress Lab" kicker="User scenario · filed baseline" />
          <p className="text-sm leading-6 text-white/68">Valuation is a scenario question. The filing does not give final share count or pricing, so this module lets the reader enter assumptions and compares them to filed revenue, income and capex.</p>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 rounded-xl border border-white/[0.075] bg-black/22 p-3">
              <span className="font-mono text-[10px] uppercase tracking-normal text-white/58">Scenario valuation ($B)</span>
              <input className="min-h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-base text-white outline-none focus:border-spacex/45" type="number" min="50" step="50" value={valuationB} onChange={(e) => setValuationB(Number(e.target.value))} />
              <input type="range" min="100" max="2500" step="25" value={valuationB} onChange={(e) => setValuationB(Number(e.target.value))} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 rounded-xl border border-white/[0.075] bg-black/22 p-3">
                <span className="font-mono text-[10px] uppercase tracking-normal text-white/58">Sales multiple</span>
                <input className="min-h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-base text-white outline-none focus:border-spacex/45" type="number" min="1" step="1" value={salesMultiple} onChange={(e) => setSalesMultiple(Number(e.target.value))} />
              </label>
              <label className="grid gap-2 rounded-xl border border-white/[0.075] bg-black/22 p-3">
                <span className="font-mono text-[10px] uppercase tracking-normal text-white/58">Target net margin</span>
                <input className="min-h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-base text-white outline-none focus:border-spacex/45" type="number" min="-50" max="60" step="1" value={targetMargin} onChange={(e) => setTargetMargin(Number(e.target.value))} />
              </label>
            </div>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <MetricPill label="Scenario revenue needed" value={`$${requiredRevenueB.toFixed(1)}B`} sub={`${salesMultiple}x sales on $${valuationB}B valuation`} />
            <MetricPill label="Implied on filed 2025 revenue" value={fmtMetric(impliedMultiple, 'multiple', 1)} sub={`2025 revenue ${money(y2025?.revenue)}`} />
            <MetricPill label="Q1 2026 revenue run-rate" value={`$${q1RunRateB.toFixed(1)}B`} sub="Q1 revenue × 4; derived" />
            <MetricPill label="Scenario net income" value={`$${requiredIncomeB.toFixed(1)}B`} sub={`${targetMargin}% margin on scenario revenue`} />
          </div>
          <div className="rounded-xl border border-amber/18 bg-amber/10 p-3 text-xs leading-5 text-white/70">
            <b className="text-amber">Guardrail:</b> valuation, multiple and margin are user-entered. Filed baseline: 2025 revenue {money(y2025?.revenue)}, 2025 net income {money(y2025?.net_income)}, Q1 2026 revenue {money(q1?.revenue)}, Q1 2026 net income {money(q1?.net_income)}.
            <Source>{filingStatus?.src}; financials.consolidated</Source>
          </div>
        </div>
      </div>
    </Panel>
  )
}

function SegmentTugOfWar({ data }) {
  const periods = ['2025', 'Q1 2026']
  return (
    <Panel pad="p-3 sm:p-4">
      <PanelTitle icon={Layers3} title="Segment Tug-of-War" kicker="Connectivity vs AI vs Space" />
      <div className="grid gap-3 xl:grid-cols-2">
        {periods.map((period) => {
          const rows = segmentRowsFor(data, period)
          const totalRevenue = segmentTotal(data, period, 'revenue')
          const totalCapex = segmentTotal(data, period, 'capex')
          return (
            <div key={period} className="rounded-xl border border-white/[0.075] bg-black/24 p-3">
              <p className="font-mono text-[10px] uppercase tracking-normal text-white/62">{period}</p>
              <div className="mt-3 grid gap-3">
                {rows.map((row) => {
                  const revMix = margin(row.revenue, totalRevenue)
                  const capexMix = margin(row.capex, totalCapex)
                  return (
                    <button key={`${period}-${row.segment}`} onClick={() => setHash('/financials')} className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-3 text-left hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-lg font-[650] tracking-normal" style={{ color: SEGMENT_COLORS[row.segment] }}>{row.segment}</p>
                        <p className="font-mono text-[10px] text-white/62">capex mix <span className="text-amber">{formatPlainPct(capexMix, 1)}</span></p>
                      </div>
                      <div className="mt-3 grid gap-2">
                        <MiniBar value={row.revenue} max={totalRevenue} color={SEGMENT_COLORS[row.segment]} label="Revenue" />
                        <MiniBar value={row.capex} max={totalCapex} color="#F3BE63" label="Capex" />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-white/62">Revenue mix {formatPlainPct(revMix, 1)} · operating income {money(row.op_income)} · Adjusted EBITDA, as filed {money(row.adj_ebitda)}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <FormulaPill>All bars are same-period segment values. This makes the Starlink/Connectivity-vs-AI capex debate inspectable without assigning a score.</FormulaPill>
      <Source>financials.segments; summary and MD&A segment tables</Source>
    </Panel>
  )
}

function RelatedPartyLens({ data }) {
  const facts = data.debate?.filedFacts || {}
  const packet = evidencePacket(data, /related|Tesla|xAI|Musk/i, 'related')
  return (
    <Panel pad="p-3 sm:p-4">
      <PanelTitle icon={Orbit} title="Related-Party / Internal Economy Map" kicker="What the filing actually says" />
      <div className="grid gap-3 xl:grid-cols-[.9fr_1.1fr]">
        <div className="grid gap-3">
          <EvidenceCard {...facts.xMerger} query="xAI merger" packet={evidencePacket(data, /Basis of presentation|xAI merger/i)} />
          <EvidenceCard {...facts.teslaRelated} query="Tesla related" packet={packet} />
          <EvidenceCard {...facts.xaiTesla} query="xAI Tesla" packet={packet} />
        </div>
        <div className="rounded-xl border border-white/[0.075] bg-black/24 p-3">
          <p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Filed counterparties</p>
          <div className="mt-3 grid gap-2">
            {data.related?.map((party) => (
              <button key={party.party} onClick={() => setHash('/atlas', { q: party.party })} className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-3 text-left hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
                <p className="text-base font-[650] text-spacex">{party.party}</p>
                <ul className="mt-2 space-y-1.5 text-xs leading-5 text-white/66">
                  {party.items.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}
                </ul>
                <Source>{party.src}</Source>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}

function SupplyMechanics({ data }) {
  const facts = data.debate?.filedFacts || {}
  const rows = [facts.ipoBlanks, facts.listing, facts.directedShare, facts.voting].filter(Boolean)
  return (
    <Panel pad="p-3 sm:p-4">
      <PanelTitle icon={Table2} title="Float / Supply Mechanics" kicker="Filed, blank, user-scenario" />
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {rows.map((item) => <EvidenceCard key={item.title} {...item} query={item.title} packet={evidencePacket(data, new RegExp(item.title.split(' ')[0], 'i'))} />)}
      </div>
      <div className="mt-3 rounded-xl border border-white/[0.075] bg-white/[0.025] p-3 text-xs leading-5 text-white/64">
        The app should not assert a float percentage until final share-count and offering-size fields are filled. Current preliminary values are intentionally blank in the prospectus.
      </div>
    </Panel>
  )
}

function ControlDecoder({ data }) {
  const facts = data.debate?.filedFacts || {}
  const rights = [facts.voting, facts.muskControl, facts.controlledCompany, facts.muskRemoval].filter(Boolean)
  return (
    <Panel pad="p-3 sm:p-4">
      <PanelTitle icon={Landmark} title="Control Terms Decoder" kicker="What common shareholders can inspect" />
      <div className="grid gap-3 xl:grid-cols-[1fr_.8fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {rights.map((item) => <EvidenceCard key={item.title} {...item} query={item.title} packet={evidencePacket(data, new RegExp(item.title.replace(/[^A-Za-z0-9 ]/g, '').split(' ').slice(0, 2).join('|'), 'i'))} />)}
        </div>
        <div className="rounded-xl border border-red/18 bg-red/10 p-3">
          <p className="font-mono text-[10px] uppercase tracking-normal text-red/80">Shareholder-rights risk factors</p>
          <div className="mt-3 grid gap-2">
            {data.risks?.filter((risk) => /controlled company|dual class|shareholders|forum|arbitration|proposal|Class B/i.test(risk.heading)).slice(0, 6).map((risk) => (
              <button key={risk.heading} onClick={() => setHash('/risks', { q: risk.heading.slice(0, 42) })} className="rounded-lg border border-white/[0.06] bg-black/25 p-2 text-left text-xs leading-5 text-white/68 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">{trimText(risk.heading, 145)}</button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}

function TreasuryOddities({ data }) {
  const facts = data.debate?.filedFacts || {}
  const treasury = data.debate?.treasury || []
  const max = Math.max(...treasury.filter((item) => item.label !== 'Bitcoin units').map((item) => Number(item.value || 0)), 1)
  return (
    <Panel pad="p-3 sm:p-4">
      <PanelTitle icon={Database} title="Treasury Oddities" kicker="Cash · securities · debt · bitcoin" />
      <div className="grid gap-3 xl:grid-cols-[1.05fr_.95fr]">
        <div className="grid gap-2 sm:grid-cols-2">
          {treasury.map((item) => (
            <button key={item.label} onClick={() => setHash('/atlas', { q: item.label.includes('Bitcoin') ? 'digital assets' : item.label })} className="rounded-xl border border-white/[0.075] bg-black/24 p-3 text-left hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
              <div className="flex items-start justify-between gap-3">
                <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">{item.label}</p>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/62">{item.asOf}</span>
              </div>
              <p className="mt-2 text-2xl font-[680] tracking-normal text-spacex">{item.display}</p>
              {item.label !== 'Bitcoin units' && <MiniBar value={item.value} max={max} color={item.label.includes('Bitcoin') ? '#F3BE63' : '#B7D8FF'} />}
              <Source>{item.source}</Source>
            </button>
          ))}
        </div>
        <div className="grid gap-3">
          <EvidenceCard {...facts.digitalAssets} query="digital assets bitcoin" packet={evidencePacket(data, /digital assets|bitcoin/i)} />
          <EvidenceCard {...facts.digitalAssetLoss} query="unrealized digital assets" packet={evidencePacket(data, /digital assets|bitcoin/i)} />
        </div>
      </div>
    </Panel>
  )
}

function HolderDecisionMap({ data }) {
  return (
    <Panel pad="p-3 sm:p-4">
      <PanelTitle icon={Users} title="Holder Decision Map" kicker="Questions, not advice" />
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
        {(data.debate?.holderPersonas || []).map((holder) => (
          <button key={holder.persona} onClick={() => setHash('/atlas', { q: holder.lookAt[0] })} className="rounded-xl border border-white/[0.075] bg-black/24 p-3 text-left hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
            <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">{holder.persona}</p>
            <p className="mt-2 text-base font-[650] tracking-normal text-white/86">{holder.question}</p>
            <ul className="mt-3 space-y-1.5 text-xs leading-5 text-white/64">
              {holder.lookAt.map((item) => <li key={item}>• {item}</li>)}
            </ul>
            <p className="mt-3 rounded-lg bg-white/[0.035] p-2 text-xs leading-5 text-white/62">{holder.answerDiscipline}</p>
            <Source>{holder.source}</Source>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function RiskClaimChecker({ data }) {
  const claims = data.debate?.riskClaims || []
  const [claimId, setClaimId] = useState(claims[0]?.id || 'ai')
  const claim = claims.find((item) => item.id === claimId) || claims[0]
  const regex = claim ? new RegExp(claim.pattern, 'i') : /./
  const matches = data.risks?.filter((risk) => regex.test(risk.heading)).slice(0, 8) || []
  return (
    <Panel pad="p-3 sm:p-4">
      <PanelTitle icon={ShieldAlert} title="Risk Claim Checker" kicker="Claim family → filed risk factors" />
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {claims.map((item) => <LensChip key={item.id} active={item.id === claimId} onClick={() => setClaimId(item.id)}>{item.label}</LensChip>)}
      </div>
      <div className="grid gap-3 xl:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-xl border border-white/[0.075] bg-black/24 p-3">
          <p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Active claim family</p>
          <p className="mt-2 text-xl font-[650] tracking-normal text-spacex">{claim?.label}</p>
          <p className="mt-2 text-sm leading-6 text-white/66">Matching is deliberately text-based over actual S‑1 risk-factor headings. No severity, probability or sentiment score is invented.</p>
          <button onClick={() => setHash('/risks', { q: claim?.label })} className="mt-3 min-h-11 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs font-[560] text-white/70 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">Open Risk Radar</button>
        </div>
        <div className="grid gap-2">
          {matches.map((risk) => (
            <button key={risk.heading} onClick={() => setHash('/risks', { q: risk.heading.slice(0, 64) })} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-left hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
              <p className="text-sm leading-5 text-white/78">{risk.heading}</p>
              <Source>{risk.source}</Source>
            </button>
          ))}
        </div>
      </div>
    </Panel>
  )
}

function DebateMap({ data, route }) {
  const themes = data.debate?.lenses || []
  const active = themes.some((theme) => theme.id === route.params?.lens) ? route.params.lens : 'valuation'
  const setActive = (lens) => setHash('/debate', { lens })
  const activeTheme = themes.find((theme) => theme.id === active)
  const activeModule = {
    valuation: <ValuationStressLab data={data} />,
    'internal-economy': <RelatedPartyLens data={data} />,
    'segment-tug': <SegmentTugOfWar data={data} />,
    'supply-mechanics': <SupplyMechanics data={data} />,
    control: <ControlDecoder data={data} />,
    treasury: <TreasuryOddities data={data} />,
    'holder-map': <HolderDecisionMap data={data} />,
    'risk-claims': <RiskClaimChecker data={data} />,
  }[active]
  return (
    <>
      <DebateHero data={data} active={active} setActive={setActive} />
      <Section
        dense
        eyebrow={activeTheme?.label || 'Filed answer'}
        title={activeTheme?.question || 'Source-cited debate lens'}
        aside="Question prompts are only starting points. Values, clauses and evidence shown here come from the S‑1 payload and source packets."
      >
        {activeModule}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {(activeTheme?.sampleQuestions || []).map((thread) => (
            <div key={thread} className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-3">
              <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">Question prompt</p>
              <p className="mt-2 text-sm leading-5 text-white/70">{thread}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section
        dense
        eyebrow="All lenses"
        title="Eight ways to interrogate the filing"
        aside="Each card jumps to a source-backed lens. Atlas remains the audit layer for exact packets."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {themes.map((theme) => (
            <button key={theme.id} onClick={() => setActive(theme.id)} className={cn('rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60', active === theme.id ? 'border-spacex/32 bg-spacex/10' : 'border-white/[0.075] bg-black/24 hover:bg-white/[0.045]')}>
              <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">{theme.label}</p>
              <p className="mt-2 text-sm leading-5 text-white/72">{theme.question}</p>
            </button>
          ))}
        </div>
      </Section>
    </>
  )
}

function DivergingBar({ value, max }) {
  const n = Number(value) || 0
  const width = max ? Math.min(50, Math.abs(n) / max * 50) : 0
  return (
    <div className="relative h-3 rounded-full bg-white/[0.055]">
      <div className="absolute left-1/2 top-[-2px] h-5 w-px bg-white/18" />
      <div
        className={cn('absolute top-0 h-3 rounded-full', n < 0 ? 'right-1/2 bg-red/75' : 'left-1/2 bg-cyan/75')}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

function FinancialBasisBanner({ data, onInspect }) {
  const status = factFor(data, 'Filing status')
  const basis = factFor(data, 'Basis of presentation')
  const offering = data.offering?.find((row) => row.label === 'Offer size / price range')
  return (
    <Panel pad="p-3" className="border-spacex/15 bg-[linear-gradient(135deg,rgba(183,216,255,.07),rgba(255,255,255,.015)_42%,rgba(0,0,0,.18))]">
      <div className="grid gap-3 lg:grid-cols-[1.1fr_.9fr_.8fr]">
        {[{
          label: 'Preliminary filing',
          title: 'Completion fields remain blank',
          body: status?.v,
          source: status?.src,
        }, {
          label: 'Basis of presentation',
          title: 'Financials are recast',
          body: basis?.v,
          source: basis?.src,
        }, {
          label: 'Investor guardrail',
          title: 'No valuation layer here',
          body: `${offering?.value || 'Offer size / price range blank in preliminary prospectus'}. Derived calculations use filing values only.`,
          source: 'Offering summary; local S‑1 payload',
        }].map((item) => (
          <button key={item.label} onClick={() => onInspect(inspectPayload({ title: item.title, value: item.label, formula: 'Filed disclosure; no arithmetic', source: item.source, inputs: [item.body] }))} className="rounded-xl border border-white/[0.075] bg-black/20 p-3 text-left hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
            <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">{item.label}</p>
            <p className="mt-1 text-base font-[650] tracking-normal text-spacex">{item.title}</p>
            <p className="mt-2 text-xs leading-5 text-white/68">{item.body}</p>
            <Source>{item.source}</Source>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function InvestorKpiRibbon({ data, onInspect }) {
  const y2024 = periodRow(data.financials.consolidated, '2024')
  const y2025 = periodRow(data.financials.consolidated, '2025')
  const q12025 = periodRow(data.financials.consolidated, 'Q1 2025')
  const q12026 = periodRow(data.financials.consolidated, 'Q1 2026')
  const latest = balanceRow(data.financials.balance, 'Mar 31 2026')
  const debt = capitalValue(data, 'Total long-term debt')
  const cashAndSec = Number(latest?.cash || 0) + Number(latest?.marketable_securities || 0)
  const q1CapexTotal = segmentTotal(data, 'Q1 2026', 'capex')
  const aiQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'AI')
  const cards = [
    inspectPayload({ title: '2025 revenue growth', value: formatPct(pctChange(y2025?.revenue, y2024?.revenue), 1), formula: '(2025 revenue ÷ 2024 revenue) − 1', source: 'financials.consolidated[period="2025"].revenue and [period="2024"].revenue', inputs: [`2025 revenue ${money(y2025?.revenue)}`, `2024 revenue ${money(y2024?.revenue)}`], packet: financialPacket(data, 'Consolidated · 2025'), tone: 'positive', rawValue: pctChange(y2025?.revenue, y2024?.revenue) }),
    inspectPayload({ title: 'Q1 2026 revenue growth', value: formatPct(pctChange(q12026?.revenue, q12025?.revenue), 1), formula: '(Q1 2026 revenue ÷ Q1 2025 revenue) − 1', source: 'financials.consolidated[period="Q1 2026"].revenue and [period="Q1 2025"].revenue', inputs: [`Q1 2026 revenue ${money(q12026?.revenue)}`, `Q1 2025 revenue ${money(q12025?.revenue)}`], packet: financialPacket(data, 'Consolidated · Q1 2026'), tone: 'positive', rawValue: pctChange(q12026?.revenue, q12025?.revenue) }),
    inspectPayload({ title: 'Q1 operating margin', value: formatPlainPct(margin(q12026?.op_income, q12026?.revenue), 1), formula: 'Operating income ÷ revenue', source: 'financials.consolidated[period="Q1 2026"]', inputs: [`Operating income ${money(q12026?.op_income)}`, `Revenue ${money(q12026?.revenue)}`], packet: financialPacket(data, 'Consolidated · Q1 2026'), tone: 'negative', rawValue: margin(q12026?.op_income, q12026?.revenue) }),
    inspectPayload({ title: 'Q1 Adjusted EBITDA, as filed margin', value: formatPlainPct(margin(q12026?.adjusted_ebitda, q12026?.revenue), 1), formula: 'Adjusted EBITDA, as filed ÷ revenue', source: 'summary lines 1035–1038; financials.consolidated[period="Q1 2026"]', inputs: [`Adjusted EBITDA, as filed ${money(q12026?.adjusted_ebitda)}`, `Revenue ${money(q12026?.revenue)}`], packet: financialPacket(data, 'Consolidated · Q1 2026'), tone: 'neutral', rawValue: margin(q12026?.adjusted_ebitda, q12026?.revenue) }),
    inspectPayload({ title: 'Cash + marketable securities', value: money(cashAndSec), formula: 'Cash and equivalents + marketable securities', source: 'financials.balance[date="Mar 31 2026"]', inputs: [`Cash ${money(latest?.cash)}`, `Marketable securities ${money(latest?.marketable_securities)}`], tone: 'neutral', rawValue: cashAndSec }),
    inspectPayload({ title: 'Current ratio', value: fmtMetric(Number(latest?.total_current_assets) / Number(latest?.current_liabilities), 'multiple', 2), formula: 'Current assets ÷ current liabilities', source: 'financials.balance[date="Mar 31 2026"]', inputs: [`Current assets ${money(latest?.total_current_assets)}`, `Current liabilities ${money(latest?.current_liabilities)}`], tone: 'neutral', rawValue: Number(latest?.total_current_assets) / Number(latest?.current_liabilities) }),
    inspectPayload({ title: 'Long-term debt less cash + securities', value: money(Number(debt || 0) - cashAndSec), formula: 'Total long-term debt − cash − marketable securities', source: data.capital?.src, inputs: [`Long-term debt ${money(debt)}`, `Cash + securities ${money(cashAndSec)}`], note: 'Qualified debt/liquid-asset bridge using capitalization-table long-term debt; not a full enterprise-value or market-net-debt calculation.', tone: 'warning', rawValue: Number(debt || 0) - cashAndSec }),
    inspectPayload({ title: 'AI share of Q1 segment capex', value: formatPlainPct(margin(aiQ1?.capex, q1CapexTotal), 1), formula: 'AI capex ÷ total segment capex', source: 'financials.segments[period="Q1 2026"]', inputs: [`AI capex ${money(aiQ1?.capex)}`, `Total segment capex ${money(q1CapexTotal)}`], packet: financialPacket(data, 'AI segment · Q1 2026'), tone: 'warning', rawValue: margin(aiQ1?.capex, q1CapexTotal) }),
  ]
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <MetricButton key={card.title} metric={card} onInspect={onInspect} tone={card.tone}>
          <p className="font-mono text-[9px] uppercase tracking-normal text-white/62">{card.title}</p>
          <p className={cn('mt-1 text-2xl font-[690] tracking-normal', card.tone === 'negative' ? 'text-red' : card.tone === 'positive' ? 'text-cyan' : card.tone === 'warning' ? 'text-amber' : 'text-spacex')}>{card.value}</p>
          <FormulaPill>{card.formula}</FormulaPill>
        </MetricButton>
      ))}
    </div>
  )
}

function ConsolidatedTrendStrip({ data, onInspect }) {
  const rows = data.financials.consolidated
  const metrics = [
    { key: 'revenue', label: 'Revenue', color: '#B7D8FF' },
    { key: 'op_income', label: 'Operating income', color: '#74E3D4' },
    { key: 'net_income', label: 'Net income', color: '#EF7D7D' },
    { key: 'adjusted_ebitda', label: 'Adjusted EBITDA, as filed', color: '#F3BE63' },
  ]
  return (
    <Panel pad="p-3">
      <PanelTitle icon={Table2} title="Consolidated trend strip" kicker="Filed periods" />
      <div className="grid gap-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const metricMaxAbs = Math.max(...rows.map((row) => Math.abs(Number(row[metric.key] || 0))), 1)
          return (
          <div key={metric.key} className="rounded-xl border border-white/[0.065] bg-black/22 p-3">
            <p className="font-mono text-[9px] uppercase tracking-normal text-white/62">{metric.label}</p>
            <div className="mt-3 grid gap-2">
              {rows.map((row) => (
                <button key={`${metric.key}-${row.period}`} onClick={() => onInspect(inspectPayload({ title: `${metric.label} · ${row.period}`, value: hasNumber(row[metric.key]) ? money(row[metric.key]) : '—', formula: metric.key === 'adjusted_ebitda' ? 'Adjusted EBITDA, as filed where disclosed; not back-filled for missing periods' : 'Filed consolidated line item', source: row.source || `financials.consolidated[period="${row.period}"]`, inputs: [`${row.period}: ${hasNumber(row[metric.key]) ? money(row[metric.key]) : 'not disclosed in payload'}`], packet: financialPacket(data, `Consolidated · ${row.period}`), status: hasNumber(row[metric.key]) ? 'filed' : 'derived' }))} className="grid grid-cols-[4.4rem_1fr_4.6rem] items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
                  <span className="font-mono text-[10px] text-white/62">{row.period}</span>
                  <DivergingBar value={row[metric.key]} max={metricMaxAbs} />
                  <span className={cn('text-right font-mono text-[11px]', Number(row[metric.key]) < 0 ? 'text-red' : 'text-white/70')}>{hasNumber(row[metric.key]) ? money(row[metric.key]) : '—'}</span>
                </button>
              ))}
            </div>
          </div>
        )})}
      </div>
      <FormulaPill>Each small multiple uses its own scale and zero line; missing Adjusted EBITDA, as filed is shown as not disclosed in the structured payload.</FormulaPill>
    </Panel>
  )
}

function SegmentCommandCenter({ data, period, setPeriod, onInspect }) {
  const rows = segmentRowsFor(data, period)
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0)
  const totalCapex = rows.reduce((sum, row) => sum + Number(row.capex || 0), 0)
  const periods = ['2023', '2024', '2025', 'Q1 2026']
  return (
    <Panel pad="p-3">
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <PanelTitle icon={Layers3} title="Segment economics" kicker="Revenue mix · margins · capex draw" />
        <div className="flex flex-wrap gap-2">
          {periods.map((p) => <button key={p} onClick={() => setPeriod(p)} className={cn('min-h-10 rounded-lg border px-3 text-xs font-[560] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60', period === p ? 'border-spacex/35 bg-spacex/10 text-spacex' : 'border-white/[0.08] bg-white/[0.025] text-white/60 hover:bg-white/[0.045]')}>{p}</button>)}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {rows.map((row) => {
          const revenueMix = margin(row.revenue, totalRevenue)
          const capexMix = margin(row.capex, totalCapex)
          const opMargin = margin(row.op_income, row.revenue)
          const ebitdaMargin = margin(row.adj_ebitda, row.revenue)
          const capexIntensity = margin(row.capex, row.revenue)
          const opNote = opMarginExplainer(row, opMargin)
          const packet = financialPacket(data, `${row.segment} segment · ${row.period}`)
          const metric = inspectPayload({ title: `${row.segment} economics · ${row.period}`, value: `${money(row.revenue)} revenue`, formula: 'Segment filing rows plus derived mix/margin ratios', source: 'Segment tables / summary', inputs: [`Revenue ${money(row.revenue)} (${formatPlainPct(revenueMix, 1)} mix)`, `Operating income ${money(row.op_income)} (${formatPlainPct(opMargin, 1)} of revenue${opNote ? '; loss exceeds revenue' : ''})`, `Adjusted EBITDA, as filed ${money(row.adj_ebitda)} (${formatPlainPct(ebitdaMargin, 1)} margin)`, `Capex ${money(row.capex)} (${formatPlainPct(capexIntensity, 1)} of revenue; ${formatPlainPct(capexMix, 1)} of segment capex)`], packet })
          return (
            <MetricButton key={`${row.period}-${row.segment}`} metric={metric} onInspect={onInspect} tone={row.segment === 'AI' ? 'amber' : row.segment === 'Connectivity' ? 'cyan' : 'default'}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-[650] tracking-normal" style={{ color: SEGMENT_COLORS[row.segment] }}>{row.segment}</p>
                  <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">{period}</p>
                </div>
                <p className="text-right font-mono text-[10px] leading-4 text-white/58">rev mix<br /><span className="text-white/78">{formatPlainPct(revenueMix, 1)}</span></p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div><dt className="font-mono text-[9px] uppercase tracking-normal text-white/58">Revenue</dt><dd className="mt-1 font-[650] text-white/84">{money(row.revenue)}</dd></div>
                <div><dt className="font-mono text-[9px] uppercase tracking-normal text-white/58">{opMarginLabel(opMargin)}</dt><dd className={cn('mt-1 font-[650]', signedClass(opMargin))}>{formatPlainPct(opMargin, 1)}</dd></div>
                <div><dt className="font-mono text-[9px] uppercase tracking-normal text-white/58">Adj. EBITDA margin</dt><dd className={cn('mt-1 font-[650]', signedClass(ebitdaMargin))}>{formatPlainPct(ebitdaMargin, 1)}</dd></div>
                <div><dt className="font-mono text-[9px] uppercase tracking-normal text-white/58">Capex / revenue</dt><dd className="mt-1 font-[650] text-amber">{formatPlainPct(capexIntensity, 1)}</dd></div>
              </dl>
              {opNote && <p className="mt-2 rounded-md border border-red/18 bg-red/10 px-2 py-1.5 text-[11px] leading-4 text-white/72">{opNote}</p>}
              <div className="mt-3 grid gap-2">
                <MiniBar value={row.revenue} max={Math.max(totalRevenue, 1)} color={SEGMENT_COLORS[row.segment]} label="Revenue scale" />
                <MiniBar value={row.capex} max={Math.max(totalCapex, 1)} color="#F3BE63" label="Capex mix" />
              </div>
            </MetricButton>
          )
        })}
      </div>
      <FormulaPill>Mix is derived against same-period segment totals. Capex/revenue uses segment capital expenditures divided by segment revenue.</FormulaPill>
    </Panel>
  )
}

function SegmentHeatmap({ data, lens, setLens, onInspect }) {
  const periods = ['2023', '2024', '2025', 'Q1 2026']
  const segments = ['Space', 'Connectivity', 'AI']
  const lenses = [
    { id: 'revenue', label: 'Revenue', unit: 'money', formula: 'segment revenue' },
    { id: 'opMargin', label: 'Op. margin', unit: 'pct', formula: 'operating income ÷ revenue' },
    { id: 'ebitdaMargin', label: 'Adj. EBITDA margin', unit: 'pct', formula: 'segment Adjusted EBITDA, as filed ÷ revenue' },
    { id: 'capexIntensity', label: 'Capex / revenue', unit: 'pct', formula: 'segment capex ÷ revenue' },
    { id: 'capexMix', label: 'Capex mix', unit: 'pct', formula: 'segment capex ÷ same-period segment capex total' },
  ]
  const active = lenses.find((item) => item.id === lens) || lenses[0]
  const valueFor = (row, period) => {
    if (!row) return null
    if (lens === 'revenue') return row.revenue
    if (lens === 'opMargin') return margin(row.op_income, row.revenue)
    if (lens === 'ebitdaMargin') return margin(row.adj_ebitda, row.revenue)
    if (lens === 'capexIntensity') return margin(row.capex, row.revenue)
    if (lens === 'capexMix') return margin(row.capex, segmentTotal(data, period, 'capex'))
    return row.revenue
  }
  const display = (v) => active.unit === 'money' ? money(v) : formatPlainPct(v, 1)
  const cellStyle = (value, segment) => {
    const n = Math.abs(Number(value) || 0)
    const alpha = Math.min(0.34, 0.06 + n / (lens === 'revenue' ? 25000 : 500) * 0.32)
    const color = lens.includes('capex') ? '243,190,99' : Number(value) < 0 ? '239,125,125' : segment === 'Connectivity' ? '116,227,212' : segment === 'AI' ? '243,190,99' : '183,216,255'
    return { background: `rgba(${color},${alpha})`, borderColor: `rgba(${color},${Math.min(0.38, alpha + 0.08)})` }
  }
  return (
    <Panel pad="p-3">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <PanelTitle icon={Database} title="Capital intensity matrix" kicker="Analyst grid" />
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {lenses.map((item) => <button key={item.id} onClick={() => setLens(item.id)} className={cn('min-h-10 shrink-0 rounded-lg border px-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60', lens === item.id ? 'border-amber/35 bg-amber/10 text-amber' : 'border-white/[0.08] bg-white/[0.025] text-white/58 hover:bg-white/[0.04]')}>{item.label}</button>)}
        </div>
      </div>
      <div className="overflow-auto rounded-xl border border-white/[0.075] bg-black/25">
        <table className="min-w-[760px] w-full border-collapse text-left text-xs">
          <thead className="bg-[#101114] font-mono text-[10px] uppercase tracking-normal text-white/58">
            <tr><th className="px-3 py-2">Segment</th>{periods.map((p) => <th key={p} className="px-3 py-2 text-right">{p}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-white/[0.055]">
            {segments.map((segment) => <tr key={segment}>
              <td className="px-3 py-3 font-[650]" style={{ color: SEGMENT_COLORS[segment] }}>{segment}</td>
              {periods.map((period) => {
                const row = data.financials.segments.find((item) => item.period === period && item.segment === segment)
                const value = valueFor(row, period)
                const packet = row && financialPacket(data, `${segment} segment · ${period}`)
                return <td key={`${segment}-${period}`} className="px-2 py-2 text-right"><button disabled={!row} onClick={() => onInspect(inspectPayload({ title: `${segment} ${active.label} · ${period}`, value: display(value), formula: active.formula, source: 'Segment tables / summary', inputs: row ? [`Revenue ${money(row.revenue)}`, `Operating income ${money(row.op_income)}`, `Adjusted EBITDA, as filed ${money(row.adj_ebitda)}`, `Capex ${money(row.capex)}`] : ['No row in current payload'], packet }))} style={cellStyle(value, segment)} className="min-h-12 w-full rounded-lg border px-3 text-right font-mono text-[12px] text-white/82 hover:brightness-125 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">{row ? display(value) : '—'}</button></td>
              })}
            </tr>)}
          </tbody>
        </table>
      </div>
      <FormulaPill>Active lens: {active.formula}. This is a navigation grid over filing values, not a scorecard.</FormulaPill>
    </Panel>
  )
}

function CashFlowFundingStack({ data, onInspect }) {
  const rows = data.financials.cash_flows
  const maxAbs = Math.max(...rows.flatMap((row) => [row.operating, row.investing, row.financing].map((x) => Math.abs(Number(x || 0)))), 1)
  return (
    <Panel pad="p-3">
      <PanelTitle icon={Gauge} title="Cash flow / funding stack" kicker="What funded the buildout?" />
      <div className="grid gap-2">
        {rows.map((row) => {
          const preFinancing = Number(row.operating || 0) + Number(row.investing || 0)
          const capex = segmentTotal(data, row.period, 'capex')
          const coverage = capex ? margin(row.operating, capex) : null
          const metric = inspectPayload({ title: `Cash flow stack · ${row.period}`, value: `${money(preFinancing)} pre-financing cash flow`, formula: 'Operating cash flow + investing cash flow; segment capex shown separately where available', source: 'Cash flow table; segment tables / summary', inputs: [`Operating cash flow ${money(row.operating)}`, `Investing cash flow ${money(row.investing)}`, `Financing cash flow ${money(row.financing)}`, capex ? `Segment capex ${money(capex)}; OCF coverage ${formatPlainPct(coverage, 1)}` : 'No segment capex row for this period'] })
          return (
            <button key={row.period} onClick={() => onInspect(metric)} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-left hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
              <div className="mb-2 flex items-center justify-between gap-3"><p className="font-mono text-[10px] uppercase tracking-normal text-white/62">{row.period}</p><p className={cn('font-mono text-xs', signedClass(preFinancing))}>Op. + investing {money(preFinancing)}</p></div>
              <div className="grid gap-2 md:grid-cols-3">
                <MiniBar value={row.operating} max={maxAbs} color="#74E3D4" label="Operating" />
                <MiniBar value={Math.abs(row.investing)} max={maxAbs} color="#EF7D7D" label="Investing outflow" />
                <MiniBar value={row.financing} max={maxAbs} color="#B7D8FF" label="Financing" />
              </div>
              {capex > 0 && <p className="mt-2 text-xs leading-5 text-white/58">Segment capex {money(capex)} · OCF coverage {formatPlainPct(coverage, 1)}. Segment capex is not the same line item as investing cash flow.</p>}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

function LiquidityCapitalStack({ data, onInspect }) {
  const latest = balanceRow(data.financials.balance, 'Mar 31 2026')
  const prior = balanceRow(data.financials.balance, 'Dec 31 2025')
  const cashAndSec = Number(latest?.cash || 0) + Number(latest?.marketable_securities || 0)
  const debt = capitalValue(data, 'Total long-term debt')
  const preferred = capitalValue(data, 'Redeemable convertible preferred stock')
  const equity = capitalValue(data, 'Total shareholders’ equity')
  const totalCap = capitalValue(data, 'Total capitalization')
  const stack = [
    { label: 'Long-term debt', value: debt, color: '#EF7D7D' },
    { label: 'Preferred stock', value: preferred, color: '#F3BE63' },
    { label: 'Shareholders’ equity', value: equity, color: '#74E3D4' },
  ]
  return (
    <Panel pad="p-3">
      <PanelTitle icon={Landmark} title="Liquidity and capitalization" kicker="Balance sheet interface" />
      <div className="grid gap-3 lg:grid-cols-[.9fr_1.1fr]">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {[inspectPayload({ title: 'Cash and marketable securities', value: money(cashAndSec), formula: 'Cash + marketable securities', source: 'Balance sheet at Mar. 31, 2026', inputs: [`Cash ${money(latest?.cash)}`, `Marketable securities ${money(latest?.marketable_securities)}`] }), inspectPayload({ title: 'Total liabilities / assets', value: formatPlainPct(margin(latest?.total_liabilities, latest?.total_assets), 1), formula: 'Total liabilities ÷ total assets', source: 'Balance sheet at Mar. 31, 2026', inputs: [`Total liabilities ${money(latest?.total_liabilities)}`, `Total assets ${money(latest?.total_assets)}`] }), inspectPayload({ title: 'PPE / assets', value: formatPlainPct(margin(latest?.pp_e_net, latest?.total_assets), 1), formula: 'Property, plant and equipment, net ÷ total assets', source: 'Balance sheet at Mar. 31, 2026', inputs: [`PP&E ${money(latest?.pp_e_net)}`, `Total assets ${money(latest?.total_assets)}`] }), inspectPayload({ title: 'Current ratio', value: fmtMetric(Number(latest?.total_current_assets) / Number(latest?.current_liabilities), 'multiple', 2), formula: 'Total current assets ÷ current liabilities', source: 'Balance sheet at Mar. 31, 2026', inputs: [`Current assets ${money(latest?.total_current_assets)}`, `Current liabilities ${money(latest?.current_liabilities)}`] })].map((metric) => <MetricButton key={metric.title} metric={metric} onInspect={onInspect}><p className="font-mono text-[9px] uppercase tracking-normal text-white/58">{metric.title}</p><p className="mt-1 text-2xl font-[650] tracking-normal text-spacex">{metric.value}</p><FormulaPill>{metric.formula}</FormulaPill></MetricButton>)}
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3">
          <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">Capitalization stack · Mar. 31, 2026</p>
          <div className="mt-4 overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.04]">
            <div className="flex h-5">
              {stack.map((item) => <button key={item.label} title={`${item.label}: ${money(item.value)}`} onClick={() => onInspect(inspectPayload({ title: item.label, value: money(item.value), formula: 'Capitalization table line item', source: data.capital?.src, inputs: [`${item.label} ${money(item.value)}`, `Total capitalization ${money(totalCap)}`] }))} style={{ width: `${margin(item.value, totalCap)}%`, backgroundColor: item.color }} className="min-w-[3px] opacity-80 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60" />)}
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {stack.map((item) => <div key={item.label} className="flex items-center justify-between gap-3 text-sm"><span className="inline-flex items-center gap-2 text-white/68"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span><span className="font-mono text-white/82">{money(item.value)}</span></div>)}
          </div>
          <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
            <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">Debt components</p>
            <div className="mt-2 grid gap-2">
              {data.capital?.debt?.map((item) => <button key={item.label} onClick={() => onInspect(inspectPayload({ title: item.label, value: money(item.value), formula: 'Filed capitalization debt component', source: data.capital?.src, inputs: [item.note] }))} className="flex justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60"><span className="text-white/62">{item.label}</span><span className="font-mono text-white/80">{money(item.value)}</span></button>)}
            </div>
          </div>
          <FormulaPill>Dec. 2025 cash was {money(prior?.cash)}; Mar. 2026 cash was {money(latest?.cash)} plus {money(latest?.marketable_securities)} of marketable securities.</FormulaPill>
        </div>
      </div>
    </Panel>
  )
}

function OperatingKpiTerminal({ data, onInspect }) {
  const starlink = data.financials.metrics.starlink
  const launches = data.financials.metrics.falcon_launches
  const mass = data.financials.metrics.mass_to_orbit
  const ai = data.financials.metrics.ai?.[0]
  const s2025 = periodRow(starlink, '2025')
  const s2024 = periodRow(starlink, '2024')
  const sQ1 = periodRow(starlink, 'Q1 2026')
  const sQ1Prev = periodRow(starlink, 'Q1 2025')
  const l2025 = periodRow(launches, '2025')
  const m2025 = periodRow(mass, '2025')
  const tonsPerLaunch = Number(m2025?.total || 0) / Number(l2025?.total || 1)
  const aiGrokShare = margin(ai?.grok_ai_feature_maus_m, ai?.maus_m)
  const modules = [
    { title: 'Starlink subscriber / ARPU trend', color: '#74E3D4', rows: [['Subscribers 2025', `${s2025?.subscribers_m}M`, `${formatPct(pctChange(s2025?.subscribers_m, s2024?.subscribers_m), 1)} YoY`], ['Q1 subscribers', `${sQ1?.subscribers_m}M`, `${formatPct(pctChange(sQ1?.subscribers_m, sQ1Prev?.subscribers_m), 1)} YoY`], ['ARPU 2025', `$${s2025?.arpu}`, `${formatPct(pctChange(s2025?.arpu, s2024?.arpu), 1)} YoY`], ['Q1 ARPU', `$${sQ1?.arpu}`, `${formatPct(pctChange(sQ1?.arpu, sQ1Prev?.arpu), 1)} YoY`]], source: 'Starlink metrics table', formula: 'Subscribers and ARPU are filed operating metrics; growth/change is derived from comparable periods.' },
    { title: 'Space throughput', color: '#B7D8FF', rows: [['Falcon launches 2025', number(l2025?.total), `${number(l2025?.customer)} customer / ${number(l2025?.internal)} internal`], ['Mass to orbit 2025', number(m2025?.total), `${number(m2025?.customer)} customer / ${number(m2025?.internal)} internal`], ['Mass-to-orbit / Falcon launch', fmtMetric(tonsPerLaunch, 'number', 1), 'derived ratio; payload unit follows filing table'], ['Customer launch mix', formatPlainPct(margin(l2025?.customer, l2025?.total), 1), 'derived from launch counts']], source: 'Mass-to-orbit and Falcon launch tables', formula: 'Operational throughput only; no revenue per launch is inferred.' },
    { title: 'AI scale snapshot', color: '#F3BE63', rows: [['Nameplate compute', `${ai?.nameplate_compute_gw} GW`, ai?.period], ['Supported accounts (filing-defined)', `${ai?.supported_accounts_b}B`, 'definition depends on filing methodology'], ['MAUs (filing-defined)', `${ai?.maus_m}M`, 'definition depends on filing methodology'], ['Grok feature MAUs', `${ai?.grok_ai_feature_maus_m}M`, `${formatPlainPct(aiGrokShare, 1)} of MAUs`], ['Daily posts', `${ai?.daily_posts_m}M`, 'filed operating metric']], source: 'AI operating metrics table', formula: 'One point-in-time filing snapshot; no trend or monetization conversion inferred. Definitions follow filing language.' },
  ]
  return (
    <Panel pad="p-3">
      <PanelTitle icon={Gauge} title="Operating KPIs" kicker="Metrics tied back to the financial story" />
      <div className="grid gap-3 xl:grid-cols-3">
        {modules.map((mod) => <button key={mod.title} onClick={() => onInspect(inspectPayload({ title: mod.title, value: mod.rows[0][1], formula: mod.formula, source: mod.source, inputs: mod.rows.map((row) => `${row[0]}: ${row[1]} · ${row[2]}`) }))} className="rounded-xl border border-white/[0.075] bg-white/[0.025] p-3 text-left hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
          <p className="text-lg font-[650] tracking-normal" style={{ color: mod.color }}>{mod.title}</p>
          <div className="mt-3 grid gap-2">
            {mod.rows.map((row) => <div key={row[0]} className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/[0.045] pb-1.5 last:border-0"><span className="text-xs text-white/58">{row[0]}<br /><span className="font-mono text-[9px] text-white/62">{row[2]}</span></span><span className="text-right font-mono text-sm text-white/82">{row[1]}</span></div>)}
          </div>
          <Source>{mod.source}</Source>
        </button>)}
      </div>
    </Panel>
  )
}

function CompactPacketPreview({ packet }) {
  if (!packet) return null
  return (
    <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">Source packet</p>
      <p className="mt-2 text-sm font-[650] leading-5 text-spacex">{packet.title}</p>
      <p className="mt-2 text-xs leading-5 text-white/58">{trimText(packet.detail, 180)}</p>
      <Source>{packet.source}</Source>
      <button onClick={() => setHash(packet.hash)} className="mt-3 min-h-10 rounded-lg bg-spacex px-3 text-xs font-[650] text-void hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">Open packet</button>
    </div>
  )
}

function FinancialMetricInspector({ metric, data, compact = false, onClose }) {
  return (
    <Panel pad="p-3" className={cn(compact ? 'max-h-[78svh] overflow-auto' : 'sticky top-[72px] self-start xl:max-h-[calc(100svh-96px)] xl:overflow-auto')}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Metric inspector</p>
        {onClose && <button onClick={onClose} className="rounded-lg border border-white/10 bg-white/[0.035] px-2 py-1 text-xs text-white/62">Close</button>}
      </div>
      <h3 className="mt-2 text-xl font-[650] leading-6 tracking-normal text-spacex">{metric?.title || 'Select any financial metric'}</h3>
      <p className="mt-2 text-3xl font-[690] tracking-normal text-white/88">{metric?.value || 'Source-linked math'}</p>
      <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/25 p-3">
        <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">Formula / method</p>
        <p className="mt-2 text-sm leading-6 text-white/74">{metric?.formula || 'Click a KPI, segment cell, capital stack item, or operating metric to see the filed inputs and calculation method.'}</p>
      </div>
      <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="font-mono text-[9px] uppercase tracking-normal text-white/58">Filed inputs</p>
        {metric?.inputs?.length ? <ul className="mt-2 space-y-1.5 text-sm leading-5 text-white/68">{metric.inputs.map((input) => <li key={input}>• {input}</li>)}</ul> : <p className="mt-2 text-sm leading-6 text-white/58">Inputs appear here after selection.</p>}
      </div>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-normal text-white/58">{metric?.status === 'filed' ? 'Filed value' : 'Derived from filed values'}{metric?.rawValue !== null && metric?.rawValue !== undefined ? ` · raw ${metric.rawValue}` : ''}</p>
      {metric?.note && <p className="mt-3 rounded-xl border border-amber/15 bg-amber/10 p-3 text-xs leading-5 text-amber/90">{metric.note}</p>}
      <Source>{metric?.source || 'Local S‑1 financial payload'}</Source>
      <div className="mt-4 flex flex-wrap gap-2">
        {metric?.packet && <button onClick={() => setHash(metric.packet.hash)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-spacex px-3 text-xs font-[650] text-void hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">Open packet <ChevronRight size={14} /></button>}
        <button onClick={() => setHash('/atlas', { type: 'financial', q: metric?.title || '' })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs text-white/74 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60"><Search size={14} /> Find in Atlas</button>
      </div>
      <CompactPacketPreview packet={metric?.packet} />
    </Panel>
  )
}

function FinancialInspectorSheet({ open, metric, data, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-end bg-black/55 p-2 backdrop-blur-sm xl:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full" initial={{ y: 48 }} animate={{ y: 0 }} exit={{ y: 48 }} transition={{ duration: 0.18 }}>
            <FinancialMetricInspector metric={metric} data={data} compact onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function AuditFinancialTables({ data }) {
  const annualSegments = data.financials.segments.filter((x) => ['2023', '2024', '2025'].includes(x.period))
  const q1Segments = data.financials.segments.filter((x) => x.period === 'Q1 2026')
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Panel><PanelTitle icon={Table2} title="Consolidated snapshot" kicker="Audit table" /><DataTable maxHeight="max-h-[330px]" columns={[
        { key: 'period', label: 'Period', className: 'font-mono text-white/58' },
        { key: 'revenue', label: 'Revenue', render: (r) => money(r.revenue) },
        { key: 'op_income', label: 'Op. income', render: (r) => <Value v={r.op_income} /> },
        { key: 'net_income', label: 'Net income', render: (r) => <Value v={r.net_income} /> },
        { key: 'adjusted_ebitda', label: 'Adj. EBITDA', render: (r) => hasNumber(r.adjusted_ebitda) ? money(r.adjusted_ebitda) : '—' },
      ]} rows={data.financials.consolidated} mobileCard={(r) => <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><p className="font-mono text-[10px] uppercase tracking-normal text-white/62">{r.period}</p><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/60"><span>Revenue <b className="block text-base text-white/84">{money(r.revenue)}</b></span><span>Net income <b className="block text-base text-white/84"><Value v={r.net_income} /></b></span><span>Op. income <b className="block text-base text-white/84"><Value v={r.op_income} /></b></span><span>Adj. EBITDA <b className="block text-base text-white/84">{hasNumber(r.adjusted_ebitda) ? money(r.adjusted_ebitda) : '—'}</b></span></div><p className="mt-2 font-mono text-[10px] text-white/58">SRC · Consolidated snapshot</p></div>} /></Panel>
      <Panel><PanelTitle icon={Layers3} title="Q1 2026 segment snapshot" kicker="Audit table" /><DataTable maxHeight="max-h-[330px]" columns={[
        { key: 'segment', label: 'Segment', render: (r) => <span style={{ color: SEGMENT_COLORS[r.segment] }} className="font-[650]">{r.segment}</span> },
        { key: 'revenue', label: 'Revenue', render: (r) => money(r.revenue) },
        { key: 'op_income', label: 'Op. income', render: (r) => <Value v={r.op_income} /> },
        { key: 'adj_ebitda', label: 'Seg. Adj. EBITDA', render: (r) => <Value v={r.adj_ebitda} /> },
        { key: 'capex', label: 'Capex', render: (r) => money(r.capex) },
      ]} rows={q1Segments} mobileCard={(r) => <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-base font-[650]" style={{ color: SEGMENT_COLORS[r.segment] }}>{r.segment}</p><p className="mt-2 text-xs leading-5 text-white/60">Revenue {money(r.revenue)} · Op. income {money(r.op_income)} · Segment Adj. EBITDA {money(r.adj_ebitda)} · Capex {money(r.capex)}</p><p className="mt-2 font-mono text-[10px] text-white/58">SRC · Q1 2026 segment snapshot</p></div>} /></Panel>
      <Panel><PanelTitle icon={Database} title="Annual segment history" kicker="Audit table" /><DataTable maxHeight="max-h-[460px]" columns={[
        { key: 'period', label: 'Period', className: 'font-mono text-white/58' },
        { key: 'segment', label: 'Segment', render: (r) => <span style={{ color: SEGMENT_COLORS[r.segment] }}>{r.segment}</span> },
        { key: 'revenue', label: 'Revenue', render: (r) => money(r.revenue) },
        { key: 'op_income', label: 'Op. income', render: (r) => <Value v={r.op_income} /> },
        { key: 'adj_ebitda', label: 'Adj. EBITDA', render: (r) => <Value v={r.adj_ebitda} /> },
        { key: 'capex', label: 'Capex', render: (r) => money(r.capex) },
      ]} rows={annualSegments} mobileCard={(r) => <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><p className="font-mono text-[10px] uppercase tracking-normal text-white/62">{r.period}</p><p className="mt-1 text-base font-[650]" style={{ color: SEGMENT_COLORS[r.segment] }}>{r.segment}</p><p className="mt-2 text-xs leading-5 text-white/60">Revenue {money(r.revenue)} · Op. income {money(r.op_income)} · Adj. EBITDA {money(r.adj_ebitda)} · Capex {money(r.capex)}</p><p className="mt-2 font-mono text-[10px] text-white/58">SRC · Annual segment history</p></div>} /></Panel>
      <Panel><PanelTitle icon={Gauge} title="Liquidity / cash flow" kicker="Audit table" /><DataTable maxHeight="max-h-[220px]" columns={[
        { key: 'period', label: 'Period' },
        { key: 'operating', label: 'Operating', render: (r) => <Value v={r.operating} /> },
        { key: 'investing', label: 'Investing', render: (r) => <Value v={r.investing} /> },
        { key: 'financing', label: 'Financing', render: (r) => <Value v={r.financing} /> },
      ]} rows={data.financials.cash_flows} mobileCard={(r) => <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><p className="font-mono text-[10px] uppercase tracking-normal text-white/62">{r.period}</p><p className="mt-2 text-xs leading-5 text-white/60">Operating {money(r.operating)} · Investing {money(r.investing)} · Financing {money(r.financing)}</p><p className="mt-2 font-mono text-[10px] text-white/58">SRC · Cash flow table</p></div>} /></Panel>
    </div>
  )
}

function FinancialSpine({ data, onInspect }) {
  const y2024 = periodRow(data.financials.consolidated, '2024')
  const y2025 = periodRow(data.financials.consolidated, '2025')
  const q12025 = periodRow(data.financials.consolidated, 'Q1 2025')
  const q12026 = periodRow(data.financials.consolidated, 'Q1 2026')
  const latest = balanceRow(data.financials.balance, 'Mar 31 2026')
  const q1Capex = segmentTotal(data, 'Q1 2026', 'capex')
  const aiQ1 = data.financials.segments.find((row) => row.period === 'Q1 2026' && row.segment === 'AI')
  const cashAndSec = Number(latest?.cash || 0) + Number(latest?.marketable_securities || 0)
  const preFinancingQ1 = Number(periodRow(data.financials.cash_flows, 'Q1 2026')?.operating || 0) + Number(periodRow(data.financials.cash_flows, 'Q1 2026')?.investing || 0)
  const cards = [
    inspectPayload({ title: 'Growth', value: `${formatPct(pctChange(y2025?.revenue, y2024?.revenue), 1)} FY / ${formatPct(pctChange(q12026?.revenue, q12025?.revenue), 1)} Q1`, formula: 'Revenue growth from filed comparable periods', source: 'financials.consolidated revenue rows', inputs: [`2024 revenue ${money(y2024?.revenue)}`, `2025 revenue ${money(y2025?.revenue)}`, `Q1 2025 revenue ${money(q12025?.revenue)}`, `Q1 2026 revenue ${money(q12026?.revenue)}`], tone: 'positive', packet: financialPacket(data, 'Consolidated · 2025') }),
    inspectPayload({ title: 'Profitability', value: `${formatPlainPct(margin(q12026?.op_income, q12026?.revenue), 1)} op. / ${formatPlainPct(margin(q12026?.adjusted_ebitda, q12026?.revenue), 1)} Adj. EBITDA`, formula: 'Q1 operating margin and Adjusted EBITDA, as filed, margin', source: 'financials.consolidated[period="Q1 2026"]', inputs: [`Operating income ${money(q12026?.op_income)}`, `Adjusted EBITDA, as filed ${money(q12026?.adjusted_ebitda)}`, `Revenue ${money(q12026?.revenue)}`], tone: 'negative', packet: financialPacket(data, 'Consolidated · Q1 2026') }),
    inspectPayload({ title: 'Capital intensity', value: `${formatPlainPct(margin(aiQ1?.capex, q1Capex), 1)} AI capex mix`, formula: 'AI segment capex ÷ total Q1 segment capex', source: 'financials.segments[period="Q1 2026"]', inputs: [`AI capex ${money(aiQ1?.capex)}`, `Total segment capex ${money(q1Capex)}`, `AI capex/revenue ${formatPlainPct(margin(aiQ1?.capex, aiQ1?.revenue), 1)}`], tone: 'warning', packet: financialPacket(data, 'AI segment · Q1 2026') }),
    inspectPayload({ title: 'Liquidity / funding', value: `${money(preFinancingQ1)} op.+inv. / ${money(cashAndSec)} liquid assets`, formula: 'Q1 operating + investing cash flow; cash + marketable securities', source: 'financials.cash_flows and financials.balance', inputs: [`Q1 operating cash flow ${money(periodRow(data.financials.cash_flows, 'Q1 2026')?.operating)}`, `Q1 investing cash flow ${money(periodRow(data.financials.cash_flows, 'Q1 2026')?.investing)}`, `Cash ${money(latest?.cash)}`, `Marketable securities ${money(latest?.marketable_securities)}`], tone: 'warning' }),
  ]
  return (
    <div className="grid gap-2 xl:grid-cols-4">
      {cards.map((card) => (
        <MetricButton key={card.title} metric={card} onInspect={onInspect} tone={card.tone}>
          <p className="font-mono text-[9px] uppercase tracking-normal text-white/62">Financial spine</p>
          <h3 className="mt-1 text-lg font-[650] tracking-normal text-spacex">{card.title}</h3>
          <p className="mt-2 text-xl font-[670] leading-6 tracking-normal text-white/88">{card.value}</p>
          <FormulaPill>{card.formula}</FormulaPill>
        </MetricButton>
      ))}
    </div>
  )
}

function Financials({ data }) {
  const [period, setPeriod] = useState('Q1 2026')
  const [lens, setLens] = useState('capexIntensity')
  const [showAudit, setShowAudit] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const isWide = useMediaQuery('(min-width: 1280px)')
  const q12026 = periodRow(data.financials.consolidated, 'Q1 2026')
  const initialMetric = inspectPayload({ title: 'Q1 2026 financial profile', value: `${money(q12026?.revenue)} revenue`, formula: 'Filed Q1 2026 consolidated snapshot; click any card/cell to inspect inputs', source: 'financials.consolidated[period="Q1 2026"]', inputs: [`Revenue ${money(q12026?.revenue)}`, `Operating income ${money(q12026?.op_income)}`, `Net income ${money(q12026?.net_income)}`, `Adjusted EBITDA, as filed ${money(q12026?.adjusted_ebitda)}`], packet: financialPacket(data, 'Consolidated · Q1 2026'), status: 'filed' })
  const [selectedMetric, setSelectedMetric] = useState(initialMetric)
  const inspect = (metric) => {
    setSelectedMetric(metric)
    if (!isWide) setInspectorOpen(true)
  }
  return (
    <Section dense eyebrow="Financial workbench" title="Financial filing workbench: growth, margins, capex, liquidity" aside="Filed values and derived ratios only. No valuation, market data, comps, forecasts, or invented scores.">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="grid gap-3">
          <FinancialBasisBanner data={data} onInspect={inspect} />
          <Panel pad="p-3" className="border-white/[0.07] bg-white/[0.018]"><p className="font-mono text-[10px] uppercase tracking-normal text-white/62">Units and method</p><p className="mt-1 text-xs leading-5 text-white/64">Financial statement values are normalized to USD millions in the local S‑1 payload; display values are rounded for readability. Ratio cards are marked as derived and show formulas in the inspector.</p></Panel>
          <FinancialSpine data={data} onInspect={inspect} />
          <InvestorKpiRibbon data={data} onInspect={inspect} />
          <ConsolidatedTrendStrip data={data} onInspect={inspect} />
          <SegmentCommandCenter data={data} period={period} setPeriod={setPeriod} onInspect={inspect} />
          <SegmentHeatmap data={data} lens={lens} setLens={setLens} onInspect={inspect} />
          <div className="grid gap-3 xl:grid-cols-[1.08fr_.92fr]">
            <CashFlowFundingStack data={data} onInspect={inspect} />
            <LiquidityCapitalStack data={data} onInspect={inspect} />
          </div>
          <OperatingKpiTerminal data={data} onInspect={inspect} />
          <Panel pad="p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Audit mode</p>
                <h3 className="mt-1 text-lg font-[650] tracking-normal text-spacex">Raw filing tables stay one click away</h3>
                <p className="mt-1 text-sm leading-6 text-white/62">Use this when you want the source rows rather than the workbench’s derived ratios.</p>
              </div>
              <button onClick={() => setShowAudit((v) => !v)} className="min-h-11 rounded-lg border border-white/10 bg-white/[0.035] px-4 text-xs font-[650] text-white/76 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">{showAudit ? 'Hide audit tables' : 'Show audit tables'}</button>
            </div>
            {showAudit && <div className="mt-3"><AuditFinancialTables data={data} /></div>}
          </Panel>
        </div>
        <div className="hidden xl:block">
          <FinancialMetricInspector metric={selectedMetric} data={data} />
        </div>
      </div>
      <FinancialInspectorSheet open={inspectorOpen} metric={selectedMetric} data={data} onClose={() => setInspectorOpen(false)} />
    </Section>
  )
}

function Risks({ data, route }) {
  const [query, setQuery] = useState(route.params.q || '')
  const [group, setGroup] = useState(route.params.group || 'all')
  useEffect(() => { setQuery(route.params.q || ''); setGroup(route.params.group || 'all') }, [route.params.q, route.params.group])
  const grouped = useMemo(() => data.risks.map((r) => ({ ...r, theme: inferRiskTheme(r.heading, r.group), packet: data.atlasRows.find((p) => p.type === 'risk' && p.title === r.heading) })), [data])
  const groups = ['all', ...Array.from(new Set(grouped.map((r) => r.theme)))]
  const update = (next = {}) => setHash('/risks', { q: next.q ?? query, group: next.group ?? group })
  const filtered = grouped.filter((r) => (group === 'all' || r.theme === group) && (!query || `${r.theme} ${r.heading}`.toLowerCase().includes(query.toLowerCase())))
  return (
    <Section dense eyebrow="Risk radar" title="Actual risk factors, linkable by theme" aside="No invented risk score: this is structure, grouping, search and source packets.">
      <div className="grid gap-3 xl:grid-cols-[300px_1fr]">
        <Panel pad="p-3" className="self-start">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-white/[0.1] bg-black/30 px-3 focus-within:border-white/24"><Search size={15} className="text-white/58" /><input aria-label="Search risk factors" value={query} onChange={(e) => { setQuery(e.target.value); update({ q: e.target.value }) }} placeholder="Search risk factors…" className="w-full bg-transparent text-base outline-none placeholder:text-white/36 sm:text-sm" /></label>
          <div className="mt-3 space-y-2">{groups.map((g) => <button key={g} onClick={() => { setGroup(g); update({ group: g }) }} className={cn('flex min-h-11 w-full justify-between rounded-lg border px-3 py-2 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60', group === g ? 'border-red/40 bg-red/10 text-white/86' : 'border-white/[0.07] text-white/58 hover:bg-white/[0.035]')}><span>{g === 'all' ? 'All risk themes' : g}</span><span className="font-mono">{g === 'all' ? grouped.length : grouped.filter((r) => r.theme === g).length}</span></button>)}</div>
        </Panel>
        <div className="grid gap-3">
          <RiskRadar data={data} onPacket={(p) => setHash(p.hash)} compact />
          <DataTable maxHeight="max-h-[520px]" empty="No matching risk factors. Try a broader term or clear the theme filter." columns={[
            { key: 'theme', label: 'Theme', className: 'w-[210px] font-mono text-[10px] uppercase tracking-normal text-amber' },
            { key: 'heading', label: `Risk factor (${filtered.length})`, render: (r) => <button onClick={() => r.packet && setHash(r.packet.hash)} className="text-left text-[13px] leading-5 text-white/76 hover:text-spacex focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">{r.heading}</button> },
          ]} rows={filtered} mobileCard={(r) => (
            <button onClick={() => r.packet && setHash(r.packet.hash)} className="block min-h-16 w-full rounded-lg border border-white/[0.07] bg-white/[0.025] p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">
              <span className="font-mono text-[10px] uppercase tracking-normal text-amber">{r.theme}</span>
              <span className="mt-1 block text-sm leading-5 text-white/78">{r.heading}</span>
              <span className="mt-2 block font-mono text-[10px] text-white/58">SRC · Risk Factors</span>
            </button>
          )} />
        </div>
      </div>
    </Section>
  )
}

function Governance({ data }) {
  return (
    <>
      <Section dense eyebrow="Governance" title="Control, management and compensation tables">
        <div className="grid gap-3 xl:grid-cols-[1.2fr_.8fr]">
          <Panel><PanelTitle icon={Users} title="Directors and named executives" /><DataTable columns={[
            { key: 'name', label: 'Name', render: (r) => <span className="font-[650] text-white/82">{r.name}</span> },
            { key: 'role', label: 'Role' },
            { key: 'age', label: 'Age', className: 'font-mono text-white/62' },
            { key: 'notes', label: 'Disclosure note', render: (r) => trimText(r.notes, 140) },
            { key: 'src', label: 'Source', className: 'font-mono text-[10px] text-white/58', render: (r) => trimText(r.src, 80) },
          ]} rows={data.governance} mobileCard={(r) => <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-base font-[650] text-white/84">{r.name}</p><p className="mt-1 text-xs leading-5 text-white/62">{r.role}</p><p className="mt-2 text-xs leading-5 text-white/62">{trimText(r.notes, 180)}</p><p className="mt-2 font-mono text-[10px] text-white/58">SRC · {trimText(r.src, 80)}</p></div>} /></Panel>
          <Panel><PanelTitle icon={Landmark} title="Executive compensation" /><DataTable columns={[
            { key: 'person', label: 'Person' },
            { key: '2025_total', label: '2025 total', className: 'font-mono text-white/74' },
            { key: 'notes', label: 'Notes', render: (r) => trimText(r.notes, 160) },
          ]} rows={data.compensation} mobileCard={(r) => <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-base font-[650] text-white/84">{r.person}</p><p className="mt-1 font-mono text-xs text-spacex">2025 total · {r['2025_total']}</p><p className="mt-2 text-xs leading-5 text-white/62">{trimText(r.notes, 180)}</p><p className="mt-2 font-mono text-[10px] text-white/58">SRC · Executive compensation</p></div>} /></Panel>
        </div>
      </Section>
      <Section dense eyebrow="Related parties" title="Related-party disclosures in one scan"><DataTable maxHeight="max-h-[560px]" columns={[
        { key: 'party', label: 'Party', className: 'w-[260px] font-[650] text-white/80' },
        { key: 'items', label: 'Disclosures', render: (r) => <ul className="space-y-1">{r.items.map((x) => <li key={x}>• {x}</li>)}</ul> },
        { key: 'src', label: 'Source', className: 'w-[170px] font-mono text-[10px] text-white/58' },
      ]} rows={data.related} mobileCard={(r) => <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-base font-[650] text-white/84">{r.party}</p><ul className="mt-2 space-y-1 text-xs leading-5 text-white/58">{r.items.map((x) => <li key={x}>• {x}</li>)}</ul><p className="mt-2 font-mono text-[10px] text-white/58">SRC · {r.src}</p></div>} /></Section>
    </>
  )
}

function SourceTextReader({ current, snippetInfo, query }) {
  const lines = (snippetInfo?.text || '').split('\n')
  const label = current?.label || 'Source document'
  const visibleChars = snippetInfo?.text?.length || 0
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#080b10] shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
      <div className="flex flex-col gap-2 border-b border-white/[0.07] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-[650] leading-5 text-white/84">{label}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-normal text-white/58">
            {number(visibleChars)} visible chars · lines {snippetInfo?.startLine || 1}–{snippetInfo?.endLine || lines.length}
            {snippetInfo?.truncatedStart ? ' · starts mid-document' : ''}
            {snippetInfo?.truncatedEnd ? ' · clipped for performance' : ''}
          </p>
        </div>
        {query?.trim() && <p className="rounded-full border border-spacex/20 bg-spacex/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-normal text-spacex">Search context · {query.trim()}</p>}
      </div>
      <div
        role="region"
        tabIndex={0}
        aria-label={`Readable extracted text for ${label}`}
        className="max-h-[64svh] overflow-auto rounded-b-xl bg-[#0b0f16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60 md:max-h-[760px]"
      >
        <ol className="min-w-0 divide-y divide-white/[0.045] py-2">
          {lines.map((line, i) => (
            <li key={`${snippetInfo?.startLine || 1}-${i}`} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 px-3 py-1.5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:px-4">
              <span aria-hidden="true" className="select-none pt-[2px] text-right font-mono text-[11px] leading-6 text-white/58">{(snippetInfo?.startLine || 1) + i}</span>
              <span className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-white/82 sm:text-[13.5px]">{line || '\u00A0'}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function Sources({ data, sourceState, route }) {
  const { source, loading, error, load } = sourceState
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [selected, setSelected] = useState(0)
  const [query, setQuery] = useState(route.params.q || '')
  useEffect(() => { load() }, [])
  useEffect(() => { setQuery(route.params.q || '') }, [route.params.q])
  const sourceItems = useMemo(() => {
    if (!source) return []
    return [
      { label: 'Main S‑1 extracted text', text: source.main_text ?? '' },
      { label: 'EX-FILING FEES', text: source.exfilingfees ?? '' },
      ...Object.entries(source.exhibits ?? {}).map(([label, text]) => ({ label, text })),
      { label: 'OCR bundle', text: source.ocr ?? '' },
    ]
  }, [source])
  const current = sourceItems[selected] ?? sourceItems[0]
  useEffect(() => {
    if (!sourceItems.length || !route.params.doc) return
    const idx = sourceItems.findIndex((item) => item.label === route.params.doc)
    if (idx >= 0 && idx !== selected) setSelected(idx)
  }, [sourceItems, route.params.doc, selected])
  const snippetInfo = useMemo(() => {
    const text = current?.text ?? ''
    const q = query.trim().toLowerCase()
    const limit = isMobile ? 8000 : 22000
    const makeInfo = (start, end, noMatch = false) => {
      const clipped = text.slice(start, end)
      const startLine = text.slice(0, start).split('\n').length
      const endLine = startLine + clipped.split('\n').length - 1
      return {
        text: clipped,
        start,
        end: start + clipped.length,
        total: text.length,
        startLine,
        endLine,
        truncatedStart: start > 0,
        truncatedEnd: start + clipped.length < text.length,
        noMatch,
      }
    }
    if (!q) return makeInfo(0, limit)
    const idx = text.toLowerCase().indexOf(q)
    if (idx < 0) return makeInfo(0, 0, true)
    const start = Math.max(0, idx - 2200)
    return makeInfo(start, idx + 12000)
  }, [current, query, isMobile])
  if (loading && !source) return <Section dense eyebrow="Audit layer" title="Loading source payload"><Panel><p aria-live="polite" className="text-sm text-white/60">Fetching full source/exhibit/OCR text on demand…</p></Panel></Section>
  if (error) return <Section dense eyebrow="Audit layer" title="Source payload failed"><Panel><p aria-live="polite" className="text-sm text-red">{error}</p></Panel></Section>
  return (
    <Section dense eyebrow="Audit layer" title="Full extracted source text" aside="Loaded only when requested so the public first paint is not blocked by megabytes of audit text.">
      <div className="grid gap-3 xl:grid-cols-[360px_1fr]">
        <Panel pad="p-3"><div className="no-scrollbar flex gap-2 overflow-x-auto xl:block xl:max-h-[720px] xl:space-y-2 xl:overflow-auto">{sourceItems.map((item, i) => <button key={item.label} onClick={() => { setSelected(i); setQuery(''); setHash('/sources', { doc: item.label }) }} className={cn('block min-h-12 min-w-[210px] rounded-lg border px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60 xl:w-full', i === selected ? 'border-spacex/30 bg-white/[0.06]' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]')}><p className="text-xs font-[650] text-white/78">{item.label}</p><p className="mt-1 font-mono text-[10px] text-white/58">{number(item.text.length)} chars</p></button>)}</div></Panel>
        <Panel>
          <label className="mb-3 flex min-h-11 items-center gap-2 rounded-lg border border-white/[0.1] bg-black/30 px-3 focus-within:border-white/24"><Search size={15} className="text-white/58" /><input aria-label="Search current source document" value={query} onChange={(e) => { setQuery(e.target.value); setHash('/sources', { q: e.target.value, doc: current?.label }) }} placeholder="Search current source document…" className="w-full bg-transparent text-base outline-none placeholder:text-white/36 sm:text-sm" /></label>
          <div className="mb-3 flex flex-wrap gap-2">
            <button onClick={() => current && copyText(`SRC · ${current.label}`, () => {})} className="min-h-11 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">Copy source label</button>
            <button onClick={() => snippetInfo?.text && copyText(snippetInfo.text, () => {})} disabled={!snippetInfo?.text} className="min-h-11 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs text-white/70 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60">Copy visible text</button>
          </div>
          {snippetInfo?.text ? <SourceTextReader current={current} snippetInfo={snippetInfo} query={query} /> : <div className="rounded-xl border border-white/[0.06] bg-black/35 p-8 text-center text-sm leading-6 text-white/62">No matches in the current source document. Try a broader term or clear the search.</div>}
        </Panel>
      </div>
    </Section>
  )
}

function ExternalModel({ data }) {
  const model = data.kubinModel
  const [surface, setSurface] = useState('scenario')
  const defaults = useMemo(() => model ? getScenarioDefaults(model) : null, [model])
  const [inputs, setInputs] = useState({
    offerPrice: 125,
    primaryShares: 800000000,
    greenshoePct: 0.15,
    includeOptions: true,
    includeRsus: true,
    includePerformanceAwards: true,
    includeEchostarShares: true,
    proceedsTreatment: 'primary-plus-greenshoe',
  })
  useEffect(() => {
    if (!defaults) return
    setInputs((prev) => ({ ...prev, offerPrice: defaults.offerPrice, primaryShares: defaults.primaryShares, greenshoePct: defaults.greenshoePct }))
  }, [defaults])
  if (!model || !defaults) return <Section dense eyebrow="External model" title="External model unavailable" aside="The attribution/model payload did not load." />

  const scenario = calculateKubinScenario(defaults, inputs)
  const fmtB = (v) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return '—'
    return n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 1 : 2)}T` : `$${n.toLocaleString()}B`
  }
  const fmtMoneyM = (v) => Number.isFinite(Number(v)) ? `$${(Number(v) / 1000).toFixed(Number(v) >= 100000 ? 1 : 2)}B` : '—'
  const fmtShares = (v) => Number.isFinite(Number(v)) ? `${(Number(v) / 1_000_000_000).toFixed(2)}B` : '—'
  const pct = (v) => Number.isFinite(Number(v)) ? `${(Number(v) * 100).toFixed(1)}%` : '—'
  const multiple = (v) => Number.isFinite(Number(v)) ? `${Number(v).toFixed(1)}×` : '—'
  const updateNumber = (key, parser = Number) => (event) => setInputs((prev) => ({ ...prev, [key]: parser(event.target.value) }))
  const tamRows = model.tam?.segments || []
  const kpiRows = (model.kpis?.rows || []).filter((row) => ['Total revenue growth', 'Gross margin', 'Operating margin', 'Net margin', 'Adjusted EBITDA'].includes(row.Metric)).slice(0, 8)
  const shareRows = (model.shareCount?.components || []).filter((row) => row['Known Shares'] || /offered|over-allotment|placeholder/i.test(row.Component || '')).slice(0, 9)
  const offering = model.offering || {}
  const checks = (model.checks?.rows || []).filter((row) => row.Status).slice(0, 8)
  const rawSheetUrl = 'https://docs.google.com/spreadsheets/d/1VnnyM1h6-JS1yN3yFyflQ9gnw-C3fzU0/edit?usp=sharing&rm=minimal'
  const xlsxUrl = publicAsset(model.source.localXlsx)
  const chip = 'rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-normal'
  const outputCards = [
    ['Gross primary proceeds', fmtMoneyM(scenario.primaryProceedsM), 'User input × primary shares'],
    ['Proceeds incl. greenshoe', fmtMoneyM(scenario.proceedsInclGreenshoeM), 'Primary plus selected over-allotment %'],
    ['Basic post-offering shares', fmtShares(scenario.basicPostOfferingShares), 'Pre-IPO shares + primary IPO shares'],
    ['Fully diluted shares', fmtShares(scenario.fullyDilutedShares), 'Basic incl. greenshoe + selected dilution toggles'],
    ['Implied equity value', fmtMoneyM(scenario.equityValueM), 'Offer price × fully diluted shares'],
    ['Implied enterprise value', fmtMoneyM(scenario.enterpriseValueM), 'Equity value + debt − cash/securities/proceeds treatment'],
    ['Ownership sold / dilution', pct(scenario.ownershipSoldInclGreenshoe), 'Primary + greenshoe / post-offering shares incl. greenshoe'],
    ['EV / FY2025 revenue', multiple(scenario.evRevenue2025), `${fmtMoneyM(scenario.revenue2025M)} FY2025 revenue denominator`],
    ['EV / FY2025 Adj. EBITDA', multiple(scenario.evAdjustedEbitda2025), `${fmtMoneyM(scenario.adjustedEbitda2025M)} FY2025 Adj. EBITDA denominator`],
  ]
  return (
    <Section dense eyebrow="External open-source model" title="Jared Kubin’s SpaceX IPO model adds a credited scenario layer." aside="This tab is an external model workbench. It separates filed S‑1 facts, Jared model assumptions, user inputs, and dashboard calculations; it is not a filing fact layer or an exact spreadsheet formula clone.">
      <Panel pad="p-4 sm:p-5" className="border-cyan/16 bg-cyan/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-normal text-cyan/78">Credited model layer</p>
            <h2 className="mt-2 text-3xl font-[720] leading-tight tracking-normal text-spacex">OCCUPY MARS: SpaceX IPO first cut</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/76">Model by <b className="text-white">Jared L. Kubin</b> <a className="text-cyan underline decoration-cyan/30 underline-offset-4" href="https://x.com/JaredKubin" target="_blank" rel="noreferrer">@JaredKubin on X</a>. The workbench below uses selected assumptions from Jared’s open model to stress test IPO mechanics, share count and EV bridge inputs.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-white/72">
              <span className={`${chip} border-white/14 bg-white/[0.035]`}>Filed S‑1 fact</span>
              <span className={`${chip} border-cyan/20 bg-cyan/10 text-cyan`}>Jared assumption</span>
              <span className={`${chip} border-amber/24 bg-amber/10 text-amber`}>User input</span>
              <span className={`${chip} border-white/14 bg-black/20`}>Dashboard calculation</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a href={model.source.originalUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-spacex px-3 text-xs font-[700] text-void hover:bg-white"><ExternalLink size={14} /> Google Sheet</a>
            <a href={xlsxUrl} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs font-[620] text-white/76 hover:bg-white/[0.06]"><Download size={14} /> Download XLSX</a>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {[['scenario','Scenario Workbench'], ['sheet','Original Sheet']].map(([id, label]) => <button key={id} onClick={() => setSurface(id)} className={cn('min-h-11 rounded-lg border px-3 text-xs font-[720]', surface === id ? 'border-spacex/35 bg-white/[0.08] text-spacex' : 'border-white/10 bg-black/20 text-white/68')}>{label}</button>)}
        </div>
      </Panel>

      {surface === 'scenario' ? (
        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
          <Panel pad="p-4" className="self-start">
            <p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Scenario Workbench · v1 scope</p>
            <h3 className="mt-1 text-xl font-[720] text-spacex">IPO mechanics, share count and EV bridge only.</h3>
            <p className="mt-2 text-xs leading-5 text-white/60">This does not run the whole spreadsheet, value SpaceX, or reproduce every formula. It makes the visible IPO bridge auditable.</p>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1 text-sm text-white/74">Offer price / share <input className="min-h-11 rounded-lg border border-white/10 bg-black/35 px-3 font-mono text-spacex" type="number" value={inputs.offerPrice} onChange={updateNumber('offerPrice')} /></label>
              <label className="grid gap-1 text-sm text-white/74">Primary shares offered <input className="min-h-11 rounded-lg border border-white/10 bg-black/35 px-3 font-mono text-spacex" type="number" step="1000000" value={inputs.primaryShares} onChange={updateNumber('primaryShares')} /></label>
              <label className="grid gap-1 text-sm text-white/74">Greenshoe exercise % <input className="min-h-11 rounded-lg border border-white/10 bg-black/35 px-3 font-mono text-spacex" type="number" step="1" value={(inputs.greenshoePct * 100).toFixed(0)} onChange={(event) => setInputs((prev) => ({ ...prev, greenshoePct: Number(event.target.value) / 100 }))} /></label>
              <label className="grid gap-1 text-sm text-white/74">Proceeds treatment <select className="min-h-11 rounded-lg border border-white/10 bg-black/35 px-3 text-white" value={inputs.proceedsTreatment} onChange={(event) => setInputs((prev) => ({ ...prev, proceedsTreatment: event.target.value }))}><option value="exclude">Exclude IPO proceeds from EV bridge</option><option value="primary">Include primary proceeds</option><option value="primary-plus-greenshoe">Include primary + greenshoe proceeds</option></select></label>
              <div className="grid gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Dilution toggles</p>
                {[['includeOptions', 'Outstanding options', defaults.options], ['includeRsus', 'RSUs outstanding', defaults.rsus], ['includePerformanceAwards', 'Performance / market-condition awards', defaults.performanceAwards], ['includeEchostarShares', 'EchoStar spectrum shares', defaults.echostarShares]].map(([key, label, value]) => <label key={key} className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 p-2 text-sm text-white/74"><span>{label}<br /><span className="font-mono text-[10px] text-white/58">{fmtShares(value)} source/model component</span></span><input type="checkbox" checked={inputs[key]} onChange={(event) => setInputs((prev) => ({ ...prev, [key]: event.target.checked }))} /></label>)}
              </div>
            </div>
          </Panel>
          <div className="grid gap-3">
            <Panel pad="p-3">
              <p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Key outputs</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{outputCards.map(([label, value, sub]) => <MetricPill key={label} label={label} value={value} sub={sub} />)}</div>
            </Panel>
            <Panel pad="p-4">
              <details open>
                <summary className="cursor-pointer text-sm font-[720] text-spacex">Formulas and caveats</summary>
                <div className="mt-3 grid gap-2 text-xs leading-5 text-white/64">
                  <p>Gross proceeds = offer price × primary shares. Greenshoe proceeds = primary proceeds × greenshoe %.</p>
                  <p>Fully diluted shares = pre‑IPO shares + primary shares + greenshoe shares + selected option/RSU/performance/EchoStar components.</p>
                  <p>Enterprise value = implied equity value + total debt − cash/equivalents − marketable securities − digital assets − selected IPO proceeds treatment.</p>
                  <p>Multiples use FY2025 revenue and adjusted EBITDA from the extracted model KPI table, with dollar values treated as $000 in the workbook and converted to millions here.</p>
                </div>
              </details>
            </Panel>
          </div>
        </div>
      ) : (
        <Panel pad="p-3" className="mt-3 overflow-hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Original Sheet fallback</p><h3 className="mt-1 text-xl font-[720] text-spacex">Raw Google Sheets interface, preserved as reference.</h3><p className="mt-1 text-sm leading-6 text-white/62">If the embed is blocked by Google or a mobile browser, use the fallback links.</p></div><div className="flex flex-wrap gap-2"><a href={rawSheetUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-spacex px-3 text-xs font-[700] text-void">Open in Sheets</a><a href={xlsxUrl} className="inline-flex min-h-11 items-center rounded-lg border border-white/10 px-3 text-xs font-[650] text-white/72">Download XLSX</a></div></div>
          <div className="mt-3 h-[72vh] min-h-[520px] overflow-hidden rounded-xl border border-white/[0.08] bg-white"><iframe title="Jared Kubin SpaceX IPO model" src={rawSheetUrl} className="h-full w-full" /></div>
        </Panel>
      )}

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,.95fr)]">
        <Panel pad="p-4" className="border-white/[0.09]"><p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Jared’s framing</p><div className="mt-3 grid gap-3"><div className="rounded-lg border border-cyan/16 bg-cyan/7 p-3"><p className="text-sm font-[720] text-cyan">Bull case</p><p className="mt-1 text-sm leading-6 text-white/74">{model.bullBear.bull.join(' + ')}</p></div><div className="rounded-lg border border-red/16 bg-red/8 p-3"><p className="text-sm font-[720] text-red">Bear case</p><p className="mt-1 text-sm leading-6 text-white/74">{model.bullBear.bear.join(' + ')}</p></div><div className="rounded-lg border border-white/[0.08] bg-black/20 p-3"><p className="text-sm font-[720] text-spacex">Burning questions</p><ol className="mt-2 grid gap-2 text-sm leading-6 text-white/72">{model.burningQuestions.map((q, i) => <li key={q}>{i + 1}. {q}</li>)}</ol></div></div></Panel>
        <Panel pad="p-4" className="border-white/[0.09]"><p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Workbook anchors</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><MetricPill label="Model raise assumption" value="$115B" sub="Workbook midpoint incl. greenshoe; not primary raise" /><MetricPill label="Quantified TAM" value={fmtB(model.tam?.companyRoundedTamB)} sub="Company rounded figure in model TAM tab" /><MetricPill label="Shares offered model" value={Number(offering.totalSharesInclGreenshoe || 0).toLocaleString()} sub="Primary + 15% greenshoe assumption" /></div><p className="mt-3 rounded-lg border border-amber/20 bg-amber/10 p-3 text-xs leading-5 text-white/72">Attribution / caveat: this is Jared’s open model and assumptions, not a final answer and not investment advice. Jared explicitly caveated that there are likely mistakes.</p></Panel>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <Panel pad="p-0" className="overflow-hidden"><div className="border-b border-white/[0.08] p-3"><p className="font-mono text-[10px] uppercase tracking-normal text-white/58">TAM tab</p><h3 className="mt-1 text-xl font-[700] text-spacex">TAM frames the dream before the model math.</h3></div><div className="grid gap-2 p-2 md:hidden">{tamRows.map((row) => <div key={row.Segment} className="rounded-lg border border-white/[0.07] bg-white/[0.024] p-3"><p className="font-[720] text-white/90">{row.Segment}</p><p className="mt-1 font-mono text-xl text-spacex">{fmtB(row['TAM ($B)'])}</p><p className="mt-1 text-xs leading-5 text-white/66">{pct(row['% of Quantified TAM'])} of quantified TAM · {row['Company Framing']}</p></div>)}</div><div className="hidden overflow-auto md:block"><table className="analyst-table min-w-[620px] w-full border-collapse text-left"><thead><tr>{['Segment','TAM','% TAM','Company framing'].map((h) => <th key={h} className="border-b border-white/[0.08] px-3 py-2.5 font-[650] uppercase">{h}</th>)}</tr></thead><tbody className="divide-y divide-white/[0.06]">{tamRows.map((row) => <tr key={row.Segment}><td className="px-3 py-3 font-[700] text-white/88">{row.Segment}</td><td className="px-3 py-3 font-mono text-spacex">{fmtB(row['TAM ($B)'])}</td><td className="px-3 py-3 font-mono text-white/78">{pct(row['% of Quantified TAM'])}</td><td className="px-3 py-3 text-sm leading-5 text-white/72">{row['Company Framing']}</td></tr>)}</tbody></table></div></Panel>
        <Panel pad="p-0" className="overflow-hidden"><div className="border-b border-white/[0.08] p-3"><p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Model KPI bridge</p><h3 className="mt-1 text-xl font-[700] text-spacex">A quick bridge from S‑1 financials into model questions.</h3></div><div className="grid gap-2 p-2 md:hidden">{kpiRows.map((row) => <div key={row.Metric} className="rounded-lg border border-white/[0.07] bg-white/[0.024] p-3"><p className="text-sm font-[700] text-white/88">{row.Metric}</p><p className="mt-1 font-mono text-sm text-spacex">FY25 {row['FY 2025'] > 1 ? money(row['FY 2025'] / 1000) : pct(row['FY 2025'])}</p><p className="mt-1 text-xs leading-5 text-white/64">{row['Notes / Formula']}</p></div>)}</div><div className="hidden overflow-auto md:block"><table className="analyst-table min-w-[680px] w-full border-collapse text-left"><thead><tr>{['Metric','FY 2025','FY 2024','FY 2023','Formula / source'].map((h) => <th key={h} className="border-b border-white/[0.08] px-3 py-2.5 font-[650] uppercase">{h}</th>)}</tr></thead><tbody className="divide-y divide-white/[0.06]">{kpiRows.map((row) => <tr key={row.Metric}><td className="px-3 py-3 font-[700] text-white/88">{row.Metric}</td><td className="px-3 py-3 font-mono text-spacex">{row['FY 2025'] > 1 ? money(row['FY 2025'] / 1000) : pct(row['FY 2025'])}</td><td className="px-3 py-3 font-mono text-white/76">{row['FY 2024'] > 1 ? money(row['FY 2024'] / 1000) : pct(row['FY 2024'])}</td><td className="px-3 py-3 font-mono text-white/64">{row['FY 2023'] > 1 ? money(row['FY 2023'] / 1000) : pct(row['FY 2023'])}</td><td className="px-3 py-3 text-xs leading-5 text-white/64">{row['Notes / Formula']} · {row.Source}</td></tr>)}</tbody></table></div></Panel>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <Panel pad="p-4"><p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Share-count problem</p><h3 className="mt-1 text-xl font-[700] text-spacex">The model foregrounds fully diluted share count risk.</h3><div className="mt-3 grid gap-2">{shareRows.map((row) => <div key={`${row.Category}-${row.Component}`} className="rounded-lg border border-white/[0.065] bg-black/18 p-3"><p className="text-sm font-[700] text-white/86">{row.Component}</p><p className="mt-1 font-mono text-sm text-white/72">{row['Known Shares'] ? Number(row['Known Shares']).toLocaleString() : 'Pricing input / not disclosed yet'} · {row.Status}</p><p className="mt-1 text-xs leading-5 text-white/62">{row['Source / Notes']}</p></div>)}</div></Panel>
        <Panel pad="p-4"><p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Validation checks</p><h3 className="mt-1 text-xl font-[700] text-spacex">Model includes explicit tie-outs and caveats.</h3><div className="mt-3 grid gap-2">{checks.map((row) => <div key={row.Check} className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.065] bg-black/18 p-3"><div><p className="text-sm font-[700] text-white/86">{row.Check}</p><p className="mt-1 text-xs leading-5 text-white/58">{trimText(row['Formula / Basis'], 130)}</p></div><span className="rounded-md border border-cyan/18 bg-cyan/10 px-2 py-1 font-mono text-[10px] text-cyan">{row.Status}</span></div>)}</div></Panel>
      </div>
    </Section>
  )
}

function MobilePosterCard({ variant, data, packet }) {
  const label = POSTERS.find((p) => p.id === variant)?.label || 'Poster'
  const q1 = data.financials.consolidated.find((x) => x.period === 'Q1 2026')
  const y2025 = data.financials.consolidated.find((x) => x.period === '2025')
  const starlink = data.financials.metrics.starlink.find((x) => x.period === 'Q1 2026')
  return (
    <Panel pad="p-4" className="relative overflow-hidden md:hidden">
      <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full border border-white/[0.06]" />
      <p className="font-mono text-[10px] uppercase tracking-normal text-white/62">SpaceX S‑1 Atlas</p>
      <h3 className="mt-2 text-3xl font-[560] leading-none tracking-normal text-spacex">{label}</h3>
      <p className="mt-2 text-sm leading-5 text-white/64">Source-cited poster surface for phone screenshots and link sharing.</p>
      <div className="mt-4"><MobileOrbitStack segments={data.segments} /></div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricPill label="2025 revenue" value={money(y2025?.revenue)} sub="SRC · consolidated" />
        <MetricPill label="Q1 revenue" value={money(q1?.revenue)} sub="SRC · consolidated" />
        <MetricPill label="Starlink subs" value={`${starlink?.subscribers_m}M`} sub="SRC · Starlink metrics" />
        <MetricPill label="Risk factors" value={riskFactorCount(data)} sub="SRC · Risk Factors" />
      </div>
      {packet && <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Disclosure packet</p><p className="mt-1 text-sm font-[620] leading-5 text-spacex">{trimText(packet.title, 105)}</p><p className="mt-2 font-mono text-[10px] text-white/58">SRC · {trimText(packet.source, 80)}</p></div>}
      <p className="mt-3 font-mono text-[10px] leading-4 text-white/58">{sourceCountLine(sourceCounts(data))}</p>
    </Panel>
  )
}

function PosterMode({ data, route }) {
  const variant = POSTERS.find((p) => p.id === route.poster)?.id || 'business-stack'
  const packet = data.atlasRows.find((r) => r.type === (variant === 'risk-radar' ? 'risk' : 'financial')) || data.atlasRows[0]
  const svg = makePosterSvg({ variant, data, packet })
  const posterLabel = POSTERS.find((p) => p.id === variant)?.label || 'Poster'
  return (
    <Section dense eyebrow="Poster mode" title={posterLabel} aside="Designed for clean link cards and manual image posts. Mobile gets a vertical card; desktop keeps the 1200×630 export preview.">
      <div className="mb-3 flex flex-wrap gap-2">{POSTERS.map((p) => <button key={p.id} onClick={() => setHash(`/poster/${p.id}`)} className={cn('min-h-11 rounded-lg border px-3 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-spacex/60', variant === p.id ? 'border-spacex/35 bg-white/[0.07] text-spacex' : 'border-white/[0.08] bg-white/[0.025] text-white/62 hover:bg-white/[0.04]')}>{p.label}</button>)}</div>
      <div className="grid gap-3 xl:grid-cols-[1fr_360px]">
        <MobilePosterCard variant={variant} data={data} packet={packet} />
        <Panel pad="p-2" className="hidden overflow-hidden md:block"><div className="mx-auto aspect-[1200/630] max-w-[1200px] overflow-hidden rounded-lg border border-white/[0.08] bg-black"><img alt={`SpaceX S-1 Atlas ${posterLabel} poster preview`} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} className="h-full w-full" /></div></Panel>
        <Panel className="self-start">
          <p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Share kit</p>
          <p className="mt-3 text-sm leading-6 text-white/64">Use Share on phone, or copy a static /share link so preview crawlers can read route-specific metadata.</p>
          <div className="mt-4"><ShareActions data={data} variant={variant} title={`SpaceX S‑1 Atlas · ${posterLabel}`} /></div>
        </Panel>
      </div>
    </Section>
  )
}

function LoadingShell() {
  return (
    <Shell>
      <div className="mx-auto grid min-h-svh max-w-[1760px] place-items-center px-safe">
        <div aria-live="polite" className="grid w-full gap-3 xl:grid-cols-[390px_1fr_430px]">
          <Panel pad="p-5"><p className="font-mono text-[10px] uppercase tracking-normal text-white/62">S‑1 Filing Map</p><h1 className="mt-3 text-4xl font-[560] leading-[0.92] tracking-normal text-spacex sm:text-5xl">SpaceX S‑1 Atlas.</h1><p className="mt-4 text-sm leading-6 text-white/66">Business stack · financials · risks · sources</p></Panel>
          <Panel className="min-h-[350px]"><div className="h-full rounded-xl border border-white/[0.07] bg-[radial-gradient(circle_at_50%_110%,rgba(183,216,255,.18),transparent_44%),linear-gradient(180deg,rgba(255,255,255,.02),rgba(0,0,0,.18))]" /></Panel>
          <Panel><p className="font-mono text-[10px] uppercase tracking-normal text-white/58">Loading source-cited packets</p><p className="mt-3 text-sm text-white/62">{sourceCountLine()}</p></Panel>
        </div>
      </div>
    </Shell>
  )
}

function App() {
  const route = useRoute()
  const { data, error } = useAtlasData()
  const sourceState = useSourcePayload(route.view)
  useEffect(() => {
    if (route.view === 'packet' || route.view === 'poster') return
    try {
      localStorage.setItem('spacex-s1-tab-v4', route.view)
    } catch {
      // Storage can be blocked in private/webview contexts; persistence is non-critical.
    }
  }, [route.view])
  if (error) return <div aria-live="polite" className="grid min-h-svh place-items-center bg-void p-8 text-red">{error}</div>
  if (!data) return <LoadingShell />
  const view = {
    'flight-deck': <FlightDeck data={data} />,
    debate: <DebateMap data={data} route={route} />,
    atlas: <Atlas data={data} route={route} />,
    segments: <Segments data={data} />,
    financials: <Financials data={data} />,
    risks: <Risks data={data} route={route} />,
    governance: <Governance data={data} />,
    model: <ExternalModel data={data} />,
    sources: <Sources data={data} sourceState={sourceState} route={route} />,
    packet: <PacketPage data={data} route={route} />,
    poster: <PosterMode data={data} route={route} />,
  }[route.view]
  return (
    <Shell>
      <Header route={route} />
      <AnimatePresence mode="wait">
        <motion.main key={`${route.view}-${route.path}`} className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-safe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
          {view}
        </motion.main>
      </AnimatePresence>
      <footer className="mx-auto max-w-[1760px] border-t border-white/[0.06] px-safe py-6 text-[11px] leading-5 text-white/58">
        Source discipline: this source-cited filing map uses the SEC S‑1 package — main S‑1, filing-fee exhibit, filed exhibits and OCR from S‑1 graphics. It is not investment advice and is not affiliated with SpaceX or the SEC. External model assumptions are separate from filed facts. <a className="text-white/65 underline decoration-white/20 underline-offset-4" href={data.sourceUrl}>SEC source filing</a>.
      </footer>
    </Shell>
  )
}

export default App
