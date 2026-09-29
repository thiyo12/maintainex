#!/usr/bin/env node
/**
 * PostgreSQL 10K Benchmark Resolution Performance Test
 * 
 * Run on VPS against a disposable PostgreSQL database:
 *   node tests/quotes/pg-10k-benchmark-test.js <DATABASE_URL>
 * 
 * Creates 10K PriceBenchmark rows and tests resolveBenchmark() performance.
 * Cleans up after itself.
 */

const { Client } = require('pg')

const DATABASE_URL = process.argv[2]
if (!DATABASE_URL) {
  console.error('Usage: node pg-10k-benchmark-test.mjs <DATABASE_URL>')
  process.exit(1)
}

const CATEGORIES = [
  'Plumbing', 'Electrical', 'Carpentry', 'Painting', 'Cleaning',
  'Landscaping', 'HVAC', 'Roofing', 'Flooring', 'Appliance Repair',
]

const CITIES = ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Negombo', 'Matara', 'Kurunegala', 'Ratnapura']
const PROVINCES = ['Western', 'Central', 'Southern', 'Northern', 'North Western', 'Sabaragamuwa']

function randomBigInt(min, max) {
  return BigInt(min) + BigInt(Math.floor(Math.random() * (max - min)))
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL })

  try {
    await client.connect()
    console.log('Connected to PostgreSQL')

    // Create PriceBenchmark table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS "PriceBenchmark" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "serviceTemplateId" TEXT,
        "countryCode" TEXT NOT NULL,
        region TEXT,
        city TEXT,
        currency TEXT NOT NULL DEFAULT 'LKR',
        "pricingMode" TEXT NOT NULL DEFAULT 'SMART_QUOTE',
        "sampleSize" INTEGER NOT NULL DEFAULT 0,
        "medianAmountCents" BIGINT NOT NULL DEFAULT 0,
        "lowerPercentileCents" BIGINT,
        "upperPercentileCents" BIGINT,
        "minimumObservedCents" BIGINT,
        "maximumObservedCents" BIGINT,
        "sourceType" TEXT NOT NULL DEFAULT 'MANUAL_MARKET_RESEARCH',
        "sourceReference" TEXT,
        "methodologyNote" TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        "effectiveFrom" TIMESTAMP(3),
        "effectiveTo" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "geographyLevel" TEXT NOT NULL DEFAULT 'COUNTRY',
        confidence TEXT NOT NULL DEFAULT 'MEDIUM',
        "submittedBy" TEXT,
        "submittedAt" TIMESTAMP(3),
        "supersededFromId" TEXT,
        "pricingConfigId" TEXT
      )
    `)

    // Clean up any previous test data
    await client.query(`DELETE FROM "PriceBenchmark" WHERE "countryCode" = 'TEST_PG'`)
    console.log('Cleaned up previous test data')

    // Seed 10K benchmarks
    console.log('Seeding 10K benchmarks...')
    const seedStart = Date.now()
    
    const batchSize = 500
    for (let batch = 0; batch < 20; batch++) {
      const values = []
      const params = []
      let paramIdx = 1

      for (let i = 0; i < batchSize; i++) {
        const globalIdx = batch * batchSize + i
        const category = pickRandom(CATEGORIES)
        const city = pickRandom(CITIES)
        const province = pickRandom(PROVINCES)
        const median = randomBigInt(500000, 5000000)
        const lower = median - randomBigInt(100000, 500000)
        const upper = median + randomBigInt(100000, 500000)

        values.push(
          `($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6}, $${paramIdx+7}, $${paramIdx+8}, $${paramIdx+9}, $${paramIdx+10}, $${paramIdx+11}, $${paramIdx+12}, $${paramIdx+13}, $${paramIdx+14}, $${paramIdx+15}, $${paramIdx+16}, $${paramIdx+17})`
        )
        params.push(
          `cat-${category.toLowerCase().replace(/\s+/g, '-')}`,
          'TEST_PG',
          province,
          city,
          Math.floor(Math.random() * 50) + 10,
          median.toString(),
          lower.toString(),
          upper.toString(),
          (lower - randomBigInt(50000, 200000)).toString(),
          (upper + randomBigInt(50000, 200000)).toString(),
          'MANUAL_MARKET_RESEARCH',
          `Benchmark for ${category} in ${city}`,
          `v1.0`,
          globalIdx + 1,
          '2026-01-01',
          null,
          pickRandom(['COUNTRY', 'PROVINCE', 'CITY']),
          'HIGH'
        )
        paramIdx += 18
      }

      await client.query(
        `INSERT INTO "PriceBenchmark" (
          "serviceTemplateId", "countryCode", region, city, currency,
          "sampleSize", "medianAmountCents", "lowerPercentileCents",
          "upperPercentileCents", "minimumObservedCents", "maximumObservedCents",
          "sourceType", "sourceReference", "methodologyNote", version,
          "effectiveFrom", "effectiveTo", "geographyLevel", confidence
        ) VALUES ${values.join(', ')}`,
        params
      )
    }

    const seedElapsed = Date.now() - seedStart
    console.log(`Seeded 10K benchmarks in ${seedElapsed}ms`)

    // Verify count
    const countResult = await client.query(`SELECT COUNT(*) FROM "PriceBenchmark" WHERE "countryCode" = 'TEST_PG'`)
    console.log(`Total benchmarks: ${countResult.rows[0].count}`)

    // Test 1: resolveBenchmark for CITY-level (most selective)
    console.log('\n--- Test 1: CITY-level resolution (most selective) ---')
    const city = pickRandom(CITIES)
    const category = pickRandom(CATEGORIES)
    const serviceTemplateId = `cat-${category.toLowerCase().replace(/\s+/g, '-')}`
    
    const cityStart = Date.now()
    const cityResult = await client.query(
      `SELECT id, "medianAmountCents", "sampleSize", "geographyLevel"
       FROM "PriceBenchmark"
       WHERE "countryCode" = 'TEST_PG'
         AND ("serviceTemplateId" = $1 OR "serviceTemplateId" IS NULL)
         AND city = $2
         AND ("effectiveTo" IS NULL OR "effectiveTo" > NOW())
       ORDER BY
         CASE WHEN "serviceTemplateId" = $1 THEN 0 ELSE 1 END,
         CASE geographyLevel WHEN 'CITY' THEN 0 WHEN 'PROVINCE' THEN 1 WHEN 'COUNTRY' THEN 2 ELSE 3 END,
         "sampleSize" DESC
       LIMIT 1`,
      [serviceTemplateId, city]
    )
    const cityElapsed = Date.now() - cityStart
    console.log(`City resolution: ${cityElapsed}ms, rows returned: ${cityResult.rows.length}`)
    if (cityResult.rows.length > 0) {
      console.log(`  Level: ${cityResult.rows[0].geographyLevel}, Median: ${cityResult.rows[0].medianAmountCents}`)
    }

    // Test 2: resolveBenchmark for PROVINCE-level
    console.log('\n--- Test 2: PROVINCE-level resolution ---')
    const province = pickRandom(PROVINCES)
    const provinceStart = Date.now()
    const provinceResult = await client.query(
      `SELECT id, "medianAmountCents", "sampleSize", "geographyLevel"
       FROM "PriceBenchmark"
       WHERE "countryCode" = 'TEST_PG'
         AND ("serviceTemplateId" = $1 OR "serviceTemplateId" IS NULL)
         AND region = $2
         AND ("effectiveTo" IS NULL OR "effectiveTo" > NOW())
       ORDER BY
         CASE WHEN "serviceTemplateId" = $1 THEN 0 ELSE 1 END,
         CASE geographyLevel WHEN 'CITY' THEN 0 WHEN 'PROVINCE' THEN 1 WHEN 'COUNTRY' THEN 2 ELSE 3 END,
         "sampleSize" DESC
       LIMIT 1`,
      [serviceTemplateId, province]
    )
    const provinceElapsed = Date.now() - provinceStart
    console.log(`Province resolution: ${provinceElapsed}ms, rows returned: ${provinceResult.rows.length}`)

    // Test 3: resolveBenchmark for COUNTRY-level (least selective, but still fast)
    console.log('\n--- Test 3: COUNTRY-level resolution (least selective) ---')
    const countryStart = Date.now()
    const countryResult = await client.query(
      `SELECT id, "medianAmountCents", "sampleSize", "geographyLevel"
       FROM "PriceBenchmark"
       WHERE "countryCode" = 'TEST_PG'
         AND ("serviceTemplateId" = $1 OR "serviceTemplateId" IS NULL)
         AND ("effectiveTo" IS NULL OR "effectiveTo" > NOW())
       ORDER BY
         CASE WHEN "serviceTemplateId" = $1 THEN 0 ELSE 1 END,
         CASE geographyLevel WHEN 'CITY' THEN 0 WHEN 'PROVINCE' THEN 1 WHEN 'COUNTRY' THEN 2 ELSE 3 END,
         "sampleSize" DESC
       LIMIT 1`,
      [serviceTemplateId]
    )
    const countryElapsed = Date.now() - countryStart
    console.log(`Country resolution: ${countryElapsed}ms, rows returned: ${countryResult.rows.length}`)

    // Test 4: 100 sequential resolution queries
    console.log('\n--- Test 4: 100 sequential resolution queries ---')
    const seqStart = Date.now()
    for (let i = 0; i < 100; i++) {
      const cat = pickRandom(CATEGORIES)
      const ct = pickRandom(CITIES)
      const catId = `cat-${cat.toLowerCase().replace(/\s+/g, '-')}`
      await client.query(
        `SELECT id, "medianAmountCents", "sampleSize", "geographyLevel"
         FROM "PriceBenchmark"
         WHERE "countryCode" = 'TEST_PG'
           AND ("serviceTemplateId" = $1 OR "serviceTemplateId" IS NULL)
           AND city = $2
           AND ("effectiveTo" IS NULL OR "effectiveTo" > NOW())
         ORDER BY
           CASE WHEN "serviceTemplateId" = $1 THEN 0 ELSE 1 END,
           CASE geographyLevel WHEN 'CITY' THEN 0 WHEN 'PROVINCE' THEN 1 WHEN 'COUNTRY' THEN 2 ELSE 3 END,
           "sampleSize" DESC
         LIMIT 1`,
        [catId, ct]
      )
    }
    const seqElapsed = Date.now() - seqStart
    console.log(`100 sequential queries: ${seqElapsed}ms (avg: ${(seqElapsed / 100).toFixed(1)}ms per query)`)

    // Test 5: 100 concurrent resolution queries
    console.log('\n--- Test 5: 100 concurrent resolution queries ---')
    const concStart = Date.now()
    const promises = []
    for (let i = 0; i < 100; i++) {
      const cat = pickRandom(CATEGORIES)
      const ct = pickRandom(CITIES)
      const catId = `cat-${cat.toLowerCase().replace(/\s+/g, '-')}`
      promises.push(
        client.query(
          `SELECT id, "medianAmountCents", "sampleSize", "geographyLevel"
           FROM "PriceBenchmark"
           WHERE "countryCode" = 'TEST_PG'
             AND ("serviceTemplateId" = $1 OR "serviceTemplateId" IS NULL)
             AND city = $2
             AND ("effectiveTo" IS NULL OR "effectiveTo" > NOW())
           ORDER BY
             CASE WHEN "serviceTemplateId" = $1 THEN 0 ELSE 1 END,
             CASE geographyLevel WHEN 'CITY' THEN 0 WHEN 'PROVINCE' THEN 1 WHEN 'COUNTRY' THEN 2 ELSE 3 END,
             "sampleSize" DESC
           LIMIT 1`,
          [catId, ct]
        )
      )
    }
    await Promise.all(promises)
    const concElapsed = Date.now() - concStart
    console.log(`100 concurrent queries: ${concElapsed}ms (avg: ${(concElapsed / 100).toFixed(1)}ms per query)`)

    // Summary
    console.log('\n=== PERFORMANCE SUMMARY ===')
    console.log(`Seed time: ${seedElapsed}ms`)
    console.log(`City resolution: ${cityElapsed}ms`)
    console.log(`Province resolution: ${provinceElapsed}ms`)
    console.log(`Country resolution: ${countryElapsed}ms`)
    console.log(`100 sequential: ${seqElapsed}ms (avg: ${(seqElapsed / 100).toFixed(1)}ms)`)
    console.log(`100 concurrent: ${concElapsed}ms (avg: ${(concElapsed / 100).toFixed(1)}ms)`)
    
    const allUnderThreshold = cityElapsed < 100 && provinceElapsed < 100 && countryElapsed < 100 && (seqElapsed / 100) < 100
    console.log(`\nAll queries under 100ms: ${allUnderThreshold ? 'PASS ✓' : 'FAIL ✗'}`)

  } finally {
    // Clean up test data
    await client.query(`DELETE FROM "PriceBenchmark" WHERE "countryCode" = 'TEST_PG'`)
    console.log('\nCleaned up test data')
    await client.end()
  }
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
