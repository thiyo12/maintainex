import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { CheckCircle, Warning, Tag, Info } from 'phosphor-react-native'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { v2Subscription } from '../../../lib/api-v2'
import { useTranslation } from 'react-i18next'

export default function SubscriptionScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const [status, setStatus] = useState<any>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [statusRes, plansRes] = await Promise.all([
        v2Subscription.getStatus().catch(() => null),
        v2Subscription.getPlans().catch(() => []),
      ])
      setStatus(statusRes)
      setPlans(plansRes)
    } catch {
      // handle errors silently
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (planId: string) => {
    setSubscribing(true)
    try {
      const res = await v2Subscription.subscribe(planId, true)
      if (res.success) {
        Alert.alert(t('common.success'), t('company.subscription') + ' ' + t('common.success'))
        loadAll()
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('errors.generic'))
    } finally {
      setSubscribing(false)
    }
  }

  const handleCancel = () => {
    Alert.alert(
      t('common.cancel') + ' ' + t('company.subscription'),
      t('errors.generic'),
      [
        { text: t('subscription.keepSubscription'), style: 'cancel' },
        {
          text: t('common.cancel'),
          style: 'destructive',
          onPress: async () => {
            try {
              await v2Subscription.cancel()
              Alert.alert(t('jobDetail.cancelled'), t('company.subscription') + ' ' + t('jobDetail.cancelled'))
              loadAll()
            } catch {
              Alert.alert(t('common.error'), t('errors.generic'))
            }
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.amber} />
      </View>
    )
  }

  const isSubscribed = status?.subscriptionStatus === 'ACTIVE' || status?.subscriptionStatus === 'TRIAL'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('company.subscription')}</Text>

      {/* Current Status */}
      <View style={styles.statusCard}>
        {isSubscribed ? (
          <CheckCircle size={28} color={colors.success} weight="fill" />
        ) : (
          <Warning size={28} color={colors.muted} />
        )}
        <View style={styles.statusInfo}>
          <Text style={styles.statusTitle}>
            {status?.subscriptionStatus === 'TRIAL' ? t('subscription.trial') :
             isSubscribed ? t('tasker.active') : t('subscription.noActive')}
          </Text>
          <Text style={styles.statusDesc}>
            {t('subscription.commission')}: {status?.commissionRate ?? 15}%
          </Text>
          {status?.subscriptionExpiresAt && (
            <Text style={styles.expiryText}>
              {t('receipt.paidOn')}: {new Date(status.subscriptionExpiresAt).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>

      {status?.activeSubscription && (
        <View style={styles.currentPlanCard}>
          <Text style={styles.planName}>{status.activeSubscription.planName}</Text>
          <Text style={styles.planStatus}>
            {t('subscription.status')}: {status.activeSubscription.status}
          </Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>{t('common.cancel')} {t('company.subscription')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>{t('subscription.availablePlans')}</Text>
      {plans.length === 0 ? (
        <View style={styles.empty}>
          <Tag size={40} color={colors.muted} />
          <Text style={styles.emptyText}>{t('common.noResults')}</Text>
        </View>
      ) : (
        plans.map((plan) => (
          <View key={plan.id} style={styles.planCard}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>LKR {plan.price.toLocaleString()}/{t('subscription.perMonth')}</Text>
            {plan.description && (
              <Text style={styles.planDesc}>{plan.description}</Text>
            )}
            {plan.features?.length > 0 && (
              <View style={styles.featuresList}>
                {plan.features.map((f: string, i: number) => (
                  <View key={i} style={styles.featureRow}>
                    <CheckCircle size={16} color={colors.success} weight="fill" />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={[styles.subscribeBtn, subscribing && styles.subscribeBtnDisabled]}
              onPress={() => handleSubscribe(plan.id)}
              disabled={subscribing}
            >
              {subscribing ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.subscribeText}>
                  {isSubscribed ? t('components.bookNow') : t('company.subscription')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ))
      )}

      <View style={styles.infoBox}>
        <Info size={20} color={colors.amber} />
        <Text style={styles.infoText}>
          {t('subscription.infoText', { commissionRate: status?.commissionRate ?? 15 })}
        </Text>
      </View>
    </ScrollView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  title: { fontSize: 24, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 20 },
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, backgroundColor: colors.white, borderRadius: 16,
    marginBottom: 16, borderWidth: 1, borderColor: colors.border,
  },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink },
  statusDesc: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  expiryText: { fontSize: 12, fontFamily: fonts.body, color: colors.amber, marginTop: 2 },
  currentPlanCard: {
    padding: 16, backgroundColor: colors.amberBg, borderRadius: 16,
    marginBottom: 24, borderWidth: 1, borderColor: colors.amber,
  },
  planName: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 4 },
  planStatus: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, marginBottom: 12 },
  cancelBtn: { alignSelf: 'flex-start' },
  cancelText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: '#EF4444' },
  sectionTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 12 },
  empty: { alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, marginTop: 12, textAlign: 'center' },
  planCard: {
    padding: 20, backgroundColor: colors.white, borderRadius: 16,
    marginBottom: 12, borderWidth: 1, borderColor: colors.border,
  },
  planPrice: { fontSize: 24, fontFamily: fonts.headingBold, color: colors.amber, marginBottom: 8 },
  planDesc: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, marginBottom: 12 },
  featuresList: { marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  featureText: { fontSize: 14, fontFamily: fonts.body, color: colors.ink },
  subscribeBtn: {
    backgroundColor: colors.amber, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center',
  },
  subscribeBtnDisabled: { opacity: 0.5 },
  subscribeText: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.white },
  infoBox: {
    flexDirection: 'row', gap: 10, padding: 14, backgroundColor: colors.amberBg,
    borderRadius: 12, marginTop: 24, borderWidth: 1, borderColor: colors.border,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.muted, lineHeight: 19 },
})
