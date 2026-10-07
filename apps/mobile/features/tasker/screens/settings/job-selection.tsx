import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretLeft, CheckCircle, MagnifyingGlass } from 'phosphor-react-native'

import { skillsApi } from '@/api/taskers'
import { fonts } from '@/lib/fonts'
import { v3 } from '@/theme/v3/tokens'

type JobItem = {
  id: string
  name: string
  description?: string
  priceMin: number
  priceMax: number
  currency: string
  selected: boolean
  hourlyRate: number
  fixedRate: number
  experienceYears: number
  experienceLevel: number
}

type CatRow = {
  id: string
  name: string
  iconName?: string
  jobs: JobItem[]
}

const MAX_SERVICES = 15

export default function JobSelectionScreen() {
  const router = useRouter()
  const [cats, setCats] = useState<CatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res: any = await skillsApi.list()
      const rows: CatRow[] = Array.isArray(res) ? res : (res?.categories || [])
      setCats(rows)
      setActiveCategoryId(current =>
        current && rows.some(category => category.id === current)
          ? current
          : rows[0]?.id || null
      )
    } catch {
      Alert.alert('Unable to load services', 'Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const allJobs = useMemo(() => cats.flatMap(category => category.jobs || []), [cats])
  const selectedJobs = useMemo(() => allJobs.filter(job => job.selected), [allJobs])
  const selectedCount = selectedJobs.length

  const visibleJobs = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (search) {
      return allJobs.filter(job =>
        job.name.toLowerCase().includes(search) ||
        String(job.description || '').toLowerCase().includes(search)
      )
    }

    return cats.find(category => category.id === activeCategoryId)?.jobs || []
  }, [activeCategoryId, allJobs, cats, query])

  const toggle = (jobId: string) => {
    const current = allJobs.find(job => job.id === jobId)
    if (!current?.selected && selectedCount >= MAX_SERVICES) {
      Alert.alert('Service limit', `Choose up to ${MAX_SERVICES} services. Remove one before adding another.`)
      return
    }

    setCats(rows => rows.map(category => ({
      ...category,
      jobs: category.jobs.map(job =>
        job.id === jobId ? { ...job, selected: !job.selected } : job
      ),
    })))
  }

  const handleSave = async () => {
    if (selectedCount === 0) {
      Alert.alert('Choose a service', 'Select at least one service you want to receive jobs for.')
      return
    }

    const picked = selectedJobs.map(job => ({
      jobId: job.id,
      hourlyRate: job.hourlyRate || 0,
      fixedRate: job.fixedRate || 0,
      experienceYears: job.experienceYears || 0,
      experienceLevel: job.experienceLevel || 1,
    }))

    setSaving(true)
    try {
      await skillsApi.save(picked)
      Alert.alert('Services updated', 'Your Tasker job matching has been updated.')
      router.back()
    } catch (err: any) {
      let message = err?.message || 'Could not save your services.'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Unable to save', message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.72}>
          <CaretLeft size={17} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Your services</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={v3.colors.ink} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.hero}>Choose the work you want</Text>
          <Text style={styles.subtitle}>Select exact services. MaintainEX will use them for matching. Rates, experience and verification stay separate in your profile.</Text>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryCount}>{selectedCount}/{MAX_SERVICES} selected</Text>
            <Text style={styles.summaryText}>
              {selectedJobs.length
                ? selectedJobs.slice(0, 3).map(job => job.name).join(' · ') + (selectedJobs.length > 3 ? ` +${selectedJobs.length - 3} more` : '')
                : 'Pick at least one service.'}
            </Text>
          </View>

          <View style={styles.searchBox}>
            <MagnifyingGlass size={17} color={v3.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search services"
              placeholderTextColor={v3.colors.textPlaceholder}
            />
          </View>

          {!query.trim() ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabs}>
              {cats.map(category => {
                const active = category.id === activeCategoryId
                const picked = category.jobs.filter(job => job.selected).length

                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[styles.categoryTab, active && styles.categoryTabActive]}
                    onPress={() => setActiveCategoryId(category.id)}
                    activeOpacity={0.78}
                  >
                    <Text style={[styles.categoryTabText, active && styles.categoryTabTextActive]}>{category.name}</Text>
                    {picked > 0 ? (
                      <View style={[styles.categoryBadge, active && styles.categoryBadgeActive]}>
                        <Text style={[styles.categoryBadgeText, active && styles.categoryBadgeTextActive]}>{picked}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          ) : null}

          <View style={styles.jobList}>
            {visibleJobs.map(job => (
              <TouchableOpacity
                key={job.id}
                style={[styles.jobRow, job.selected && styles.jobRowSelected]}
                onPress={() => toggle(job.id)}
                activeOpacity={0.76}
              >
                <View style={[styles.check, job.selected && styles.checkSelected]}>
                  {job.selected ? <CheckCircle size={20} color={v3.colors.paper} weight="fill" /> : null}
                </View>

                <View style={styles.jobCopy}>
                  <Text style={styles.jobName}>{job.name}</Text>
                  {job.description ? (
                    <Text style={styles.jobDescription} numberOfLines={2}>{job.description}</Text>
                  ) : (
                    <Text style={styles.jobDescription}>{job.selected ? 'Included in your job matching' : 'Tap to add this service'}</Text>
                  )}
                </View>

                <Text style={[styles.stateLabel, job.selected && styles.stateLabelSelected]}>
                  {job.selected ? 'Selected' : 'Add'}
                </Text>
              </TouchableOpacity>
            ))}

            {visibleJobs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No matching services</Text>
                <Text style={styles.emptyText}>Try another search or choose a different category.</Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, (saving || selectedCount === 0) && styles.disabled]}
            onPress={handleSave}
            disabled={saving || selectedCount === 0}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={v3.colors.paper} />
            ) : (
              <Text style={styles.saveText}>Save {selectedCount} service{selectedCount === 1 ? '' : 's'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  topBar: { height: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 38, height: 38 },
  topTitle: { fontSize: 14, fontFamily: fonts.headingBold, color: v3.colors.ink },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  hero: { marginTop: 8, fontSize: 27, lineHeight: 33, fontFamily: fonts.heading, color: v3.colors.ink, letterSpacing: -0.35 },
  subtitle: { marginTop: 6, maxWidth: 340, fontSize: 10.5, lineHeight: 16, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  summaryCard: { marginTop: 18, padding: 14, borderRadius: 16, backgroundColor: v3.colors.ink },
  summaryCount: { fontSize: 14, fontFamily: fonts.headingBold, color: v3.colors.paper },
  summaryText: { marginTop: 5, fontSize: 9.5, lineHeight: 14, fontFamily: fonts.bodySemiBold, color: '#D1D1D1' },
  searchBox: { height: 52, marginTop: 14, borderRadius: 15, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.paper, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, fontSize: 11.5, fontFamily: fonts.bodySemiBold, color: v3.colors.ink, paddingVertical: 0 },
  categoryTabs: { paddingTop: 14, paddingBottom: 12, gap: 8, paddingRight: 16 },
  categoryTab: { minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.paper, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  categoryTabActive: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  categoryTabText: { fontSize: 10, fontFamily: fonts.headingBold, color: v3.colors.ink },
  categoryTabTextActive: { color: v3.colors.paper },
  categoryBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  categoryBadgeActive: { backgroundColor: v3.colors.paper },
  categoryBadgeText: { fontSize: 8, fontFamily: fonts.headingBold, color: v3.colors.paper },
  categoryBadgeTextActive: { color: v3.colors.ink },
  jobList: { gap: 9 },
  jobRow: { minHeight: 70, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 16, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.paper, flexDirection: 'row', alignItems: 'center' },
  jobRowSelected: { borderColor: v3.colors.ink, borderWidth: 1.5 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  checkSelected: { borderColor: v3.colors.ink, backgroundColor: v3.colors.ink },
  jobCopy: { flex: 1, marginLeft: 11, paddingRight: 8 },
  jobName: { fontSize: 11.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  jobDescription: { marginTop: 3, fontSize: 9, lineHeight: 13, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  stateLabel: { fontSize: 9, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  stateLabelSelected: { color: v3.colors.ink },
  emptyCard: { padding: 22, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center' },
  emptyTitle: { fontSize: 12, fontFamily: fonts.headingBold, color: v3.colors.ink },
  emptyText: { marginTop: 4, fontSize: 9.5, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted, textAlign: 'center' },
  saveButton: { height: 54, marginTop: 24, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  saveText: { fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.paper },
})
