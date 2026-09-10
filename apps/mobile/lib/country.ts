import { useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getCurrencyForCountry, type Currency } from './money'

const COUNTRY_KEY = 'user_country_code'

export function useCountry(): string {
  const [countryCode, setCountryCode] = useState<string>('LK')

  useEffect(() => {
    AsyncStorage.getItem(COUNTRY_KEY).then((stored) => {
      if (stored) setCountryCode(stored)
    })
  }, [])

  return countryCode
}

export function useCurrency(): Currency {
  const countryCode = useCountry()
  return getCurrencyForCountry(countryCode)
}

export async function setCountryCode(countryCode: string): Promise<void> {
  await AsyncStorage.setItem(COUNTRY_KEY, countryCode)
}
