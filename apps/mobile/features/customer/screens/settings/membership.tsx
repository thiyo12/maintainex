import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { CaretRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/lib/auth'
import { colors, spacing, radius, typography } from '@/lib/design'
import { tierById, nextTier, TIERS } from '@/lib/tiers'

export default function MembershipScreen() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const tier = tierById((user as any)?.tierLevel)
  const TierIcon = tier.icon
  const next = nextTier(tier.id)
  const completedJobs = (user as any)?.completedJobs || 0
  const totalSpent = (user as any)?.totalSpent || 0

  const jobProgress = next ? Math.min(100, Math.round((completedJobs / next.minJobs) * 100)) : 100
  const spentProgress = next && next.minSpent > 0 ? Math.min(100, Math.round((totalSpent / next.minSpent) * 100)) : 0

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[tier.color, colors.surfaceHigh]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroIconBox}>
          <TierIcon size={34} color="#FFFFFF" weight="fill" />
        </View>
        <Text style={styles.heroLabel}>{t('account.currentTier')}</Text>
        <Text style={styles.heroTitle}>{t(`tiers.${tier.id.toLowerCase()}`)}</Text>
        <Text style={styles.heroDesc}>{t(`tiers.${tier.id.toLowerCase()}Desc`)}</Text>
      </LinearGradient>

      {next ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('tiers.nextTier')}</Text>
          <Text style={styles.nextName}>{t(`tiers.${next.id.toLowerCase()}`)}</Text>

          <View style={styles.progressBlock}>
            <Text style={styles.progressLabel}>{t('tiers.jobsCompleted', { n: completedJobs })}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${jobProgress}%`, backgroundColor: next.color }]} />
            </View>
          </View>

          {next.minSpent > 0 ? (
            <View style={styles.progressBlock}>
              <Text style={styles.progressLabel}>{t('tiers.spent', { n: totalSpent.toLocaleString() })}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${spentProgress}%`, backgroundColor: next.color }]} />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>{t('tiers.howItWorks')}</Text>
      <Text style={styles.sectionSub}>{t('tiers.howItWorksDesc')}</Text>

      <View style={styles.tierList}>
        {TIERS.map((tierItem) => {
          const Icon = tierItem.icon
          const isCurrent = tierItem.id === tier.id
          return (
            <View key={tierItem.id} style={[styles.tierRow, isCurrent && { borderColor: tierItem.color }]}>
              <View style={[styles.tierRowIcon, { backgroundColor: tierItem.color + '18' }]}>
                <Icon size={22} color={tierItem.color} weight={isCurrent ? 'fill' : 'regular'} />
              </View>
              <View style={styles.tierRowBody}>
                <Text style={styles.tierRowName}>{t(`tiers.${tierItem.id.toLowerCase()}`)}</Text>
                <Text style={styles.tierRowDesc}>{t(`tiers.${tierItem.id.toLowerCase()}Desc`)}</Text>
              </View>
              {isCurrent ? <CaretRight size={16} color={tierItem.color} weight="fill" style={{ transform: [{ rotate: '90deg' }] }} /> : null}
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  hero: { borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  heroIconBox: { width: 68, height: 68, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  heroLabel: { ...typography.caption, color: 'rgba(255,255,255,0.85)' },
  heroTitle: { ...typography.h2, color: '#FFFFFF', marginTop: 2 },
  heroDesc: { ...typography.bodyMuted, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 4 },

  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  cardTitle: { ...typography.caption, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Outfit_600SemiBold' },
  nextName: { ...typography.h3, marginTop: 4, marginBottom: spacing.md },

  progressBlock: { marginBottom: spacing.md },
  progressLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 6 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  sectionTitle: { ...typography.h3, fontSize: 18, marginTop: spacing.sm, marginBottom: 4 },
  sectionSub: { ...typography.bodyMuted, fontSize: 14, marginBottom: spacing.md },

  tierList: { gap: 8 },
  tierRow: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  tierRowIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tierRowBody: { flex: 1, marginLeft: spacing.md },
  tierRowName: { ...typography.body, fontFamily: 'Outfit_700Bold', fontSize: 15 },
  tierRowDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
})