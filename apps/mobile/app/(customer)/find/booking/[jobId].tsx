import { useEffect } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useColors } from '../../../../lib/ThemeContext'

export default function QuickBookingRedirect() {
  const colors = useColors()
  const router = useRouter()
  const { jobId, taskerId } = useLocalSearchParams<{ jobId: string; taskerId: string }>()

  useEffect(() => {
    const qs = new URLSearchParams({ templateJobId: jobId })
    if (taskerId) qs.set('taskerId', taskerId)
    router.replace(`/(customer)/jobs/v2/create?${qs.toString()}`)
  }, [jobId, taskerId])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.amber} />
      <Text style={[styles.text, { color: colors.muted }]}>Opening booking wizard…</Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  text: { fontSize: 14, fontWeight: '500' },
})