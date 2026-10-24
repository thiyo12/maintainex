import { useState } from 'react'
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { v2JobActions } from '@/api/v2-jobs'
import { useColors } from '@/lib/ThemeContext'

type Props = {
  jobId: string
  role: 'customer' | 'provider'
  jobStatus: string
  escrow: {
    paymentMethod?: string
    currency?: string
    totalAmount?: number
    cashCollectionStatus?: string
    cashCollectedMinor?: string | null
  } | null
  onUpdated: () => void
}

const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, {
  style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: 2,
}).format(value)

export default function CashCollectionPanel({ jobId, role, jobStatus, escrow, onUpdated }: Props) {
  const colors = useColors()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const currency = escrow?.currency || 'LKR'
  const status = escrow?.cashCollectionStatus || 'NOT_REPORTED'
  if (escrow?.paymentMethod !== 'CASH' || !['IN_PROGRESS', 'COMPLETED'].includes(jobStatus)) return null

  const submit = async (action: 'REPORT' | 'CONFIRM' | 'CONTEST') => {
    setBusy(true)
    setError('')
    try {
      let amountMinor: string | undefined
      if (action === 'REPORT') {
        const normalized = amount.trim().replace(',', '.')
        if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(normalized)) {
          setError('Enter the cash actually collected, with up to two decimal places.')
          return
        }
        const [whole, fraction = ''] = normalized.split('.')
        amountMinor = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))).toString()
        if (Number(amountMinor) / 100 > (escrow.totalAmount || 0)) {
          setError('Reported cash cannot exceed the accepted invoice total.')
          return
        }
      }
      await v2JobActions.cashCollection(jobId, action, amountMinor)
      setAmount('')
      onUpdated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update cash collection.')
    } finally {
      setBusy(false)
    }
  }

  const reported = escrow?.cashCollectedMinor == null ? null : Number(escrow.cashCollectedMinor) / 100
  const statusText: Record<string, string> = {
    NOT_REPORTED: 'Cash collection has not been reported.',
    PROVIDER_REPORTED: 'Provider reported cash received. Waiting for your confirmation.',
    CUSTOMER_CONFIRMED: 'Cash total confirmed by the customer. Later collections can be reported as a new cumulative total.',
    CONTESTED: 'Cash amount is contested. No commission has been recorded.',
  }

  return (
    <View accessibilityRole="summary" style={{ backgroundColor: colors.surfaceHigh, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16, marginVertical: 10, gap: 10 }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Cash collection · {currency}</Text>
      <Text style={{ color: colors.textSecondary || colors.text, fontSize: 14 }}>{statusText[status] || 'Cash collection status needs review.'}</Text>
      {reported !== null && <Text style={{ color: colors.text, fontSize: 15 }}>Reported: {money(reported, currency)}</Text>}
      {role === 'provider' && ['NOT_REPORTED', 'PROVIDER_REPORTED', 'CUSTOMER_CONFIRMED', 'CONTESTED'].includes(status) && (
        <>
          <Text style={{ color: colors.textSecondary || colors.text, fontSize: 13 }}>Enter the cumulative cash received to date, including earlier collections. Use 0 if no cash was collected. This report alone does not confirm payment.</Text>
          <TextInput
            accessibilityLabel={`Cash collected in ${currency}`}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            placeholder={`Amount in ${currency}`}
            placeholderTextColor={colors.textSecondary || '#777'}
            style={{ color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 9, padding: 12, fontSize: 16 }}
          />
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => submit('REPORT')} style={{ backgroundColor: colors.primary, borderRadius: 9, padding: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Report cash collected</Text>}
          </TouchableOpacity>
        </>
      )}
      {role === 'customer' && status === 'PROVIDER_REPORTED' && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => submit('CONFIRM')} style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 9, padding: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Confirm amount</Text>}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => submit('CONTEST')} style={{ flex: 1, borderColor: colors.error, borderWidth: 1, borderRadius: 9, padding: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.error, fontWeight: '700' }}>Contest</Text>
          </TouchableOpacity>
        </View>
      )}
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 13 }}>{error}</Text>}
    </View>
  )
}
