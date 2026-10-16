        : ''
      const priceMin = parseNonNegativeMajorUnitPrice(body?.priceMin ?? 0, currency as 'LKR' | 'CAD')
      const priceMax = parseNonNegativeMajorUnitPrice(body?.priceMax ?? body?.priceMin ?? 0, currency as 'LKR' | 'CAD')
      if (priceMin === null || priceMax === null || priceMax < priceMin) {
        return NextResponse.json({ error: 'Invalid price range: use non-negative prices to 2 decimal places' }, { status: 400 })
      }

      // Price currency must match the market it is quoted in. Independent
      // Sri Lankan and Canadian pricing: never one derived from the other.
      const currency = typeof body?.currency === 'string'
        ? body.currency.trim().toUpperCase().slice(0, 8)
        : ''
      const MARKET_CURRENCY: Record<string, string> = { LK: 'LKR', CA: 'CAD' }
      const declaredMarkets = countries.map(c => c.toUpperCase())
      if (currency !== 'LKR' && currency !== 'CAD') {
        return NextResponse.json(
          { error: 'currency must be LKR for Sri Lanka or CAD for Canada' },
          { status: 400 }
        )
      }

      // A job may not claim a market its parent category does not cover.
      const outsideParent = countries
        .map(c => c.toUpperCase())
        .filter(c => !parentCountries.includes(c))
      if (outsideParent.length > 0) {
        return NextResponse.json(
          { error: `Country scope exceeds the parent category: ${outsideParent.join(', ')}` },
          { status: 400 }
        )
      }
