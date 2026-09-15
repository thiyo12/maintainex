import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../../../lib/ThemeContext'
import { fonts } from '../../../../../../lib/fonts'
import { v2Jobs, v2ChangeOrder } from '../../../../../../lib/api-v2'

export default function ChangeOrderScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
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
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  const currentPrice = job?.budgetAmount || 0
  const adjustment = parseFloat(priceAdjustment) || 0
  const newPrice = currentPrice + adjustment

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.heading}>{t('changeOrder.title')}</Text>
        <Text style={styles.subtitle}>{t('changeOrder.subtitle')}</Text>

        {/* Current Price (client preview only) */}
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t('changeOrder.currentPrice')}</Text>
            <Text style={styles.priceValue}>LKR {currentPrice.toLocaleString()}</Text>
          </View>
          {priceAdjustment !== '' && (
            <>
              <View style={styles.priceDivider} />
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{t('changeOrder.priceAdjustment')}</Text>
                <Text style={[styles.priceValue, { color: adjustment >= 0 ? '#059669' : '#DC2626' }]}>
                  {adjustment >= 0 ? '+' : ''}LKR {adjustment.toLocaleString()}
                </Text>
              </View>
              <View style={styles.priceDivider} />
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { fontWeight: '700' }]}>{t('changeOrder.newPrice')}</Text>
                <Text style={[styles.priceValue, { fontSize: 20 }]}>LKR {newPrice.toLocaleString()}</Text>
              </View>
            </>
          )}
        </View>

        {/* Reason */}
        <Text style={styles.label}>{t('changeOrder.reason')} *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={reason}
          onChangeText={setReason}
          placeholder={t('changeOrder.reasonPlaceholder')}
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={3}
        />

        {/* Price Adjustment (delta in LKR, sent as cents to server) */}
        <Text style={styles.label}>{t('changeOrder.priceAdjustment')}</Text>
        <View style={styles.priceInputRow}>
          <Text style={styles.currencySign}>LKR</Text>
          <TextInput
            style={[styles.input, styles.priceInput]}
            value={priceAdjustment}
            onChangeText={setPriceAdjustment}
            placeholder="0"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
          />
        </View>

        {/* Scope Delta */}
        <Text style={styles.label}>{t('changeOrder.description')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={scopeDelta}
          onChangeText={setScopeDelta}
          placeholder={t('changeOrder.descriptionPlaceholder')}
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={4}
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !reason.trim()) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !reason.trim()}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>{t('changeOrder.submit')}</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scroll: { paddingHorizontal: 24 },
  heading: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 16 },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 20, lineHeight: 20 },

  priceCard: {
    backgroundColor: colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 20,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  priceLabel: { fontSize: 13, color: colors.muted },
  priceValue: { fontSize: 16, fontWeight: '700', color: colors.ink },
  priceDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },

  label: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.white, borderRadius: 12, padding: 14, fontSize: 15,
    borderWidth: 1.5, borderColor: colors.border, color: colors.ink,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  priceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencySign: { fontSize: 18, fontWeight: '700', color: colors.ink },
  priceInput: { flex: 1, fontSize: 24, fontWeight: '700' },

  submitBtn: { backgroundColor: colors.amber, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: colors.ink },
})
