import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { colors } from '../../../lib/colors'

export default function ProfileTabRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/(customer)/settings')
  }, [])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )
}
