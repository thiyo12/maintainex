import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/auth'
import { LoadingScreen } from '../components/ui/LoadingScreen'
import Logo from '../components/ui/Logo'
import { useColors } from '../lib/ThemeContext'
import { fonts, fontSizes } from '../lib/fonts'
import { spacing } from '../lib/tokens'

export default function SplashScreen() {
  const colors = useColors()
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated) {
      if (user?.role === 'ADMIN') router.replace('/(admin)')
      else if (user?.role === 'TASKER' && user?.needsOnboarding) router.replace('/(auth)/onboarding/tasker-services')
      else if (user?.role === 'COMPANY' && user?.needsOnboarding) router.replace('/(auth)/onboarding/company-setup')
      else if (user?.role === 'TASKER') router.replace('/(tasker)')
      else if (user?.role === 'COMPANY') router.replace('/(company)')
      else router.replace('/(customer)')
      return
    }
    const timer = setTimeout(() => router.replace('/(auth)/welcome'), 2000)
    return () => clearTimeout(timer)
  }, [isAuthenticated, isLoading, user])

  if (isLoading) return <LoadingScreen />

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <View style={styles.logoWrapper}>
        <Logo size={120} />
        <Text style={[styles.appName, { color: colors.white }]}>Maintainex</Text>
        <Text style={[styles.tagline, { color: colors.white }]}>Professional Services at Your Doorstep</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  logoWrapper: { alignItems: 'center' },
  appName: {
    fontSize: fontSizes.display,
    fontFamily: fonts.display,
    marginBottom: spacing.sm,
    marginTop: spacing.xxl,
    opacity: 0.9,
  },
  tagline: {
    fontSize: fontSizes.body,
    fontFamily: fonts.bodyLight,
    opacity: 0.7,
    textAlign: 'center',
  },
})
