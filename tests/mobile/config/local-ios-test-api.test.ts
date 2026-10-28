import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveLocalTestApiUrl } from '../../../apps/mobile/scripts/resolve-local-test-api.cjs'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require('../../../apps/mobile/app.config.js') as (arg: { config: any }) => any
// eslint-disable-next-line @typescript-eslint/no-require-imports
const baseConfig = require('../../../apps/mobile/app.json').expo

describe('local iOS QA API configuration', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('requires an explicit URL when local iOS QA mode is enabled', () => {
    vi.stubEnv('MAINTAINEX_IOS_TEST_BUILD', '1')
    vi.stubEnv('EXPO_PUBLIC_API_URL', '')
    expect(() => appConfig({ config: baseConfig })).toThrow(/requires an explicit EXPO_PUBLIC_API_URL/)
  })

  it.each(['https://maintainex.lk', 'https://ca.maintainex.lk', 'https://maintainex.ca'])('rejects production endpoint %s', value => {
    expect(() => resolveLocalTestApiUrl(value)).toThrow(/production MaintainEX host/)
  })

  it('rejects public API hosts and URLs containing credentials or paths', () => {
    expect(() => resolveLocalTestApiUrl('https://api.example.com')).toThrow(/localhost, a private IPv4/)
    expect(() => resolveLocalTestApiUrl('http://user:pass@127.0.0.1:3000')).toThrow(/without credentials/)
    expect(() => resolveLocalTestApiUrl('http://127.0.0.1:3000/api')).toThrow(/without credentials/)
  })

  it('targets a private local API and uses a separate QA bundle identifier', () => {
    vi.stubEnv('MAINTAINEX_IOS_TEST_BUILD', '1')
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'http://127.0.0.1:3000')
    const config = appConfig({ config: baseConfig })

    expect(config.ios.bundleIdentifier).toBe(`${baseConfig.ios.bundleIdentifier}.qa`)
    expect(config.extra.apiUrl).toBe('http://127.0.0.1:3000')
    expect(config.extra.buildFlavor).toBe('local-ios-qa')
  })

  it('leaves normal release configuration unchanged when QA mode is off', () => {
    vi.stubEnv('MAINTAINEX_IOS_TEST_BUILD', '')
    vi.stubEnv('EXPO_PUBLIC_API_URL', '')
    const config = appConfig({ config: baseConfig })

    expect(config.ios.bundleIdentifier).toBe(baseConfig.ios.bundleIdentifier)
    expect(config.extra.apiUrl).toBe('https://maintainex.lk')
  })
})
