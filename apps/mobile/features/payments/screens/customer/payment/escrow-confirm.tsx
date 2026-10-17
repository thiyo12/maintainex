import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { CaretLeft, Lock, ShieldCheck } from 'phosphor-react-native'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { v2JobActions, v2Jobs } from '@/api/v2-jobs'
import type { V2Quote } from '@/api/v2-types'
import { currencyForJobCountry, quoteMatchesJobCurrency } from '@/lib/market-currency'

export default function EscrowConfirmScreen() {
  const colors = useColors()
  const router = useRouter()
  const params = useLocalSearchParams<{
    bookingId: string; jobTitle: string; taskerName: string;
    quotedAmount: string; currency?: string; quoteId?: string
  }>()
  const { bookingId, quoteId } = params
  const [loading, setLoading] = useState(false)
  const [quote, setQuote] = useState<V2Quote | null>(null)
  const [jobTitle, setJobTitle] = useState('')
  const [currency, setCurrency] = useState<'LKR' | 'CAD' | null>(null)
  const [readState, setReadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const styles = makeStyles(colors)

  // Navigation params are not financial evidence. Reload canonical job/quote.
  useEffect(() => {
    let alive = true
    setReadState('loading')
    setQuote(null)
    setCurrency(null)
    if (!bookingId || !quoteId) {
      setReadState('error')
      return
    }
    v2Jobs.get(bookingId)
      .then(({ job }) => {
        if (!alive) return
        const selected = job.quotes?.find(item => item.id === quoteId && item.status === 'PENDING')
        const marketCurrency = currencyForJobCountry(job.countryCode)
        if (!selected || !marketCurrency ||
            !quoteMatchesJobCurrency(job.countryCode, selected.currency)) {
          setReadState('error')
          return
        }
        setQuote(selected)
        setCurrency(marketCurrency)
        setJobTitle(job.title)
        setReadState('ready')
      })
      .catch(() => { if (alive) setReadState('error') })
    return () => { alive = false }
  }, [bookingId, quoteId])

  const handleConfirm = async () => {
    if (loading || readState !== 'ready' || !quote || !currency || !quoteId) return
    setLoading(true)
    try {
      // Prevent stale navigation prices; server still owns final concurrency.
      const latest = await v2Jobs.get(bookingId)
      const stillPending = latest.job.quotes?.find(
        item => item.id === quoteId && item.status === 'PENDING'
      )
      if (!stillPending || !quoteMatchesJobCurrency(latest.job.countryCode, stillPending.currency) ||
          stillPending.currency !== currency || stillPending.price !== quote.price) {
        throw new Error('Quote has changed. Return to the booking to review the latest quote.')
      }
      await v2JobActions.selectQuote(bookingId, quoteId)
      // Canonical confirmation screen presents actual payment methods and fees.
      // Quote acceptance itself never funds an escrow or charges the user.
      router.replace('/(customer)/jobs/v2/confirm/' + bookingId)
    } catch (e: any) {
      Alert.alert('Could not accept quote', e?.message || 'Review the current quote and retry.')
    } finally {
      setLoading(false)
    }
  }

  const amount = quote?.price ?? 0
  const ready = readState === 'ready' && !!quote && !!currency

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} style={styles.backBtn}>
          <CaretLeft size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Quote</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.lockBox}>
        <Lock size={32} color={colors.amberDark} />
      </View>
      <Text style={styles.htitle}>Confirm Your Provider Quote</Text>
      <Text style={styles.hsub}>
        Accept the provider's quote first. The next screen shows approved
        payment methods and actual charges for this booking.
        Cash is paid directly to the provider and is not held by MaintainEX.
      </Text>

      {ready ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Provider quote — before applicable charges</Text>
          <View style={[styles.row, { borderTopWidth: 0 }]}>
            <Text style={styles.rowL}>Job</Text>
            <Text style={styles.rowV}>{jobTitle}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowL}>Provider</Text>
            <Text style={styles.rowV}>{quote?.provider?.name || 'Selected provider'}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalL}>Provider quote</Text>
            <Text style={styles.totalV}>{currency} {amount.toLocaleString()}</Text>
          </View>
          <Text style={[styles.rowL, { marginTop: 12 }]}>
            Applicable fees and payment terms are shown on the next screen.
            No funds are held at this stage.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {readState === 'loading' ? 'Loading current quote...' :
              'Quote unavailable, changed or in a different currency'}
          </Text>
          <Text style={styles.rowL}>
            Return to the booking to review the current verified quote.
            No payment has been initiated.
          </Text>
        </View>
      )}

      <View style={styles.trustRow}>
        <ShieldCheck size={18} color="#06C167" />
        <Text style={styles.trustTxt}>
          Quote acceptance is separate from payment. MaintainEX shows available
          payment methods before any funding action.
        </Text>
      </View>

      {ready ? (
        <TouchableOpacity accessibilityRole="button"
          style={styles.btn} onPress={handleConfirm} disabled={loading} activeOpacity={0.8}>
          <Text style={styles.btnTxt}>
            {loading ? 'Accepting quote...' : 'Accept Quote & Review Payment Options'}
          </Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity accessibilityRole="button" style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelTxt}>Go back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: fonts.headingBold, color: colors.ink },
  lockBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.amberBg, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginTop: 8, marginBottom: 12, shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 5 },
  htitle: { fontSize: 20, fontFamily: fonts.heading, color: colors.ink, letterSpacing: -0.4, marginBottom: 6, textAlign: 'center' },
  hsub: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8, marginBottom: 20 },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 4 },
  cardTitle: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: colors.border },
  rowL: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, flex: 1 },
  rowV: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4, borderTopWidth: 1.5, borderTopColor: colors.border },
  totalL: { fontSize: 15, fontFamily: fonts.headingBold, color: colors.ink },
  totalV: { fontSize: 20, fontFamily: fonts.heading, color: colors.amberDark, letterSpacing: -0.5 },
  trustRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.successBg, borderRadius: 12, padding: 12, marginBottom: 12 },
  trustTxt: { fontSize: 12, fontFamily: fonts.body, color: '#06C167', flex: 1, lineHeight: 18 },
  btn: { backgroundColor: colors.amber, borderRadius: 14, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  btnTxt: { fontSize: 15, fontFamily: fonts.headingBold, color: '#111827' },
  cancelBtn: { alignItems: 'center', marginTop: 12, padding: 12 },
  cancelTxt: { fontSize: 13, fontFamily: fonts.body, color: colors.muted },
})
