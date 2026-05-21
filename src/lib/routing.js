export function encodeParams(params = {}) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).length > 0 && v !== 'all') sp.set(k, String(v))
  })
  return sp.toString()
}

export function parseHash(hash = (typeof window !== 'undefined' ? window.location.hash : '')) {
  const raw = hash.replace(/^#/, '') || '/flight-deck'
  const [pathRaw, queryRaw = ''] = raw.split('?')
  const path = pathRaw.startsWith('/') ? pathRaw : `/${pathRaw}`
  const parts = path.split('/').filter(Boolean)
  const params = Object.fromEntries(new URLSearchParams(queryRaw).entries())
  if (parts[0] === 'poster') return { view: 'poster', poster: parts[1] || 'business-stack', params, path }
  if (parts[0] === 'packet') return { view: 'packet', packetType: parts[1], packetId: parts.slice(2).join('/'), params, path }
  const view = ['flight-deck', 'debate', 'atlas', 'segments', 'financials', 'risks', 'governance', 'model', 'sources'].includes(parts[0]) ? parts[0] : 'flight-deck'
  return { view, params, path: `/${view}` }
}

export function setHash(path, params = {}) {
  if (typeof window === 'undefined') return
  const qs = encodeParams(params)
  window.location.hash = `${path}${qs ? `?${qs}` : ''}`
}

export function scrollToId(id) {
  if (typeof document === 'undefined') return
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
