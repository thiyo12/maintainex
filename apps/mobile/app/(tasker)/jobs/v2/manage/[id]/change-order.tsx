import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretLeft, FileText, ShieldCheck } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../../../../../lib/fonts'
import { v2Jobs, v2ChangeOrder } from '../../../../../../lib/api-v2'
import { v3 } from '../../../../../../theme/v3/tokens'

export default function ChangeOrderScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reason, setReason] = useState('')
  const [scopeDelta, setScopeDelta] = useState('')
  const [priceAdjustment, setPriceAdjustment] = useState('')

  useEffect(() => {
    loadJob()
  }, [id])

  const loadJob = async () => {
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
    } catch {
      Alert.alert(t('common.error'), t('errors.jobNotFound'))
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!reason.trim()) {
      Alert.alert(t('common.error'), t('changeOrder.reasonRequired'))
      return
    }
    const adjustment = parseFloat(priceAdjustment)
    if (isNaN(adjustment) || adjustment === 0) {
      Alert.alert(t('common.error'), t('changeOrder.adjustmentRequired'))
      return
    }
    const acceptedQuote = job?.quotes?.find((q: any) => q.status === 'ACCEPTED')
    if (!acceptedQuote) {
      Alert.alert(t('common.error'), t('changeOrder.noAcceptedQuote'))
      return
    }
    setSubmitting(true)
    try {
      await v2ChangeOrder.create(id, {
        baseQuoteId: acceptedQuote.id,
        reason: reason.trim(),
        amountDeltaCents: Math.round(adjustment * 100),
        scopeDelta: scopeDelta.trim() || undefined,
        status: 'SUBMITTED',
      })
      Alert.alert(t('changeOrder.submitted'), t('changeOrder.submittedDesc'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('errors.generic'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loading}><ActivityIndicator size="small" color={v3.colors.ink} /></View>
      </SafeAreaView>
    )
  }

  const currentPrice = Number(job?.budgetAmount || 0)
  const adjustment = parseFloat(priceAdjustment) || 0
  const newPrice = currentPrice + adjustment

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.72} onPress={() => router.back()}>
          <CaretLeft size={17} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Change order</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.iconBox}><FileText size={23} color={v3.colors.ink} weight="bold" /></View>
        <Text style={styles.hero}>Request extra work</Text>
        <Text style={styles.subtitle}>Use a change order when the agreed job scope or price needs customer approval.</Text>

        <View style={styles.priceCard}>
          <View style={styles.priceLine}>
            <Text style={styles.priceLabel}>Current job value</Text>
            <Text style={styles.priceValue}>LKR {currentPrice.toLocaleString()}</Text>
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceLine}>
            <Text style={styles.priceLabel}>Added amount</Text>
            <Text style={[styles.priceValue, adjustment < 0 && { color: v3.colors.error }]}>
              {adjustment >= 0 ? '+' : ''}LKR {adjustment.toLocaleString()}
            </Text>
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceLine}>
            <Text style={styles.priceStrongLabel}>New total</Text>
            <Text style={styles.priceStrong}>LKR {newPrice.toLocaleString()}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>REASON</Text>
        <View style={styles.fieldCard}>
          <TextInput
            style={styles.textArea}
            value={reason}
            onChangeText={setReason}
            placeholder="Why is the scope changing?"
            placeholderTextColor={v3.colors.textPlaceholder}
            multiline
            textAlignVertical="top"
          />
        </View>

        <Text style={styles.sectionLabel}>ADDED AMOUNT</Text>
        <View style={styles.moneyField}>
          <Text style={styles.currency}>LKR</Text>
          <TextInput
            style={styles.moneyInput}
            value={priceAdjustment}
            onChangeText={setPriceAdjustment}
            placeholder="0"
            placeholderTextColor={v3.colors.textPlaceholder}
            keyboardType="numeric"
          />
        </View>

        <Text style={styles.sectionLabel}>NOTE TO CUSTOMER</Text>
        <View style={styles.fieldCard}>
          <TextInput
            style={styles.textArea}
            value={scopeDelta}
            onChangeText={setScopeDelta}
            placeholder="Explain the additional work or materials."
            placeholderTextColor={v3.colors.textPlaceholder}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.approvalCard}>
          <ShieldCheck size={16} color={v3.colors.info} weight="fill" />
          <Text style={styles.approvalText}>The extra amount is not charged until the customer approves this change order.</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (submitting || !reason.trim()) && styles.disabled]}
          activeOpacity={0.78}
          disabled={submitting || !reason.trim()}
          onPress={handleSubmit}
        >
          {submitting ? <ActivityIndicator size="small" color={v3.colors.paper} /> : <Text style={styles.submitText}>Send for approval</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { height: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 38, height: 38 },
  topTitle: { fontSize: 14, fontFamily: fonts.headingBold, color: v3.colors.ink },
  content: { paddingHorizontal: 20, paddingBottom: 34 },
  iconBox: { width: 46, height: 46, marginTop: 9, borderRadius: 15, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  hero: { marginTop: 14, fontSize: 27, lineHeight: 33, fontFamily: fonts.heading, color: v3.colors.ink, letterSpacing: -0.35 },
  subtitle: { marginTop: 6, maxWidth: 330, fontSize: 10.5, lineHeight: 16, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  priceCard: { marginTop: 23, borderRadius: 18, paddingHorizontal: 15, backgroundColor: v3.colors.ink },
  priceLine: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#333333' },
  priceLabel: { fontSize: 9.5, fontFamily: fonts.bodySemiBold, color: '#CFCFCF' },
  priceStrongLabel: { fontSize: 10, fontFamily: fonts.headingBold, color: v3.colors.paper },
  priceValue: { fontSize: 12, fontFamily: fonts.headingBold, color: v3.colors.success },
  priceStrong: { fontSize: 16, fontFamily: fonts.heading, color: v3.colors.paper },
  sectionLabel: { marginTop: 23, marginBottom: 8, fontSize: 9, letterSpacing: 0.6, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  fieldCard: { minHeight: 96, borderRadius: 16, padding: 13, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  textArea: { minHeight: 68, padding: 0, fontSize: 11, lineHeight: 17, fontFamily: fonts.bodyMedium, color: v3.colors.ink },
  moneyField: { height: 56, borderRadius: 16, paddingHorizontal: 14, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  currency: { marginRight: 7, fontSize: 16, fontFamily: fonts.headingBold, color: v3.colors.ink },
  moneyInput: { flex: 1, padding: 0, fontSize: 18, fontFamily: fonts.heading, color: v3.colors.ink },
  approvalCard: { minHeight: 64, marginTop: 18, borderRadius: 15, padding: 13, backgroundColor: v3.colors.infoSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  approvalText: { flex: 1, fontSize: 8.8, lineHeight: 14, fontFamily: fonts.bodySemiBold, color: '#4F4F4F' },
  submitButton: { height: 54, marginTop: 24, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.42 },
  submitText: { fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.paper },
})
