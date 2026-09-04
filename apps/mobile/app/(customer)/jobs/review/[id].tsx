import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Animated, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import StarRating from '../../../../components/ui/StarRating'
import { useColors } from '../../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { jobs } from '../../../../lib/api'
import { JobPosting } from '../../../../lib/types'

export default function ReviewScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const [job, setJob] = useState<JobPosting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const slideAnim = useRef(new Animated.Value(0)).current
  const charCount = comment.length

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }).start()
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    jobs.get(id as string)
      .then(setJob)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert(t('common.error'), t('errors.ratingRequired'))
      return
    }
    setSubmitted(true)
  }

  const categories = [t('receipt.rateQuality'), t('receipt.ratePunctuality'), t('receipt.rateCommunication'), t('receipt.rateValue')]

  const taskerName = job?.assignedTasker?.user?.name || t('customer.tasker')
  const avatarLetter = taskerName.charAt(0)

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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: colors.red, textAlign: 'center' }}>{error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Animated.View style={[styles.successCircle, { transform: [{ scale: slideAnim }] }]}>
            <Ionicons name="star" size={36} color={colors.white} />
          </Animated.View>
          <Text style={styles.successTitle}>{t('receipt.reviewSubmitted')}</Text>
          <Text style={styles.successSub}>
            {t('receipt.reviewSubmittedDesc')}
          </Text>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.replace('/(customer)')}
          >
            <Text style={styles.homeBtnText}>{t('receipt.backToHome')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.taskerAvatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <Text style={styles.heading}>{t('receipt.reviewTitle', { name: taskerName })}</Text>
          <Text style={styles.subtitle}>{t('receipt.reviewSubtitle')}</Text>
        </View>

        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>{t('receipt.overallRating')}</Text>
          <StarRating stars={rating} onRate={setRating} size={40} />
          {rating > 0 ? (
            <Text style={styles.ratingText}>
              {rating === 5 ? t('receipt.ratingExcellent') : rating === 4 ? t('receipt.ratingGreat') : rating === 3 ? t('receipt.ratingGood') : rating === 2 ? t('receipt.ratingFair') : t('receipt.ratingPoor')}
            </Text>
          ) : null}
        </View>

        <View style={styles.categorySection}>
          {categories.map((cat) => (
            <View key={cat} style={styles.catRow}>
              <Text style={styles.catLabel}>{cat}</Text>
              <StarRating stars={0} size={24} readonly={false} />
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
            numberOfLines={5}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{t('postJob.charCount', { n: charCount })}</Text>
        </View>

        <View style={styles.photoSection}>
          <Text style={styles.photoLabel}>{t('receipt.addPhotos')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            <TouchableOpacity style={styles.addPhoto}>
              <Text style={styles.addPhotoIcon}>+</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
        <Text style={styles.submitBtnText}>{t('receipt.submitReview')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { paddingHorizontal: 24, paddingTop: 8 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  scroll: { paddingHorizontal: 24 },
  header: { alignItems: 'center', paddingTop: 16, paddingBottom: 24 },
  taskerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.customerAccent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: colors.white },
  heading: { fontSize: 22, fontWeight: '800', color: colors.dark, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.gray, textAlign: 'center' },
  ratingSection: {
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  ratingLabel: { fontSize: 15, fontWeight: '700', color: colors.dark, marginBottom: 12 },
  ratingText: { fontSize: 16, fontWeight: '600', color: colors.primary, marginTop: 8 },
  categorySection: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  catLabel: { fontSize: 14, fontWeight: '600', color: colors.dark },
  commentSection: { marginBottom: 14 },
  commentLabel: { fontSize: 14, fontWeight: '700', color: colors.dark, marginBottom: 8 },
  textArea: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.dark,
    height: 120,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 12, color: colors.gray, textAlign: 'right', marginTop: 4 },
  photoSection: { marginBottom: 100 },
  photoLabel: { fontSize: 14, fontWeight: '700', color: colors.dark, marginBottom: 10 },
  photoRow: { gap: 10 },
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.lightGray,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  addPhotoIcon: { fontSize: 28, color: colors.gray },
  submitBtn: {
    backgroundColor: colors.primary,
    marginHorizontal: 24,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  successTitle: { fontSize: 26, fontWeight: '800', color: colors.dark, marginBottom: 8 },
  successSub: { fontSize: 15, color: colors.gray, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  homeBtn: {
    width: '100%',
    backgroundColor: colors.customerAccent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  homeBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
})
