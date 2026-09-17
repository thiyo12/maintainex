import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { CaretLeft, CheckCircle, WarningCircle, Flag } from 'phosphor-react-native'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { v2JobActions } from '../../../lib/api-v2'

const REASONS = [
  'Work not completed',
  'Work done poorly',
  'Tasker did not arrive',
  'Damage caused to property',
  'Wrong service provided',
  'Other',
]

export default function DisputeScreen() {
  const colors = useColors()
  const router = useRouter()
  const { bookingId, jobTitle, taskerName } = useLocalSearchParams<{ bookingId: string; jobTitle: string; taskerName: string }>()
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const styles = makeStyles(colors)

  const handleSubmit = async () => {
    if (!reason) { Alert.alert('Please select a reason'); return }
    if (!description || description.length < 20) {
      Alert.alert('Please describe the issue in more detail (at least 20 characters)')
      return
    }
    setLoading(true)
    try {
      await v2JobActions.complete(bookingId!, 'DISPUTE')
      Alert.alert(
        'Dispute Raised',
        'Our team will review your dispute within 3 business days. The payment is frozen until resolved.',
        [{ text: 'OK', onPress: () => router.replace('/(customer)/(tabs)') }]
      )
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to raise dispute.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <CaretLeft size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Raise a Dispute</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView>
        <View style={styles.warning}>
          <WarningCircle size={18} color="#E11900" />
          <Text style={styles.warnTxt}>
            Raising a dispute freezes the payment. Our team reviews within 3 business days. Only raise a dispute if there is a genuine problem with the work.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>What went wrong?</Text>
          {REASONS.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.reasonBtn, reason === r && styles.reasonOn]}
              onPress={() => setReason(r)}
              activeOpacity={0.8}
            >
              <Text style={styles.reasonTxt}>{r}</Text>
              {reason === r && <CheckCircle size={18} color={colors.amber} />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Describe the issue</Text>
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Explain what happened in detail..."
            placeholderTextColor={colors.muted}
            multiline
          />
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Flag size={18} color="#FFFFFF" />
          <Text style={styles.btnTxt}>{loading ? 'Submitting...' : 'Raise Dispute'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: fonts.headingBold, color: colors.ink },
  warning: { backgroundColor: colors.redBg, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 18 },
  warnTxt: { fontSize: 12, fontFamily: fonts.body, color: '#E11900', flex: 1, lineHeight: 18 },
  section: { marginBottom: 18 },
  label: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  reasonBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, marginBottom: 8, backgroundColor: colors.white },
  reasonOn: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  reasonTxt: { fontSize: 13, fontFamily: fonts.body, color: colors.ink },
  textInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 13, fontFamily: fonts.body, color: colors.ink, backgroundColor: colors.white, minHeight: 100, textAlignVertical: 'top' },
  btn: { backgroundColor: '#E11900', borderRadius: 14, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnTxt: { fontSize: 15, fontFamily: fonts.headingBold, color: '#FFFFFF' },
})
