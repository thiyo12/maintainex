import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Animated, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Star } from 'phosphor-react-native'
import StarRating from '../../../../components/ui/StarRating'
import { useColors } from '../../../../lib/ThemeContext'
import { fonts } from '../../../../lib/fonts'
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
        <ActivityIndicator size="large" color="#F5A623" style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#E11900', textAlign: 'center' }}>{error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Animated.View style={[styles.successCircle, { transform: [{ scale: slideAnim }] }]}>
            <Star size={36} color="#FFFFFF" weight="fill" />
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
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  backBtn: { paddingHorizontal: 24, paddingTop: 8 },
  backText: { fontSize: 16, color: '#F5A623', fontFamily: fonts.body },
  scroll: { paddingHorizontal: 24 },
  header: { alignItems: 'center', paddingTop: 16, paddingBottom: 24 },
  taskerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F5A623',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 24, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
  heading: { fontSize: 22, fontFamily: fonts.heading, color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6F6B6B', textAlign: 'center' },
  ratingSection: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  ratingLabel: { fontSize: 15, fontFamily: fonts.bodyMedium, color: '#0D0D0D', marginBottom: 12 },
  ratingText: { fontSize: 16, fontFamily: fonts.body, color: '#F5A623', marginTop: 8 },
  categorySection: {
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#2E2E2E',
  },
  catLabel: { fontSize: 14, fontFamily: fonts.body, color: '#0D0D0D' },
  commentSection: { marginBottom: 14 },
  commentLabel: { fontSize: 14, fontFamily: fonts.bodyMedium, color: '#FFFFFF', marginBottom: 8 },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#2E2E2E',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#0D0D0D',
    height: 120,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 12, color: '#6F6B6B', textAlign: 'right', marginTop: 4 },
  photoSection: { marginBottom: 100 },
  photoLabel: { fontSize: 14, fontFamily: fonts.bodyMedium, color: '#FFFFFF', marginBottom: 10 },
  photoRow: { gap: 10 },
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2E2E2E',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  addPhotoIcon: { fontSize: 28, color: '#6F6B6B' },
  submitBtn: {
    backgroundColor: '#F5A623',
    marginHorizontal: 24,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnText: { fontSize: 17, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
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
    backgroundColor: '#F5A623',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  successTitle: { fontSize: 26, fontFamily: fonts.heading, color: '#FFFFFF', marginBottom: 8 },
  successSub: { fontSize: 15, color: '#6F6B6B', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  homeBtn: {
    width: '100%',
    backgroundColor: '#F5A623',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  homeBtnText: { fontSize: 17, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
})
