import { useState, useEffect, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretLeft, MapPin, Clock, ShieldCheck } from 'phosphor-react-native'
import { v2Jobs, v2Quotes, v2Identity } from '../../../../../lib/api-v2'
import { fonts } from '../../../../../lib/fonts'
import { v3 } from '../../../../../theme/v3/tokens'

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return null
  return 'LKR ' + Number(value).toLocaleString()
}

function budgetLabel(job: any) {
  const min = Number(job?.smartBooking?.estimatedPriceMin ?? job?.budgetMin ?? 0)
  const max = Number(job?.smartBooking?.estimatedPriceMax ?? job?.budgetMax ?? job?.budgetAmount ?? 0)
  if (min > 0 && max > 0 && min !== max) return money(min) + '–' + money(max)?.replace('LKR ', '')
  return money(max || min) || 'Budget not set'
}

function requestedTime(job: any) {
  const raw = job?.smartBooking?.preferredDate || job?.preferredDate || job?.scheduledAt
  const slot = job?.smartBooking?.timeSlot || job?.timeSlot
  if (!raw && !slot) return 'Schedule to be confirmed'

  let dateLabel = ''
  if (raw) {
    const parsed = new Date(String(raw).includes('T') ? raw : raw + 'T12:00:00')
    dateLabel = Number.isNaN(parsed.getTime())
      ? String(raw)
      : parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  }
  return [dateLabel, slot].filter(Boolean).join(' · ')
}

