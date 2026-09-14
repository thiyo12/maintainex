import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ShieldCheck, ArrowLeft, Lock } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../lib/ThemeContext'
import { fonts } from '../../../../lib/fonts'
import { v2JobActions } from '../../../../lib/api-v2'
import PinInput from '../../../../components/ui/PinInput'

export default function ProviderPinVerifyScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('jobPin.verify')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {locked ? (
          <>
            <Lock size={64} color="#DC2626" />
            <Text style={styles.lockedTitle}>{t('jobPin.locked')}</Text>
            <Text style={styles.lockedBody}>{t('jobPin.lockedBody')}</Text>
            <TouchableOpacity style={styles.backBtnLarge} onPress={() => router.back()}>
              <Text style={styles.backBtnText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ShieldCheck size={64} color={colors.amber} />
            <Text style={styles.purpose}>{purposeLabels[purpose || 'ARRIVAL']}</Text>
            <Text style={styles.subtitle}>{t('jobPin.enterPin')}</Text>

            {loading ? (
              <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 24 }} />
            ) : (
              <PinInput onComplete={handlePinComplete} error={error} />
            )}

            {attempts > 0 && !locked && (
              <Text style={styles.attemptsText}>
                {MAX_ATTEMPTS - attempts} {attempts === MAX_ATTEMPTS - 1 ? 'attempt' : 'attempts'} remaining
              </Text>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontFamily: fonts.semibold, color: colors.text },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    purpose: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, marginTop: 16 },
    subtitle: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, marginTop: 8, textAlign: 'center' },
    attemptsText: { fontSize: 12, color: '#D97706', marginTop: 16, textAlign: 'center' },
    lockedTitle: { fontSize: 20, fontFamily: fonts.bold, color: '#DC2626', marginTop: 16 },
    lockedBody: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, marginTop: 8, textAlign: 'center', lineHeight: 20 },
    backBtnLarge: { backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, marginTop: 24 },
    backBtnText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
  })
}
