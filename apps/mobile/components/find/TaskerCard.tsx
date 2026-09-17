import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Star, Briefcase, MapPin, ChatCircleText } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'

interface Props {
  name: string
  rating: number
  completedJobs: number
  isVerified: boolean
  isOnline: boolean
  distance?: number
  hourlyRate: number
  skills?: string[]
  onPress: () => void
  onMessage?: () => void
}

export default function TaskerCard({ name, rating, completedJobs, isVerified, isOnline, distance, hourlyRate, skills, onPress, onMessage }: Props) {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = makeStyles(colors)
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.top}>
          <View style={[styles.avatar, { backgroundColor: colors.border }]}>
            <Text style={{ fontSize: 18, fontFamily: 'Outfit_700Bold', color: colors.white }}>{name?.charAt(0)?.toUpperCase() || 'T'}</Text>
          </View>
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.ink }]}>{name}</Text>
              {isVerified && <Star size={14} color={colors.amber} weight="fill" />}
            </View>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Star size={12} color={colors.amber} weight="fill" />
                <Text style={[styles.statText, { color: colors.muted }]}>{rating.toFixed(1)}</Text>
              </View>
              <View style={styles.stat}>
                <Briefcase size={12} color={colors.muted} />
                <Text style={[styles.statText, { color: colors.muted }]}>{completedJobs}{t('customer.jobs')}</Text>
              </View>
              {distance !== undefined && (
                <View style={styles.stat}>
                  <MapPin size={12} color={colors.muted} />
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
          {skills && skills.length > 0 && (
            <View style={styles.skillsRow}>
              {skills.slice(0, 3).map((s, i) => (
                <View key={i} style={[styles.skillChip, { backgroundColor: colors.border }]}>
                  <Text style={[styles.skillText, { color: colors.muted }]} numberOfLines={1}>{s}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : colors.border }]} />
            <Text style={[styles.statusText, { color: colors.muted }]}>{isOnline ? t('common.online') : t('common.offline')}</Text>
            {onMessage && (
              <TouchableOpacity onPress={onMessage} hitSlop={8} style={[styles.messageBtn, { backgroundColor: colors.border }]}>
                <ChatCircleText size={14} color={colors.amberDark} weight="fill" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
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
  bottom: { marginTop: 8, gap: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12 },
  messageBtn: { marginLeft: 'auto', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  skillChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  skillText: { fontSize: 11, fontFamily: 'Outfit_500Medium' },
})
