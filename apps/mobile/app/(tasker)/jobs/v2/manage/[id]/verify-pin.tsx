import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ShieldCheck, CaretLeft, Lock } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../../../../../lib/fonts'
import { v2JobActions } from '../../../../../../lib/api-v2'
import PinInput from '../../../../../../components/ui/PinInput'
import { v3 } from '../../../../../../theme/v3/tokens'

export default function ProviderPinVerifyScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { id, purpose } = useLocalSearchParams<{ id: string; purpose: string }>()

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)

  const MAX_ATTEMPTS = 5

  const purposeLabels: Record<string, string> = {
    ARRIVAL: t('jobPin.verifyArrival'),
    WORK_START: t('jobPin.verifyWorkStart'),
    COMPLETION: t('jobPin.verifyCompletion'),
  }

  const handlePinComplete = async (pin: string) => {
    if (locked) return
    setLoading(true)
    setError('')
    try {
      await v2JobActions.verifyPin(id, pin, purpose || 'ARRIVAL')
      Alert.alert(t('common.success'), t('jobPin.verified'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ])
    } catch (err: any) {
      const msg = err?.message || ''
      const newAttempts = attempts + 1
      setAttempts(newAttempts)

      if (msg.includes('Incorrect PIN') || msg.includes('incorrect')) {
        const remaining = MAX_ATTEMPTS - newAttempts
        if (remaining <= 0) {
          setLocked(true)
          setError(t('jobPin.locked'))
        } else {
          setError(`${t('jobPin.wrong')} (${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} left)`)
        }
      } else if (msg.includes('locked') || msg.includes('Locked')) {
        setLocked(true)
        setError(t('jobPin.locked'))
      } else if (msg.includes('Not authorized') || msg.includes('unauthorized')) {
        setError(t('jobPin.notAuthorized'))
      } else if (msg.includes('expired')) {
        setError(t('jobPin.expired'))
      } else {
        setError(msg || t('common.error'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.72}>
          <CaretLeft size={17} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Verify arrival</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {locked ? (
          <>
            <View style={styles.iconCardError}><Lock size={27} color={v3.colors.error} weight="fill" /></View>
            <Text style={styles.hero}>PIN temporarily locked</Text>
            <Text style={styles.subtitle}>{t('jobPin.lockedBody')}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
              <Text style={styles.secondaryText}>Back to job</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.iconCard}><ShieldCheck size={28} color={v3.colors.info} weight="fill" /></View>
            <Text style={styles.hero}>{purposeLabels[purpose || 'ARRIVAL'] || 'Verify arrival'}</Text>
            <Text style={styles.subtitle}>Enter the 4-digit PIN shown to the customer. This confirms you reached the correct job.</Text>

            <View style={styles.pinCard}>
              {loading ? (
                <ActivityIndicator size="small" color={v3.colors.ink} />
              ) : (
                <PinInput onComplete={handlePinComplete} error={error} />
              )}
            </View>

            {attempts > 0 && !locked ? (
              <Text style={styles.attemptsText}>{MAX_ATTEMPTS - attempts} attempts remaining</Text>
            ) : null}

            <View style={styles.whyCard}>
              <ShieldCheck size={15} color={v3.colors.success} weight="fill" />
              <View style={styles.whyCopy}>
                <Text style={styles.whyTitle}>Why this matters</Text>
                <Text style={styles.whyText}>PIN verification protects both the customer and Tasker and records the arrival inside MaintainEX.</Text>
              </View>
            </View>

            <Text style={styles.helperText}>The job starts only after a valid customer PIN is verified.</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  topBar: { height: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 38, height: 38 },
  topTitle: { fontSize: 14, fontFamily: fonts.headingBold, color: v3.colors.ink },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 42, alignItems: 'center' },
  iconCard: { width: 58, height: 58, borderRadius: 18, backgroundColor: v3.colors.infoSoft, alignItems: 'center', justifyContent: 'center' },
  iconCardError: { width: 58, height: 58, borderRadius: 18, backgroundColor: v3.colors.errorSoft, alignItems: 'center', justifyContent: 'center' },
  hero: { marginTop: 18, fontSize: 27, lineHeight: 33, fontFamily: fonts.heading, color: v3.colors.ink, textAlign: 'center' },
  subtitle: { marginTop: 8, maxWidth: 320, fontSize: 10.5, lineHeight: 16, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary, textAlign: 'center' },
  pinCard: { minHeight: 106, width: '100%', marginTop: 28, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  attemptsText: { marginTop: 10, fontSize: 9.5, fontFamily: fonts.headingBold, color: v3.colors.amberDark },
  whyCard: { width: '100%', minHeight: 84, marginTop: 28, borderRadius: 16, padding: 14, backgroundColor: v3.colors.successSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  whyCopy: { flex: 1 },
  whyTitle: { fontSize: 10, fontFamily: fonts.headingBold, color: v3.colors.success },
  whyText: { marginTop: 5, fontSize: 8.8, lineHeight: 14, fontFamily: fonts.bodySemiBold, color: '#4F4F4F' },
  helperText: { marginTop: 16, fontSize: 8.8, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted, textAlign: 'center' },
  secondaryButton: { minWidth: 150, height: 50, marginTop: 28, borderRadius: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 11, fontFamily: fonts.headingBold, color: v3.colors.ink },
})
