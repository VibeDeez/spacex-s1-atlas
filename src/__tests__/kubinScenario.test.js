import { describe, expect, it } from 'vitest'
import { calculateKubinScenario } from '../kubinScenario.js'

const defaults = {
  offerPrice: 125,
  primaryShares: 800_000_000,
  greenshoePct: 0.15,
  preIpoShares: 12_000_000_000,
  options: 10,
  rsus: 20,
  performanceAwards: 30,
  echostarShares: 40,
  cashAndEquivalentsM: 100,
  marketableSecuritiesM: 50,
  digitalAssetsM: 25,
  totalDebtM: 500,
  revenue2025M: 10_000,
  adjustedEbitda2025M: 2_000,
}

describe('calculateKubinScenario', () => {
  it('calculates primary proceeds from offer price and primary shares', () => {
    const scenario = calculateKubinScenario(defaults, { offerPrice: 100, primaryShares: 1_000_000, greenshoePct: 0 })
    expect(scenario.primaryProceedsM).toBe(100)
  })

  it('clamps greenshoe between zero and one', () => {
    expect(calculateKubinScenario(defaults, { greenshoePct: -1 }).greenshoePct).toBe(0)
    expect(calculateKubinScenario(defaults, { greenshoePct: 2 }).greenshoePct).toBe(1)
  })

  it('includes only selected diluted share toggles', () => {
    const scenario = calculateKubinScenario(defaults, {
      includeOptions: true,
      includeRsus: false,
      includePerformanceAwards: true,
      includeEchostarShares: false,
    })
    expect(scenario.dilutedAdditions).toBe(40)
  })

  it('changes EV bridge with proceeds treatment', () => {
    const none = calculateKubinScenario(defaults, { proceedsTreatment: 'none', greenshoePct: 0 })
    const primary = calculateKubinScenario(defaults, { proceedsTreatment: 'primary', greenshoePct: 0 })
    expect(none.enterpriseValueM - primary.enterpriseValueM).toBe(primary.primaryProceedsM)
  })

  it('uses revenue and Adjusted EBITDA denominators for EV multiples', () => {
    const scenario = calculateKubinScenario(defaults, { proceedsTreatment: 'none', greenshoePct: 0 })
    expect(scenario.evRevenue2025).toBe(scenario.enterpriseValueM / defaults.revenue2025M)
    expect(scenario.evAdjustedEbitda2025).toBe(scenario.enterpriseValueM / defaults.adjustedEbitda2025M)
  })
})
