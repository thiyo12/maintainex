import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { v2Wallet } from '../../../lib/api-v2'

export default function CustomerWalletScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
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
      Alert.alert('Done!', `LKR ${amount} added to your wallet`)
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
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>LKR {wallet.balance?.toLocaleString() || '0'}</Text>
            <Text style={styles.balanceSub}>Secure funds for marketplace jobs</Text>
          </View>

          {/* Quick Top Up */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Top Up</Text>
            <View style={styles.quickRow}>
              {[500, 1000, 2000, 5000].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[styles.quickBtn, parseFloat(amount) === amt && styles.quickBtnSelected]}
                  onPress={() => setAmount(amt.toString())}
                >
                  <Text style={[styles.quickBtnText, parseFloat(amount) === amt && styles.quickBtnTextSelected]}>
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
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[styles.topUpBtn, submitting && styles.btnDisabled]}
              onPress={handleTopUp}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.topUpBtnText}>Add Funds</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Transactions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            {transactions.length === 0 ? (
              <View style={styles.emptyTx}>
                <Ionicons name="card-outline" size={36} color={colors.muted} />
                <Text style={styles.emptyTxText}>No transactions yet</Text>
              </View>
            ) : (
              transactions.map((tx) => (
                <View key={tx.id} style={styles.txCard}>
                  <View style={styles.txLeft}>
                    <View style={[styles.txIcon, tx.type === 'CREDIT' ? styles.txIconCredit : styles.txIconDebit]}>
                      <Text style={styles.txIconText}>{tx.type === 'CREDIT' ? '↓' : '↑'}</Text>
                    </View>
                    <View>
                      <Text style={styles.txType}>{tx.type === 'CREDIT' ? 'Deposit' : 'Payment'}</Text>
                      <Text style={styles.txRef}>{tx.reference}</Text>
                      <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <Text style={[styles.txAmount, tx.type === 'CREDIT' ? styles.credit : styles.debit]}>
                    {tx.type === 'CREDIT' ? '+' : '-'} LKR {tx.amount}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scroll: { flex: 1 },
  balanceCard: { backgroundColor: colors.amber, marginHorizontal: 20, marginTop: 20, borderRadius: 20, padding: 28, alignItems: 'center', shadowColor: colors.amber, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 },
  balanceLabel: { fontSize: 13, color: colors.ink, opacity: 0.7, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  balanceAmount: { fontSize: 40, fontWeight: '800', color: colors.ink, marginTop: 8, marginBottom: 4 },
  balanceSub: { fontSize: 12, color: colors.ink, opacity: 0.6 },

  section: { padding: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 14 },

  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  quickBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  quickBtnSelected: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  quickBtnText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  quickBtnTextSelected: { color: colors.amberDark },

  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 15, color: colors.ink, backgroundColor: colors.white, marginBottom: 12 },
  topUpBtn: { backgroundColor: colors.amber, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  topUpBtnText: { fontSize: 16, fontWeight: '700', color: colors.ink },

  emptyTx: { alignItems: 'center', paddingVertical: 30 },
  emptyTxIcon: { fontSize: 36, marginBottom: 8 },
  emptyTxText: { fontSize: 14, color: colors.muted },

  txCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: colors.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  txLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  txIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txIconCredit: { backgroundColor: '#D1FAE5' },
  txIconDebit: { backgroundColor: '#FEE2E2' },
  txIconText: { fontSize: 16, fontWeight: '800' },
  txType: { fontSize: 14, fontWeight: '600', color: colors.ink },
  txRef: { fontSize: 12, color: colors.muted, marginTop: 2 },
  txDate: { fontSize: 11, color: colors.muted, marginTop: 1 },
  txAmount: { fontSize: 16, fontWeight: '700' },
  credit: { color: colors.success },
  debit: { color: colors.error },
})
