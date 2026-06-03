import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/auth'
import { LoadingScreen } from '../components/ui/LoadingScreen'
import Logo from '../components/ui/Logo'
import { colors } from '../lib/colors'
import { fonts } from '../lib/fonts'

export default function SplashScreen() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated) {
      if (user?.role === 'ADMIN') router.replace('/(admin)')
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
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        <Logo size={120} />
        <Text style={styles.appName}>Maintainex</Text>
        <Text style={styles.tagline}>Professional Services at Your Doorstep</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.amber,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoWrapper: { alignItems: 'center' },
  appName: { fontSize: 36, fontFamily: fonts.heading, color: colors.ink, marginBottom: 8, marginTop: 24 },
  tagline: { fontSize: 16, fontFamily: fonts.bodyLight, color: colors.ink, opacity: 0.8, textAlign: 'center' },
})
