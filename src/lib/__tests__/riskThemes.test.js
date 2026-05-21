import { describe, expect, it } from 'vitest'
import { inferRiskTheme, RISK_THEME_META, RISK_THEME_NAMES } from '../riskThemes.js'

describe('riskThemes', () => {
  it('maps Starship headings to Launch / Starship', () => {
    expect(inferRiskTheme('Any failure or delay in the development of Starship at scale', 'Business')).toBe('Launch / Starship')
  })

  it('maps Starlink headings to Starlink / Network', () => {
    expect(inferRiskTheme('Starlink broadband and mobile satellite spectrum risks', 'Business')).toBe('Starlink / Network')
  })

  it('maps AI/Grok/compute headings to AI / Compute', () => {
    expect(inferRiskTheme('Our AI compute and Grok model infrastructure may not scale', 'Business')).toBe('AI / Compute')
  })

  it('maps stock/voting/class/share headings to Offering / Control', () => {
    expect(inferRiskTheme('Class B voting stock could control shareholder outcomes', 'Business')).toBe('Offering / Control')
  })

  it('keeps theme metadata aligned with names', () => {
    expect(RISK_THEME_META.map((theme) => theme.name)).toEqual(RISK_THEME_NAMES)
  })
})