export default function V2SubmitQuoteScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const router = useRouter()

  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [identity, setIdentity] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [stage, setStage] = useState<'opportunity' | 'quote'>('opportunity')

  const [price, setPrice] = useState('')
  const [estimatedCompletionTime, setEstimatedCompletionTime] = useState('')
  const [message, setMessage] = useState('')
  const [existingQuoteId, setExistingQuoteId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const [jobRes, idRes] = await Promise.allSettled([
          v2Jobs.get(id),
          v2Identity.getStatus(),
        ])

        if (jobRes.status === 'fulfilled') {
          const nextJob = jobRes.value.job
          setJob(nextJob)

          const currentQuote = (nextJob.quotes || []).find(
            quote => quote.providerType === 'INDIVIDUAL' && quote.status === 'PENDING'
          )
          if (currentQuote) {
            setExistingQuoteId(currentQuote.id)
            setPrice(String(currentQuote.price))
            setEstimatedCompletionTime(currentQuote.estimatedCompletionTime || '')
            setMessage(currentQuote.message || '')
          } else {
            setExistingQuoteId(null)
            const min = Number(nextJob?.smartBooking?.estimatedPriceMin ?? 0)
            const max = Number(nextJob?.smartBooking?.estimatedPriceMax ?? nextJob?.budgetAmount ?? 0)
            if (min > 0 && max > 0) setPrice(String(Math.round((min + max) / 2)))
            else if (max > 0) setPrice(String(Math.round(max)))
          }
        } else {
          Alert.alert('Job unavailable', 'This opportunity is no longer available.')
          router.back()
          return
        }

        if (idRes.status === 'fulfilled') setIdentity(idRes.value.identityStatus)
      } finally {
        setLoading(false)
      }
    })()
  }, [id, router])

  const isVerified = identity === 'VERIFIED' || identity === 'APPROVED'

  const customer = useMemo(() => {
    const value = job?.customer || job?.customerProfile || {}
    const name = value?.name || job?.customerName || 'Customer'
    const initial = String(name).trim().charAt(0).toUpperCase() || 'C'
    const rating = Number(value?.rating || job?.customerRating || 0)
    const jobsCount = Number(value?.completedJobs || value?.jobsCompleted || job?.customerCompletedJobs || 0)
    const cancellation = value?.cancellationRate ?? job?.customerCancellationRate
    const verifiedMobile = value?.phoneVerified ?? job?.customerPhoneVerified
    const priority = Boolean(value?.priorityBooker || value?.isPriorityBooker || job?.priorityBooker)
    return { name, initial, rating, jobsCount, cancellation, verifiedMobile, priority }
  }, [job])

  const detailsLine = useMemo(() => {
    const smart = job?.smartBooking
    if (smart?.categoryName) {
      const answers = smart?.answers && typeof smart.answers === 'object'
        ? Object.values(smart.answers).flat().filter(Boolean).slice(0, 2).map(String)
        : []
      return [smart.categoryName, ...answers].join(' · ')
    }
    return job?.description || 'Review the customer request before quoting.'
  }, [job])

  const handleStartQuote = () => {
    if (isVerified) {
      setStage('quote')
      return
    }

    Alert.alert(
      'Identity verification required',
      'Verify your identity before sending a quote.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Verify now', onPress: () => router.push('/(tasker)/identity' as any) },
      ]
    )
  }

  const handleSubmit = async () => {
    const numericPrice = Number(price)
    if (!numericPrice || numericPrice <= 0 || !estimatedCompletionTime.trim()) {
      Alert.alert('Complete your quote', 'Enter a valid price and arrival estimate.')
      return
    }
    if (!id) return

    setSubmitting(true)
    try {
      if (existingQuoteId) {
        await v2Quotes.revise(existingQuoteId, {
          price: numericPrice,
          estimatedCompletionTime: estimatedCompletionTime.trim(),
          message: message.trim(),
          revisionReason: 'Updated after customer discussion',
        })
        Alert.alert('Quote updated', 'Your revised price is now the active offer for the customer.', [
          { text: 'Done', onPress: () => router.replace('/(tasker)/(tabs)/my-jobs' as any) },
        ])
      } else {
        await v2Quotes.submit({
          jobId: id,
          providerType: 'INDIVIDUAL',
          price: numericPrice,
          estimatedCompletionTime: estimatedCompletionTime.trim(),
          message: message.trim(),
        })
        Alert.alert('Quote sent', 'The customer can now compare your offer.', [
          { text: 'Done', onPress: () => router.replace('/(tasker)/(tabs)/my-jobs' as any) },
        ])
      }
    } catch (e: any) {
      Alert.alert('Unable to send quote', e?.message || 'Please try again.')
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

  if (!job) return null

  if (stage === 'quote') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.formTopBar}>
          <TouchableOpacity style={styles.circleButton} activeOpacity={0.72} onPress={() => setStage('opportunity')}>
            <CaretLeft size={18} color={v3.colors.ink} weight="bold" />
          </TouchableOpacity>
          <Text style={styles.formTopTitle}>{existingQuoteId ? 'Update quote' : 'Send quote'}</Text>
          <View style={styles.circlePlaceholder} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.formHero}>{existingQuoteId ? 'Revise your offer' : 'Your offer'}</Text>
          <Text style={styles.formSubtitle}>
            {existingQuoteId
              ? 'After bargaining in chat, update the final price here. The old quote is replaced, not duplicated.'
              : 'Customer sees price, ETA, rating and your profile together.'}
          </Text>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>Price</Text>
            <View style={styles.priceRow}>
              <Text style={styles.currencyPrefix}>LKR</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={v3.colors.textPlaceholder}
                style={styles.priceInput}
              />
            </View>
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>Arrival</Text>
            <TextInput
              value={estimatedCompletionTime}
              onChangeText={setEstimatedCompletionTime}
              placeholder="About 12 minutes"
              placeholderTextColor={v3.colors.textPlaceholder}
              style={styles.textInput}
            />
          </View>

          <View style={[styles.fieldCard, styles.messageCard]}>
            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Tell the customer how you can help."
              placeholderTextColor={v3.colors.textPlaceholder}
              style={styles.messageInput}
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.disabledButton]}
            activeOpacity={0.78}
            disabled={submitting}
            onPress={handleSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={v3.colors.paper} />
            ) : (
              <Text style={styles.primaryButtonText}>{existingQuoteId ? 'Update quote' : 'Send quote'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const trustMeta = [
    customer.jobsCount > 0 ? customer.jobsCount + ' jobs' : null,
    customer.cancellation != null ? Number(customer.cancellation).toFixed(0) + '% cancellation' : null,
    customer.verifiedMobile ? 'Verified mobile' : null,
  ].filter(Boolean).join(' · ')

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.opportunityContent}>
        <View style={styles.opportunityHeader}>
          <TouchableOpacity style={styles.circleButton} activeOpacity={0.72} onPress={() => router.back()}>
            <CaretLeft size={16} color={v3.colors.ink} weight="bold" />
          </TouchableOpacity>
          <View style={styles.opportunityTitleCopy}>
            <Text style={styles.opportunityTitle}>New opportunity</Text>
            <Text style={styles.opportunitySub}>Respond quickly — customer can compare live quotes.</Text>
          </View>
        </View>

        <View style={styles.customerCard}>
          <View style={styles.customerAvatar}><Text style={styles.customerInitial}>{customer.initial}</Text></View>
          <View style={styles.customerCopy}>
            <Text style={styles.customerName}>{customer.name}</Text>
            {customer.priority ? (
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityText}>PRIORITY BOOKER</Text>
              </View>
            ) : null}
            <Text style={styles.customerMeta} numberOfLines={1}>{trustMeta || 'MaintainEX customer'}</Text>
          </View>
          {customer.rating > 0 ? <Text style={styles.customerRating}>{customer.rating.toFixed(1)} ★</Text> : null}
        </View>

        <Text style={styles.sectionTitle}>Job</Text>
        <View style={styles.jobCard}>
          <Text style={styles.jobTitle}>{job.title || 'Service request'}</Text>
          <Text style={styles.jobDescription} numberOfLines={2}>{detailsLine}</Text>

          <View style={styles.metaLine}>
            <MapPin size={15} color={v3.colors.textSecondary} weight="regular" />
            <Text style={styles.metaText}>{job.locationName || job.areaName || 'Location shown after acceptance'}</Text>
          </View>

          <View style={styles.metaLine}>
            <Clock size={15} color={v3.colors.textSecondary} weight="regular" />
            <Text style={styles.metaText}>{requestedTime(job)}</Text>
          </View>

          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Customer budget</Text>
            <Text style={styles.budgetValue}>{budgetLabel(job)}</Text>
          </View>
        </View>

        <View style={styles.trustCard}>
          <View style={styles.trustTitleRow}>
            <ShieldCheck size={15} color={v3.colors.info} weight="fill" />
            <Text style={styles.trustTitle}>Trust signal</Text>
          </View>
          <Text style={styles.trustText}>
            {customer.priority
              ? 'Priority Booker means this customer completes most bookings and has a low cancellation rate.'
              : 'MaintainEX keeps quotes, job status and customer approval inside the marketplace.'}
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.78} onPress={handleStartQuote}>
          <Text style={styles.primaryButtonText}>{existingQuoteId ? 'Review / update quote' : 'Send a quote'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  opportunityContent: {
    paddingHorizontal: 18,
    paddingTop: 7,
    paddingBottom: 24,
  },
  opportunityHeader: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePlaceholder: { width: 40, height: 40 },
  opportunityTitleCopy: {
    flex: 1,
    marginLeft: 10,
    paddingTop: 1,
  },
  opportunityTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  opportunitySub: {
    marginTop: 2,
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: fonts.bodySemiBold,
    color: v3.colors.textSecondary,
  },
  customerCard: {
    minHeight: 122,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  customerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D9D9D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitial: {
    fontSize: 12,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  customerCopy: {
    flex: 1,
    marginLeft: 12,
    paddingRight: 8,
  },
  customerName: {
    fontSize: 12.2,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    minHeight: 24,
    marginTop: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: v3.colors.amberSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityText: {
    fontSize: 8.8,
    fontFamily: fonts.headingBold,
    color: v3.colors.amberDark,
  },
  customerMeta: {
    marginTop: 6,
    fontSize: 8.8,
    fontFamily: fonts.bodySemiBold,
    color: v3.colors.textSecondary,
  },
  customerRating: {
    fontSize: 10,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 14.5,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  jobCard: {
    minHeight: 188,
    borderRadius: 18,
    padding: 14,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
  },
  jobTitle: {
    fontSize: 17,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  jobDescription: {
    marginTop: 5,
    fontSize: 9.5,
    lineHeight: 14,
    fontFamily: fonts.bodySemiBold,
    color: v3.colors.textSecondary,
  },
  metaLine: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    flex: 1,
    fontSize: 9.2,
    fontFamily: fonts.bodyMedium,
    color: '#4F4F4F',
  },
  budgetRow: {
    marginTop: 16,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: v3.colors.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 8.7,
    fontFamily: fonts.bodyMedium,
    color: v3.colors.textSecondary,
  },
  budgetValue: {
    fontSize: 11.5,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  trustCard: {
    minHeight: 84,
    marginTop: 22,
    borderRadius: 16,
    backgroundColor: v3.colors.infoSoft,
    padding: 14,
  },
  trustTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustTitle: {
    fontSize: 9.5,
    fontFamily: fonts.headingBold,
    color: v3.colors.info,
  },
  trustText: {
    marginTop: 8,
    fontSize: 8.7,
    lineHeight: 16,
    fontFamily: fonts.bodySemiBold,
    color: '#4F4F4F',
  },
  primaryButton: {
    minHeight: 54,
    marginTop: 32,
    borderRadius: 16,
    backgroundColor: v3.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: { opacity: 0.55 },
  primaryButtonText: {
    fontSize: 13.5,
    fontFamily: fonts.headingBold,
    color: v3.colors.paper,
  },
  formTopBar: {
    height: 76,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  formTopTitle: {
    flex: 1,
    marginLeft: 10,
    fontSize: 17,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  formContent: {
    paddingHorizontal: 24,
    paddingTop: 3,
    paddingBottom: 30,
  },
  formHero: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  formSubtitle: {
    marginTop: 5,
    marginBottom: 29,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.bodySemiBold,
    color: '#5B5B5B',
  },
  fieldCard: {
    minHeight: 70,
    marginBottom: 18,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
  },
  messageCard: {
    minHeight: 110,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    color: v3.colors.textMuted,
  },
  priceRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyPrefix: {
    marginRight: 6,
    fontSize: 20,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 20,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  textInput: {
    marginTop: 3,
    paddingVertical: 0,
    fontSize: 15,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  messageInput: {
    minHeight: 70,
    marginTop: 8,
    paddingVertical: 0,
    fontSize: 12,
    lineHeight: 20,
    fontFamily: fonts.bodySemiBold,
    color: '#5B5B5B',
  },
})
