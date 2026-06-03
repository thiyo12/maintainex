import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../../lib/colors'
import { v2Wallet } from '../../../lib/api-v2'

export default function CustomerWalletScreen() {
  const [wallet, setWallet] = useState<any>({ balance: 0 })
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadWallet() }, [])

  const loadWallet = async () => {
    try {
      const res = await v2Wallet.get('customer')
      setWallet(res.wallet)
      setTransactions(res.transactions)
    } catch (e) {
      console.error('Load wallet error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleTopUp = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Enter a valid amount')
      return
    }
    setSubmitting(true)
    try {
      const res = await v2Wallet.topUp(parseFloat(amount))
      setWallet({ ...wallet, balance: res.balance })
      setAmount('')
      Alert.alert('Success', `Added LKR ${amount} to wallet`)
      loadWallet()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>LKR {wallet.balance?.toLocaleString() || '0'}</Text>
          </View>

          <Text style={styles.sectionTitle}>Top Up Wallet</Text>
          <View style={styles.topUpRow}>
            {[500, 1000, 2000, 5000].map((amt) => (
              <TouchableOpacity
                key={amt}
                style={[styles.quickAmt, parseFloat(amount) === amt && styles.quickAmtSelected]}
                onPress={() => setAmount(amt.toString())}
              >
                <Text style={[styles.quickAmtText, parseFloat(amount) === amt && styles.quickAmtTextSelected]}>
                  LKR {amt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="Custom amount"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={[styles.topUpBtn, submitting && styles.topUpBtnDisabled]}
            onPress={handleTopUp}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#1a1a1a" />
            ) : (
              <Text style={styles.topUpBtnText}>Add Funds</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Transactions</Text>
          {transactions.length === 0 ? (
            <Text style={styles.emptyText}>No transactions yet</Text>
          ) : (
            transactions.map((tx) => (
              <View key={tx.id} style={styles.txCard}>
                <View style={styles.txLeft}>
                  <Text style={styles.txType}>{tx.type === 'CREDIT' ? 'Deposit' : 'Payment'}</Text>
                  <Text style={styles.txRef}>{tx.reference}</Text>
                  <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.txAmount, tx.type === 'CREDIT' ? styles.credit : styles.debit]}>
                  {tx.type === 'CREDIT' ? '+' : '-'}LKR {tx.amount}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
  balanceCard: { backgroundColor: colors.primary, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24 },
  balanceLabel: { fontSize: 14, color: 'rgba(0,0,0,0.6)', marginBottom: 8 },
  balanceAmount: { fontSize: 36, fontWeight: '800', color: '#1a1a1a' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginTop: 20, marginBottom: 12 },
  topUpRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  quickAmt: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#e0e0e0', alignItems: 'center' },
  quickAmtSelected: { borderColor: colors.primary, backgroundColor: '#FFF8E1' },
  quickAmtText: { fontSize: 13, fontWeight: '600', color: '#666' },
  quickAmtTextSelected: { color: colors.primary },
  input: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, padding: 14, fontSize: 15, color: '#333', marginBottom: 12 },
  topUpBtn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  topUpBtnDisabled: { opacity: 0.6 },
  topUpBtnText: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 20 },
  txCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 10, padding: 14, marginBottom: 8 },
  txLeft: { flex: 1 },
  txType: { fontSize: 14, fontWeight: '600', color: '#333' },
  txRef: { fontSize: 12, color: '#999', marginTop: 2 },
  txDate: { fontSize: 11, color: '#bbb', marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '700' },
  credit: { color: '#10B981' },
  debit: { color: '#EF4444' },
})
