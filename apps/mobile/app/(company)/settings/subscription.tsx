import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { v2Subscription } from '../../../lib/api-v2'

export default function SubscriptionScreen() {
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
        Alert.alert('Subscribed', 'Your subscription is now active.')
        loadAll()
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to subscribe')
    } finally {
      setSubscribing(false)
    }
  }

  const handleCancel = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure? Your subscription will end at the current billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await v2Subscription.cancel()
              Alert.alert('Cancelled', 'Your subscription has been cancelled.')
              loadAll()
            } catch {
              Alert.alert('Error', 'Failed to cancel subscription')
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
      <Text style={styles.title}>Subscription</Text>

      {/* Current Status */}
      <View style={styles.statusCard}>
        <Ionicons
          name={isSubscribed ? 'checkmark-circle' : 'alert-circle-outline'}
          size={28}
          color={isSubscribed ? colors.success : colors.muted}
        />
        <View style={styles.statusInfo}>
          <Text style={styles.statusTitle}>
            {status?.subscriptionStatus === 'TRIAL' ? 'Trial Period' :
             isSubscribed ? 'Active' : 'No Active Subscription'}
          </Text>
          <Text style={styles.statusDesc}>
            Commission: {status?.commissionRate ?? 15}% on job payments
          </Text>
          {status?.subscriptionExpiresAt && (
            <Text style={styles.expiryText}>
              Expires: {new Date(status.subscriptionExpiresAt).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>

      {status?.activeSubscription && (
        <View style={styles.currentPlanCard}>
          <Text style={styles.planName}>{status.activeSubscription.planName}</Text>
          <Text style={styles.planStatus}>
            Status: {status.activeSubscription.status}
          </Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel Subscription</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Available Plans */}
      <Text style={styles.sectionTitle}>Available Plans</Text>
      {plans.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="pricetag-outline" size={40} color={colors.muted} />
          <Text style={styles.emptyText}>No plans available yet. Contact us for pricing.</Text>
        </View>
      ) : (
        plans.map((plan) => (
          <View key={plan.id} style={styles.planCard}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>LKR {plan.price.toLocaleString()}/month</Text>
            {plan.description && (
              <Text style={styles.planDesc}>{plan.description}</Text>
            )}
            {plan.features?.length > 0 && (
              <View style={styles.featuresList}>
                {plan.features.map((f: string, i: number) => (
                  <View key={i} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
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
                  {isSubscribed ? 'Switch to this Plan' : 'Subscribe'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ))
      )}

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color={colors.amber} />
        <Text style={styles.infoText}>
          Subscription covers your monthly plan. The {status?.commissionRate ?? 15}% commission is deducted from job payments automatically. Companies are recommended for jobs over LKR 15,000.
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
