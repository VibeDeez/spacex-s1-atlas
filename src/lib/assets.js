export function publicAsset(path) {
  const rel = String(path || '').replace(/^\/+/, '')
  const base = import.meta.env?.BASE_URL || '/'
  return `${base}${rel}`
}

export async function loadJson(path) {
  const url = publicAsset(path)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`)
  return res.json()
}
