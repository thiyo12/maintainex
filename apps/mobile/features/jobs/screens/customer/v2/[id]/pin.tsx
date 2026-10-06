import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretLeft, ShieldCheck, ShieldSlash, ArrowsClockwise, Copy, CheckCircle, WarningCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { v2JobActions } from '@/api/v2-jobs'
import * as Clipboard from 'expo-clipboard'

export default function JobPinScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [pinState, setPinState] = useState<{ hasActivePin: boolean; version: number | null; locked: boolean; lastSuccessfulUseAt: string | null } | null>(null)
  const [generatedPin, setGeneratedPin] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [copied, setCopied] = useState(false)

  const loadPinState = async () => {
    try {
      const res = await v2JobActions.getPinState(id)
      setPinState(res.pinState)
    } catch {
      setPinState(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPinState() }, [id])

  const handleGenerate = async () => {
    setActionLoading('generate')
    try {
      const res = await v2JobActions.generatePin(id)
      setGeneratedPin(res.pin)
      setPinState({ hasActivePin: true, version: res.version, locked: false, lastSuccessfulUseAt: null })
    } catch (err: any) {
      const msg = err?.message || t('common.error')
      if (msg.includes('already exists')) {
        Alert.alert(t('jobPin.title'), t('jobPin.alreadyExists'))
      } else {
        Alert.alert(t('common.error'), msg)
      }
    } finally {
      setActionLoading('')
    }
  }

  const handleRotate = async () => {
    Alert.alert(
      t('jobPin.rotateConfirm'),
      t('jobPin.rotateConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('jobPin.rotate'),
          style: 'destructive',
          onPress: async () => {
            setActionLoading('rotate')
            try {
              const res = await v2JobActions.rotatePin(id)
              setGeneratedPin(res.pin)
              setPinState({ hasActivePin: true, version: res.version, locked: false, lastSuccessfulUseAt: null })
            } catch (err: any) {
              Alert.alert(t('common.error'), err?.message || t('common.error'))
            } finally {
              setActionLoading('')
            }
          },
        },
      ]
    )
  }

  const handleRevoke = async () => {
    Alert.alert(
      t('jobPin.revokeConfirm'),
      t('jobPin.revokeConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('jobPin.revoke'),
          style: 'destructive',
          onPress: async () => {
            setActionLoading('revoke')
            try {
              await v2JobActions.revokePin(id)
              setGeneratedPin(null)
              setPinState({ hasActivePin: false, version: null, locked: false, lastSuccessfulUseAt: null })
              Alert.alert(t('jobPin.title'), t('jobPin.revoked'))
            } catch (err: any) {
              Alert.alert(t('common.error'), err?.message || t('common.error'))
            } finally {
              setActionLoading('')
            }
          },
        },
      ]
    )
  }

  const handleCopyPin = async () => {
    if (!generatedPin) return
    await Clipboard.setStringAsync(generatedPin)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <CaretLeft size={20} color={colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>{t('jobPin.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: colors.muted }]}>{t('jobPin.description')}</Text>

        {generatedPin && (
          <View style={[styles.pinReveal, { backgroundColor: colors.white, borderColor: colors.amber }]}>
            <Text style={[styles.pinLabel, { color: colors.muted }]}>{t('jobPin.yourPin')}</Text>
            <Text style={[styles.pinValue, { color: colors.amber }]}>{generatedPin}</Text>
            <Text style={[styles.pinWarning, { color: colors.error }]}>{t('jobPin.saveWarning')}</Text>
            <TouchableOpacity style={[styles.copyBtn, { backgroundColor: colors.surface }]} onPress={handleCopyPin}>
              {copied ? (
                <CheckCircle size={18} color={colors.success} />
              ) : (
                <Copy size={18} color={colors.amber} />
              )}
              <Text style={[styles.copyText, { color: copied ? colors.success : colors.amber }]}>
                {copied ? t('jobPin.copied') : t('jobPin.copy')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {pinState?.hasActivePin && !generatedPin && (
          <View style={[styles.stateCard, { backgroundColor: colors.white, borderColor: colors.border }]}>
            <ShieldCheck size={24} color={colors.success} />
            <View style={styles.stateInfo}>
              <Text style={[styles.stateLabel, { color: colors.ink }]}>{t('jobPin.activePin')}</Text>
              <Text style={[styles.stateDetail, { color: colors.muted }]}>{t('jobPin.version', { n: pinState.version })}</Text>
              {pinState.lastSuccessfulUseAt && (
                <Text style={[styles.stateDetail, { color: colors.muted }]}>{t('jobPin.lastUsed', { time: new Date(pinState.lastSuccessfulUseAt).toLocaleString() })}</Text>
              )}
            </View>
          </View>
        )}

        {pinState?.locked && (
          <View style={[styles.stateCard, { backgroundColor: colors.white, borderColor: colors.error }]}>
            <WarningCircle size={24} color={colors.error} />
            <View style={styles.stateInfo}>
              <Text style={[styles.stateLabel, { color: colors.error }]}>{t('jobPin.locked')}</Text>
              <Text style={[styles.stateDetail, { color: colors.muted }]}>{t('jobPin.lockedBody')}</Text>
            </View>
          </View>
        )}

        {!pinState?.hasActivePin && !generatedPin && (
          <View style={styles.emptyState}>
            <ShieldSlash size={48} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>{t('jobPin.noPin')}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>{t('jobPin.noPinBody')}</Text>
          </View>
        )}

        <View style={styles.safetyCard}>
          <Text style={[styles.safetyTitle, { color: colors.ink }]}>Safety</Text>
          <Text style={[styles.safetyBody, { color: colors.muted }]}>Do not share the PIN over the phone. Only share it in person at the job site.</Text>
        </View>

        <View style={styles.actions}>
          {!pinState?.hasActivePin && !generatedPin && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryBtn, { backgroundColor: colors.amber }]}
              onPress={handleGenerate}
              disabled={!!actionLoading}
            >
              {actionLoading === 'generate' ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <ShieldCheck size={20} color="#000" />
                  <Text style={styles.primaryBtnText}>{t('jobPin.generate')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {pinState?.hasActivePin && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.secondaryBtn, { borderColor: colors.amber }]}
                onPress={handleRotate}
                disabled={!!actionLoading}
              >
                {actionLoading === 'rotate' ? (
                  <ActivityIndicator size="small" color={colors.amber} />
                ) : (
                  <>
                    <ArrowsClockwise size={20} color={colors.amber} />
                    <Text style={[styles.secondaryBtnText, { color: colors.amber }]}>{t('jobPin.rotate')}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.dangerBtn, { borderColor: colors.error }]}
                onPress={handleRevoke}
                disabled={!!actionLoading}
              >
                {actionLoading === 'revoke' ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <ShieldSlash size={20} color={colors.error} />
                    <Text style={[styles.dangerBtnText, { color: colors.error }]}>{t('jobPin.revoke')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
    backBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontFamily: fonts.headingBold },
    scroll: { padding: 20 },
    subtitle: { fontSize: 14, fontFamily: fonts.body, marginBottom: 24, lineHeight: 20 },
    pinReveal: {
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 1,
    },
    pinLabel: { fontSize: 14, fontFamily: fonts.body, marginBottom: 8 },
    pinValue: { fontSize: 48, fontFamily: fonts.heading, letterSpacing: 8, marginBottom: 8 },
    pinWarning: { fontSize: 12, fontFamily: fonts.body, textAlign: 'center', marginBottom: 16 },
    copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    copyText: { fontSize: 14, fontFamily: fonts.bodyMedium },
    stateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
    },
    stateInfo: { flex: 1 },
    stateLabel: { fontSize: 16, fontFamily: fonts.bodySemiBold },
    stateDetail: { fontSize: 12, fontFamily: fonts.body, marginTop: 2 },
    emptyState: { alignItems: 'center', paddingVertical: 40, marginBottom: 24 },
    emptyTitle: { fontSize: 18, fontFamily: fonts.bodySemiBold, marginTop: 16 },
    emptySubtitle: { fontSize: 14, fontFamily: fonts.body, marginTop: 8, textAlign: 'center' },
    safetyCard: {
      backgroundColor: '#FFF2D6',
      borderRadius: 18,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.amber,
    },
    safetyTitle: { fontSize: 12, fontFamily: fonts.headingBold, marginBottom: 4 },
    safetyBody: { fontSize: 11, fontFamily: fonts.body, lineHeight: 16 },
    actions: { gap: 12 },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 12,
    },
    primaryBtn: {},
    primaryBtnText: { fontSize: 16, fontFamily: fonts.bodySemiBold, color: '#000' },
    secondaryBtn: { backgroundColor: 'transparent', borderWidth: 1 },
    secondaryBtnText: { fontSize: 16, fontFamily: fonts.bodySemiBold },
    dangerBtn: { backgroundColor: 'transparent', borderWidth: 1 },
    dangerBtnText: { fontSize: 16, fontFamily: fonts.bodySemiBold },
  })
}
