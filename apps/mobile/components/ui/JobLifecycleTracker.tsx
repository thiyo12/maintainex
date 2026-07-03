import { View, Text, StyleSheet } from 'react-native'
import { CalendarBlank, Cardholder, Wrench, CheckCircle, XCircle, Circle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'
import { fonts } from '../../lib/fonts'

interface Props {
  status: string
  escrowStatus?: string | null
  createdAt?: string
}

function getStepIndex(status: string, escrowStatus?: string | null): number {
  switch (status) {
    case 'CANCELLED':
    case 'DISPUTED':
      return -1
    case 'OPEN':
    case 'QUOTE_ACCEPTED':
      return 0
    case 'ESCROW_DEPOSITED':
      return escrowStatus === 'PROTECTED' ? 1 : 0
    case 'IN_PROGRESS':
      return 2
    case 'COMPLETED':
      return 3
    default:
      return 0
  }
}

export default function JobLifecycleTracker({ status, escrowStatus, createdAt }: Props) {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = makeStyles(colors)

  const STEPS = [
    { key: 'BOOKED', label: t('components.statusOpen'), icon: CalendarBlank },
    { key: 'PAYMENT', label: t('components.statusInProgress'), icon: Cardholder },
    { key: 'IN_PROGRESS', label: t('components.statusInProgress'), icon: Wrench },
    { key: 'COMPLETE', label: t('components.statusCompleted'), icon: CheckCircle },
  ]

  const step = getStepIndex(status, escrowStatus)
  const isCancelled = status === 'CANCELLED' || status === 'DISPUTED'

  if (isCancelled) {
    return (
      <View style={[styles.container, styles.cancelledContainer]}>
        <XCircle size={22} color={colors.error} weight="fill" />
        <Text style={[styles.cancelledText, { color: colors.error }]}>
          {status === 'DISPUTED' ? t('components.statusCancelled') : t('components.statusCancelled')}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <View style={styles.barRow}>
        {STEPS.map((s, i) => {
          const isDone = i < step
          const isCurrent = i === step
          const StepIcon = s.icon
          return (
            <View key={s.key} style={styles.stepWrap}>
              <View style={[
                styles.dot,
                isDone && { backgroundColor: colors.success },
                isCurrent && { backgroundColor: colors.amber, shadowColor: colors.amber, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
                !isDone && !isCurrent && { backgroundColor: colors.border },
              ]}>
                {isDone ? (
                  <CheckCircle size={14} color="#FFFFFF" weight="fill" />
                ) : isCurrent ? (
                  <Circle size={10} color="#FFFFFF" weight="fill" />
                ) : (
                  <StepIcon size={14} color={colors.muted} weight="regular" />
                )}
              </View>
              {i < STEPS.length - 1 ? (
                <View style={[styles.line, { backgroundColor: isDone ? colors.success : colors.border }]} />
              ) : null}
            </View>
          )
        })}
      </View>
      <View style={styles.labelRow}>
        {STEPS.map((s, i) => {
          const isDone = i < step
          const isCurrent = i === step
          return (
            <Text key={s.key} style={[
              styles.label,
              isDone && { color: colors.success },
              isCurrent && { color: colors.amberDark, fontFamily: fonts.headingBold },
              !isDone && !isCurrent && { color: colors.muted },
            ]}>
              {s.label}
            </Text>
          )
        })}
      </View>
      {createdAt && step === 0 && status === 'OPEN' && (
        <Text style={[styles.cancelHint, { color: colors.muted }]}>
          {t('jobDetail.cancelConfirm')}
        </Text>
      )}
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { marginVertical: 12, borderRadius: 16, padding: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepWrap: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  line: { width: 36, height: 2, marginHorizontal: 4, borderRadius: 2 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  label: { fontSize: 9, fontFamily: fonts.body, textTransform: 'uppercase', letterSpacing: 0.3, flex: 1, textAlign: 'center' },
  cancelledContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.error, paddingVertical: 12 },
  cancelledText: { fontSize: 15, fontFamily: fonts.headingBold },
  cancelHint: { fontSize: 10, fontFamily: fonts.body, textAlign: 'center', marginTop: 8 },
})
