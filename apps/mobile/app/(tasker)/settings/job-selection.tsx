import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretLeft, Check, Wrench } from 'phosphor-react-native'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { skillsApi } from '../../../lib/api'
import { v3 } from '../../../theme/v3/tokens'

type JobItem = {
  id: string
  name: string
  priceMin: number
  priceMax: number
  currency: string
  selected: boolean
  hourlyRate: number
  fixedRate: number
  experienceYears: number
  experienceLevel: number
}

type CatRow = { id: string; name: string; iconName: string; jobs: JobItem[] }

const LEVELS = [
  { label: 'Beginner', value: 1 },
  { label: 'Intermediate', value: 2 },
  { label: 'Expert', value: 3 },
]

export default function JobSelectionScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [cats, setCats] = useState<CatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res: any = await skillsApi.list()
      setCats(Array.isArray(res) ? res : (res?.categories || []))
    } catch {
      Alert.alert('Error', 'Could not load services.')
    } finally {
      setLoading(false)
    }
  }

  const toggle = (catIdx: number, jobIdx: number) => {
    const next = [...cats]
    const job = next[catIdx].jobs[jobIdx]
    next[catIdx].jobs[jobIdx] = { ...job, selected: !job.selected }
    setCats(next)
  }

  const patchJob = (catIdx: number, jobIdx: number, patch: Partial<JobItem>) => {
    const next = [...cats]
    next[catIdx].jobs[jobIdx] = { ...next[catIdx].jobs[jobIdx], ...patch }
    setCats(next)
  }

  const handleSave = async () => {
    const picked: any[] = []
    for (const cat of cats) {
      for (const job of cat.jobs) {
        if (job.selected) {
          picked.push({
            jobId: job.id,
            hourlyRate: job.hourlyRate || job.priceMin,
            fixedRate: job.fixedRate || 0,
            experienceYears: job.experienceYears || 0,
            experienceLevel: job.experienceLevel || 1,
          })
        }
      }
    }
    if (picked.length === 0) {
      Alert.alert('No services selected', 'Pick at least one service you offer.')
      return
    }
    setSaving(true)
    try {
      await skillsApi.save(picked)
      Alert.alert('Saved', 'Your service selection has been updated.')
      router.back()
    } catch {
      Alert.alert('Error', 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const selectedCount = cats.reduce((n, c) => n + c.jobs.filter(j => j.selected).length, 0)

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
        <View style={styles.loadingWrap}><ActivityIndicator size="small" color={v3.colors.ink} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.hero}>What can you do?</Text>
          <Text style={styles.subtitle}>Choose the jobs you want MaintainEX to match with your Tasker account.</Text>

          <View style={styles.countCard}>
            <Text style={styles.countValue}>{selectedCount}</Text>
            <Text style={styles.countLabel}>{selectedCount === 1 ? 'service selected' : 'services selected'}</Text>
          </View>

          {cats.map((cat, ci) => (
            <View key={cat.id} style={styles.category}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryIcon}><Wrench size={16} color={v3.colors.ink} weight="bold" /></View>
                <Text style={styles.categoryName}>{cat.name}</Text>
              </View>

              {cat.jobs.length === 0 ? (
                <Text style={styles.emptyJobs}>No active jobs in this category.</Text>
              ) : (
                cat.jobs.map((job, ji) => (
                  <View key={job.id} style={styles.serviceWrap}>
                    <TouchableOpacity style={styles.serviceRow} activeOpacity={0.72} onPress={() => toggle(ci, ji)}>
                      <View style={[styles.check, job.selected && styles.checkSelected]}>
                        {job.selected ? <Check size={13} color={v3.colors.paper} weight="bold" /> : null}
                      </View>
                      <View style={styles.serviceCopy}>
                        <Text style={styles.serviceName}>{job.name}</Text>
                        <Text style={styles.serviceMeta}>
                          {job.selected ? 'Active for matching' : 'Tap to add this service'}
                        </Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>

                    {job.selected ? (
                      <View style={styles.configCard}>
                        <View style={styles.rateRow}>
                          <Text style={styles.configLabel}>Hourly rate</Text>
                          <View style={styles.rateInputWrap}>
                            <Text style={styles.currency}>{job.currency || 'LKR'}</Text>
                            <TextInput
                              style={styles.rateInput}
                              value={String(job.hourlyRate || '')}
                              keyboardType="numeric"
                              placeholder={String(job.priceMin || 0)}
                              placeholderTextColor={v3.colors.textPlaceholder}
                              onChangeText={(value) => patchJob(ci, ji, { hourlyRate: Number(value) || 0 })}
                            />
                          </View>
                        </View>

                        <Text style={styles.configLabel}>Experience</Text>
                        <View style={styles.levelRow}>
                          {LEVELS.map((level) => {
                            const selected = job.experienceLevel === level.value
                            return (
                              <TouchableOpacity
                                key={level.value}
                                style={[styles.levelButton, selected && styles.levelButtonSelected]}
                                activeOpacity={0.72}
                                onPress={() => patchJob(ci, ji, { experienceLevel: level.value })}
                              >
                                <Text style={[styles.levelText, selected && styles.levelTextSelected]}>{level.label}</Text>
                              </TouchableOpacity>
                            )
                          })}
                        </View>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          ))}

          <TouchableOpacity style={[styles.saveButton, saving && styles.disabled]} onPress={handleSave} disabled={saving} activeOpacity={0.78}>
            {saving ? <ActivityIndicator size="small" color={v3.colors.paper} /> : <Text style={styles.saveText}>Save services{selectedCount ? ` · ${selectedCount}` : ''}</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (_colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  topBar: { height: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 38, height: 38 },
  topTitle: { fontSize: 14, fontFamily: fonts.headingBold, color: v3.colors.ink },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  hero: { marginTop: 8, fontSize: 27, lineHeight: 33, fontFamily: fonts.heading, color: v3.colors.ink, letterSpacing: -0.35 },
  subtitle: { marginTop: 6, maxWidth: 330, fontSize: 10.5, lineHeight: 16, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  countCard: { height: 60, marginTop: 20, paddingHorizontal: 15, borderRadius: 16, backgroundColor: v3.colors.ink, flexDirection: 'row', alignItems: 'center' },
  countValue: { fontSize: 22, fontFamily: fonts.heading, color: v3.colors.paper },
  countLabel: { marginLeft: 9, fontSize: 9.5, fontFamily: fonts.bodySemiBold, color: '#CFCFCF' },
  category: { marginTop: 22 },
  categoryHeader: { height: 42, flexDirection: 'row', alignItems: 'center' },
  categoryIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  categoryName: { marginLeft: 9, fontSize: 12.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  emptyJobs: { paddingVertical: 10, fontSize: 9.5, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  serviceWrap: { marginBottom: 8 },
  serviceRow: { minHeight: 58, paddingHorizontal: 12, borderRadius: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: '#C5C5C5', alignItems: 'center', justifyContent: 'center' },
  checkSelected: { borderColor: v3.colors.ink, backgroundColor: v3.colors.ink },
  serviceCopy: { flex: 1, marginLeft: 10, paddingRight: 8 },
  serviceName: { fontSize: 10.8, fontFamily: fonts.headingBold, color: v3.colors.ink },
  serviceMeta: { marginTop: 3, fontSize: 8.5, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  chevron: { fontSize: 20, fontFamily: fonts.body, color: v3.colors.textMuted },
  configCard: { marginTop: 6, padding: 12, borderRadius: 14, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  rateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  configLabel: { fontSize: 8.8, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  rateInputWrap: { width: 142, height: 42, borderRadius: 12, paddingHorizontal: 10, backgroundColor: v3.colors.surfaceGray, flexDirection: 'row', alignItems: 'center' },
  currency: { fontSize: 9, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  rateInput: { flex: 1, paddingVertical: 0, marginLeft: 5, textAlign: 'right', fontSize: 12, fontFamily: fonts.headingBold, color: v3.colors.ink },
  levelRow: { flexDirection: 'row', gap: 6, marginTop: 7 },
  levelButton: { flex: 1, height: 38, borderRadius: 11, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  levelButtonSelected: { backgroundColor: v3.colors.ink },
  levelText: { fontSize: 8.5, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  levelTextSelected: { color: v3.colors.paper },
  saveButton: { height: 54, marginTop: 24, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  saveText: { fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.paper },
})
