import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../lib/ThemeContext'

interface Props {
  status: string
  escrowStatus?: string | null
  createdAt?: string
}

const STEPS = [
  { key: 'BOOKED', label: 'Booked', icon: 'calendar-outline' },
  { key: 'PAYMENT', label: 'Payment', icon: 'card-outline' },
  { key: 'IN_PROGRESS', label: 'In Progress', icon: 'construct-outline' },
  { key: 'COMPLETE', label: 'Complete', icon: 'checkmark-circle-outline' },
]

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
  const styles = makeStyles(colors)
  const step = getStepIndex(status, escrowStatus)
  const isCancelled = status === 'CANCELLED' || status === 'DISPUTED'

  if (isCancelled) {
    return (
      <View style={[styles.container, styles.cancelledContainer]}>
        <Ionicons name="close-circle-outline" size={22} color={colors.error} />
        <Text style={[styles.cancelledText, { color: colors.error }]}>
          {status === 'DISPUTED' ? 'Disputed' : 'Cancelled'}
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
          return (
            <View key={s.key} style={styles.stepWrap}>
              <View style={[
                styles.dot,
                isDone && { backgroundColor: colors.success },
                isCurrent && { backgroundColor: colors.amber, shadowColor: colors.amber, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
                !isDone && !isCurrent && { backgroundColor: colors.border },
              ]}>
                <Ionicons
                  name={isDone ? 'checkmark' : isCurrent ? 'ellipse' : s.icon as any}
                  size={isCurrent ? 10 : 14}
                  color={isDone || isCurrent ? '#FFFFFF' : colors.muted}
                />
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
              isCurrent && { color: colors.amberDark, fontFamily: 'Outfit_800ExtraBold' },
              !isDone && !isCurrent && { color: colors.muted },
            ]}>
              {s.label}
            </Text>
          )
        })}
      </View>
      {createdAt && step === 0 && status === 'OPEN' && (
        <Text style={[styles.cancelHint, { color: colors.muted }]}>
          You can cancel within 30 min of posting
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
  label: { fontSize: 9, fontFamily: 'Outfit_500Medium', textTransform: 'uppercase', letterSpacing: 0.3, flex: 1, textAlign: 'center' },
  cancelledContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.error, paddingVertical: 12 },
  cancelledText: { fontSize: 15, fontFamily: 'Outfit_800ExtraBold' },
  cancelHint: { fontSize: 10, fontFamily: 'Outfit_500Medium', textAlign: 'center', marginTop: 8 },
})
