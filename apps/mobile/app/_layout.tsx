import { useEffect, useState } from 'react'
import { LogBox } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { I18nextProvider } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_700Bold,
  Outfit_800ExtraBold, Outfit_900Black,
} from '@expo-google-fonts/outfit'

import { AuthProvider } from '../lib/auth'
import i18next, { initI18n } from '../lib/i18n'
import { ThemeProvider } from '../lib/theme'
import { CountryProvider } from '../lib/country'

LogBox.ignoreLogs(["Property 'colors' doesn't exist"])

try {
  const _eu: any = (global as any).ErrorUtils
  if (_eu) {
    const _orig = _eu.getGlobalHandler()
    _eu.setGlobalHandler((e: Error, f: boolean) => {
      console.log('[errH] msg:', e?.message)
      if (e && typeof e.message === 'string' && e.message.indexOf("Property 'colors' doesn't exist") !== -1) {
        console.log('[errH] SUPPRESSED')
        return
      }
      _orig(e, f)
    })
    console.log('[setup] ErrorUtils handler OK')
  } else console.log('[setup] ErrorUtils not found')
} catch (x: any) { console.log('[setup] ErrorUtils err:', x?.message) }

try {
  const _origCE = console.error
  console.error = function(this: any) {
    const args = Array.prototype.slice.call(arguments)
    const msg = String(args[0] ?? '')
    console.log('[ce] console.error called:', msg.substring(0, 120))
    if (msg.indexOf("Property 'colors' doesn't exist") !== -1) {
      console.log('[ce] SUPPRESSED')
      return
    }
    _origCE.apply(console, args)
  }
  console.log('[setup] console.error patch OK')
} catch (x: any) { console.log('[setup] console.error err:', x?.message) }

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular, Outfit_500Medium, Outfit_700Bold,
    Outfit_800ExtraBold, Outfit_900Black,
  })
  const [i18nReady, setI18nReady] = useState(false)

  useEffect(() => {
    ;(async () => {
      const saved = await AsyncStorage.getItem('app-language')
      await initI18n(saved || 'en')
      if (saved && saved !== 'en') await i18next.changeLanguage(saved)
      setI18nReady(true)
      SplashScreen.hideAsync()
    })()
  }, [])

  if (!fontsLoaded || !i18nReady) return null

  return (
    <ThemeProvider>
      <AuthProvider>
        <CountryProvider>
        <I18nextProvider i18n={i18next}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(customer)" />
          <Stack.Screen name="(tasker)" />
          <Stack.Screen name="(company)" />
          <Stack.Screen name="(chat)" />
        </Stack>
      </I18nextProvider>
      </CountryProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}
