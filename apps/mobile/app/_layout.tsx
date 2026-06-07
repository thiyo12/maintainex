import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { I18nextProvider } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { AuthProvider } from '../lib/auth'
import i18next, { initI18n } from '../lib/i18n'
import { ThemeProvider } from '../lib/ThemeContext'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
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

  if (!i18nReady) return null

  return (
    <ThemeProvider>
      <AuthProvider>
        <I18nextProvider i18n={i18next}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(customer)" />
          <Stack.Screen name="(tasker)" />
          <Stack.Screen name="(company)" />
          <Stack.Screen name="(chat)" />
          <Stack.Screen name="(admin)" />
        </Stack>
      </I18nextProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}
