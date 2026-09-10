import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { v2Wallet } from '../../../lib/api-v2'
import { formatCurrency, getCurrencyForCountry } from '../../../lib/currency-format'
import { Currency } from '../../../lib/money'
import { useCountry } from '../../../lib/country'

const METHODS = [
  { id: 'bank_transfer', label: 'Bank Transfer', sub: '2-3 business days', icon: 'business-outline' },
  { id: 'ez_cash', label: 'eZ Cash', sub: 'Instant', icon: 'phone-portrait-outline' },
  { id: 'dialog_genie', label: 'Dialog Genie', sub: 'Instant', icon: 'phone-portrait-outline' },
  { id: 'paypal', label: 'PayPal', sub: '1-2 business days', icon: 'globe-outline' },
]

export default function WithdrawScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const { selectedCountry } = useCountry()
  const currency: Currency = getCurrencyForCountry(selectedCountry?.code || 'LK')
  const [wallet, setWallet] = useState<any>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('bank_transfer')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    v2Wallet.get('provider').then(r => setWallet(r.wallet)).catch(() => {})
  }, [])

  const handleWithdraw = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt < 500) { Alert.alert(`Minimum withdrawal is ${formatCurrency(BigInt(50000), currency)}`); return }
    if (!wallet || amt > (wallet.availableBalance || 0)) { Alert.alert('Insufficient balance'); return }
    setLoading(true)
    try {
      await v2Wallet.withdrawPayout(amt)
      Alert.alert('Withdrawal Requested', 'Your payout will be processed within 24 hours.', [
        { text: 'OK', onPress: () => setAmount('') },
      ])
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Withdrawal failed')
    } finally {
      setLoading(false)
    }
  }

  const available = wallet?.availableBalance || 0
  const numAmt = parseFloat(amount) || 0

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmt}>{formatCurrency(BigInt(available), currency)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Amount to withdraw ({currency})</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
          />
          <Text style={styles.hint}>Minimum {formatCurrency(BigInt(50000), currency)} • Estimated 24 hours</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Payout Method</Text>
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
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ margin: 16 }}>
          <TouchableOpacity
            style={[styles.btn, (loading || !amount || numAmt < 500 || numAmt > available) && { opacity: 0.5 }]}
            onPress={handleWithdraw}
            disabled={loading || !amount || numAmt < 500 || numAmt > available}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up-circle-outline" size={18} color="#111827" />
            <Text style={styles.btnTxt}>
              {loading ? 'Processing...' : `Withdraw ${formatCurrency(BigInt(Math.round(numAmt * 100)), currency)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  balanceCard: { backgroundColor: '#0D0D0D', margin: 16, borderRadius: 22, padding: 24, alignItems: 'center' },
  balanceLabel: { fontSize: 11, fontFamily: fonts.bodyMedium, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1 },
  balanceAmt: { fontSize: 38, fontFamily: fonts.heading, color: '#FFFFFF', letterSpacing: -1, marginTop: 4 },
  section: { marginHorizontal: 16, marginBottom: 20 },
  label: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 14, fontSize: 22, fontFamily: fonts.heading, color: colors.ink, backgroundColor: colors.white, letterSpacing: -0.5 },
  hint: { fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginTop: 6 },
  methodCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, borderWidth: 1.5, borderColor: colors.border },
  methodOn: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  methodIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface || colors.cream, justifyContent: 'center', alignItems: 'center' },
  methodLbl: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },
  methodSub: { fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginTop: 1 },
  btn: { backgroundColor: colors.amber, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  btnTxt: { fontSize: 15, fontFamily: fonts.headingBold, color: '#111827' },
})
