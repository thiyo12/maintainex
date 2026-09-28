import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView, Modal, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { v2Wallet } from '@/lib/api-v2'
import { formatCurrency, getCurrencyForCountry } from '@/lib/currency-format'
import { Currency } from '@/lib/money'
import { useCountry } from '@/lib/country'

const PRESETS = [500, 1000, 2500, 5000, 10000, 25000]

const METHODS = [
  { id: 'payhere', label: 'Card / Bank / eZ Cash', sub: 'Visa, Mastercard, Dialog, Sampath', icon: 'card-outline', badge: 'Instant', badgeColor: '#22C55E' },
  { id: 'stripe', label: 'International Card', sub: 'Visa / Mastercard (USD, CAD, GBP)', icon: 'globe-outline', badge: 'Instant', badgeColor: '#22C55E' },
  { id: 'bank_transfer', label: 'Direct Bank Transfer', sub: "People's Bank, BOC, Commercial Bank", icon: 'business-outline', badge: '1-2 hours', badgeColor: '#3B82F6' },
]

export default function TopUpScreen() {
  const colors = useColors()
  const router = useRouter()
  const { selectedCountry } = useCountry()
  const currency: Currency = getCurrencyForCountry(selectedCountry?.code || 'LK')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('payhere')
  const [loading, setLoading] = useState(false)
  const [showBank, setShowBank] = useState(false)
  const styles = makeStyles(colors)

  const handleTopUp = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt < 100) {
      Alert.alert(`Minimum top-up is ${formatCurrency(BigInt(10000), currency)}`)
      return
    }
    if (method === 'bank_transfer') {
      setShowBank(true)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'}/api/mobile/v2/wallet/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await (await import('@/lib/api')).getAuthToken()}`,
        },
        body: JSON.stringify({ amount: amt }),
      })
      const data = await res.json()
      if (data.success && data.paymentUrl) {
        await Linking.openURL(data.paymentUrl)
        Alert.alert(
          'Payment Processing',
          'Complete your payment in the browser. Your wallet will be updated automatically after confirmation.',
          [{ text: 'OK' }]
        )
      } else if (data.code === 'PAYHERE_NOT_CONFIGURED') {
        Alert.alert(
          'Payment Gateway Setup',
          'Online payments are being configured. Please use Direct Bank Transfer for now.',
          [{
            text: 'OK',
            onPress: () => {
              setMethod('bank_transfer')
              setShowBank(true)
            },
          }]
        )
      } else {
        Alert.alert('Error', data.error || 'Failed to initiate payment')
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to initiate payment')
    } finally {
      setLoading(false)
    }
  }

  const numAmt = parseFloat(amount) || 0

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.section}>
          <Text style={styles.sLabel}>Select Amount ({currency})</Text>
          <View style={styles.presets}>
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.preset, amount === String(p) && styles.presetOn]}
                onPress={() => setAmount(String(p))}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetTxt, amount === String(p) && styles.presetTxtOn]}>
                  {p.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sLabel}>Or enter custom amount</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sLabel}>Payment Method</Text>
          {METHODS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.methodCard, method === m.id && styles.methodOn]}
              onPress={() => setMethod(m.id)}
              activeOpacity={0.8}
            >
              <View style={styles.methodIcon}>
                <Ionicons name={m.icon as any} size={20} color={colors.amberDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodLbl}>{m.label}</Text>
                <Text style={styles.methodSub}>{m.sub}</Text>
              </View>
              <Text style={[styles.badge, { backgroundColor: m.badgeColor + '20', color: m.badgeColor }]}>
                {m.badge}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, (loading || !amount) && { opacity: 0.5 }]}
            onPress={handleTopUp}
            disabled={loading || !amount}
            activeOpacity={0.8}
          >
            <Ionicons name="lock-closed-outline" size={18} color="#111827" />
            <Text style={styles.btnTxt}>
              {loading ? 'Processing...' : `Add ${formatCurrency(BigInt(Math.round(numAmt * 100)), currency)} to Wallet`}
            </Text>
          </TouchableOpacity>
          <Text style={styles.feeNote}>
            Your money is secured. We never share your payment details.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={showBank} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }}>
          <View style={styles.bankModal}>
            <Text style={{ fontSize: 16, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 4 }}>
              Bank Transfer Details
            </Text>
            <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginBottom: 16 }}>
              Transfer {formatCurrency(BigInt(Math.round(numAmt * 100)), currency)} to this account and use your phone number as reference.
            </Text>
            {[
              ['Bank', "People's Bank"],
              ['Branch', 'Jaffna'],
              ['Account Name', 'MΛINTΛINEX (Pvt) Ltd'],
              ['Account No.', '123-456-789'],
              ['Reference', 'Your registered phone number'],
            ].map(([l, v]) => (
              <View key={l} style={styles.bankRow}>
                <Text style={styles.bankLabel}>{l}</Text>
                <Text style={styles.bankVal}>{v}</Text>
              </View>
            ))}
            <TouchableOpacity style={[styles.btn, { marginTop: 16 }]} onPress={() => setShowBank(false)} activeOpacity={0.8}>
              <Text style={styles.btnTxt}>Done — I've transferred</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sLabel: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  presetOn: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  presetTxt: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },
  presetTxtOn: { color: colors.amberDark },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 14, fontSize: 22, fontFamily: fonts.heading, color: colors.ink, backgroundColor: colors.white, letterSpacing: -0.5 },
  methodCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, borderWidth: 1.5, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  methodOn: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  methodIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface || colors.cream, justifyContent: 'center', alignItems: 'center' },
  methodLbl: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },
  methodSub: { fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginTop: 1 },
  badge: { fontSize: 9, fontFamily: fonts.bodyMedium, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, overflow: 'hidden', textTransform: 'uppercase', letterSpacing: 0.5 },
  footer: { margin: 16 },
  btn: { backgroundColor: colors.amber, borderRadius: 14, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  btnTxt: { fontSize: 15, fontFamily: fonts.headingBold, color: '#111827' },
  feeNote: { fontSize: 11, fontFamily: fonts.body, color: colors.muted, textAlign: 'center', marginTop: 10 },
  bankModal: { backgroundColor: colors.white, margin: 24, borderRadius: 18, padding: 20 },
  bankRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: colors.border },
  bankLabel: { fontSize: 12, fontFamily: fonts.body, color: colors.muted },
  bankVal: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.ink },
})
