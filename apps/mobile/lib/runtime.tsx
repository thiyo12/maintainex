import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Constants from 'expo-constants'
import { request } from '@/api/client'
import { useCountry } from '@/lib/country'

export interface PlatformRuntimeConfig {
  channels: {
    website: boolean
    mobile: boolean
    booking: boolean
  }
  maintenance: {
    enabled: boolean
    message: string
  }
  catalog: {
    visible: boolean
  }
  offers: {
    visible: boolean
  }
  notifications: {
    enabled: boolean
  }
  banner: {
    enabled: boolean
    message: string
    severity: 'INFO' | 'WARNING' | 'CRITICAL'
  }
  mobile: {
    minimumVersion: string
  }
  market: {
    countryCode: string | null
    available: boolean
    availableMarkets: string[]
  }
  booking: {
    enabled: false
    locked: true
    reason: string
  }
}

const DEFAULT_RUNTIME: PlatformRuntimeConfig = {
  channels: { website: true, mobile: true, booking: false },
  maintenance: { enabled: false, message: '' },
  catalog: { visible: true },
  offers: { visible: true },
  notifications: { enabled: true },
  banner: { enabled: false, message: '', severity: 'INFO' },
  mobile: { minimumVersion: '1.0.0' },
  market: { countryCode: null, available: true, availableMarkets: [] },
  booking: {
    enabled: false,
    locked: true,
    reason: 'PUBLIC_BOOKING_UX_GATE_PENDING',
  },
}

interface RuntimeContextValue {
  config: PlatformRuntimeConfig
  loading: boolean
  refresh: () => Promise<void>
}

const RuntimeContext = createContext<RuntimeContextValue>({
  config: DEFAULT_RUNTIME,
  loading: true,
  refresh: async () => {},
})

export function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const { selectedCountry, isLoading: countryLoading } = useCountry()
  const [config, setConfig] = useState<PlatformRuntimeConfig>(DEFAULT_RUNTIME)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (countryLoading) return
    setLoading(true)
    try {
      const country = selectedCountry?.code
      const query = country ? `?country=${encodeURIComponent(country)}` : ''
      const next = await request<PlatformRuntimeConfig>(`/api/runtime/config${query}`)
      setConfig(next)
    } catch {
      // Runtime configuration is operational guidance, not an availability dependency.
      // Fail open to the app defaults if the config endpoint is temporarily unreachable.
      setConfig(DEFAULT_RUNTIME)
    } finally {
      setLoading(false)
    }
  }, [countryLoading, selectedCountry?.code])

  useEffect(() => {
    load()
  }, [load])

  const value = useMemo(() => ({ config, loading, refresh: load }), [config, loading, load])
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
}

export function useRuntimeConfig() {
  return useContext(RuntimeContext)
}

export function RuntimeGate({ children }: { children: React.ReactNode }) {
  const { config, loading, refresh } = useRuntimeConfig()
  const currentVersion = Constants.expoConfig?.version || '1.0.0'
  const updateRequired = compareVersions(currentVersion, config.mobile.minimumVersion) < 0

  if (loading) {
    return (
      <View style={styles.gate}>
        <Text style={styles.brand}>MaintainEX</Text>
        <Text style={styles.message}>Preparing your marketplace…</Text>
      </View>
    )
  }

  if (
    config.maintenance.enabled ||
    !config.channels.mobile ||
    !config.market.available ||
    updateRequired
  ) {
    const title = updateRequired
      ? 'Update required'
      : !config.market.available
        ? 'Market not available'
        : 'Temporarily unavailable'

    const message = updateRequired
      ? `MaintainEX ${config.mobile.minimumVersion} or later is required to continue.`
      : config.maintenance.message ||
        (!config.market.available
          ? 'MaintainEX is not currently available in this market.'
          : 'MaintainEX mobile access is temporarily paused.')

    return (
      <View style={styles.gate}>
        <Text style={styles.brand}>MaintainEX</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity style={styles.retry} onPress={refresh}>
          <Text style={styles.retryText}>Check again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {children}
      {config.banner.enabled && config.banner.message.trim() ? (
        <View
          pointerEvents="none"
          style={[
            styles.banner,
            config.banner.severity === 'CRITICAL'
              ? styles.bannerCritical
              : config.banner.severity === 'WARNING'
                ? styles.bannerWarning
                : styles.bannerInfo,
          ]}
        >
          <Text style={styles.bannerText}>{config.banner.message}</Text>
        </View>
      ) : null}
    </View>
  )
}

function compareVersions(a: string, b: string) {
  const left = parseVersion(a)
  const right = parseVersion(b)
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

function parseVersion(value: string): [number, number, number] {
  const parts = value.split('.').slice(0, 3).map(part => {
    const n = Number.parseInt(part.replace(/\D.*$/, ''), 10)
    return Number.isFinite(n) ? n : 0
  })
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D0D0D',
    paddingHorizontal: 28,
  },
  brand: {
    color: '#F5A623',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 18,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    color: '#B7B7B7',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 420,
  },
  retry: {
    marginTop: 22,
    borderRadius: 999,
    backgroundColor: '#F5A623',
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  retryText: {
    color: '#0D0D0D',
    fontSize: 14,
    fontWeight: '700',
  },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 52,
    zIndex: 9999,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  bannerInfo: {
    backgroundColor: '#163149',
    borderColor: '#2E6A9C',
  },
  bannerWarning: {
    backgroundColor: '#4A3713',
    borderColor: '#9B6D13',
  },
  bannerCritical: {
    backgroundColor: '#4B1C1C',
    borderColor: '#9B3434',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
})
