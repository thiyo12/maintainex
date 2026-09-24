import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft } from 'phosphor-react-native'
import CancelJobWithOtp from '@/components/jobs/CancelJobWithOtp'
import { v3 } from '@/theme/v3/tokens'

export default function CancelJobScreen() {
  const router = useRouter()
  const { id, reason } = useLocalSearchParams<{ id: string; reason?: string }>()

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.circle} onPress={() => router.back()}>
          <CaretLeft size={18} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>SECURE ACTION</Text>
          <Text style={styles.title}>Cancel job</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <CancelJobWithOtp jobId={id} initialReason={reason || ''} onDone={() => router.replace('/' as any)} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 40 },
  headerCopy: { flex: 1, marginLeft: 11 },
  eyebrow: { ...v3.typography.smallBold, color: v3.colors.amberDark, letterSpacing: 0.8 },
  title: { ...v3.typography.title, color: v3.colors.ink, marginTop: 1 },
  content: { padding: 18, paddingBottom: 36 },
})
