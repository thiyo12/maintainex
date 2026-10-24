import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPhase04CrewPinTestKey } from '@/lib/domain/company-crew-pin-dev-api-guard'

describe('Phase04 dev PIN key isolation requires two independent opt-ins',()=>{
  beforeEach(()=>{
    vi.stubEnv('NODE_ENV','test')
    vi.stubEnv('DATABASE_URL','postgresql://test:local_password@localhost:5432/maintainex_test_phase07_ci')
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_WITNESS_TEST_ENABLED','true')
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_PIN_TEST_ENABLED','true')
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_PIN_TEST_KEY_HEX','ab'.repeat(32))
  })
  afterEach(()=>vi.unstubAllEnvs())

  it('only returns private 32-byte key in explicitly opted-in isolated test',()=>{
    expect(getPhase04CrewPinTestKey()).toEqual(Buffer.from('ab'.repeat(32),'hex'))
  })
  it('rejects production even if flags and key are present',()=>{
    vi.stubEnv('NODE_ENV','production')
    expect(getPhase04CrewPinTestKey()).toBeNull()
  })
  it('rejects absent/weak/malformed keys without database access',()=>{
    for(const value of ['', 'ff', 'z'.repeat(64), 'f'.repeat(63),
      'ab'.repeat(32)+'0', '0x'+'ab'.repeat(32)]){
      vi.stubEnv('MAINTAINEX_PHASE04_CREW_PIN_TEST_KEY_HEX',value)
      expect(getPhase04CrewPinTestKey()).toBeNull()
    }
  })
  it('requires BOTH opt-in flags and locally named CI database',()=>{
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_WITNESS_TEST_ENABLED','false')
    expect(getPhase04CrewPinTestKey()).toBeNull()
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_WITNESS_TEST_ENABLED','true')
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_PIN_TEST_ENABLED','false')
    expect(getPhase04CrewPinTestKey()).toBeNull()
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_PIN_TEST_ENABLED','true')
    vi.stubEnv('DATABASE_URL','postgresql://test:pass@localhost:5432/maintainex')
    expect(getPhase04CrewPinTestKey()).toBeNull()
  })
})
