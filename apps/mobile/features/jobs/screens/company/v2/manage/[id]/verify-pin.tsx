import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ShieldCheck, ArrowLeft } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { v2JobActions } from '@/lib/api-v2'
import PinInput from '@/components/ui/PinInput'

export default function CompanyPinVerifyScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id, purpose } = useLocalSearchParams<{ id: string; purpose: string }>()

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const purposeLabels: Record<string, string> = {
    ARRIVAL: t('jobPin.verifyArrival'),
    WORK_START: t('jobPin.verifyWorkStart'),
    COMPLETION: t('jobPin.verifyCompletion'),
  }

  const handlePinComplete = async (pin: string) => {
    setLoading(true)
    setError('')
    try {
      await v2JobActions.verifyPin(id, pin, purpose || 'ARRIVAL')
      Alert.alert(t('common.success'), t('jobPin.verified'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ])
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('Incorrect PIN')) {
        setError(t('jobPin.wrong'))
      } else if (msg.includes('locked')) {
        setError(t('jobPin.locked'))
      } else if (msg.includes('Not authorized')) {
        setError(t('jobPin.notAuthorized'))
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
        <ShieldCheck size={64} color={colors.amber} />
        <Text style={styles.purpose}>{purposeLabels[purpose || 'ARRIVAL']}</Text>
        <Text style={styles.subtitle}>{t('jobPin.enterPin')}</Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 24 }} />
        ) : (
          <PinInput onComplete={handlePinComplete} error={error} />
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
  })
}
