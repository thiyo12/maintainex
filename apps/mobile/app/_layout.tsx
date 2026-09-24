import { useEffect, useRef, useState, Component, ReactNode } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { I18nextProvider } from 'react-i18next'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Animated, StyleSheet, Text, TouchableOpacity, View, Vibration } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold,
  Outfit_800ExtraBold, Outfit_900Black,
} from '@expo-google-fonts/outfit'

import { AuthProvider } from '../lib/auth'
import i18next, { initI18n } from '../lib/i18n'
import { ThemeProvider } from '../lib/theme'
import { CountryProvider } from '../lib/country'
import { auth } from '../lib/api'
import { addNotificationListeners, registerForPushNotifications } from '../lib/notifications'
import { LoadingScreen } from '../components/ui/LoadingScreen'

SplashScreen.preventAutoHideAsync().catch(() => {})

type LiveOffer = {
  jobId: string
  title: string
  body: string
  companyId?: string
}

async function openNotification(data: any) {
  const jobId = String(data?.jobId || data?.referenceId || '')
  if (!jobId) return

  if (data?.type === 'NEW_JOB') {
    if (data?.companyId) {
      router.push(`/(company)/jobs/v2/quote/${jobId}` as any)
    } else {
      router.push(`/(tasker)/jobs/v2/quote/${jobId}` as any)
    }
    return
  }

  try {
    const me = await auth.me()
    const role = me?.user?.role
    if (role === 'CUSTOMER') router.push(`/(customer)/jobs/v2/${jobId}` as any)
    else if (role === 'COMPANY') router.push(`/(company)/jobs/v2/manage/${jobId}` as any)
    else if (role === 'TASKER') router.push(`/(tasker)/jobs/v2/manage/${jobId}` as any)
  } catch {}
}

function LiveJobOfferBanner({ offer, onClose }: { offer: LiveOffer; onClose: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.72, duration: 480, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 480, useNativeDriver: true }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [pulse])

  return (
    <Animated.View style={[offerStyles.wrap, { opacity: pulse }]}>
      <View style={offerStyles.dot} />
      <View style={offerStyles.copy}>
        <Text style={offerStyles.eyebrow}>NEW MATCHING JOB</Text>
        <Text style={offerStyles.title} numberOfLines={1}>{offer.title}</Text>
        <Text style={offerStyles.body} numberOfLines={2}>{offer.body}</Text>
      </View>
      <View style={offerStyles.actions}>
        <TouchableOpacity style={offerStyles.dismiss} onPress={onClose}>
          <Text style={offerStyles.dismissText}>Later</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={offerStyles.view}
          onPress={() => {
            onClose()
            openNotification({
              type: 'NEW_JOB',
              jobId: offer.jobId,
              companyId: offer.companyId,
            })
          }}
        >
          <Text style={offerStyles.viewText}>View</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <View style={ebStyles.container}>
          <Text style={ebStyles.title}>Something went wrong</Text>
          <Text style={ebStyles.msg}>{this.state.error.message || String(this.state.error)}</Text>
          <TouchableOpacity
            style={ebStyles.btn}
            onPress={() => {
              this.setState({ error: null })
              router.replace('/')
            }}
          >
            <Text style={ebStyles.btnText}>Restart app</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold,
    Outfit_800ExtraBold, Outfit_900Black,
  })
  const [i18nReady, setI18nReady] = useState(false)
  const [liveOffer, setLiveOffer] = useState<LiveOffer | null>(null)
  const offerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const saved = await AsyncStorage.getItem('app-language')
        await initI18n(saved || 'en')
        if (saved && saved !== 'en') await i18next.changeLanguage(saved)
      } catch {}
      setI18nReady(true)
      SplashScreen.hideAsync().catch(() => {})
    })()
  }, [])

  useEffect(() => {
    registerForPushNotifications()
    const registrationRetry = setInterval(() => {
      registerForPushNotifications()
    }, 30_000)

    const cleanupListeners = addNotificationListeners(
      (notification) => {
        const content = notification?.request?.content
        const data = content?.data || {}
        if (data?.type !== 'NEW_JOB') return

        if (offerTimer.current) clearTimeout(offerTimer.current)
        setLiveOffer({
          jobId: String(data.jobId || ''),
          companyId: data.companyId ? String(data.companyId) : undefined,
          title: content?.title || 'New job near you',
          body: content?.body || 'A matching job is ready for your review.',
        })
        Vibration.vibrate([0, 250, 120, 250, 120, 400])
        offerTimer.current = setTimeout(() => setLiveOffer(null), 30_000)
      },
      (response) => {
        openNotification(response?.notification?.request?.content?.data || {})
      },
    )

    return () => {
      clearInterval(registrationRetry)
      cleanupListeners()
      if (offerTimer.current) clearTimeout(offerTimer.current)
    }
  }, [])

  if (!fontsLoaded || !i18nReady) {
    return <LoadingScreen />
  }

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
                {liveOffer ? <LiveJobOfferBanner offer={liveOffer} onClose={() => setLiveOffer(null)} /> : null}
              </I18nextProvider>
            </CountryProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}

const offerStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 56,
    left: 12,
    right: 12,
    zIndex: 999,
    borderRadius: 20,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#F4B400',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 16,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#F4B400',
    marginRight: 10,
  },
  copy: { flex: 1, paddingRight: 8 },
  eyebrow: { fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#F4B400', letterSpacing: 0.8 },
  title: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: '#FFFFFF', marginTop: 2 },
  body: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: '#C8C8C8', marginTop: 2, lineHeight: 15 },
  actions: { gap: 6, alignItems: 'stretch' },
  dismiss: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  dismissText: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: '#AFAFAF' },
  view: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, backgroundColor: '#F4B400' },
  viewText: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: '#111111' },
})

const ebStyles = {
  container: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: '#F7F7F7', padding: 24 },
  title: { fontSize: 20, fontFamily: 'Outfit_700Bold', color: '#000000', marginBottom: 12 },
  msg: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: '#6F6F6F', textAlign: 'center' as const, marginBottom: 24 },
  btn: { backgroundColor: '#000000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  btnText: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: '#FFFFFF' },
}
