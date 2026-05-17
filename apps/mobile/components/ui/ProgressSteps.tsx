import { View, Text, StyleSheet } from 'react-native'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  green: '#10B981',
  red: '#EF4444',
  white: '#FFFFFF',
}

interface Props {
  current: number
  total: number
  labels?: string[]
}

export default function ProgressSteps({ current, total, labels }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.barRow}>
        {Array.from({ length: total }, (_, i) => {
          const isDone = i < current
          const isCurrent = i === current
          return (
            <View key={i} style={styles.stepWrap}>
              <View style={[styles.dot, isDone && styles.dotDone, isCurrent && styles.dotCurrent]}>
                <Text style={[styles.dotText, (isDone || isCurrent) && styles.dotTextActive]}>
                  {isDone ? '✓' : i + 1}
                </Text>
              </View>
              {i < total - 1 ? (
                <View style={[styles.line, isDone && styles.lineDone]} />
              ) : null}
            </View>
          )
        })}
      </View>
      {labels ? (
        <View style={styles.labelRow}>
          {labels.map((l, i) => (
            <Text key={i} style={[styles.label, i === current && styles.labelActive]}>
              {l}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginVertical: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepWrap: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotDone: { backgroundColor: colors.green },
  dotCurrent: { backgroundColor: colors.primary },
  dotText: { fontSize: 12, fontWeight: '700', color: colors.gray },
  dotTextActive: { color: colors.white },
  line: {
    width: 40,
    height: 3,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
    borderRadius: 2,
  },
  lineDone: { backgroundColor: colors.green },
  labelRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  label: { fontSize: 11, color: colors.gray, fontWeight: '500' },
  labelActive: { color: colors.primary, fontWeight: '700' },
})
