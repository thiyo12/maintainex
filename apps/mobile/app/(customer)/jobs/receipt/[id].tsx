import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  primary: '#F59E0B',
  purple: '#7C3AED',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
  red: '#EF4444',
}

export default function ReceiptScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
  }, [])

  const subtotal = 8500
  const fee = Math.round(subtotal * 0.05)
  const total = subtotal + fee

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.receiptCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.receiptHeader}>
            <Text style={styles.receiptEmoji}>🧾</Text>
            <Text style={styles.receiptTitle}>Payment receipt</Text>
            <Text style={styles.receiptId}>#INV-{id}-001</Text>
            <View style={styles.paidBadge}>
              <Text style={styles.paidText}>✅ Paid</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.serviceSection}>
            <Text style={styles.serviceTitle}>Fix leaking pipe</Text>
            <Text style={styles.serviceMeta}>Plumbing • Colombo 03</Text>
            <Text style={styles.serviceMeta}>Kamal Perera • Plumber</Text>
            <Text style={styles.serviceDate}>📅 Today at 2:00 PM</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.lineItem}>
            <Text style={styles.lineLabel}>Service amount</Text>
            <Text style={styles.lineValue}>LKR {subtotal.toLocaleString()}</Text>
          </View>
          <View style={styles.lineItem}>
            <Text style={styles.lineLabel}>Platform fee (5%)</Text>
            <Text style={styles.lineValue}>LKR {fee.toLocaleString()}</Text>
          </View>
          <View style={styles.lineItem}>
            <Text style={styles.lineLabel}>Discount</Text>
            <Text style={[styles.lineValue, { color: colors.green }]}>- LKR 0</Text>
          </View>
          <View style={[styles.lineItem, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total charged</Text>
            <Text style={styles.totalValue}>LKR {total.toLocaleString()}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.paymentSection}>
            <Text style={styles.paymentLabel}>Payment method</Text>
            <Text style={styles.paymentValue}>💳 Visa ending in 4242</Text>
          </View>
          <View style={styles.paymentSection}>
            <Text style={styles.paymentLabel}>Paid on</Text>
            <Text style={styles.paymentValue}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
          </View>

          <View style={styles.escrowNote}>
            <Text style={styles.escrowIcon}>🔒</Text>
            <Text style={styles.escrowText}>
              Payment has been released from escrow to the tasker.
            </Text>
          </View>
        </Animated.View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.shareBtn}>
            <Text style={styles.shareBtnText}>📤 Share receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => router.push('/(customer)/jobs/review/' + id)}
          >
            <Text style={styles.reviewBtnText}>⭐ Leave a review</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.homeBtn}
        onPress={() => router.replace('/(customer)')}
      >
        <Text style={styles.homeBtnText}>Back to home</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  backBtn: { paddingHorizontal: 24, paddingTop: 8 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  receiptCard: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  receiptHeader: { alignItems: 'center', marginBottom: 16 },
  receiptEmoji: { fontSize: 40, marginBottom: 8 },
  receiptTitle: { fontSize: 20, fontWeight: '800', color: colors.dark, marginBottom: 4 },
  receiptId: { fontSize: 12, color: colors.gray, marginBottom: 8 },
  paidBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  paidText: { fontSize: 13, fontWeight: '700', color: colors.green },
  divider: { height: 1, backgroundColor: colors.lightGray, marginVertical: 12 },
  serviceSection: { marginBottom: 4 },
  serviceTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 6 },
  serviceMeta: { fontSize: 13, color: colors.gray, marginBottom: 2 },
  serviceDate: { fontSize: 13, color: colors.gray, marginTop: 4 },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  lineLabel: { fontSize: 14, color: colors.gray },
  lineValue: { fontSize: 14, fontWeight: '600', color: colors.dark },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    marginTop: 4,
    paddingTop: 12,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.dark },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.primary },
  paymentSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  paymentLabel: { fontSize: 13, color: colors.gray },
  paymentValue: { fontSize: 13, fontWeight: '600', color: colors.dark },
  escrowNote: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  escrowIcon: { fontSize: 16 },
  escrowText: { flex: 1, fontSize: 12, color: '#1E40AF', lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    marginHorizontal: 24,
    gap: 12,
    marginBottom: 100,
  },
  shareBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  shareBtnText: { fontSize: 14, fontWeight: '600', color: colors.dark },
  reviewBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  reviewBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  homeBtn: {
    backgroundColor: colors.purple,
    marginHorizontal: 24,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  homeBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
})
