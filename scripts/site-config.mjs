export const SITE = {
  title: 'SpaceX S-1 Atlas',
  description: "A source-cited map of SpaceX's S-1: business stack, financials, risks, exhibits, OCR, and source packets.",
  canonicalUrl: process.env.PUBLIC_BASE_URL || 'https://henry.here.now/spacex-s1-atlas',
  socialImagePath: '/social/spacex-s1-atlas-card.png',
}

export function canonicalSiteUrl(path = '/') {
  const base = SITE.canonicalUrl.replace(/\/+$/, '')
  const rel = String(path || '/').startsWith('/') ? String(path || '/') : `/${path}`
  return `${base}${rel}`
}
