import { useEffect, useState, Component, ReactNode } from 'react'
import { Text } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { I18nextProvider } from 'react-i18next'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold,
  Outfit_800ExtraBold, Outfit_900Black,
} from '@expo-google-fonts/outfit'

import { AuthProvider } from '../lib/auth'
import i18next, { initI18n } from '../lib/i18n'
import { ThemeProvider } from '../lib/theme'
import { CountryProvider } from '../lib/country'
import { getAuthToken } from '../lib/api'
import { LoadingScreen } from '../components/ui/LoadingScreen'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

async function registerForPushNotifications() {
  try {
    let Notifications: any
    try { Notifications = require('expo-notifications') } catch { return null }
    let Device: any
    try { Device = require('expo-device') } catch { return null }
    if (!Device.isDevice) return null
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return null
    const tokenData = await Notifications.getExpoPushTokenAsync()
    const token = tokenData.data
    try {
      const authToken = await getAuthToken()
      if (authToken) {
        await fetch(`${API_URL}/api/mobile/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ token }),
        })
      }
    } catch {}
    return token
  } catch {
    return null
  }
}

SplashScreen.preventAutoHideAsync()

class ErrorBoundary extends Component<{ children: ReactNode }, { error: any }> {
  state = { error: null }
  static getDerivedStateFromError(error: any) { return { error } }
  render() {
    if (this.state.error) {
      const { View, Text, TouchableOpacity, StyleSheet } = require('react-native')
      return (
        <View style={ebStyles.container}>
          <Text style={ebStyles.title}>Something went wrong</Text>
          <Text style={ebStyles.msg}>{String(this.state.error?.message || this.state.error)}</Text>
          <TouchableOpacity style={ebStyles.btn} onPress={() => { this.setState({ error: null }); require('expo-router').router.replace('/') }}>
            <Text style={ebStyles.btnText}>Restart App</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const ebStyles = {
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0D0D', padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold' as const, color: '#fff', marginBottom: 12 },
  msg: { fontSize: 14, color: '#999', textAlign: 'center' as const, marginBottom: 24 },
  btn: { backgroundColor: '#F5A623', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  btnText: { fontSize: 16, fontWeight: 'bold' as const, color: '#0D0D0D' },
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold,
    Outfit_800ExtraBold, Outfit_900Black,
  })
  const [i18nReady, setI18nReady] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const saved = await AsyncStorage.getItem('app-language')
        await initI18n(saved || 'en')
        if (saved && saved !== 'en') await i18next.changeLanguage(saved)
      } catch {}
      setI18nReady(true)
      SplashScreen.hideAsync()
      registerForPushNotifications()
    })()
  }, [])

  if (!fontsLoaded || !i18nReady) {
    return <LoadingScreen />
  }

  if (!Text.defaultProps) Text.defaultProps = {} as any
  Text.defaultProps.style = { fontFamily: 'Outfit_400Regular' }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
    <ErrorBoundary>
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
    </ErrorBoundary>
    </GestureHandlerRootView>
  )
}
