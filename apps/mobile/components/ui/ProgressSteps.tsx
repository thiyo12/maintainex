import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/ThemeContext'

interface Props {
  current: number
  total: number
  labels?: string[]
  title?: string
  percentage?: number
}

export default function ProgressSteps({ current, total, labels, title, percentage }: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const pct = percentage || Math.round((current / total) * 100)

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      {(title || percentage) ? (
        <View style={styles.header}>
          {title ? <Text style={[styles.title, { color: colors.ink }]}>{title}</Text> : null}
          {percentage ? <Text style={[styles.pct, { color: colors.amber }]}>{pct}%</Text> : null}
        </View>
      ) : null}
      <View style={styles.barRow}>
        {Array.from({ length: total }, (_, i) => {
          const isDone = i < current
          const isCurrent = i === current
          return (
            <View key={i} style={styles.stepWrap}>
              <View style={[
                styles.dot,
                isDone && { backgroundColor: '#22C55E' },
                isCurrent && {
                  backgroundColor: '#F5A623',
                  shadowColor: '#F5A623', shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
                },
                !isDone && !isCurrent && { backgroundColor: colors.border },
              ]}>
                {isDone ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                  <Text style={[
                    styles.dotText,
                    isCurrent && { color: '#111827' },
                    !isCurrent && { color: '#6B7280' },
                  ]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              {i < total - 1 ? (
                <View style={[styles.line, { backgroundColor: isDone ? '#22C55E' : colors.border }]} />
              ) : null}
            </View>
          )
        })}
      </View>
      {labels ? (
        <View style={styles.labelRow}>
          {labels.map((l, i) => {
            const isDone = i < current
            const isCur = i === current
            return (
              <Text key={i} style={[
                styles.label,
                isDone && { color: '#22C55E' },
                isCur && { color: '#D48900', fontFamily: 'Outfit_800ExtraBold' },
                !isDone && !isCur && { color: '#6B7280' },
              ]}>
                {l}
              </Text>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container:   { marginVertical: 16, shadowOpacity: 0, padding: 0 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title:       { fontSize: 14, fontFamily: 'Outfit_800ExtraBold' },
  pct:         { fontSize: 14, fontFamily: 'Outfit_800ExtraBold' },
  barRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepWrap:    { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  dotText:       { fontSize: 13, fontFamily: 'Outfit_700Bold' },
  line: { width: 40, height: 2, marginHorizontal: 6, borderRadius: 2 },
  labelRow:     { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  label:        { fontSize: 9, fontFamily: 'Outfit_500Medium', textTransform: 'uppercase', letterSpacing: 0.4, flex: 1, textAlign: 'center' },
})
