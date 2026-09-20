import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/auth'

export default function EntryScreen() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    if (isAuthenticated) {
      if (user?.role === 'TASKER' && user?.needsOnboarding) {
        router.replace('/(auth)/onboarding/tasker-services')
        return
      }

      if (user?.role === 'COMPANY' && user?.needsOnboarding) {
        router.replace('/(auth)/onboarding/company-setup')
        return
      }

      if (user?.role === 'TASKER') {
        router.replace('/(tasker)')
        return
      }

      if (user?.role === 'COMPANY') {
        router.replace('/(company)')
        return
      }

      router.replace('/(customer)')
      return
    }

    router.replace('/(auth)/welcome')
  }, [isAuthenticated, isLoading, user, router])

  // Native expo-splash-screen owns the launch experience.
  // Keep this transition surface visually identical so no legacy JS splash
  // or white flash appears while auth routing resolves.
  return <View style={styles.container} />
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
})
