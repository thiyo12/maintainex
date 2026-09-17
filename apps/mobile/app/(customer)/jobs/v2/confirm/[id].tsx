import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Lock, CheckCircle, Check } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../../lib/ThemeContext'
import { fonts } from '../../../../../lib/fonts'
import { v2Jobs, v2JobActions } from '../../../../../lib/api-v2'
import Avatar from '../../../../../components/ui/Avatar'

const TIME_SLOTS = ['08:00-10:00','10:00-12:00','12:00-14:00','14:00-16:00','16:00-18:00']

const CANVAS = '#0D0D0D'
const PAPER = '#FFFFFF'
const FREEZE_BG = '#111111'
const AMBER = '#F5A623'
const SUCCESS = '#06C167'
const ERROR = '#E11900'
const LINE = '#2E2E2E'
const MUTED = '#888888'

export default function V2ConfirmBookingScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<any>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleSlot, setScheduleSlot] = useState('')

  useEffect(() => { loadData() }, [id])

  useEffect(() => {
    if (!scheduleDate) {
      setScheduleDate(new Date().toISOString().split('T')[0])
    }
  }, [])

  const loadData = async () => {
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
      setEscrow(res.job.escrow || null)
    } catch (e) {
      Alert.alert(t('common.error'), t('errors.generic'))
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleDeposit = async () => {
    if (!scheduleSlot) {
      Alert.alert(t('booking.timeSlot'), t('components.selectTime'))
      return
    }
    setActionLoading('escrow')
    try {
      await v2JobActions.update(id, { preferredDate: scheduleDate, timeSlot: scheduleSlot })
      await v2JobActions.depositEscrow(id, job?.budgetAmount || 0)
      Alert.alert(t('booking.paymentSecured'), t('jobDetail.escrowDepositedDesc'), [
        { text: t('common.ok'), onPress: () => router.push(`/(customer)/jobs/v2/${id}`) },
      ])
      loadData()
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setActionLoading('')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={AMBER} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  const steps = [
    { label: t('booking.paymentSecured'), done: escrow !== null && escrow.status !== 'REFUNDED' },
    { label: t('tracking.inProgress'), done: false },
    { label: t('booking.confirmComplete'), done: false },
    { label: t('tracking.completed'), done: false },
  ]

  const acceptedQuote = job?.quotes?.find((q: any) => q.status === 'ACCEPTED')

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('booking.confirm')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {acceptedQuote && (
          <View style={styles.card}>
            <Text style={styles.label}>{t('booking.professional')}</Text>
            <View style={styles.providerRow}>
              <Avatar
                name={acceptedQuote.provider?.name || t('jobDetail.provider')}
                size={48}
                color={acceptedQuote.providerType === 'COMPANY' ? colors.company : AMBER}
              />
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{acceptedQuote.provider?.name || t('jobDetail.provider')}</Text>
                <Text style={styles.providerType}>{acceptedQuote.providerType}</Text>
              </View>
              <Text style={styles.providerPrice}>LKR {acceptedQuote.price.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {job && (
          <View style={styles.card}>
            <Text style={styles.label}>{t('dispute.job')}</Text>
            <Text style={styles.jobTitle}>{job.title}</Text>
            {job.category && <Text style={styles.jobCategory}>{job.category}</Text>}
          </View>
        )}

        {!escrow && (
          <View style={styles.card}>
            <Text style={styles.label}>{t('booking.selectDate')}</Text>
            <TextInput
              style={styles.dateInput}
              value={scheduleDate}
              onChangeText={setScheduleDate}
              placeholder={t('booking.datePlaceholder')}
              placeholderTextColor={colors.muted}
            />
            <Text style={[styles.label, { marginTop: 14 }]}>{t('booking.timeSlot')}</Text>
            <View style={styles.chipGrid}>
              {TIME_SLOTS.map((slot) => {
                const active = scheduleSlot === slot
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setScheduleSlot(slot)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{slot}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

        <View style={styles.freezeCard}>
          <View style={styles.freezeIconWrap}>
            <Lock size={24} color={AMBER} weight="regular" />
          </View>
          <Text style={styles.freezeLabel}>{t('wallet.balance')}</Text>
          <Text style={styles.freezeAmount}>
            LKR {(acceptedQuote?.price || job?.budgetAmount || 0).toLocaleString()}
          </Text>
          <Text style={styles.freezeDesc}>{t('booking.escrowInfo')}</Text>

          {!escrow && (
            <TouchableOpacity
              style={[styles.ctaBtn, actionLoading !== '' && { opacity: 0.6 }]}
              onPress={handleDeposit}
              disabled={actionLoading !== ''}
              activeOpacity={0.8}
            >
              {actionLoading === 'escrow' ? (
                <ActivityIndicator color={CANVAS} />
              ) : (
                <Text style={styles.ctaText}>{t('booking.paymentSecured')}</Text>
              )}
            </TouchableOpacity>
          )}

          {escrow && escrow.status === 'PROTECTED' && (
            <View style={styles.successBadge}>
              <CheckCircle size={18} color={SUCCESS} weight="fill" />
              <Text style={styles.successText}>{t('booking.paymentSecured')}</Text>
            </View>
          )}
        </View>

        <View style={styles.stepsCard}>
          <Text style={styles.label}>{t('booking.paymentSecured')}</Text>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepTrack}>
                <View style={[styles.stepDot, step.done && styles.stepDotDone]}>
                  {step.done ? (
                    <Check size={12} color={PAPER} weight="bold" />
                  ) : (
                    <Text style={styles.stepNum}>{i + 1}</Text>
                  )}
                </View>
                {i < steps.length - 1 && (
                  <View style={[styles.stepLine, step.done && styles.stepLineDone]} />
                )}
              </View>
              <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>{step.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CANVAS,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: LINE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 20,
    fontFamily: fonts.bodyMedium,
    color: PAPER,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.headingBold,
    color: PAPER,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  label: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  card: {
    backgroundColor: PAPER,
    borderRadius: 18,
    padding: 18,
    marginTop: 14,
  },

  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerName: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: '#000000',
  },
  providerType: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#6B6B6B',
    marginTop: 2,
  },
  providerPrice: {
    fontSize: 18,
    fontFamily: fonts.headingBold,
    color: '#000000',
  },

  jobTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: '#000000',
  },
  jobCategory: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#6B6B6B',
    marginTop: 4,
  },

  dateInput: {
    borderWidth: 1.5,
    borderColor: LINE,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontFamily: fonts.body,
    color: '#000000',
    backgroundColor: '#F7F7F7',
  },

  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: LINE,
    backgroundColor: '#F7F7F7',
  },
  chipActive: {
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderColor: AMBER,
  },
  chipText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#000000',
  },
  chipTextActive: {
    color: AMBER,
    fontFamily: fonts.bodyMedium,
  },

  freezeCard: {
    backgroundColor: FREEZE_BG,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginTop: 18,
  },
  freezeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(245,166,35,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  freezeLabel: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#888888',
    marginBottom: 4,
  },
  freezeAmount: {
    fontSize: 28,
    fontFamily: fonts.heading,
    color: AMBER,
    marginBottom: 8,
  },
  freezeDesc: {
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  ctaBtn: {
    backgroundColor: AMBER,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: CANVAS,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6,193,103,0.14)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  successText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: SUCCESS,
  },

  stepsCard: {
    backgroundColor: PAPER,
    borderRadius: 18,
    padding: 18,
    marginTop: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  stepTrack: {
    alignItems: 'center',
    width: 28,
    marginRight: 14,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: LINE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotDone: {
    backgroundColor: SUCCESS,
  },
  stepNum: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: '#888888',
  },
  stepLine: {
    width: 2,
    height: 24,
    backgroundColor: LINE,
    marginTop: 4,
  },
  stepLineDone: {
    backgroundColor: SUCCESS,
  },
  stepLabel: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: '#888888',
    paddingTop: 3,
  },
  stepLabelDone: {
    color: '#000000',
    fontFamily: fonts.bodyMedium,
  },
})
