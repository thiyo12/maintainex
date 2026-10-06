import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { PaperPlaneTilt } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  title: string
  status: string
  providerName?: string
  quoteCount?: number
  onPress: () => void
}

export default function V3ActiveJobCard({ title, status, providerName, quoteCount, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.topRow}>
        <Text style={styles.label}>ACTIVE JOB</Text>
        {quoteCount && quoteCount > 0 ? (
          <View style={styles.quotePill}>
            <Text style={styles.quoteText}>{quoteCount} quotes</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>{title || 'Your job'}</Text>
      {providerName ? (
        <View style={styles.providerRow}>
          <View style={styles.providerDot}>
            <Text style={styles.providerInitial}>{providerName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.providerName} numberOfLines={1}>{providerName}</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>
      ) : null}
      <TouchableOpacity style={styles.trackBtn} onPress={onPress} activeOpacity={0.7}>
        <PaperPlaneTilt size={14} color={v3.colors.paper} weight="fill" />
        <Text style={styles.trackText}>Track</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.lg,
    padding: 18,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 8.4,
    fontFamily: 'Outfit_700Bold',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.6,
  },
  quotePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: v3.radius.full,
  },
  quoteText: {
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.paper,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.paper,
    marginBottom: 12,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  providerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerInitial: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.paper,
  },
  providerName: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.paper,
    flex: 1,
  },
  statusPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: v3.radius.full,
  },
  statusText: {
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.paper,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: v3.colors.paper,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: v3.radius.full,
    alignSelf: 'flex-start',
  },
  trackText: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.ink,
  },
})
