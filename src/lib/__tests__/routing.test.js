import { describe, expect, it, vi } from 'vitest'
import { encodeParams, parseHash, scrollToId } from '../routing.js'

describe('routing', () => {
  it('resolves a blank hash to the flight deck', () => {
    expect(parseHash('')).toMatchObject({ view: 'flight-deck', path: '/flight-deck' })
  })

  it('parses poster routes', () => {
    expect(parseHash('#/poster/risk-radar')).toMatchObject({ view: 'poster', poster: 'risk-radar' })
  })

  it('parses packet routes', () => {
    expect(parseHash('#/packet/risk/foo')).toMatchObject({ view: 'packet', packetType: 'risk', packetId: 'foo' })
  })

  it('falls unknown routes back to flight deck', () => {
    expect(parseHash('#/unknown?q=x')).toMatchObject({ view: 'flight-deck', params: { q: 'x' }, path: '/flight-deck' })
  })

  it('omits empty and all values when encoding params', () => {
    expect(encodeParams({ q: 'Starlink', type: 'all', empty: '', n: 3 })).toBe('q=Starlink&n=3')
  })

  it('scrolls to a known DOM node when available', () => {
    const spy = vi.fn()
    const previousDocument = globalThis.document
    globalThis.document = {
      getElementById: (id) => id === 'target' ? { scrollIntoView: spy } : null,
    }
    scrollToId('target')
    globalThis.document = previousDocument
    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })
})
