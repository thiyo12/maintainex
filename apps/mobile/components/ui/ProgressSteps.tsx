import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../../lib/ThemeContext'
import { fonts, fontSizes } from '../../lib/fonts'
import { spacing, borderRadius } from '../../lib/tokens'

interface Props {
  current: number
  total: number
  labels?: string[]
}

export default function ProgressSteps({ current, total, labels }: Props) {
  const colors = useColors()

  return (
    <View style={styles.container}>
      <View style={styles.barRow}>
        {Array.from({ length: total }, (_, i) => {
          const isDone = i < current
          const isCurrent = i === current
          return (
            <View key={i} style={styles.stepWrap}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isDone ? colors.success : isCurrent ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.dotText, (isDone || isCurrent) && { color: colors.white }]}>
                  {isDone ? '✓' : i + 1}
                </Text>
              </View>
              {i < total - 1 ? (
                <View style={[styles.line, { backgroundColor: isDone ? colors.success : colors.border }]} />
              ) : null}
            </View>
          )
        })}
      </View>
      {labels ? (
        <View style={styles.labelRow}>
          {labels.map((l, i) => (
            <Text
              key={i}
              style={[
                styles.label,
                { color: i === current ? colors.primary : colors.muted },
                i === current && { fontFamily: fonts.headingBold },
              ]}
            >
              {l}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginVertical: spacing.lg },
  barRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepWrap: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotText: { fontSize: fontSizes.captionSmall, fontFamily: fonts.bodyMedium },
  line: {
    width: 48,
    height: 3,
    marginHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.sm },
  label: { fontSize: fontSizes.label, fontFamily: fonts.body, textAlign: 'center', flex: 1 },
})
