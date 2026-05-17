import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/auth'
import { LoadingScreen } from '../components/ui/LoadingScreen'
import { colors } from '../lib/colors'

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
        <View style={styles.logoSquare}>
          <Text style={styles.logoText}>M</Text>
        </View>
        <Text style={styles.appName}>Maintainex</Text>
        <Text style={styles.tagline}>Professional Services at Your Doorstep</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoWrapper: { alignItems: 'center' },
  logoSquare: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  logoText: { fontSize: 48, fontWeight: '800', color: colors.dark },
  appName: { fontSize: 36, fontWeight: '800', color: colors.white, marginBottom: 8 },
  tagline: { fontSize: 16, color: colors.white, opacity: 0.9, textAlign: 'center' },
})
