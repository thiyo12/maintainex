import { isPhase04CrewWitnessIsolatedTestEnvironment } from '@/lib/domain/company-crew-witness-isolated-db'

/**
 * Additional guard for unfinished customer PIN issuing/worker PIN consumption.
 * An explicit second flag and dedicated server-held signing key are required
 * ON TOP OF the witness endpoint's disposable local-PostgreSQL restriction.
 * No application configuration turns these on. Production stays disabled.
 */
export function getPhase04CrewPinTestKey(): Buffer | null {
  if (!isPhase04CrewWitnessIsolatedTestEnvironment() ||
      process.env.MAINTAINEX_PHASE04_CREW_PIN_TEST_ENABLED !== 'true') return null
  const hex = process.env.MAINTAINEX_PHASE04_CREW_PIN_TEST_KEY_HEX
  if (!hex || !/^[a-fA-F0-9]{64}$/.test(hex)) return null
  const key = Buffer.from(hex, 'hex')
  return key.length === 32 ? key : null
}
