import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('accepted booking mutation boundary', () => {
  it('locks generic job edits once a quote is accepted', () => {
    const route = read('app/api/mobile/v2/jobs/[id]/route.ts')

    expect(route).toContain("if (job.status !== 'OPEN')")
    expect(route).toContain("if (current.status !== 'OPEN')")
    expect(route).toContain('Use the change-order flow for post-acceptance scope changes')
    expect(route).not.toContain("!['OPEN', 'QUOTE_ACCEPTED'].includes(current.status)")
  })

  it('shares exact address only inside an active payment-protected transaction', () => {
    const route = read('app/api/mobile/v2/jobs/[id]/share-address/route.ts')

    expect(route).toContain('FOR UPDATE')
    expect(route).toContain("!['QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(job.status)")
    expect(route).toContain("where: { jobId: id, status: 'PROTECTED' }")
    expect(route).toContain('addressSharedAt: null')
    expect(route).toContain("if (claimed.count !== 1) throw new Error('SHARE_ADDRESS_STATE_CHANGED')")
  })
})
