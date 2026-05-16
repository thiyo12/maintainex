import { useEffect, useState } from 'react'
import { Redirect, Slot } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { View, ActivityIndicator } from 'react-native'

export default function RootLayout() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<string | null>(null)

  useEffect(() => {
    loadSession()
  }, [])

  const loadSession = async () => {
    try {
      const token = await SecureStore.getItemAsync('session_token')
      setSession(token)
    } catch {}
    setLoading(false)
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    )
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />
  }

  return <Slot />
}
