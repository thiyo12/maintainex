import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/features/auth/context/auth'
import * as SecureStore from 'expo-secure-store'

export default function EntryScreen() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    let cancelled = false
    ;(async () => {
      if (isAuthenticated) {
        const pendingInvite = await SecureStore.getItemAsync('pending_company_invite')
        if (!cancelled && pendingInvite) {
          router.replace(`/company-invite?token=${encodeURIComponent(pendingInvite)}` as any)
          return
        }

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
    })().catch(() => {
      if (!cancelled) router.replace(isAuthenticated ? '/(customer)' : '/(auth)/welcome')
    })

    return () => {
      cancelled = true
    }
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
