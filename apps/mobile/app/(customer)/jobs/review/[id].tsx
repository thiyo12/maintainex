import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Animated, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import StarRating from '../../../../components/ui/StarRating'
import { useColors } from '../../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { v2Jobs, v2JobActions } from '../../../../lib/api-v2'

export default function ReviewScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quality, setQuality] = useState(0)
  const [communication, setCommunication] = useState(0)
  const [timeliness, setTimeliness] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)
  const slideAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }).start()
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    v2Jobs.get(id)
      .then((res) => {
        setJob(res.job)
        setAlreadyReviewed((res.job.reviews?.customerReviews || []).length > 0)
      })
      .catch((e) => setError(e?.message || 'Could not load this job'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async () => {
    if (!quality || !communication || !timeliness) {
      Alert.alert(t('common.error'), 'Please rate quality, communication, and timeliness.')
      return
    }
    if (job?.status !== 'COMPLETED') {
      Alert.alert(t('common.error'), 'Reviews are available after the job is completed.')
      return
    }

    setSubmitting(true)
    try {
      await v2JobActions.createReview(id, {
        reviewType: 'CUSTOMER_REVIEWS_PROVIDER',
        quality,
        communication,
        timeliness,
        comment: comment.trim(),
      })
      setSubmitted(true)
      setAlreadyReviewed(true)
    } catch (e: any) {
      if ((e?.message || '').toLowerCase().includes('already reviewed')) {
        setAlreadyReviewed(true)
      } else {
        Alert.alert(t('common.error'), e?.message || 'Could not submit your review.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const providerName =
    job?.acceptedQuote?.provider?.name ||
    job?.quotes?.find((q: any) => q.status === 'ACCEPTED')?.provider?.name ||
    'Provider'
  const avatarLetter = providerName.charAt(0).toUpperCase()

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={{ color: colors.red, textAlign: 'center' }}>{error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (submitted || alreadyReviewed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Animated.View style={[styles.successCircle, { transform: [{ scale: slideAnim }] }]}>
            <Ionicons name="star" size={36} color={colors.white} />
          </Animated.View>
          <Text style={styles.successTitle}>{submitted ? t('receipt.reviewSubmitted') : 'Review already submitted'}</Text>
          <Text style={styles.successSub}>
            {submitted ? t('receipt.reviewSubmittedDesc') : 'This completed job already has your review.'}
          </Text>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(customer)/(tabs)' as any)}>
            <Text style={styles.homeBtnText}>{t('receipt.backToHome')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const ratingRows = [
    { label: t('receipt.rateQuality'), value: quality, setter: setQuality },
    { label: t('receipt.rateCommunication'), value: communication, setter: setCommunication },
    { label: t('receipt.ratePunctuality'), value: timeliness, setter: setTimeliness },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.taskerAvatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <Text style={styles.heading}>{t('receipt.reviewTitle', { name: providerName })}</Text>
          <Text style={styles.subtitle}>{t('receipt.reviewSubtitle')}</Text>
        </View>

        <View style={styles.categorySection}>
          {ratingRows.map((row) => (
            <View key={row.label} style={styles.ratingRow}>
              <Text style={styles.catLabel}>{row.label}</Text>
              <StarRating stars={row.value} onRate={row.setter} size={30} />
            </View>
          ))}
        </View>

        <View style={styles.commentSection}>
          <Text style={styles.commentLabel}>{t('receipt.writeReview')}</Text>
          <TextInput
            style={styles.textArea}
            value={comment}
            onChangeText={setComment}
            placeholder={t('receipt.reviewPlaceholder')}
            multiline
            maxLength={1000}
            numberOfLines={5}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{comment.length}/1000</Text>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.submitBtn, submitting && { opacity: 0.55 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color={colors.white} />
          : <Text style={styles.submitBtnText}>{t('receipt.submitReview')}</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: { alignItems: 'center', paddingTop: 16, paddingBottom: 24 },
  taskerAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.customerAccent, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 24, fontWeight: '700', color: colors.white },
  heading: { fontSize: 22, fontWeight: '800', color: colors.dark, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.gray, textAlign: 'center' },
  categorySection: { backgroundColor: colors.white, padding: 16, borderRadius: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  ratingRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lightGray, gap: 8 },
  catLabel: { fontSize: 14, fontWeight: '600', color: colors.dark },
  commentSection: { marginBottom: 110 },
  commentLabel: { fontSize: 14, fontWeight: '700', color: colors.dark, marginBottom: 8 },
  textArea: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray, borderRadius: 12, padding: 14, fontSize: 15, color: colors.dark, height: 120, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: colors.gray, textAlign: 'right', marginTop: 4 },
  submitBtn: { backgroundColor: colors.primary, marginHorizontal: 24, marginBottom: 32, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  submitBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  successCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 24, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  successTitle: { fontSize: 26, fontWeight: '800', color: colors.dark, marginBottom: 8, textAlign: 'center' },
  successSub: { fontSize: 15, color: colors.gray, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  homeBtn: { width: '100%', backgroundColor: colors.customerAccent, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  homeBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
})
