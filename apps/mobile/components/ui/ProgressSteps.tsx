import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../lib/ThemeContext'
import { fonts, fontSizes } from '../../lib/fonts'
import { spacing, borderRadius } from '../../lib/tokens'

interface Props {
  current: number
  total: number
  labels?: string[]
  title?: string
  percentage?: number
}

export default function ProgressSteps({ current, total, labels, title, percentage }: Props) {
  const colors = useColors()
  const pct = percentage || Math.round((current / total) * 100)

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.surface }]}>
      {(title || percentage) ? (
        <View style={styles.header}>
          {title ? <Text style={[styles.title, { color: colors.ink }]}>{title}</Text> : null}
          {percentage ? <Text style={[styles.pct, { color: colors.primary }]}>{pct}%</Text> : null}
        </View>
      ) : null}
      <View style={styles.stepsRow}>
        {Array.from({ length: total }, (_, i) => {
          const isDone = i < current
          const isCurrent = i === current
          const isUp = i > current
          return (
            <View key={i} style={styles.step}>
              <View
                style={[
                  styles.dot,
                  isDone && { backgroundColor: colors.success },
                  isCurrent && { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
                  isUp && { backgroundColor: colors.border },
                ]}
              >
                {isDone ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                  <Text style={[
                    styles.dotText,
                    isCurrent && { color: '#111' },
                    isUp && { color: colors.muted },
                  ]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              {i < total - 1 ? (
                <View style={[styles.line, { backgroundColor: isDone ? colors.success : colors.border }]} />
              ) : null}
            </View>
          )
        })}
      </View>
      {labels ? (
        <View style={styles.lblRow}>
          {labels.map((l, i) => {
            const isDone = i < current
            const isCur = i === current
            return (
              <Text
                key={i}
                style={[
                  styles.lbl,
                  isDone && { color: colors.success },
                  isCur && { color: colors.primaryDark, fontFamily: fonts.headingBold },
                  !isDone && !isCur && { color: colors.muted },
                ]}
              >
                {l}
              </Text>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 18,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: fontSizes.bodySmall,
    fontFamily: fonts.headingBold,
  },
  pct: {
    fontSize: fontSizes.bodySmall,
    fontFamily: fonts.headingBold,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontSize: 13,
    fontFamily: fonts.headingBold,
  },
  line: {
    flex: 1,
    height: 2,
    marginHorizontal: 6,
    borderRadius: 1,
  },
  lblRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm + 2,
  },
  lbl: {
    fontSize: 9,
    fontFamily: fonts.label,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
    textAlign: 'center',
  },
})
