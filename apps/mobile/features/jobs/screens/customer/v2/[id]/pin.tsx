import { useState, useEffect } from 'react'
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ShieldCheck, ShieldSlash, ArrowsClockwise, Copy, CheckCircle, WarningCircle } from 'phosphor-react-native'
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

  const [pinState, setPinState] = useState<{
    hasActivePin: boolean
    version: number | null
    locked: boolean
    lastSuccessfulUseAt: string | null
    arrivalVerifiedAt: string | null
    workStartVerifiedAt: string | null
    completionVerifiedAt: string | null
  } | null>(null)
  const [generatedPin, setGeneratedPin] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [copied, setCopied] = useState(false)
  const [workerIdentity, setWorkerIdentity] = useState<{
    required: boolean
    worker: null | {
      providerIdentityId: string
      providerType: 'INDIVIDUAL' | 'COMPANY'
      userId: string
      displayName: string
      verifiedPhotoUrl: string | null
      identityVerified: boolean
      companyId: string | null
      companyName: string | null
    }
    confirmation: null | {
      id: string
      status: string
      confirmedAt: string | null
      mismatchReportedAt: string | null
    }
  } | null>(null)

  const loadPinState = async () => {
    try {
      const res = await v2JobActions.getPinState(id)
      setPinState(res.pinState)
      if (!res.pinState.hasActivePin) setGeneratedPin(null)
    } catch {
      setPinState(null)
    } finally {
      setLoading(false)
    }
  }

  const loadWorkerIdentity = async () => {
    try {
      const state = await v2JobActions.getWorkerIdentity(id)
      setWorkerIdentity(state)
    } catch {
      setWorkerIdentity(null)
    }
  }

  useEffect(() => {
    loadPinState()
    loadWorkerIdentity()
    const timer = setInterval(loadPinState, 3000)
    return () => clearInterval(timer)
  }, [id])

  const handleGenerate = async () => {
    const startingWork = Boolean(pinState?.arrivalVerifiedAt && !pinState?.workStartVerifiedAt)
    if (
      startingWork &&
      workerIdentity?.required &&
      workerIdentity.confirmation?.status !== 'MATCHED'
    ) {
      Alert.alert(
        'Confirm your tasker first',
        'For your safety, confirm that the person who arrived matches the verified MaintainEX profile before generating the Start Work PIN.'
      )
      return
    }

    setActionLoading('generate')
    try {
      const res = await v2JobActions.generatePin(id)
      setGeneratedPin(res.pin)
      setPinState((prev) => ({
        hasActivePin: true,
        version: res.version,
        locked: false,
        lastSuccessfulUseAt: null,
        arrivalVerifiedAt: prev?.arrivalVerifiedAt ?? null,
        workStartVerifiedAt: prev?.workStartVerifiedAt ?? null,
        completionVerifiedAt: prev?.completionVerifiedAt ?? null,
      }))
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
              setPinState((prev) => ({
                hasActivePin: true,
                version: res.version,
                locked: false,
                lastSuccessfulUseAt: null,
                arrivalVerifiedAt: prev?.arrivalVerifiedAt ?? null,
                workStartVerifiedAt: prev?.workStartVerifiedAt ?? null,
                completionVerifiedAt: prev?.completionVerifiedAt ?? null,
              }))
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
              setPinState((prev) => ({
                hasActivePin: false,
                version: prev?.version ?? null,
                locked: false,
                lastSuccessfulUseAt: prev?.lastSuccessfulUseAt ?? null,
                arrivalVerifiedAt: prev?.arrivalVerifiedAt ?? null,
                workStartVerifiedAt: prev?.workStartVerifiedAt ?? null,
                completionVerifiedAt: prev?.completionVerifiedAt ?? null,
              }))
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

  const handleWorkerMatch = async () => {
    setActionLoading('identity-match')
    try {
      const result = await v2JobActions.confirmWorkerIdentity(id, 'MATCH')
      setWorkerIdentity(prev => prev ? { ...prev, confirmation: result.confirmation } : prev)
      Alert.alert(
        'Identity confirmed',
        'The arriving person matches the verified MaintainEX profile. You can now generate the Start Work PIN when you are ready.'
      )
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || 'Could not confirm worker identity.')
    } finally {
      setActionLoading('')
    }
  }

  const handleWorkerMismatch = () => {
    Alert.alert(
      'Different person arrived?',
      'Do not share the Start Work PIN. MaintainEX will flag this booking for Trust & Safety review.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Report mismatch',
          style: 'destructive',
          onPress: async () => {
            setActionLoading('identity-mismatch')
            try {
              const result = await v2JobActions.confirmWorkerIdentity(
                id,
                'MISMATCH',
                'Customer reported that the arriving person did not match the verified profile.'
              )
              setWorkerIdentity(prev => prev ? { ...prev, confirmation: result.confirmation } : prev)
              Alert.alert(
                'Mismatch reported',
                'Work start is blocked. Do not share any PIN until MaintainEX resolves the identity issue.'
              )
            } catch (err: any) {
              Alert.alert(t('common.error'), err?.message || 'Could not report the identity mismatch.')
            } finally {
              setActionLoading('')
            }
          },
        },
      ],
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

  const nextPurpose = !pinState?.arrivalVerifiedAt
    ? 'Arrival PIN'
    : !pinState?.workStartVerifiedAt
      ? 'Start Work PIN'
      : 'Verification PIN'

  const nextPurposeHint = !pinState?.arrivalVerifiedAt
    ? 'Give this one-time PIN to the provider only when they have arrived.'
    : !pinState?.workStartVerifiedAt
      ? 'Arrival is confirmed. Generate a fresh one-time PIN only when you are ready for work to start.'
      : 'Work has already started. No additional start PIN is required.'

  const needsWorkerIdentity =
    Boolean(pinState?.arrivalVerifiedAt && !pinState?.workStartVerifiedAt && workerIdentity?.required)
  const workerMatched = workerIdentity?.confirmation?.status === 'MATCHED'
  const workerMismatch = workerIdentity?.confirmation?.status === 'MISMATCH_REPORTED'

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('jobPin.title')}</Text>
        <Text style={styles.subtitle}>{t('jobPin.description')}</Text>

        {needsWorkerIdentity && (
          <View style={[
            styles.identityCard,
            workerMismatch && { borderColor: colors.error },
            workerMatched && { borderColor: colors.success },
          ]}>
            <View style={styles.identityHeader}>
              <ShieldCheck
                size={22}
                color={workerMatched ? colors.success : workerMismatch ? colors.error : colors.amber}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.identityTitle}>Confirm your arriving tasker</Text>
                <Text style={styles.identitySubtitle}>
                  Make sure the person at your location matches this MaintainEX verified profile before work starts.
                </Text>
              </View>
            </View>

            {workerIdentity?.worker ? (
              <>
                <View style={styles.workerRow}>
                  {workerIdentity.worker.verifiedPhotoUrl ? (
                    <Image
                      source={{ uri: workerIdentity.worker.verifiedPhotoUrl }}
                      style={styles.workerPhoto}
                    />
                  ) : (
                    <View style={[styles.workerPhoto, styles.workerPhotoFallback]}>
                      <ShieldSlash size={28} color={colors.muted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workerName}>{workerIdentity.worker.displayName}</Text>
                    {workerIdentity.worker.companyName && (
                      <Text style={styles.workerCompany}>{workerIdentity.worker.companyName}</Text>
                    )}
                    <Text style={[
                      styles.workerVerification,
                      { color: workerIdentity.worker.identityVerified ? colors.success : colors.error },
                    ]}>
                      {workerIdentity.worker.identityVerified
                        ? '✓ Identity verified by MaintainEX'
                        : 'Identity photo verification pending'}
                    </Text>
                  </View>
                </View>

                {workerMatched ? (
                  <View style={styles.identitySuccess}>
                    <CheckCircle size={18} color={colors.success} />
                    <Text style={styles.identitySuccessText}>Person confirmed. Start Work PIN is available.</Text>
                  </View>
                ) : workerMismatch ? (
                  <View style={styles.identityDanger}>
                    <WarningCircle size={18} color={colors.error} />
                    <Text style={styles.identityDangerText}>
                      Identity mismatch reported. Do not allow work to start.
                    </Text>
                  </View>
                ) : workerIdentity.worker.identityVerified ? (
                  <View style={styles.identityActions}>
                    <TouchableOpacity
                      style={[styles.identityAction, styles.identityMatchBtn]}
                      onPress={handleWorkerMatch}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === 'identity-match'
                        ? <ActivityIndicator size="small" color="#000" />
                        : <Text style={styles.identityMatchText}>Person matches</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.identityAction, styles.identityMismatchBtn]}
                      onPress={handleWorkerMismatch}
                      disabled={!!actionLoading}
                    >
                      <Text style={styles.identityMismatchText}>Different person arrived</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.identityDanger}>
                    <WarningCircle size={18} color={colors.error} />
                    <Text style={styles.identityDangerText}>
                      Do not share the Start Work PIN until MaintainEX verifies this worker's public identity photo.
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.identityDanger}>
                <WarningCircle size={18} color={colors.error} />
                <Text style={styles.identityDangerText}>
                  The assigned worker is not ready for identity confirmation yet.
                </Text>
              </View>
            )}
          </View>
        )}

        {generatedPin && (!needsWorkerIdentity || workerMatched) && (
          <View style={styles.pinReveal}>
            <Text style={styles.pinLabel}>{nextPurpose}</Text>
            <Text style={styles.pinValue}>{generatedPin}</Text>
            <Text style={styles.pinWarning}>{nextPurposeHint}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyPin}>
              {copied ? (
                <CheckCircle size={18} color={colors.success} />
              ) : (
                <Copy size={18} color={colors.amber} />
              )}
              <Text style={[styles.copyText, copied && { color: colors.success }]}>
                {copied ? t('jobPin.copied') : t('jobPin.copy')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {pinState?.hasActivePin && !generatedPin && (
          <View style={styles.stateCard}>
            <ShieldCheck size={24} color={colors.success} />
            <View style={styles.stateInfo}>
              <Text style={styles.stateLabel}>{t('jobPin.activePin')}</Text>
              <Text style={styles.stateDetail}>{t('jobPin.version', { n: pinState.version })}</Text>
              {pinState.lastSuccessfulUseAt && (
                <Text style={styles.stateDetail}>{t('jobPin.lastUsed', { time: new Date(pinState.lastSuccessfulUseAt).toLocaleString() })}</Text>
              )}
            </View>
          </View>
        )}

        {pinState?.locked && (
          <View style={[styles.stateCard, { borderColor: colors.error }]}>
            <WarningCircle size={24} color={colors.error} />
            <View style={styles.stateInfo}>
              <Text style={[styles.stateLabel, { color: colors.error }]}>{t('jobPin.locked')}</Text>
              <Text style={styles.stateDetail}>{t('jobPin.lockedBody')}</Text>
            </View>
          </View>
        )}

        {!pinState?.hasActivePin && !generatedPin && (
          <View style={styles.emptyState}>
            {pinState?.workStartVerifiedAt ? (
              <CheckCircle size={48} color={colors.success} />
            ) : (
              <ShieldSlash size={48} color={colors.muted} />
            )}
            <Text style={styles.emptyTitle}>
              {pinState?.workStartVerifiedAt ? 'Work start verified' : nextPurpose}
            </Text>
            <Text style={styles.emptySubtitle}>{nextPurposeHint}</Text>
          </View>
        )}

        <View style={styles.actions}>
          {!pinState?.hasActivePin && !generatedPin && !pinState?.workStartVerifiedAt && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryBtn]}
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
                style={[styles.actionBtn, styles.secondaryBtn]}
                onPress={handleRotate}
                disabled={!!actionLoading}
              >
                {actionLoading === 'rotate' ? (
                  <ActivityIndicator size="small" color={colors.amber} />
                ) : (
                  <>
                    <ArrowsClockwise size={20} color={colors.amber} />
                    <Text style={styles.secondaryBtnText}>{t('jobPin.rotate')}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.dangerBtn]}
                onPress={handleRevoke}
                disabled={!!actionLoading}
              >
                {actionLoading === 'revoke' ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <ShieldSlash size={20} color={colors.error} />
                    <Text style={styles.dangerBtnText}>{t('jobPin.revoke')}</Text>
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
    scroll: { padding: 20 },
    title: { fontSize: 24, fontFamily: fonts.bold, color: colors.text, marginBottom: 8 },
    subtitle: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, marginBottom: 24, lineHeight: 20 },
    pinReveal: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.amber,
    },
    pinLabel: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, marginBottom: 8 },
    pinValue: { fontSize: 48, fontFamily: fonts.bold, color: colors.amber, letterSpacing: 8, marginBottom: 8 },
    pinWarning: { fontSize: 12, fontFamily: fonts.regular, color: colors.error, textAlign: 'center', marginBottom: 16 },
    copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.surface },
    copyText: { fontSize: 14, fontFamily: fonts.medium, color: colors.amber },
    stateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stateInfo: { flex: 1 },
    stateLabel: { fontSize: 16, fontFamily: fonts.semibold, color: colors.text },
    stateDetail: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
    emptyState: { alignItems: 'center', paddingVertical: 40, marginBottom: 24 },
    emptyTitle: { fontSize: 18, fontFamily: fonts.semibold, color: colors.text, marginTop: 16 },
    emptySubtitle: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, marginTop: 8, textAlign: 'center' },
    actions: { gap: 12 },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 12,
    },
    primaryBtn: { backgroundColor: colors.amber },
    primaryBtnText: { fontSize: 16, fontFamily: fonts.semibold, color: '#000' },
    secondaryBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.amber },
    secondaryBtnText: { fontSize: 16, fontFamily: fonts.semibold, color: colors.amber },
    dangerBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.error },
    dangerBtnText: { fontSize: 16, fontFamily: fonts.semibold, color: colors.error },
  })
}
