export const RISK_THEME_META = [
  { name: 'Launch / Starship', color: '#B7D8FF', label: 'Launch' },
  { name: 'Starlink / Network', color: '#74E3D4', label: 'Starlink' },
  { name: 'AI / Compute', color: '#F3BE63', label: 'AI' },
  { name: 'Regulatory', color: '#EF7D7D', label: 'Reg.' },
  { name: 'Operations / Market', color: '#C6D0DD', label: 'Ops' },
  { name: 'Offering / Control', color: '#9DB9FF', label: 'Control' },
]

export const RISK_THEME_NAMES = RISK_THEME_META.map((theme) => theme.name)

export function inferRiskTheme(heading, group) {
  const h = String(heading || '').toLowerCase()
  if (/starship|launch|rocket|reusable|dragon|mission|payload|orbital/.test(h)) return 'Launch / Starship'
  if (/starlink|satellite|connectivity|broadband|mobile|spectrum/.test(h)) return 'Starlink / Network'
  if (/ai|xai|grok|compute|model|data center/.test(h)) return 'AI / Compute'
  if (/government|regulat|law|fda|license|faa|fcc|export|security|defense/.test(h)) return 'Regulatory'
  if (/stock|voting|offering|controlled|class|shares|market/.test(h) || group !== 'Business') return 'Offering / Control'
  return 'Operations / Market'
}
