import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft, MapPin, Play, ShieldCheck } from 'phosphor-react-native'
import { v2JobActions } from '../../../../../../lib/api-v2'
import { v3 } from '../../../../../../theme/v3/tokens'
import PinInput from '../../../../../../components/ui/PinInput'

export default function CompanyPinVerifyScreen() {
  const router = useRouter()
  const { id, purpose } = useLocalSearchParams<{ id: string; purpose: string }>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const mode = purpose === 'WORK_START' ? 'WORK_START' : 'ARRIVAL'
  const copy = useMemo(() => mode === 'ARRIVAL'
    ? {
        eyebrow: 'ARRIVAL CHECK',
        title: 'Confirm your team arrived',
        text: 'Ask the customer for the 6-digit arrival PIN only after your team is physically at the job location.',
        Icon: MapPin,
      }
    : {
        eyebrow: 'WORK START',
        title: 'Start work securely',
        text: 'Arrival must be verified first. Enter the customer PIN again to unlock the work stage.',
        Icon: Play,
      }, [mode])

  const submit = async (pin: string) => {
    setLoading(true)
    setError('')
    try {
      await v2JobActions.verifyPin(id, pin, mode)
      Alert.alert(
        mode === 'ARRIVAL' ? 'Arrival verified' : 'Work started',
        mode === 'ARRIVAL'
          ? 'Your team is checked in. Continue with Start work when the customer is ready.'
          : 'The secure work-start check is complete.',
        [{ text: 'Continue', onPress: () => router.back() }],
      )
    } catch (err: any) {
      const message = err?.message || 'Unable to verify PIN.'
      if (message.includes('Incorrect PIN')) setError('That PIN is not correct.')
      else if (message.includes('locked')) setError('PIN verification is temporarily locked.')
      else if (message.includes('current job state')) {
        setError(mode === 'WORK_START'
          ? 'Verify arrival first, then start work.'
          : 'Arrival verification is not available at this job stage.')
      } else if (message.includes('Not authorized')) setError('This account is not authorized for this job.')
      else setError(message)
    } finally {
      setLoading(false)
    }
  }

  const Icon = copy.Icon

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.circle} onPress={() => router.back()}>
          <CaretLeft size={18} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job verification</Text>
        <View style={styles.circlePlaceholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Icon size={30} color={v3.colors.ink} weight="fill" />
        </View>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.text}</Text>

        <View style={styles.securityNote}>
          <ShieldCheck size={17} color={v3.colors.success} weight="fill" />
          <Text style={styles.securityText}>Never ask the customer to send the PIN before you arrive.</Text>
        </View>

        <View style={styles.pinCard}>
          {loading ? (
            <View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View>
          ) : (
            <PinInput onComplete={submit} error={error} />
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  circlePlaceholder: { width: 40, height: 40 },
  headerTitle: { ...v3.typography.title, color: v3.colors.ink },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 44, alignItems: 'center' },
  iconWrap: { width: 68, height: 68, borderRadius: 23, backgroundColor: v3.colors.amber, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { ...v3.typography.smallBold, color: v3.colors.amberDark, letterSpacing: 1, marginTop: 20 },
  title: { ...v3.typography.h4, color: v3.colors.ink, textAlign: 'center', marginTop: 4 },
  body: { ...v3.typography.body, color: v3.colors.textSecondary, textAlign: 'center', lineHeight: 19, marginTop: 8, maxWidth: 330 },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: v3.colors.successSoft, borderRadius: 16, padding: 12, marginTop: 20, width: '100%' },
  securityText: { ...v3.typography.caption, color: v3.colors.textSecondary, marginLeft: 8, lineHeight: 16, flex: 1 },
  pinCard: { width: '100%', backgroundColor: v3.colors.paper, borderRadius: 20, borderWidth: 1, borderColor: v3.colors.line, paddingVertical: 24, paddingHorizontal: 12, marginTop: 12 },
  loading: { height: 70, alignItems: 'center', justifyContent: 'center' },
})
