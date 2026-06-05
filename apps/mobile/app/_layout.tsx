import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { I18nextProvider } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFonts, Syne_400Regular, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne'
import { DMSans_300Light, DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans'
import { AuthProvider } from '../lib/auth'
import i18next, { initI18n } from '../lib/i18n'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Syne_400Regular,
    Syne_700Bold,
    Syne_800ExtraBold,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
  })
  const [i18nReady, setI18nReady] = useState(false)

  useEffect(() => {
    ;(async () => {
      const saved = await AsyncStorage.getItem('app-language')
      await initI18n(saved || 'en')
      if (saved && saved !== 'en') await i18next.changeLanguage(saved)
      setI18nReady(true)
    })()
  }, [])

  useEffect(() => {
    if (fontsLoaded && i18nReady) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, i18nReady])

  if (!fontsLoaded || !i18nReady) return null

  return (
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
  )
}
