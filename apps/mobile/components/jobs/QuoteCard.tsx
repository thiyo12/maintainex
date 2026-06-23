import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'
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
  const colors = useColors()
  const { t } = useTranslation()
    const styles = makeStyles(colors)
  const isCompany = providerType === 'COMPANY'

  const providerTypeLabels: Record<string, string> = {
    FREELANCER: t('quotes.freelancer'),
    COMPANY: t('quotes.company'),
  }
  const accentColor = isCompany ? colors.company : colors.amber

  return (
    <View style={[styles.card, { backgroundColor: colors.white, shadowColor: colors.ink, borderLeftColor: accentColor, borderLeftWidth: 3 }]}>
      <View style={styles.top}>
        <Avatar name={providerName} size={42} color={accentColor} />
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.ink }]}>{providerName}</Text>
          <Badge label={providerTypeLabels[providerType] || providerType} variant={isCompany ? 'purple' : 'amber'} />
          {rating && (
            <Text style={[styles.rating, { color: colors.muted }]}><Ionicons name="star" size={14} color="#F59E0B" /> {rating.toFixed(1)}</Text>
          )}
        </View>
        <Text style={[styles.price, { color: colors.primaryDark }]}>LKR {price.toLocaleString()}</Text>
      </View>
      {message ? <Text style={[styles.message, { color: colors.ink, borderTopColor: colors.border }]} numberOfLines={2}>{message}</Text> : null}
      {estimatedCompletion && (
        <Text style={[styles.eta, { color: colors.muted }]}>{t('quotes.estimatedCompletion')}: {estimatedCompletion}</Text>
      )}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: accentColor }]} onPress={onAccept} disabled={loading}>
          <Text style={[styles.acceptBtnText, { color: colors.white }]}>{loading ? '...' : t('quotes.accept')}</Text>
        </TouchableOpacity>
        {onViewProfile && (
          <TouchableOpacity style={[styles.profileBtn, { borderColor: colors.border }]} onPress={onViewProfile}>
            <Text style={[styles.profileBtnText, { color: accentColor }]}>{t('quotes.viewProfile')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontFamily: fonts.bodyMedium, marginBottom: 2 },
  rating: { fontSize: 12, fontFamily: fonts.body, marginTop: 2 },
  price: { fontSize: 18, fontFamily: fonts.heading },
  message: { fontSize: 13, fontFamily: fonts.body, opacity: 0.7, lineHeight: 20, marginBottom: 8, paddingTop: 8, borderTopWidth: 1 },
  eta: { fontSize: 12, fontFamily: fonts.body, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  acceptBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  acceptBtnText: { fontSize: 14, fontFamily: fonts.bodyMedium },
  profileBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1.5 },
  profileBtnText: { fontSize: 14, fontFamily: fonts.bodyMedium },
})
