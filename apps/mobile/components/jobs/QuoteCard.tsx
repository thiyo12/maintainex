import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from '../../lib/colors'
import { fonts } from '../../lib/fonts'
import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'

interface Props {
  providerName: string
  providerType: 'FREELANCER' | 'COMPANY'
  price: number
  message?: string
  estimatedCompletion?: string
  rating?: number
  onAccept: () => void
  onViewProfile?: () => void
  loading?: boolean
}

export default function QuoteCard({ providerName, providerType, price, message, estimatedCompletion, rating, onAccept, onViewProfile, loading }: Props) {
  const isCompany = providerType === 'COMPANY'
  const accentColor = isCompany ? colors.company : colors.amber

  return (
    <View style={[styles.card, { borderLeftColor: accentColor, borderLeftWidth: 3 }]}>
      <View style={styles.top}>
        <Avatar name={providerName} size={42} color={isCompany ? colors.company : colors.amber} />
        <View style={styles.info}>
          <Text style={styles.name}>{providerName}</Text>
          <Badge label={providerType} variant={isCompany ? 'purple' : 'amber'} />
          {rating && (
            <Text style={styles.rating}>★ {rating.toFixed(1)}</Text>
          )}
        </View>
        <Text style={[styles.price, { color: colors.primaryDark }]}>LKR {price.toLocaleString()}</Text>
      </View>
      {message ? <Text style={styles.message} numberOfLines={2}>{message}</Text> : null}
      {estimatedCompletion && (
        <Text style={styles.eta}>Est. completion: {estimatedCompletion}</Text>
      )}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: accentColor }]} onPress={onAccept} disabled={loading}>
          <Text style={styles.acceptBtnText}>{loading ? '...' : 'Accept Quote'}</Text>
        </TouchableOpacity>
        {onViewProfile && (
          <TouchableOpacity style={styles.profileBtn} onPress={onViewProfile}>
            <Text style={[styles.profileBtnText, { color: accentColor }]}>View Profile</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 2 },
  rating: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  price: { fontSize: 18, fontFamily: fonts.heading },
  message: { fontSize: 13, fontFamily: fonts.body, color: colors.ink, opacity: 0.7, lineHeight: 20, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  eta: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  acceptBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  acceptBtnText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink },
  profileBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  profileBtnText: { fontSize: 14, fontFamily: fonts.bodyMedium },
})
