import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTheme } from '../../lib/ThemeContext'
import { useAuth } from '../../lib/auth'
import { matchCategory } from '../../lib/aiMatch'
import { v2Jobs } from '../../lib/api-v2'
import { realEstate } from '../../lib/api'
import CategoryPills from '../../components/ui/CategoryPills'
import PhotoUploader from '../../components/ui/PhotoUploader'
import AISearchBar from '../../components/shared/AISearchBar'
import { useTranslation } from 'react-i18next'

export default function PostJobScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const { user } = useAuth()
  const [role, setRole] = useState<'individual' | 'company'>('individual')
  const [selectedCat, setSelectedCat] = useState<string>('plumbing')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [openToQuotes, setOpenToQuotes] = useState(true)
  const [aiQuery, setAiQuery] = useState('')
  const [aiMatch, setAiMatch] = useState<ReturnType<typeof matchCategory>>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    AsyncStorage.getItem('active-role').then(v => {
      if (v === 'individual' || v === 'company') setRole(v)
    })
  }, [])

  const handleAiChange = useCallback((text: string) => {
    setAiQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const result = matchCategory(text)
      setAiMatch(result)
      if (result) {
        setSelectedCat(result.categoryId)
        if (title === '') setTitle(result.categoryName)
      }
    }, 400)
  }, [title])

  const handleRoleChange = (r: 'individual' | 'company') => {
    setRole(r)
    AsyncStorage.setItem('active-role', r)
  }

  const handlePost = async () => {
    try {
      if (selectedCat !== 'realestate' && user?.id) {
        const existing = await v2Jobs.list()
        const activeCount = (existing.jobs || []).filter((j: any) => j.customerId === user.id && j.status !== 'COMPLETED' && j.status !== 'CANCELLED').length
        if (activeCount >= 2) {
          Alert.alert(t('postJob.maxActiveJobs'), t('postJob.maxActiveJobsDesc'))
          return
        }
      }
      if (selectedCat === 'realestate') {
        await realEstate.create({
          title,
          description,
          price: parseInt(budgetMax || budgetMin || '0', 10) || 0,
          type: 'FOR_SALE',
        })
        router.replace('/real-estate')
      } else {
        const created = await v2Jobs.create({
          title,
          description,
          categoryId: selectedCat,
          budgetType: openToQuotes ? 'REQUEST_QUOTES' : 'FIXED',
          budgetAmount: parseInt(budgetMax || budgetMin || '0', 10) || 0,
        })
        router.replace(`/(customer)/(tabs)?newJobId=${(created as any).id || ''}`)
      }
    } catch (err: any) {
      let msg = err.message || t('postJob.failedToPost')
      try { const p = JSON.parse(msg); msg = p.error || msg } catch {}
      Alert.alert(t('common.error'), msg)
    }
  }

  const isRemoteCat = ['webdesign', 'graphics', 'marketing'].includes(selectedCat)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.white, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close-outline" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>{t('postJob.header')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Role segment */}
        <View style={[styles.seg, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.segItem, role === 'individual' && styles.segItemOn]}
            onPress={() => handleRoleChange('individual')}
          >
            <Ionicons name="person-outline" size={14} color={role === 'individual' ? colors.ink : colors.muted} />
            <Text style={[styles.segText, { color: role === 'individual' ? colors.ink : colors.muted }]}>{t('postJob.individual')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segItem, role === 'company' && styles.segItemOn]}
            onPress={() => handleRoleChange('company')}
          >
            <Ionicons name="business-outline" size={14} color={role === 'company' ? colors.ink : colors.muted} />
            <Text style={[styles.segText, { color: role === 'company' ? colors.ink : colors.muted }]}>{t('profile.company')}</Text>
          </TouchableOpacity>
        </View>

        {/* AI Search Bar */}
        <AISearchBar
          value={aiQuery}
          onChangeText={handleAiChange}
          placeholder={t('postJob.titlePlaceholder')}
        />

        {/* AI correction card */}
        {aiMatch?.correctedText && aiQuery.length > 0 && (
          <View style={[styles.correctionCard, { backgroundColor: colors.surface, borderColor: colors.amber }]}>
            <Ionicons name="text-outline" size={17} color={colors.amberDark} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.correctionText, { color: colors.muted }]}>
                {t('home.didYouMean')}{' '}
                <Text style={{ color: colors.ink, fontFamily: 'Outfit_800ExtraBold' }}>
                  {aiMatch.categoryName}
                </Text>
                ?{' '}
                <Text style={{ textDecorationLine: 'line-through', opacity: 0.5 }}>
                  {aiQuery}
                </Text>
                {' → '}matched
              </Text>
            </View>
          </View>
        )}

        {/* Title */}
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>{t('postJob.jobTitle')}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink }]}
          placeholder={t('postJob.jobTitlePlaceholder')}
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
        />

        {/* Category chips */}
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>{t('postJob.category')}</Text>
        <CategoryPills selected={selectedCat} onSelect={setSelectedCat} />

        {/* Description */}
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>{t('postJob.description')}</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink }]}
          placeholder={t('postJob.descPlaceholder')}
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />

        {/* Conditional Location */}
        {!isRemoteCat ? (
          <>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>{t('postJob.location')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink }]}
              placeholder={t('postJob.locationPlaceholder')}
              placeholderTextColor={colors.muted}
            />
            <View style={styles.infoRow}>
              <Ionicons name="map-pin-outline" size={12} color={colors.muted} />
              <Text style={[styles.infoText, { color: colors.muted }]}>{t('postJob.postedDesc')}</Text>
            </View>
          </>
        ) : (
          <View style={styles.infoRow}>
            <Ionicons name="globe-outline" size={12} color={colors.muted} />
            <Text style={[styles.infoText, { color: colors.muted }]}>{t('postJob.remoteWorkInfo')}</Text>
          </View>
        )}

        {/* Budget */}
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>{t('postJob.budget')}</Text>
        <View style={styles.budgetRow}>
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink }]}
            placeholder={t('postJob.min')}
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            value={budgetMin}
            onChangeText={setBudgetMin}
          />
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink }]}
            placeholder={t('postJob.max')}
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            value={budgetMax}
            onChangeText={setBudgetMax}
          />
        </View>

        {/* Open to quotes toggle (hidden for real estate) */}
        {selectedCat !== 'realestate' && (
          <TouchableOpacity
            style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setOpenToQuotes(!openToQuotes)}
            activeOpacity={0.7}
          >
            <View>
              <Text style={[styles.toggleTitle, { color: colors.ink }]}>{t('postJob.letThemQuote')}</Text>
              <Text style={[styles.toggleSub, { color: colors.muted }]}>{t('postJob.taskersSuggestPrice')}</Text>
            </View>
            <View style={[styles.switch, openToQuotes && { backgroundColor: colors.amber }]}>
              <View style={[styles.switchKnob, openToQuotes && { alignSelf: 'flex-end' }]} />
            </View>
          </TouchableOpacity>
        )}

        {/* Photo uploader */}
        <PhotoUploader
          onPhotosChange={() => {}}
        />

        {/* Post button */}
        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: colors.amber }]}
          onPress={handlePost}
          activeOpacity={0.8}
        >
          <Ionicons name="paper-plane-outline" size={16} color="#111827" />
          <Text style={styles.postBtnText}>{t('postJob.post')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontFamily: 'Outfit_800ExtraBold' },
  content: { padding: 24, paddingBottom: 48 },
  seg: {
    flexDirection: 'row',
    borderRadius: 100,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 100,
  },
  segItemOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  segText: { fontSize: 12, fontFamily: 'Outfit_700Bold' },
  correctionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 12,
    marginBottom: 12,
  },
  correctionText: { fontSize: 11, fontFamily: 'Outfit_700Bold' },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  infoText: { fontSize: 11, fontFamily: 'Outfit_500Medium' },
  budgetRow: { flexDirection: 'row', gap: 10 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    marginTop: 16,
  },
  toggleTitle: { fontSize: 13, fontFamily: 'Outfit_700Bold' },
  toggleSub: { fontSize: 11, fontFamily: 'Outfit_500Medium', marginTop: 1 },
  switch: {
    width: 40,
    height: 24,
    borderRadius: 100,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  postBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 20,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  postBtnText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: '#111827' },
})
