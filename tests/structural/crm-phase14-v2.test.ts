import { describe,expect,it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 Phase 14 observability contract',()=>{
  it('retires old dark audit and security page implementations',()=>{
    for(const path of ['app/(admin)/admin/analytics/audit/page.tsx','app/(admin)/admin/analytics/security-monitor/page.tsx']){
      const source=readFileSync(resolve(process.cwd(),path),'utf8')
      expect(source).toContain("from '@/components/crm/v2/CrmPrimitives'")
      expect(source).not.toContain("bg-[#15161E]")
      expect(source).not.toContain('ROLE_PERMISSIONS')
    }
  })
  it('guards safe system health without exposing secret values',()=>{
    const source=readFileSync(resolve(process.cwd(),'app/api/admin/health/route.ts'),'utf8')
    expect(source).toContain("permission: 'health:view'")
    expect(source).toContain('paypalConfigured')
    expect(source).toContain('cloudinaryConfigured')
    expect(source).not.toContain('PAYPAL_CLIENT_SECRET:')
    expect(source).not.toContain('CLOUDINARY_API_SECRET:')
  })
  it('extends global search to governed operational domains',()=>{
    const source=readFileSync(resolve(process.cwd(),'app/api/admin/search/route.ts'),'utf8')
    expect(source).toContain("'disputes'")
    expect(source).toContain("'payments'")
    expect(source).toContain("'listings'")
    expect(source).toContain("allowed('finance:payments:view')")
    expect(source).toContain("allowed('realestate:view')")
    expect(source).toContain('getCrmCountryFilter')
  })
})
