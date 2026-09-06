import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { fonts } from '../../../lib/fonts'
import { v2Wallet } from '../../../lib/api-v2'

const TX_ICONS: Record<string, { name: string; bg: string }> = {
  ESCROW_RELEASE:  { name: 'lock-closed-outline', bg: '#FEF3C7' },
  ESCROW_REFUND:   { name: 'return-down-back-outline', bg: '#DBEAFE' },
  WITHDRAWAL:      { name: 'arrow-up-circle-outline', bg: '#DBEAFE' },
  SERVICE_FEE:     { name: 'trending-down-outline', bg: '#FEE2E2' },
}

const TX_LABELS: Record<string, string> = {
  ESCROW_RELEASE: 'Payment Released from Escrow',
  ESCROW_REFUND: 'Refund',
  WITHDRAWAL: 'Withdrawal',
  SERVICE_FEE: 'Service Fee',
}

export default function CustomerWalletScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const router = useRouter()
  const [wallet, setWallet] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const fadeAnim = useState(new Animated.Value(0))[0]

  const fetchWallet = useCallback(async () => {
    try {
      const res = await v2Wallet.get('customer')
      setWallet(res.wallet)
      setTransactions(res.transactions)
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 500, useNativeDriver: true,
      }).start()
    } catch (e) {
      console.error('Load wallet error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchWallet() }, [])

  const styles = makeStyles(colors)

  if (loading || !wallet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.muted, fontFamily: fonts.body }}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWallet() }} tintColor={colors.amber} />
        }
      >
        <Animated.View style={[styles.balanceCard, { opacity: fadeAnim }]}>
          <View style={styles.balanceBg}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmt}>
              {(wallet.balance ?? 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.balanceCurr}>{wallet.currency || 'LKR'}</Text>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.addBtn]} onPress={() => router.push('/(customer)/wallet/topup')} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={16} color="#111827" />
              <Text style={styles.addTxt}>Add Money</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.withdrawBtn]}
              onPress={() => router.push('/(tasker)/wallet/withdraw' as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.withdrawTxt}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Text style={styles.sectionTitle}>Transaction History</Text>

        {transactions.length === 0 && (
          <View style={styles.emptyTx}>
            <Ionicons name="receipt-outline" size={40} color={colors.muted} />
            <Text style={{ color: colors.muted, fontFamily: fonts.body, marginTop: 12 }}>
              No transactions yet
            </Text>
          </View>
        )}

        {transactions.map((tx: any) => {
          const icon = TX_ICONS[tx.referenceType as string] || { name: 'swap-horizontal-outline', bg: colors.surface || colors.amberBg }
          return (
            <View key={tx.id} style={styles.txCard}>
              <View style={[styles.txIcon, { backgroundColor: icon.bg }]}>
                <Ionicons name={icon.name as any} size={18} color={colors.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txTitle}>{TX_LABELS[tx.referenceType as string] || tx.referenceType}</Text>
                <Text style={styles.txSub}>
                  {new Date(tx.createdAt).toLocaleDateString('en-LK', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={[styles.txAmt, { color: tx.type === 'CREDIT' ? '#22C55E' : colors.ink }]}>
                {tx.type === 'CREDIT' ? '+' : '-'}LKR {tx.amount.toLocaleString()}
              </Text>
            </View>
          )
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  balanceCard: {
    margin: 16, borderRadius: 22, overflow: 'hidden',
    backgroundColor: '#0D0D0D',
    shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  balanceBg: { padding: 24 },
  balanceLabel: {
    fontSize: 11, fontFamily: fonts.bodyMedium,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  balanceAmt: {
    fontSize: 38, fontFamily: fonts.heading,
    color: '#FFFFFF', letterSpacing: -1, marginVertical: 4,
  },
  balanceCurr: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.amber },
  escrowRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 4, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  escrowTxt: { fontSize: 12, fontFamily: fonts.body, color: 'rgba(255,255,255,0.4)' },
  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingBottom: 20 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 12,
  },
  addBtn: { backgroundColor: colors.amber },
  withdrawBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  addTxt: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#111827' },
  withdrawTxt: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
  sectionTitle: {
    fontSize: 14, fontFamily: fonts.headingBold,
    color: colors.ink, paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 10,
  },
  txCard: {
    backgroundColor: colors.white, marginHorizontal: 16,
    marginBottom: 8, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  txIcon: {
    width: 38, height: 38, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  txTitle: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },
  txSub: { fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginTop: 1 },
  txAmt: { fontSize: 15, fontFamily: fonts.heading, letterSpacing: -0.3 },
  emptyTx: { alignItems: 'center', paddingVertical: 40 },
})
