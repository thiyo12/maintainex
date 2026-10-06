import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PlusCircle, Receipt, ArrowDownLeft, ArrowCircleUp, TrendDown, ArrowRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { fonts } from '@/lib/fonts'
import { v2Wallet } from '@/api/v2-wallet'
import { formatCurrency, getCurrencyForCountry } from '@/lib/currency-format'
import { Currency } from '@/lib/money'
import { useCountry } from '@/lib/country'
import { v3 } from '@/theme/v3/tokens'

const TX_ICONS: Record<string, { icon: any; bg: string; fg: string }> = {
  ESCROW_RELEASE: { icon: ArrowDownLeft, bg: v3.colors.amberSoft, fg: v3.colors.amberDark },
  ESCROW_REFUND: { icon: ArrowRight, bg: v3.colors.infoSoft, fg: v3.colors.info },
  WITHDRAWAL: { icon: ArrowCircleUp, bg: v3.colors.infoSoft, fg: v3.colors.info },
  SERVICE_FEE: { icon: TrendDown, bg: v3.colors.errorSoft, fg: v3.colors.error },
}

const TX_LABELS: Record<string, string> = {
  ESCROW_RELEASE: 'Payment released from escrow',
  ESCROW_REFUND: 'Refund',
  WITHDRAWAL: 'Withdrawal',
  SERVICE_FEE: 'Service fee',
}

export default function CustomerWalletScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { selectedCountry } = useCountry()
  const currency: Currency = getCurrencyForCountry(selectedCountry?.code || 'LK')
  const [wallet, setWallet] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const fadeAnim = useState(new Animated.Value(0))[0]

  const fetchWallet = useCallback(async () => {
    try {
      const res = await v2Wallet.get('customer')
      setWallet(res.wallet)
      setTransactions(res.transactions || [])
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start()
    } catch (e) {
      console.error('Load wallet error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fadeAnim])

  useEffect(() => {
    fetchWallet()
  }, [fetchWallet])

  if (loading || !wallet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchWallet()
            }}
            tintColor={v3.colors.ink}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MX WALLET</Text>
          <Text style={styles.title}>Wallet</Text>
          <Text style={styles.subtitle}>Top up, track payments and refunds.</Text>
        </View>

        <Animated.View style={[styles.balanceCard, { opacity: fadeAnim }]}>
          <Text style={styles.balanceLabel}>Available balance</Text>
          <Text style={styles.balanceAmt}>{formatCurrency(BigInt(wallet.balance ?? 0), currency)}</Text>
          <Text style={styles.balanceCurr}>{currency}</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => router.push('/(customer)/wallet/topup')}
              activeOpacity={0.8}
            >
              <PlusCircle size={17} color={v3.colors.paper} weight="bold" />
              <Text style={styles.primaryActionText}>Add money</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Text style={styles.sectionTitle}>Transaction history</Text>

        {transactions.length === 0 ? (
          <View style={styles.emptyTx}>
            <View style={styles.emptyIcon}>
              <Receipt size={26} color={v3.colors.textMuted} weight="regular" />
            </View>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySub}>Your top ups, escrow payments and refunds will appear here.</Text>
          </View>
        ) : null}

        {transactions.map((tx: any) => {
          const txIcon = TX_ICONS[tx.referenceType as string] || {
            icon: ArrowRight,
            bg: v3.colors.surfaceGray,
            fg: v3.colors.textSecondary,
          }
          const TxIcon = txIcon.icon
          const isCredit = tx.type === 'CREDIT'
          return (
            <View key={tx.id} style={styles.txCard}>
              <View style={[styles.txIcon, { backgroundColor: txIcon.bg }]}>
                <TxIcon size={18} color={txIcon.fg} weight="bold" />
              </View>
              <View style={styles.txMain}>
                <Text style={styles.txTitle}>{TX_LABELS[tx.referenceType as string] || tx.referenceType || 'Wallet transaction'}</Text>
                <Text style={styles.txSub}>
                  {new Date(tx.createdAt).toLocaleDateString('en-LK', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={[styles.txAmt, { color: isCredit ? v3.colors.success : v3.colors.textPrimary }]}>
                {isCredit ? '+' : '-'}{formatCurrency(BigInt(tx.amount ?? 0), currency)}
              </Text>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  scroll: { paddingBottom: 32 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: v3.colors.textSecondary, fontFamily: fonts.body },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  eyebrow: {
    fontSize: 9,
    fontFamily: fonts.bodySemiBold,
    color: v3.colors.amberDark,
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  title: { fontSize: 28, fontFamily: fonts.heading, color: v3.colors.textPrimary },
  subtitle: { fontSize: 12, fontFamily: fonts.body, color: v3.colors.textSecondary, marginTop: 4 },
  balanceCard: {
    marginHorizontal: 18,
    borderRadius: v3.radius.xl,
    backgroundColor: v3.colors.ink,
    padding: 22,
    marginBottom: 26,
  },
  balanceLabel: {
    fontSize: 10,
    fontFamily: fonts.bodySemiBold,
    color: '#B9B9B9',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceAmt: {
    fontSize: 36,
    fontFamily: fonts.heading,
    color: v3.colors.paper,
    letterSpacing: -1,
    marginTop: 6,
  },
  balanceCurr: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: v3.colors.amber, marginTop: 2 },
  actionRow: { flexDirection: 'row', marginTop: 20 },
  primaryAction: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 18,
    backgroundColor: v3.colors.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryActionText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: v3.colors.ink },
  sectionTitle: {
    fontSize: 15,
    fontFamily: fonts.headingBold,
    color: v3.colors.textPrimary,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  txCard: {
    backgroundColor: v3.colors.paper,
    marginHorizontal: 18,
    marginBottom: 8,
    borderRadius: v3.radius.lg,
    borderWidth: 1,
    borderColor: v3.colors.line,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  txIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txMain: { flex: 1 },
  txTitle: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: v3.colors.textPrimary },
  txSub: { fontSize: 10.5, fontFamily: fonts.body, color: v3.colors.textMuted, marginTop: 2 },
  txAmt: { fontSize: 14, fontFamily: fonts.headingBold },
  emptyTx: { alignItems: 'center', paddingVertical: 42, paddingHorizontal: 36 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: v3.colors.surfaceGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontFamily: fonts.headingBold, color: v3.colors.textPrimary },
  emptySub: { fontSize: 11, fontFamily: fonts.body, color: v3.colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 17 },
})
