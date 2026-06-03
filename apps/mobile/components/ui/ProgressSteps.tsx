import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../lib/colors'
import { fonts } from '../../lib/fonts'

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
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotDone: { backgroundColor: colors.success },
  dotCurrent: { backgroundColor: colors.amber },
  dotText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted },
  dotTextActive: { color: colors.white },
  line: {
    width: 40,
    height: 3,
    backgroundColor: colors.border,
    marginHorizontal: 4,
    borderRadius: 2,
  },
  lineDone: { backgroundColor: colors.success },
  labelRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  label: { fontSize: 11, fontFamily: fonts.body, color: colors.muted },
  labelActive: { color: colors.amber, fontFamily: fonts.headingBold },
})
