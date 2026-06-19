import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import PressScale from './PressScale'
import { useColors } from '../../lib/ThemeContext'

interface Props {
  name: string
  rating: number
  completedJobs: number
  isVerified: boolean
  isOnline: boolean
  distance?: number
  hourlyRate: number
  onPress: () => void
}

export default function TaskerCard({ name, rating, completedJobs, isVerified, isOnline, distance, hourlyRate, onPress }: Props) {
  const colors = useColors()
    const styles = makeStyles(colors)
  return (
    <PressScale onPress={onPress}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.top}>
          <View style={[styles.avatar, { backgroundColor: colors.border }]}>
            <Ionicons name="person" size={24} color={colors.white} />
          </View>
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.ink }]}>{name}</Text>
              {isVerified && <Ionicons name="checkmark-circle" size={16} color={colors.amber} />}
            </View>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Ionicons name="star" size={13} color={colors.amber} />
                <Text style={[styles.statText, { color: colors.muted }]}>{rating.toFixed(1)}</Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="briefcase" size={13} color={colors.muted} />
                <Text style={[styles.statText, { color: colors.muted }]}>{completedJobs} jobs</Text>
              </View>
              {distance !== undefined && (
                <View style={styles.stat}>
                  <Ionicons name="location" size={13} color={colors.muted} />
                  <Text style={[styles.statText, { color: colors.muted }]}>{distance.toFixed(1)} km</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.rateCol}>
            <Text style={[styles.rate, { color: colors.success }]}>Rs {hourlyRate}</Text>
            <Text style={[styles.rateLabel, { color: colors.muted }]}>/hr</Text>
          </View>
        </View>
        <View style={styles.bottom}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : colors.border }]} />
          <Text style={[styles.statusText, { color: colors.muted }]}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
      </View>
    </PressScale>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  top: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 15, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 10, marginTop: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontSize: 12 },
  rateCol: { alignItems: 'flex-end' },
  rate: { fontSize: 15, fontWeight: '700' },
  rateLabel: { fontSize: 10 },
  bottom: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12 },
})
