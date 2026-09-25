import { useEffect, useState, useRef, Component, ReactNode } from 'react'
import { Text } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { I18nextProvider } from 'react-i18next'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold,
  Outfit_800ExtraBold, Outfit_900Black,
} from '@expo-google-fonts/outfit'

import { AuthProvider, useAuth } from '../lib/auth'
import i18next, { initI18n } from '../lib/i18n'
import { ThemeProvider } from '../lib/theme'
import { CountryProvider } from '../lib/country'
import { registerForPushNotifications, addNotificationListeners, getLastNotificationResponse } from '../lib/notifications'

SplashScreen.preventAutoHideAsync()

class ErrorBoundary extends Component<{ children: ReactNode }, { error: any }> {
  state = { error: null }
  static getDerivedStateFromError(error: any) { return { error } }
  render() {
    if (this.state.error) {
      const { View, Text, TouchableOpacity } = require('react-native')
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

function NotificationBootstrap() {
  const router = useRouter()
  const { user } = useAuth()
  const handledResponseId = useRef<string | null>(null)

  useEffect(() => {
    if (!user?.id) return

    registerForPushNotifications().catch(() => {})

    const openNotification = (response: any) => {
      const request = response?.notification?.request
      const responseId = request?.identifier || null
      if (responseId && handledResponseId.current === responseId) return
      if (responseId) handledResponseId.current = responseId

      const data = request?.content?.data || {}
      const referenceType = data.referenceType as string | undefined
      const referenceId = data.referenceId as string | undefined
      if (!referenceType || !referenceId) return

      if (referenceType === 'JOB' || referenceType === 'QUOTE') {
        if (user.role === 'TASKER') {
          router.push(`/(tasker)/jobs/v2/manage/${referenceId}` as any)
        } else if (user.role === 'COMPANY') {
          router.push(`/(company)/jobs/v2/manage/${referenceId}` as any)
        } else {
          router.push(`/(customer)/jobs/v2/${referenceId}` as any)
        }
        return
      }

      if (referenceType === 'CHAT') {
        router.push(`/(chat)/${referenceId}` as any)
        return
      }

      if (referenceType === 'WALLET') {
        if (user.role === 'TASKER') router.push('/(tasker)/wallet/withdraw' as any)
        else if (user.role === 'COMPANY') router.push('/(company)/(tabs)/earnings-list' as any)
        else router.push('/(customer)/wallet' as any)
      }
    }

    const unsubscribe = addNotificationListeners(undefined, openNotification)
    getLastNotificationResponse().then((response) => {
      if (response) openNotification(response)
    }).catch(() => {})

    return unsubscribe
  }, [router, user?.id, user?.role])

  return null
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
    })()
  }, [])

  useEffect(() => {
    if (fontsLoaded && i18nReady) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, i18nReady])

  // Keep the native launch layer visible until the JS splash is fully ready.
  // The native layer is background-only, so there is no legacy splash image
  // before the V3.3 animated splash in app/index.tsx.
  if (!fontsLoaded || !i18nReady) {
    return null
  }

  if (!Text.defaultProps) Text.defaultProps = {} as any
  Text.defaultProps.style = { fontFamily: 'Outfit_400Regular' }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0D0D0D' }}>
    <ErrorBoundary>
    <ThemeProvider>
      <AuthProvider>
        <NotificationBootstrap />
        <CountryProvider>
        <I18nextProvider i18n={i18next}>
          <StatusBar style="light" />
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
