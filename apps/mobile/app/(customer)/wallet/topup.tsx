import { useState } from 'react'
import {
  ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CreditCard, LockSimple, Plus } from 'phosphor-react-native'

import { v2Wallet } from '../../../lib/api-v2'
import { v3 } from '../../../theme/v3/tokens'
import V3PageHeader from '../../../components/v3/V3PageHeader'

const PRESETS = [500, 1000, 2500, 5000, 10000, 25000]

export default function TopUpScreen() {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const topUp = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 100) {
      Alert.alert('Check amount', 'Enter at least LKR 100.')
      return
    }

    setLoading(true)
    try {
      const response = await v2Wallet.topUp(value)
      if (response.paymentUrl) {
        await Linking.openURL(response.paymentUrl)
        Alert.alert('Payment opened', 'Complete the payment securely, then return to MaintainEX.')
        return
      }
      Alert.alert(
        'Online top up unavailable',
        'The payment gateway has not returned a checkout link. No money was taken.'
      )
    } catch (error: any) {
      let message = error?.message || 'Could not start the top up.'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Could not top up', message)
    } finally {
      setLoading(false)
    }
  }

  const value = Number(amount) || 0

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="Add money" subtitle="Top up MX Wallet through the connected payment provider." />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.amountCard}>
          <Text style={styles.eyebrow}>AMOUNT</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>LKR</Text>
            <TextInput
              value={amount}
              onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              placeholderTextColor="#A7A7A7"
              keyboardType="decimal-pad"
              style={styles.amountInput}
            />
          </View>
        </View>

        <Text style={styles.section}>QUICK AMOUNTS</Text>
        <View style={styles.presets}>
          {PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset}
              activeOpacity={0.75}
              onPress={() => setAmount(String(preset))}
              style={[styles.preset, amount === String(preset) && styles.presetActive]}
            >
              <Text style={[styles.presetText, amount === String(preset) && styles.presetTextActive]}>
                {preset.toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.providerCard}>
          <View style={styles.providerIcon}><CreditCard size={20} color={v3.colors.ink} weight="fill" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.providerTitle}>Secure online checkout</Text>
            <Text style={styles.providerText}>Available methods are shown by the connected payment provider at checkout.</Text>
          </View>
        </View>

        <View style={styles.protection}>
          <LockSimple size={17} color={v3.colors.success} weight="fill" />
          <Text style={styles.protectionText}>No card or bank details are stored on this screen.</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.82}
          disabled={loading || value < 100}
          onPress={topUp}
          style={[styles.primary, (loading || value < 100) && styles.disabled]}
        >
          {loading ? <ActivityIndicator color={v3.colors.paper} /> : (
            <>
              <Plus size={18} color={v3.colors.paper} weight="bold" />
              <Text style={styles.primaryText}>
                {value >= 100 ? `Add LKR ${value.toLocaleString()}` : 'Enter an amount'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  amountCard: { padding: 18, borderRadius: 20, backgroundColor: v3.colors.ink },
  eyebrow: { fontFamily: 'Outfit_800ExtraBold', fontSize: 9.5, color: '#AFAFAF', letterSpacing: 1 },
  amountRow: { marginTop: 8, flexDirection: 'row', alignItems: 'baseline' },
  currency: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: v3.colors.amber, marginRight: 10 },
  amountInput: { flex: 1, padding: 0, fontFamily: 'Outfit_900Black', fontSize: 38, color: v3.colors.paper },
  section: { marginTop: 20, marginBottom: 9, fontFamily: 'Outfit_800ExtraBold', fontSize: 10, color: v3.colors.textMuted, letterSpacing: 0.8 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { minWidth: 92, height: 42, borderRadius: 12, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  presetActive: { backgroundColor: v3.colors.amberSoft, borderColor: '#F2D08C' },
  presetText: { fontFamily: 'Outfit_700Bold', fontSize: 12, color: v3.colors.ink },
  presetTextActive: { color: v3.colors.amberDark },
  providerCard: { marginTop: 20, minHeight: 78, padding: 14, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  providerIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: v3.colors.amberSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  providerTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 13.5, color: v3.colors.ink },
  providerText: { marginTop: 2, fontFamily: 'Outfit_400Regular', fontSize: 10.5, lineHeight: 15, color: v3.colors.textSecondary },
  protection: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: v3.colors.successSoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
  protectionText: { flex: 1, fontFamily: 'Outfit_500Medium', fontSize: 11, color: v3.colors.textSecondary },
  primary: { marginTop: 20, height: 56, borderRadius: 16, backgroundColor: v3.colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  disabled: { opacity: 0.35 },
  primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: v3.colors.paper },
})
