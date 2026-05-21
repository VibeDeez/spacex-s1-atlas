export function appOrigin() {
  if (typeof window === 'undefined') return '/'
  return new URL('.', window.location.href).href
}

export function packetUrl(packet) {
  return packet?.id ? `${appOrigin()}share/packet/${packet.id}/` : `${appOrigin()}#/flight-deck`
}

export function posterUrl(variant) {
  return `${appOrigin()}share/${variant}/`
}

export function makeCaption({ type, title, url, source }) {
  if (type === 'poster') {
    return `${title}\n\nA source-cited map of SpaceX's S‑1: business stack, financials, risks, and sources.\n\n${url}`
  }
  return `SpaceX S‑1 Atlas\n\nPacket: ${title}\nSource: ${source}\n\n${url}`
}

export async function copyText(text, setCopied) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
  setCopied?.(true)
  window.setTimeout(() => setCopied?.(false), 1400)
}

export async function shareToDevice({ title, caption, url, setCopied }) {
  const text = caption.replace(url, '').trim()
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return
    } catch {
      // User canceled or webview rejected the share payload. Fall back to copy.
    }
  }
  await copyText(`${caption}`, setCopied)
}
