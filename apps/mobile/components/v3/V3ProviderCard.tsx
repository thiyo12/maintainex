import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Star, SealCheck } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  name: string
  rating: number
  completedJobs: number
  isVerified: boolean
  skills?: string[]
  onPress: () => void
}

export default function V3ProviderCard({ name, rating, completedJobs, isVerified, skills, onPress }: Props) {
  const initial = (name || 'T').charAt(0).toUpperCase()

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
        {isVerified ? (
          <View style={styles.verifiedBadge}>
            <SealCheck size={12} color={v3.colors.info} weight="fill" />
          </View>
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      <View style={styles.ratingRow}>
        <Star size={11} color={v3.colors.amber} weight="fill" />
        <Text style={styles.rating}>{rating ? rating.toFixed(1) : '—'}</Text>
        <Text style={styles.jobs}>({completedJobs})</Text>
      </View>
      {skills && skills.length > 0 ? (
        <Text style={styles.skill} numberOfLines={1}>{skills[0]}</Text>
      ) : null}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 150,
    backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1,
    borderColor: v3.colors.line,
    borderRadius: v3.radius.lg,
    padding: 14,
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: v3.colors.surfaceGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
    color: v3.colors.textPrimary,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: v3.colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.textPrimary,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rating: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.textPrimary,
  },
  jobs: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textMuted,
  },
  skill: {
    fontSize: 9,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textSecondary,
    marginTop: 4,
  },
})
