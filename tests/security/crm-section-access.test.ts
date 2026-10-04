import { describe, expect, it } from 'vitest'
import { getCrmSectionAccess } from '@/lib/crm/section-access'

describe('CRM section access', () => {
  it('keeps support focused on dispute/support queues and trust, not Job 360 or finance', () => {
    expect(getCrmSectionAccess('SUPPORT')).toMatchObject({
      work: false,
      finance: false,
      trust: true,
      audit: true,
      customerCrm: true,
    })
  })

  it('keeps managers out of finance while allowing job and trust operations', () => {
    expect(getCrmSectionAccess('MANAGER')).toMatchObject({
      work: true,
      finance: false,
      trust: true,
      audit: true,
      customerCrm: true,
    })
  })

  it('keeps finance staff in financial data without granting Job 360 work access', () => {
    expect(getCrmSectionAccess('FINANCE')).toMatchObject({
      work: false,
      finance: true,
      trust: false,
      audit: true,
      security: false,
      customerCrm: false,
    })
  })

  it('allows user management to see internal customer CRM notes but not finance', () => {
    expect(getCrmSectionAccess('USER_MANAGEMENT')).toMatchObject({
      work: false,
      finance: false,
      trust: true,
      audit: true,
      customerCrm: true,
    })
  })

  it('gives technical staff security/audit access without user or finance expansion', () => {
    expect(getCrmSectionAccess('TECHNICAL')).toMatchObject({
      work: false,
      finance: false,
      trust: true,
      audit: true,
      security: true,
      customerCrm: false,
    })
  })

  it('keeps super admin fully enabled', () => {
    expect(getCrmSectionAccess('SUPER_ADMIN')).toEqual({
      work: true,
      finance: true,
      trust: true,
      audit: true,
      security: true,
      customerCrm: true,
    })
  })
})
