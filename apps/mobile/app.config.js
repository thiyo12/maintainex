const { resolveLocalTestApiUrl } = require('./scripts/resolve-local-test-api.cjs')

module.exports = ({ config } = {}) => {
  const base = config || require('./app.json').expo

  if (process.env.MAINTAINEX_IOS_TEST_BUILD !== '1') return base

  const apiUrl = resolveLocalTestApiUrl(process.env.EXPO_PUBLIC_API_URL)
  const baseBundleIdentifier = base.ios?.bundleIdentifier

  return {
    ...base,
    name: 'MaintainEX QA',
    ios: {
      ...base.ios,
      bundleIdentifier: baseBundleIdentifier?.endsWith('.qa')
        ? baseBundleIdentifier
        : `${baseBundleIdentifier}.qa`,
    },
    extra: {
      ...base.extra,
      apiUrl,
      buildFlavor: 'local-ios-qa',
    },
  }
}
