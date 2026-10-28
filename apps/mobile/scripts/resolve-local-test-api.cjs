const net = require('node:net')

function isPrivateIpv4(host) {
  if (net.isIPv4(host) !== 1) return false
  const [a, b] = host.split('.').map(Number)
  return a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
}

function isLocalTestHost(host) {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '')
  return normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === 'host.docker.internal' ||
    isPrivateIpv4(normalized) ||
    /\.(?:local|test|internal)$/.test(normalized)
}

function resolveLocalTestApiUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('iOS QA build requires an explicit EXPO_PUBLIC_API_URL')
  }

  let url
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('iOS QA API URL must be an absolute HTTP(S) URL')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('iOS QA API URL must use HTTP or HTTPS')
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) {
    throw new Error('iOS QA API URL must be an origin without credentials, path, query, or fragment')
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'maintainex.lk' || host.endsWith('.maintainex.lk') || host === 'maintainex.ca' || host.endsWith('.maintainex.ca')) {
    throw new Error('iOS QA builds cannot target a production MaintainEX host')
  }
  if (!isLocalTestHost(host)) {
    throw new Error('iOS QA API URL must target localhost, a private IPv4 address, or a .local/.test/.internal host')
  }

  return url.origin
}

module.exports = { resolveLocalTestApiUrl }
