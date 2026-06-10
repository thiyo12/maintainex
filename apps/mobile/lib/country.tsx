import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { v2Locations } from './api-v2'

const COUNTRY_KEY = 'user_country'
const LAST_COUNTRY_KEY = 'last_seen_country'

interface Country {
  id: string
  name: string
  code: string
  states?: any[]
}

interface CountryContextType {
  countries: Country[]
  selectedCountry: Country | null
  setCountry: (code: string) => Promise<void>
  detectedCountry: Country | null
  countryChanged: boolean
  dismissCountryChange: () => Promise<void>
  isLoading: boolean
}

const CountryContext = createContext<CountryContextType | undefined>(undefined)

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [countries, setCountries] = useState<Country[]>([])
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null)
  const [detectedCountry, setDetectedCountry] = useState<Country | null>(null)
  const [countryChanged, setCountryChanged] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const mounted = useRef(true)

  useEffect(() => {
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const [locationData, savedCode, lastSeen] = await Promise.all([
          v2Locations.get(),
          AsyncStorage.getItem(COUNTRY_KEY),
          AsyncStorage.getItem(LAST_COUNTRY_KEY),
        ])
        const allCountries: Country[] = locationData.countries || []
        if (!mounted.current) return
        setCountries(allCountries)

        const detected = allCountries[0] || null
        setDetectedCountry(detected)

        if (savedCode) {
          const saved = allCountries.find((c) => c.code === savedCode) || detected
          setSelectedCountry(saved)
        } else {
          setSelectedCountry(detected)
          if (detected) await AsyncStorage.setItem(COUNTRY_KEY, detected.code)
        }

        if (lastSeen && detected && lastSeen !== detected.code) {
          setCountryChanged(true)
        }
        if (detected) await AsyncStorage.setItem(LAST_COUNTRY_KEY, detected.code)
      } catch {
        if (mounted.current) setSelectedCountry(null)
      } finally {
        if (mounted.current) setIsLoading(false)
      }
    })()
  }, [])

  const setCountry = useCallback(async (code: string) => {
    const country = countries.find((c) => c.code === code)
    if (country) {
      setSelectedCountry(country)
      await AsyncStorage.setItem(COUNTRY_KEY, code)
      setCountryChanged(false)
    }
  }, [countries])

  const dismissCountryChange = useCallback(async () => {
    setCountryChanged(false)
    if (detectedCountry) await AsyncStorage.setItem(LAST_COUNTRY_KEY, detectedCountry.code)
  }, [detectedCountry])

  return (
    <CountryContext.Provider
      value={{ countries, selectedCountry, setCountry, detectedCountry, countryChanged, dismissCountryChange, isLoading }}
    >
      {children}
    </CountryContext.Provider>
  )
}

export function useCountry() {
  const context = useContext(CountryContext)
  if (!context) throw new Error('useCountry must be used within CountryProvider')
  return context
}
