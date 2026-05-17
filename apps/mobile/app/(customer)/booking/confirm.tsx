import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  primary: '#F59E0B',
  purple: '#7C3AED',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
}

export default function BookingConfirmScreen() {
  const router = useRouter()
  const total = 8500
  const fee = Math.round(total * 0.05)
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.heading}>Confirm booking</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text style={styles.sumTitle}>Fix leaking pipe</Text>
          <Text style={styles.sumDetail}>Kamal Perera • Plumber</Text>
          <Text style={styles.sumDetail}>📅 Today at 2:00 PM</Text>
          <Text style={styles.sumDetail}>📍 Colombo 03</Text>
        </View>

        <View style={styles.payment}>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>Quoted amount</Text>
            <Text style={styles.payValue}>LKR {total.toLocaleString()}</Text>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>Platform fee (5%)</Text>
            <Text style={styles.payValue}>LKR {fee.toLocaleString()}</Text>
          </View>
          <View style={[styles.payRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>LKR {(total + fee).toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.escrowBox}>
          <Text style={styles.escrowIcon}>🔒</Text>
          <Text style={styles.escrowText}>
            Funds are held securely in escrow until the job is completed to your satisfaction.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Payment method</Text>
        <TouchableOpacity style={styles.paymentOption}>
          <Text style={styles.payOptionText}>💳 Visa ending in 4242</Text>
          <Text style={styles.radio} >✓</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addPayment}>
          <Text style={styles.addPaymentText}>+ Add new payment method</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={styles.confirmBtn}
        onPress={() => router.push('/(customer)/booking/confirmed')}
      >
        <Text style={styles.confirmBtnText}>Confirm and pay LKR {(total + fee).toLocaleString()}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  backBtn: { paddingHorizontal: 24, paddingTop: 8 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark, paddingHorizontal: 24, marginBottom: 16 },
  summary: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
  },
  sumTitle: { fontSize: 17, fontWeight: '700', color: colors.dark, marginBottom: 8 },
  sumDetail: { fontSize: 14, color: colors.gray, marginBottom: 4 },
  payment: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
  },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  payLabel: { fontSize: 14, color: colors.gray },
  payValue: { fontSize: 14, fontWeight: '600', color: colors.dark },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.lightGray, marginTop: 4, paddingTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.dark },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.primary },
  escrowBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 24,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  escrowIcon: { fontSize: 20 },
  escrowText: { flex: 1, fontSize: 13, color: '#1E40AF', lineHeight: 18 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  payOptionText: { fontSize: 14, color: colors.dark },
  radio: { fontSize: 18, color: colors.primary, fontWeight: '700' },
  addPayment: {
    marginHorizontal: 24,
    padding: 14,
    alignItems: 'center',
  },
  addPaymentText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  confirmBtn: {
    backgroundColor: colors.purple,
    marginHorizontal: 24,
    marginBottom: 24,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
})
