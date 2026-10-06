import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import Constants from 'expo-constants'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ArrowLeft, Camera, CaretRight, Check, CheckCircle, ClockAfternoon,
  MapPin, Microphone, Plus, Sparkle, Wallet, X,
} from 'phosphor-react-native'

import { useAuth } from '@/features/auth/context/auth'
import { useCountry } from '@/lib/country'
import { jobCategories } from '@/api/jobs'
import { upload } from '@/api/upload'
import { v2Jobs } from '@/api/v2-jobs'
import { v2Search } from '@/api/v2-search'
import { v2SmartBooking } from '@/api/v2-pricing'
import { type SmartTemplate } from '@/api/v2-types'
import type { JobCategory } from '@/lib/types'
import { v3 } from '@/theme/v3/tokens'
import V3CustomerBottomNav from '@/components/v3/V3CustomerBottomNav'
import JobLocationPicker, { type JobLocationValue } from '@/components/location/JobLocationPicker'

type SearchCategory = {
  id: string
  name: string
  icon?: string
  score?: number
}

function tomorrowIso() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

function cleanTitle(text: string) {
  const firstLine = text.trim().split(/\n|\.|\?|!/)[0]?.trim() || text.trim()
  return firstLine.slice(0, 90) || 'Service request'
}

export default function CreateJobScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { selectedCountry } = useCountry()
  const countryCode = (selectedCountry?.code || (user as any)?.countryCode || 'LK').toUpperCase()
  const params = useLocalSearchParams<{
    urgency?: string
    categoryId?: string
    templateJobId?: string
    title?: string
    taskerId?: string
    taskerName?: string
  }>()

  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [description, setDescription] = useState(params.title || '')
  const [categories, setCategories] = useState<JobCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<JobCategory | SearchCategory | null>(null)
  const [searchResults, setSearchResults] = useState<SearchCategory[]>([])
  const [recentJob, setRecentJob] = useState<any>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<SmartTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createdJob, setCreatedJob] = useState<any>(null)
  const [listening, setListening] = useState(false)
  const descriptionRef = useRef<TextInput>(null)
  const speechCleanup = useRef<(() => void) | null>(null)

  const [locationText, setLocationText] = useState(
    [(user as any)?.area, (user as any)?.city].filter(Boolean).join(', ')
  )
  const [locationCoords, setLocationCoords] = useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null })
  const [when, setWhen] = useState<'now' | 'tomorrow' | 'flexible'>('now')
  const [budgetMode, setBudgetMode] = useState<'quotes' | 'fixed'>('quotes')
  const [budget, setBudget] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [estimate, setEstimate] = useState<any>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    Promise.allSettled([jobCategories.list(countryCode), v2Jobs.list()])
      .then(([categoryResult, jobsResult]) => {
        if (!active) return
        if (categoryResult.status === 'fulfilled') {
          const list = Array.isArray(categoryResult.value)
            ? categoryResult.value.filter((item: any) => item?.isActive !== false)
            : []
          setCategories(list)

          if (params.categoryId) {
            const match = list.find((item: any) =>
              item.id === params.categoryId || item.slug === params.categoryId
            )
            if (match) setSelectedCategory(match)
          }
        }

        if (jobsResult.status === 'fulfilled') {
          setRecentJob(jobsResult.value.jobs?.[0] || null)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [params.categoryId, countryCode])

  useEffect(() => {
    const categoryId = selectedCategory?.id
    if (!categoryId || !params.templateJobId) {
      setSelectedTemplate(null)
      return
    }

    let active = true
    v2SmartBooking.templates(categoryId, countryCode)
      .then((templates) => {
        if (!active) return
        const match = templates.find((item: any) =>
          item.id === params.templateJobId ||
          item.slug === params.templateJobId ||
          item.refJob?.id === params.templateJobId
        ) || null
        setSelectedTemplate(match)
        if (!description.trim() && match) {
          setDescription(match.description || match.name)
        }
      })
      .catch(() => {
        if (active) setSelectedTemplate(null)
      })
    return () => { active = false }
  }, [selectedCategory?.id, params.templateJobId, countryCode])

  useEffect(() => {
    const q = description.trim()
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.length < 3) {
      setSearchResults([])
      return
    }

    searchTimer.current = setTimeout(() => {
      setSearching(true)
      v2Search.categories(q, undefined, countryCode)
        .then((result) => {
          const mapped = (result.categories || []).slice(0, 5).map((item) => ({
            id: item.id,
            name: item.name,
            icon: item.icon,
            score: item.score,
          }))
          setSearchResults(mapped)
          if (!selectedCategory && mapped[0]?.score != null && mapped[0].score >= 0.72) {
            const full = categories.find((cat) => cat.id === mapped[0].id)
            setSelectedCategory(full || mapped[0])
          }
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false))
    }, 320)

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [description, categories, selectedCategory, countryCode])

  useEffect(() => {
    if (step !== 1 || !selectedTemplate) {
      setEstimate(null)
      return
    }

    v2SmartBooking.priceEstimate({
      templateId: selectedTemplate.id,
      answers: {},
      countryCode: countryCode,
      urgency: params.urgency || 'normal',
      city: (user as any)?.city || undefined,
      scheduledFor: when === 'now' ? 'today' : when === 'tomorrow' ? 'tomorrow' : 'flexible',
    })
      .then(setEstimate)
      .catch(() => setEstimate(null))
  }, [step, selectedTemplate?.id, when, params.urgency, user])

  const displayedSuggestions = useMemo(() => {
    if (searchResults.length > 0) return searchResults
    return categories.slice(0, 4)
  }, [categories, searchResults])

  const localRange = useMemo(() => {
    if (estimate?.priceRange?.min != null && estimate?.priceRange?.max != null) {
      return {
        min: Number(estimate.priceRange.min),
        max: Number(estimate.priceRange.max),
        currency: estimate.currency || 'LKR',
      }
    }

    const jobs = (selectedCategory as any)?.jobs
    if (Array.isArray(jobs) && jobs.length) {
      const mins = jobs.map((item: any) => Number(item.priceMin)).filter(Number.isFinite)
      const maxs = jobs.map((item: any) => Number(item.priceMax)).filter(Number.isFinite)
      if (mins.length && maxs.length) {
        return {
          min: Math.min(...mins),
          max: Math.max(...maxs),
          currency: jobs[0]?.currency || 'LKR',
        }
      }
    }
    return null
  }, [estimate, selectedCategory])

  const canContinue = description.trim().length >= 3 && !!selectedCategory

  const stopVoice = () => {
    speechCleanup.current?.()
    speechCleanup.current = null
    setListening(false)
    if (Platform.OS !== 'web') {
      try {
        const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition')
        ExpoSpeechRecognitionModule.stop()
      } catch {}
    }
  }

  const startVoice = async () => {
    if (listening) {
      stopVoice()
      return
    }

    if (Platform.OS === 'web') {
      const root: any = globalThis as any
      const Recognition = root.SpeechRecognition || root.webkitSpeechRecognition
      if (!Recognition) {
        Alert.alert('Voice input unavailable', 'This browser does not support speech recognition.')
        return
      }
      const recognition = new Recognition()
      recognition.lang = countryCode === 'LK' ? 'en-LK' : 'en-CA'
      recognition.interimResults = true
      recognition.continuous = false
      recognition.onstart = () => setListening(true)
      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          transcript += event.results[i]?.[0]?.transcript || ''
        }
        if (transcript.trim()) setDescription(transcript.trim())
      }
      recognition.onerror = () => setListening(false)
      recognition.onend = () => setListening(false)
      recognition.start()
      return
    }

    if ((Constants as any).appOwnership === 'expo') {
      Alert.alert(
        'Voice input needs the MaintainEX development build',
        'Expo Go cannot load native speech recognition. The production/development build supports the Voice button. For this Expo Go test, tap the description field and use the keyboard microphone.'
      )
      descriptionRef.current?.focus()
      return
    }

    try {
      const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition')
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Microphone permission needed', 'Allow microphone and speech recognition so you can describe the job by voice.')
        return
      }

      const startSub = ExpoSpeechRecognitionModule.addListener('start', () => setListening(true))
      const resultSub = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        const transcript = event.results?.[0]?.transcript?.trim()
        if (transcript) setDescription(transcript)
      })
      const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
        setListening(false)
        speechCleanup.current?.()
        speechCleanup.current = null
      })
      const errorSub = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        setListening(false)
        Alert.alert('Voice input stopped', event?.message || 'Please try again.')
      })

      speechCleanup.current = () => {
        startSub.remove()
        resultSub.remove()
        endSub.remove()
        errorSub.remove()
      }

      ExpoSpeechRecognitionModule.start({
        lang: countryCode === 'LK' ? 'en-LK' : 'en-CA',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        iosTaskHint: 'dictation',
      })
    } catch {
      Alert.alert('Voice input unavailable', 'Use a MaintainEX development or production build to enable speech recognition.')
      descriptionRef.current?.focus()
    }
  }

  useEffect(() => () => {
    speechCleanup.current?.()
  }, [])

  const pickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (permission.status !== 'granted') {
      Alert.alert('Photo access needed', 'Allow photo access to attach job photos.')
      return
    }

    const remaining = 5 - photos.length
    if (remaining <= 0) {
      Alert.alert('Photo limit reached', 'You can attach up to 5 photos.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.75,
    })
    if (result.canceled) return

    setPhotoUploading(true)
    try {
      const uploaded: string[] = []
      for (const asset of result.assets) {
        const response = await upload.file(asset.uri, 'attachment')
        if (response.url) uploaded.push(response.url)
      }
      setPhotos((current) => [...current, ...uploaded].slice(0, 5))
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Could not upload your photos.')
    } finally {
      setPhotoUploading(false)
    }
  }

  const useRecent = () => {
    if (!recentJob) return
    setDescription(recentJob.description || recentJob.title || '')
    const category = categories.find((item) => item.id === recentJob.categoryId)
    if (category) setSelectedCategory(category)
  }

  const submit = async () => {
    if (!selectedCategory || !description.trim()) return
    if (budgetMode === 'fixed' && Number(budget) <= 0) {
      Alert.alert('Add a budget', 'Enter a valid fixed budget or choose “Let taskers quote”.')
      return
    }

    setSubmitting(true)
    try {
      const response = await v2Jobs.create({
        title: cleanTitle(description),
        description: [
          description.trim(),
          locationText.trim() ? `Location: ${locationText.trim()}` : '',
          params.taskerName ? `Requested provider: ${params.taskerName}` : '',
        ].filter(Boolean).join('\n\n'),
        categoryId: selectedCategory.id,
        photos,
        budgetType: budgetMode === 'quotes' ? 'REQUEST_QUOTES' : 'FIXED',
        budgetAmount: budgetMode === 'fixed' ? Math.round(Number(budget)) : null,
        areaId: null,
        postalCode: null,
        preferredDate: when === 'tomorrow' ? tomorrowIso() : null,
        materialHandling: 'quote_both',
        urgency: params.urgency || 'normal',
        workersCount: 1,
        serviceTemplateId: selectedTemplate?.id || undefined,
        templateJobId: selectedTemplate?.refJob?.id || undefined,
        countryCode,
        targetTaskerId: params.taskerId || null,
        latitude: locationCoords.latitude,
        longitude: locationCoords.longitude,
        smartBookingJson: {
          source: 'V3_POST_JOB',
          naturalDescription: description.trim(),
          locationText: locationText.trim() || null,
          when,
          targetedTaskerId: params.taskerId || null,
        },
      })

      setCreatedJob(response.job)
      setStep(2)
    } catch (error: any) {
      let message = error?.message || 'Could not post your job.'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Could not post job', message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectSuggestion = (item: any) => {
    const full = categories.find((cat) => cat.id === item.id)
    setSelectedCategory(full || item)
    if (description.trim().length < 3) setDescription(item.name || 'Service request')
  }

  const renderBottomNav = step < 2 ? (
    <V3CustomerBottomNav
      activeTab="post"
      onTabPress={(tab) => {
        if (tab === 'post') return
        if (tab === 'home') router.push('/(customer)/(tabs)' as any)
        else router.push(`/(customer)/(tabs)/${tab}` as any)
      }}
      onPostJob={() => {}}
    />
  ) : null

  if (step === 2) {
    return (
      <SafeAreaView style={styles.successSafe}>
        <View style={styles.successWrap}>
          <View style={styles.successMark}>
            <Check size={34} color={v3.colors.success} weight="bold" />
          </View>
          <Text style={styles.successEyebrow}>JOB POSTED</Text>
          <Text style={styles.successTitle}>Your job is live</Text>
          <Text style={styles.successBody}>
            Nearby professionals have been notified.{params.taskerId ? ' Your selected provider can now review the request.' : ''}
          </Text>
          <Text style={styles.successBody}>Quotes will appear as they respond.</Text>

          <TouchableOpacity
            activeOpacity={0.82}
            style={styles.primaryButton}
            onPress={() => router.replace(`/(customer)/jobs/waiting/${createdJob?.id}` as any)}
          >
            <Text style={styles.primaryButtonText}>See matching</Text>
            <CaretRight size={19} color={v3.colors.paper} weight="bold" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.topBar}>
          {step === 1 ? (
            <TouchableOpacity onPress={() => setStep(0)} activeOpacity={0.72} style={styles.backButton}>
              <ArrowLeft size={20} color={v3.colors.ink} weight="bold" />
            </TouchableOpacity>
          ) : (
            <View style={styles.backSpacer} />
          )}
          <Text style={styles.pageTitle}>Post a job</Text>
          <View style={styles.backSpacer} />
        </View>

        {step === 0 ? (
          <>
            <Text style={styles.stepLabel}>STEP 1 OF 3</Text>
            <Text style={styles.heroTitle}>What needs fixing?</Text>
            <Text style={styles.heroSubtitle}>Describe it naturally. MaintainEX handles the form.</Text>

            <View style={styles.describeBox}>
              <TextInput
                ref={descriptionRef}
                value={description}
                onChangeText={setDescription}
                placeholder="My AC is running but not cooling"
                placeholderTextColor={v3.colors.textPlaceholder}
                multiline
                textAlignVertical="top"
                style={styles.describeInput}
              />
              <Text style={styles.helperText}>
                {description.trim().length > 0 ? 'Add any useful detail, timing, or symptoms.' : 'Example: It started this afternoon.'}
              </Text>

              <View style={styles.attachRow}>
                <TouchableOpacity activeOpacity={0.7} onPress={startVoice} style={[styles.attachAction, listening && styles.voiceActive]}>
                  {listening ? <ActivityIndicator size="small" color={v3.colors.ink} /> : <Microphone size={17} color={v3.colors.ink} weight="fill" />}
                  <Text style={styles.attachText}>{listening ? 'Listening…' : 'Voice'}</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={pickPhotos} style={styles.attachAction}>
                  {photoUploading ? (
                    <ActivityIndicator size="small" color={v3.colors.ink} />
                  ) : (
                    <Plus size={18} color={v3.colors.ink} weight="bold" />
                  )}
                  <Text style={styles.attachText}>Photo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
                {photos.map((uri) => (
                  <View key={uri} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photo} />
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setPhotos((current) => current.filter((item) => item !== uri))}
                      style={styles.photoRemove}
                    >
                      <X size={12} color={v3.colors.paper} weight="bold" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{searchResults.length ? 'Best match' : 'Popular near you'}</Text>
              {searching ? <ActivityIndicator size="small" color={v3.colors.ink} /> : null}
            </View>

            {loading ? (
              <View style={styles.loadingBlock}><ActivityIndicator color={v3.colors.ink} /></View>
            ) : (
              <View style={styles.suggestionGrid}>
                {displayedSuggestions.map((item: any) => {
                  const selected = selectedCategory?.id === item.id
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => selectSuggestion(item)}
                      activeOpacity={0.75}
                      style={[styles.suggestionChip, selected && styles.suggestionChipSelected]}
                    >
                      <Text style={[styles.suggestionText, selected && styles.suggestionTextSelected]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {recentJob ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Recent request</Text>
                <TouchableOpacity activeOpacity={0.78} onPress={useRecent} style={styles.recentCard}>
                  <View style={styles.recentIcon}>
                    <ClockAfternoon size={20} color={v3.colors.ink} weight="fill" />
                  </View>
                  <View style={styles.recentCopy}>
                    <Text style={styles.recentTitle} numberOfLines={1}>{recentJob.title}</Text>
                    <Text style={styles.recentMeta}>Your previous MaintainEX request</Text>
                  </View>
                  <Text style={styles.rebookText}>Rebook</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <View style={styles.fastPath}>
              <Sparkle size={18} color={v3.colors.amberDark} weight="fill" />
              <View style={styles.fastPathCopy}>
                <Text style={styles.fastPathTitle}>Fast path</Text>
                <Text style={styles.fastPathText}>We’ll ask only what this job needs.</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.82}
              disabled={!canContinue}
              onPress={() => setStep(1)}
              style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
              <CaretRight size={19} color={v3.colors.paper} weight="bold" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.stepLabel}>STEP 2 OF 3</Text>
            <Text style={styles.heroTitle}>Confirm the basics</Text>
            <Text style={styles.heroSubtitle}>We pre-filled what we already know.</Text>

            <View style={styles.confirmCard}>
              <View style={styles.confirmRow}>
                <View style={styles.confirmIcon}><MapPin size={19} color={v3.colors.ink} weight="fill" /></View>
                <View style={styles.confirmCopy}>
                  <Text style={styles.confirmLabel}>Location</Text>
                  <TextInput
                    value={locationText}
                    onChangeText={setLocationText}
                    placeholder="Add area or address"
                    placeholderTextColor={v3.colors.textPlaceholder}
                    style={styles.inlineInput}
                  />
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.confirmRow}>
                <View style={styles.confirmIcon}><ClockAfternoon size={19} color={v3.colors.ink} weight="fill" /></View>
                <View style={styles.confirmCopy}>
                  <Text style={styles.confirmLabel}>When</Text>
                  <View style={styles.segmentRow}>
                    {([
                      ['now', 'Now'],
                      ['tomorrow', 'Tomorrow'],
                      ['flexible', 'Flexible'],
                    ] as const).map(([value, label]) => (
                      <TouchableOpacity
                        key={value}
                        onPress={() => setWhen(value)}
                        activeOpacity={0.72}
                        style={[styles.segment, when === value && styles.segmentSelected]}
                      >
                        <Text style={[styles.segmentText, when === value && styles.segmentTextSelected]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <TouchableOpacity activeOpacity={0.72} onPress={pickPhotos} style={styles.confirmRow}>
                <View style={styles.confirmIcon}><Camera size={19} color={v3.colors.ink} weight="fill" /></View>
                <View style={styles.confirmCopy}>
                  <Text style={styles.confirmLabel}>Photos</Text>
                  <Text style={styles.confirmValue}>
                    {photos.length ? `${photos.length} attached` : 'Add optional photos'}
                  </Text>
                </View>
                {photoUploading ? <ActivityIndicator size="small" color={v3.colors.ink} /> : <Plus size={18} color={v3.colors.ink} weight="bold" />}
              </TouchableOpacity>

              <View style={styles.divider} />

              <View style={styles.confirmRow}>
                <View style={styles.confirmIcon}><Wallet size={19} color={v3.colors.ink} weight="fill" /></View>
                <View style={styles.confirmCopy}>
                  <Text style={styles.confirmLabel}>Budget</Text>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    onPress={() => setBudgetMode(budgetMode === 'quotes' ? 'fixed' : 'quotes')}
                  >
                    <Text style={styles.confirmValue}>
                      {budgetMode === 'quotes' ? 'Let taskers quote' : 'Set fixed budget'}
                    </Text>
                  </TouchableOpacity>
                  {budgetMode === 'fixed' ? (
                    <TextInput
                      value={budget}
                      onChangeText={setBudget}
                      keyboardType="numeric"
                      placeholder="LKR amount"
                      placeholderTextColor={v3.colors.textPlaceholder}
                      style={styles.budgetInput}
                    />
                  ) : null}
                </View>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 18, marginBottom: 10 }]}>Pin the exact location</Text>
            <JobLocationPicker
              value={{ latitude: locationCoords.latitude, longitude: locationCoords.longitude, label: locationText }}
              onChange={(next: JobLocationValue) => {
                setLocationCoords({ latitude: next.latitude, longitude: next.longitude })
                if (next.label) setLocationText(next.label)
              }}
            />

            <View style={styles.rangeCard}>
              <View>
                <Text style={styles.rangeLabel}>Estimated local range</Text>
                <Text style={styles.rangeValue}>
                  {localRange
                    ? `${localRange.currency} ${Math.round(localRange.min).toLocaleString()} – ${Math.round(localRange.max).toLocaleString()}`
                    : 'Taskers will quote after you post'}
                </Text>
              </View>
              <View style={styles.aiBadge}>
                <Sparkle size={13} color={v3.colors.amberDark} weight="fill" />
                <Text style={styles.aiText}>AI</Text>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>REQUEST</Text>
              <Text style={styles.summaryText} numberOfLines={3}>{description.trim()}</Text>
              <Text style={styles.summaryCategory}>{selectedCategory?.name}</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.82}
              disabled={submitting}
              onPress={submit}
              style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={v3.colors.paper} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Get quotes</Text>
                  <CheckCircle size={19} color={v3.colors.paper} weight="fill" />
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {renderBottomNav}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  scroll: { paddingHorizontal: 18, paddingTop: 6 },
  topBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
  },
  backSpacer: { width: 38 },
  pageTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 17, color: v3.colors.ink },
  stepLabel: {
    marginTop: 14,
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 10,
    letterSpacing: 1,
    color: v3.colors.textMuted,
  },
  heroTitle: {
    marginTop: 8,
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 29,
    lineHeight: 35,
    color: v3.colors.ink,
  },
  heroSubtitle: {
    marginTop: 6,
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: v3.colors.textSecondary,
  },
  describeBox: {
    marginTop: 18,
    minHeight: 180,
    padding: 16,
    borderRadius: 20,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
  },
  describeInput: {
    minHeight: 86,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 20,
    lineHeight: 28,
    color: v3.colors.ink,
  },
  helperText: {
    marginTop: 6,
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: v3.colors.textMuted,
  },
  attachRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  attachAction: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: v3.colors.canvas,
    borderWidth: 1,
    borderColor: v3.colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  disabledAction: { opacity: 0.55 },
  voiceActive: { backgroundColor: v3.colors.amberSoft, borderColor: '#F2D08C' },
  attachText: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: v3.colors.ink },
  photoStrip: { gap: 10, paddingTop: 12 },
  photoWrap: { width: 72, height: 72, borderRadius: 14, overflow: 'hidden' },
  photo: { width: 72, height: 72 },
  photoRemove: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: v3.colors.ink,
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: v3.colors.ink },
  loadingBlock: {
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: v3.colors.paper,
  },
  suggestionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    maxWidth: '100%',
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
  },
  suggestionChipSelected: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  suggestionText: { fontFamily: 'Outfit_600SemiBold', fontSize: 12, color: v3.colors.ink, maxWidth: 155 },
  suggestionTextSelected: { color: v3.colors.paper },
  recentCard: {
    marginTop: 10,
    minHeight: 68,
    padding: 12,
    borderRadius: 16,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: v3.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentCopy: { flex: 1, marginLeft: 11 },
  recentTitle: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: v3.colors.ink },
  recentMeta: { marginTop: 2, fontFamily: 'Outfit_400Regular', fontSize: 11, color: v3.colors.textMuted },
  rebookText: { fontFamily: 'Outfit_700Bold', fontSize: 12, color: v3.colors.ink },
  fastPath: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: v3.colors.amberSoft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fastPathCopy: { marginLeft: 10 },
  fastPathTitle: { fontFamily: 'Outfit_700Bold', fontSize: 13, color: v3.colors.ink },
  fastPathText: { marginTop: 1, fontFamily: 'Outfit_400Regular', fontSize: 12, color: v3.colors.textSecondary },
  primaryButton: {
    marginTop: 18,
    height: 56,
    borderRadius: 16,
    backgroundColor: v3.colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonDisabled: { opacity: 0.36 },
  primaryButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: v3.colors.paper },
  confirmCard: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    overflow: 'hidden',
  },
  confirmRow: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: v3.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  confirmCopy: { flex: 1 },
  confirmLabel: { fontFamily: 'Outfit_700Bold', fontSize: 12, color: v3.colors.textMuted },
  confirmValue: { marginTop: 4, fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: v3.colors.ink },
  inlineInput: {
    marginTop: 2,
    paddingVertical: 4,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: v3.colors.ink,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: v3.colors.line, marginLeft: 64 },
  segmentRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segment: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: v3.colors.canvas,
    borderWidth: 1,
    borderColor: v3.colors.line,
  },
  segmentSelected: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  segmentText: { fontFamily: 'Outfit_600SemiBold', fontSize: 11, color: v3.colors.ink },
  segmentTextSelected: { color: v3.colors.paper },
  budgetInput: {
    marginTop: 8,
    height: 42,
    borderRadius: 11,
    paddingHorizontal: 12,
    backgroundColor: v3.colors.canvas,
    borderWidth: 1,
    borderColor: v3.colors.line,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: v3.colors.ink,
  },
  rangeCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: v3.colors.amberSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rangeLabel: { fontFamily: 'Outfit_600SemiBold', fontSize: 12, color: v3.colors.textSecondary },
  rangeValue: { marginTop: 3, fontFamily: 'Outfit_800ExtraBold', fontSize: 17, color: v3.colors.ink },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: v3.colors.paper,
  },
  aiText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 10, color: v3.colors.amberDark },
  summaryCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
  },
  summaryLabel: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 10,
    letterSpacing: 0.8,
    color: v3.colors.textMuted,
  },
  summaryText: { marginTop: 8, fontFamily: 'Outfit_600SemiBold', fontSize: 15, lineHeight: 21, color: v3.colors.ink },
  summaryCategory: { marginTop: 8, fontFamily: 'Outfit_500Medium', fontSize: 12, color: v3.colors.textSecondary },
  successSafe: { flex: 1, backgroundColor: v3.colors.canvas },
  successWrap: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successMark: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: v3.colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successEyebrow: {
    marginTop: 22,
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 10,
    letterSpacing: 1.3,
    color: v3.colors.textMuted,
  },
  successTitle: {
    marginTop: 10,
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 30,
    color: v3.colors.ink,
    textAlign: 'center',
  },
  successBody: {
    marginTop: 8,
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: v3.colors.textSecondary,
    textAlign: 'center',
  },
})
