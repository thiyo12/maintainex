import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(process.cwd(),
  'apps/mobile/features/safety/components/JobSafetyCentre.tsx'), 'utf8')
const entry = readFileSync(resolve(process.cwd(),
  'apps/mobile/features/auth/screens/root-entry.tsx'), 'utf8')

describe('Phase 07 — discreet safety exit is not emergency dispatch', () => {
  it('provides an accessible one-tap exit to the ordinary application entry', () => {
    expect(src).toContain('accessibilityLabel="Quick exit Safety Centre"')
    expect(src).toContain('onPress={quickExit}')
    expect(src).toContain("router.replace('/')")
    expect(entry).toContain("router.replace('/(customer)')")
    expect(entry).toContain("router.replace('/(tasker)')")
    expect(entry).toContain("router.replace('/(company)')")
  })
  it('clears unsent draft, displayed report reference and the chosen incident reason', () => {
    const start = src.indexOf('const quickExit = () => {')
    const end = src.indexOf('const report = async () => {')
    const handler = src.slice(start, end)
    expect(handler).toContain("setDescription('')")
    expect(handler).toContain('setReference(null)')
    expect(handler).toContain("setReason('SAFETY_UNSAFE_WORK')")
    expect(handler).toContain('setOpen(false)')
    expect(handler).not.toContain('Alert.alert')
  })
  it('does not pop up sensitive success/error alerts after the user exits', () => {
    expect(src).toContain('exited.current = true')
    expect(src).toContain('if (!exited.current) {')
    expect(src).toContain('exited.current = false')
  })
  it('does not claim to cancel or delete a server-recorded incident', () => {
    expect(src).toContain('never remove an already-sent staff report')
    expect(src).toContain('cannot dispatch responders')
    expect(src).toContain('does not automatically change a payment.')
    expect(src).not.toContain('deleteSafetyReport(')
  })
})
