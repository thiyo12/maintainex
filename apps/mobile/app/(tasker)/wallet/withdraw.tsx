import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Building, DeviceMobile, Globe, CaretLeft, ShieldCheck } from 'phosphor-react-native'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { v2Wallet } from '../../../lib/api-v2'
import { formatCurrency, getCurrencyForCountry } from '../../../lib/currency-format'
import { Currency } from '../../../lib/money'
import { useCountry } from '../../../lib/country'
import { useRouter } from 'expo-router'
import { v3 } from '../../../theme/v3/tokens'

const METHODS = [
  { id: 'bank_transfer', label: 'Bank Transfer', sub: '2-3 business days', Icon: Building },
  { id: 'ez_cash', label: 'eZ Cash', sub: 'Instant', Icon: DeviceMobile },
  { id: 'dialog_genie', label: 'Dialog Genie', sub: 'Instant', Icon: DeviceMobile },
  { id: 'paypal', label: 'PayPal', sub: '1-2 business days', Icon: Globe },
]

export default function WithdrawScreen() {
  const router = useRouter()
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.72} onPress={() => router.back()}>
          <CaretLeft size={17} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Withdraw earnings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>AVAILABLE</Text>
        <Text style={styles.balance}>{formatCurrency(BigInt(Math.round(available)), currency)}</Text>
        <Text style={styles.balanceSub}>Ready for payout</Text>

        <Text style={styles.sectionLabel}>AMOUNT</Text>
        <View style={styles.amountCard}>
          <Text style={styles.currencyText}>{currency}</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={v3.colors.textPlaceholder}
            keyboardType="decimal-pad"
          />
        </View>
        <Text style={styles.hint}>Minimum {formatCurrency(BigInt(50000), currency)} · payout timing depends on the selected method.</Text>

        <Text style={styles.sectionLabel}>PAYOUT METHOD</Text>
        <View style={styles.methodList}>
          {METHODS.map((item) => {
            const selected = method === item.id
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.methodRow, selected && styles.methodRowSelected]}
                activeOpacity={0.72}
                onPress={() => setMethod(item.id)}
              >
                <View style={styles.methodIcon}><item.Icon size={18} color={v3.colors.ink} weight="bold" /></View>
                <View style={styles.methodCopy}>
                  <Text style={styles.methodTitle}>{item.label}</Text>
                  <Text style={styles.methodSub}>{item.sub}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioInner} /> : null}</View>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <ShieldCheck size={16} color={v3.colors.success} weight="fill" />
            <Text style={styles.summaryTitle}>Payout summary</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount</Text>
            <Text style={styles.summaryValue}>{formatCurrency(BigInt(Math.round(numAmt * 100)), currency)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Method</Text>
            <Text style={styles.summaryValue}>{METHODS.find((item) => item.id === method)?.label || 'Bank Transfer'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Remaining balance</Text>
            <Text style={styles.summaryValue}>{formatCurrency(BigInt(Math.max(0, Math.round(available - numAmt))), currency)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.withdrawButton, (loading || !amount || numAmt < 500 || numAmt > available) && styles.disabled]}
          activeOpacity={0.78}
          onPress={handleWithdraw}
          disabled={loading || !amount || numAmt < 500 || numAmt > available}
        >
          <Text style={styles.withdrawText}>{loading ? 'Processing…' : 'Withdraw'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (_colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  topBar: { height: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 38, height: 38 },
  topTitle: { fontSize: 14, fontFamily: fonts.headingBold, color: v3.colors.ink },
  content: { paddingHorizontal: 20, paddingBottom: 34 },
  eyebrow: { marginTop: 10, fontSize: 9, letterSpacing: 0.7, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  balance: { marginTop: 5, fontSize: 32, lineHeight: 38, fontFamily: fonts.heading, color: v3.colors.ink, letterSpacing: -0.5 },
  balanceSub: { marginTop: 3, fontSize: 10, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  sectionLabel: { marginTop: 25, marginBottom: 8, fontSize: 9, letterSpacing: 0.6, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  amountCard: { height: 70, borderRadius: 18, paddingHorizontal: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  currencyText: { fontSize: 12, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  amountInput: { flex: 1, marginLeft: 8, padding: 0, fontSize: 28, fontFamily: fonts.heading, color: v3.colors.ink },
  hint: { marginTop: 6, fontSize: 8.5, lineHeight: 13, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  methodList: { gap: 8 },
  methodRow: { minHeight: 62, paddingHorizontal: 12, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  methodRowSelected: { borderColor: v3.colors.ink },
  methodIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  methodCopy: { flex: 1, marginLeft: 10 },
  methodTitle: { fontSize: 10.8, fontFamily: fonts.headingBold, color: v3.colors.ink },
  methodSub: { marginTop: 2, fontSize: 8.5, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#C7C7C7', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: v3.colors.ink },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: v3.colors.ink },
  summaryCard: { marginTop: 24, borderRadius: 18, padding: 15, backgroundColor: v3.colors.ink },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  summaryTitle: { fontSize: 10.5, fontFamily: fonts.headingBold, color: v3.colors.paper },
  summaryRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#333333' },
  summaryLabel: { fontSize: 8.8, fontFamily: fonts.bodySemiBold, color: '#CFCFCF' },
  summaryValue: { maxWidth: '58%', fontSize: 9.5, fontFamily: fonts.headingBold, color: v3.colors.paper, textAlign: 'right' },
  withdrawButton: { height: 54, marginTop: 24, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  withdrawText: { fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.paper },
})
