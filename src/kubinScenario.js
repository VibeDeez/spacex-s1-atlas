export function findShareComponent(model, needle) {
  return (model?.shareCount?.components || []).find((row) =>
    String(row.Component || '').toLowerCase().includes(needle.toLowerCase())
  )
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function getScenarioDefaults(model) {
  const offering = model?.offering || {}
  const rows = model?.shareCount?.components || []
  const existingShares = rows
    .filter((row) => row.Category === 'Existing / Old Shares')
    .reduce((sum, row) => sum + toNumber(row['Known Shares']), 0)
  const optionRow = findShareComponent(model, 'Outstanding stock options')
  const rsuRow = findShareComponent(model, 'Outstanding RSUs')
  const performanceRow = findShareComponent(model, 'Performance & market condition awards')
  const echostarRow = findShareComponent(model, 'EchoStar spectrum')
  const kpis = model?.kpis?.rows || []
  const revenue2025Thousands = toNumber(kpis.find((row) => row.Metric === 'Space segment revenue')?.['FY 2025'])
    + toNumber(kpis.find((row) => row.Metric === 'Connectivity segment revenue')?.['FY 2025'])
    + toNumber(kpis.find((row) => row.Metric === 'AI segment revenue')?.['FY 2025'])
  const adjustedEbitda2025Thousands = toNumber(kpis.find((row) => row.Metric === 'Adjusted EBITDA')?.['FY 2025'])
  return {
    offerPrice: 125,
    primaryShares: toNumber(offering.primarySharesOffered, 800000000),
    greenshoePct: offering.primarySharesOffered ? toNumber(offering.greenshoeShares) / toNumber(offering.primarySharesOffered) : 0.15,
    preIpoShares: existingShares || 12520310769,
    options: toNumber(optionRow?.['Known Shares']),
    rsus: toNumber(rsuRow?.['Known Shares']),
    performanceAwards: toNumber(performanceRow?.['Known Shares']),
    echostarShares: toNumber(echostarRow?.['Known Shares']),
    cashAndEquivalentsM: 24747,
    marketableSecuritiesM: 0,
    digitalAssetsM: 1637,
    totalDebtM: 22896,
    revenue2025M: revenue2025Thousands / 1000,
    adjustedEbitda2025M: adjustedEbitda2025Thousands / 1000,
  }
}

export function calculateKubinScenario(defaults, inputs) {
  const offerPrice = toNumber(inputs.offerPrice, defaults.offerPrice)
  const primaryShares = toNumber(inputs.primaryShares, defaults.primaryShares)
  const greenshoePct = Math.max(0, Math.min(1, toNumber(inputs.greenshoePct, defaults.greenshoePct)))
  const greenshoeShares = primaryShares * greenshoePct
  const primaryProceedsM = (offerPrice * primaryShares) / 1_000_000
  const greenshoeProceedsM = (offerPrice * greenshoeShares) / 1_000_000
  const proceedsInclGreenshoeM = primaryProceedsM + greenshoeProceedsM
  const basicPostOfferingShares = defaults.preIpoShares + primaryShares
  const basicPostOfferingInclGreenshoeShares = basicPostOfferingShares + greenshoeShares
  const dilutedAdditions =
    (inputs.includeOptions ? defaults.options : 0) +
    (inputs.includeRsus ? defaults.rsus : 0) +
    (inputs.includePerformanceAwards ? defaults.performanceAwards : 0) +
    (inputs.includeEchostarShares ? defaults.echostarShares : 0)
  const fullyDilutedShares = basicPostOfferingInclGreenshoeShares + dilutedAdditions
  const equityValueM = (offerPrice * fullyDilutedShares) / 1_000_000
  const includedProceedsM = inputs.proceedsTreatment === 'primary-plus-greenshoe'
    ? proceedsInclGreenshoeM
    : inputs.proceedsTreatment === 'primary'
      ? primaryProceedsM
      : 0
  const netCashBridgeM = defaults.totalDebtM - defaults.cashAndEquivalentsM - defaults.marketableSecuritiesM - defaults.digitalAssetsM - includedProceedsM
  const enterpriseValueM = equityValueM + netCashBridgeM
  return {
    offerPrice,
    primaryShares,
    greenshoePct,
    greenshoeShares,
    primaryProceedsM,
    proceedsInclGreenshoeM,
    basicPostOfferingShares,
    basicPostOfferingInclGreenshoeShares,
    dilutedAdditions,
    fullyDilutedShares,
    equityValueM,
    includedProceedsM,
    enterpriseValueM,
    ownershipSoldBasic: primaryShares / basicPostOfferingShares,
    ownershipSoldInclGreenshoe: (primaryShares + greenshoeShares) / basicPostOfferingInclGreenshoeShares,
    evRevenue2025: enterpriseValueM / defaults.revenue2025M,
    evAdjustedEbitda2025: enterpriseValueM / defaults.adjustedEbitda2025M,
    revenue2025M: defaults.revenue2025M,
    adjustedEbitda2025M: defaults.adjustedEbitda2025M,
  }
}
