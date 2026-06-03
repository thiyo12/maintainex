import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import PressScale from './PressScale'
import { colors } from '../../lib/colors'

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
  return (
    <PressScale onPress={onPress}>
      <View style={styles.card}>
        <View style={styles.top}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#fff" />
          </View>
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{name}</Text>
              {isVerified && <Ionicons name="checkmark-circle" size={16} color={colors.amber} />}
            </View>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={styles.statText}>{rating.toFixed(1)}</Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="briefcase" size={13} color="#6B7280" />
                <Text style={styles.statText}>{completedJobs} jobs</Text>
              </View>
              {distance !== undefined && (
                <View style={styles.stat}>
                  <Ionicons name="location" size={13} color="#6B7280" />
                  <Text style={styles.statText}>{distance.toFixed(1)} km</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.rateCol}>
            <Text style={styles.rate}>Rs {hourlyRate}</Text>
            <Text style={styles.rateLabel}>/hr</Text>
          </View>
        </View>
        <View style={styles.bottom}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#D1D5DB' }]} />
          <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
      </View>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
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
    backgroundColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  stats: { flexDirection: 'row', gap: 10, marginTop: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontSize: 12, color: '#6B7280' },
  rateCol: { alignItems: 'flex-end' },
  rate: { fontSize: 15, fontWeight: '700', color: '#059669' },
  rateLabel: { fontSize: 10, color: '#9CA3AF' },
  bottom: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: '#9CA3AF' },
})
