import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import Slider from '@react-native-community/slider'
import { bookings } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { useColors } from '../../../lib/ThemeContext'

export default function BookingConfirmScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { user } = useAuth()
  const { jobId, bidId, taskerName, price } = useLocalSearchParams()
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const baseAmount = budgetMin && budgetMax ? (Number(budgetMin) + Number(budgetMax)) / 2 : Number(price) || 8500
  const total = baseAmount
  const fee = Math.round(total * 0.05)
  const [district, setDistrict] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (!district) { Alert.alert('Error', 'Please enter your district'); return }
    setSubmitting(true)
    try {
      const res = await bookings.create({
        name: user?.name || '',
        phone: user?.phone || '',
        email: user?.email || '',
        serviceId: jobId || '',
        district,
        address: '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        notes: bidId ? `Bid: ${bidId}` : '',
        budgetMin: budgetMin || undefined,
        budgetMax: budgetMax || undefined,
      })
      router.push(`/(customer)/booking/confirmed?bookingId=${res.booking.id}`)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create booking')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Confirm booking</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text style={styles.sumTitle}>Service booking</Text>
          <Text style={styles.sumDetail}>{taskerName || 'Tasker'} • Professional</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="calendar-outline" size={16} color={colors.gray} />
            <Text style={styles.sumDetail}> Today</Text>
          </View>
        </View>

        <View style={styles.summary}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.dark, marginBottom: 8 }}>Service location (district)</Text>
          <TextInput
            style={{ borderWidth: 1.5, borderColor: colors.lightGray, borderRadius: 12, padding: 14, fontSize: 15, color: colors.dark }}
            placeholder="Enter your district"
            value={district}
            onChangeText={setDistrict}
          />
        </View>

        <View style={styles.payment}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.dark, marginBottom: 8 }}>Budget Range (optional)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <TextInput
              style={[styles.input, { flex: 1, textAlign: 'center', marginBottom: 0 }]}
              value={budgetMin}
              onChangeText={(val) => {
                const max = budgetMax || '100000'
                setBudgetMin(val && Number(val) > Number(max) ? max : val)
              }}
              placeholder="Min"
              keyboardType="numeric"
            />
            <Text style={{ fontSize: 16, color: colors.gray }}>-</Text>
            <TextInput
              style={[styles.input, { flex: 1, textAlign: 'center', marginBottom: 0 }]}
              value={budgetMax}
              onChangeText={(val) => {
                const min = budgetMin || '0'
                setBudgetMax(val && Number(val) < Number(min) ? min : val)
              }}
              placeholder="Max"
              keyboardType="numeric"
            />
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.dark }}>LKR</Text>
          </View>
          <View style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: -4 }}>
              <Text style={{ fontSize: 11, color: colors.gray }}>LKR 0</Text>
              <Text style={{ fontSize: 11, color: colors.gray }}>LKR 100K</Text>
            </View>
            <View style={{ height: 40, justifyContent: 'center', position: 'relative' }}>
              <View style={{ height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginHorizontal: 14 }} />
              <View
                style={{
                  position: 'absolute', height: 4, backgroundColor: colors.primary,
                  borderRadius: 2, left: `${(Number(budgetMin || 0) / 100000) * 100}%`,
                  right: `${100 - (Number(budgetMax || 100000) / 100000) * 100}%`,
                }}
              />
              <Slider
                style={{ position: 'absolute', left: 0, right: 0, height: 40 }}
                minimumValue={0}
                maximumValue={100000}
                step={500}
                value={Number(budgetMin) || 0}
                onValueChange={(v) => {
                  const max = Number(budgetMax || 100000)
                  setBudgetMin(v > max ? String(max) : String(Math.round(v)))
                }}
                minimumTrackTintColor="transparent"
                maximumTrackTintColor="transparent"
                thumbTintColor={colors.primary}
              />
              <Slider
                style={{ position: 'absolute', left: 0, right: 0, height: 40 }}
                minimumValue={0}
                maximumValue={100000}
                step={500}
                value={Number(budgetMax) || 100000}
                onValueChange={(v) => {
                  const min = Number(budgetMin || 0)
                  setBudgetMax(v < min ? String(min) : String(Math.round(v)))
                }}
                minimumTrackTintColor="transparent"
                maximumTrackTintColor="transparent"
                thumbTintColor={colors.primary}
              />
            </View>
          </View>
          <Text style={{ fontSize: 12, color: colors.gray, marginBottom: 8 }}>Drag thumbs or enter values above</Text>
          {budgetMin && budgetMax && (
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Your range</Text>
              <Text style={styles.payValue}>LKR {Number(budgetMin).toLocaleString()} - {Number(budgetMax).toLocaleString()}</Text>
            </View>
          )}
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
          <Ionicons name="lock-closed-outline" size={20} color="#1E40AF" />
          <Text style={styles.escrowText}>
            Funds are held securely in escrow until the job is completed to your satisfaction.
          </Text>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.confirmBtn}
        onPress={handleConfirm}
        disabled={submitting}
      >
        <Text style={styles.confirmBtnText}>
          {submitting ? 'Processing...' : `Confirm and pay LKR ${(total + fee).toLocaleString()}`}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
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
  confirmBtn: {
    backgroundColor: colors.primary,
    marginHorizontal: 24,
    marginBottom: 24,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1F2937', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
})