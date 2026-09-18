import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretLeft, Check, Wrench } from 'phosphor-react-native'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { skillsApi } from '../../../lib/api'

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
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <CaretLeft size={24} color="#FFFFFF" weight="bold" />
        </TouchableOpacity>
        <Text style={styles.heading}>Your Services</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#F5A623" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subTitle}>
            Tell customers which jobs you handle and set an hourly rate for each.
          </Text>

          {cats.map((cat, ci) => (
            <View key={cat.id} style={[styles.catCard, { backgroundColor: '#FFFFFF' }]}>
              <View style={styles.catHeader}>
                <Wrench size={16} color="#F5A623" weight="fill" />
                <Text style={[styles.catName, { color: '#000000' }]}>{cat.name}</Text>
              </View>
              {cat.jobs.length === 0 ? (
                <Text style={[styles.emptyJobs, { color: '#6F6B6B' }]}>No jobs in this category yet.</Text>
              ) : (
                cat.jobs.map((job, ji) => (
                  <TouchableOpacity key={job.id} style={styles.jobRow} onPress={() => toggle(ci, ji)} activeOpacity={0.7}>
                    <View style={[styles.check, job.selected && { backgroundColor: '#F5A623', borderColor: '#F5A623' }]}>
                      {job.selected && <Check size={13} color="#0D0D0D" weight="fill" />}
                    </View>
                    <View style={styles.jobBody}>
                      <Text style={[styles.jobName, { color: '#000000' }]}>{job.name}</Text>
                      {job.selected ? (
                        <View>
                          <View style={[styles.rateWrap, { borderColor: '#E5E5E5' }]}>
                            <Text style={[styles.rateLabel, { color: '#6F6B6B' }]}>Rate ({job.currency}/hr)</Text>
                            <TextInput
                              style={[styles.rateInput, { color: '#000000' }]}
                              value={String(job.hourlyRate || '')}
                              keyboardType="numeric"
                              placeholder={`Default ${job.priceMin || ''}`}
                              placeholderTextColor="#6F6B6B"
                              onPressIn={(e: any) => e.stopPropagation?.()}
                              onChangeText={(v) => patchJob(ci, ji, { hourlyRate: Number(v) || 0 })}
                            />
                          </View>
                          <View style={styles.levelWrap}>
                            <Text style={[styles.rateLabel, { color: '#6F6B6B' }]}>Experience</Text>
                            <View style={styles.levelRow}>
                              {LEVELS.map(lv => (
                                <TouchableOpacity
                                  key={lv.value}
                                  onPress={(e: any) => { e.stopPropagation?.(); patchJob(ci, ji, { experienceLevel: lv.value }) }}
                                  style={[
                                    styles.levelBtn,
                                    job.experienceLevel === lv.value ? { backgroundColor: '#F5A623' } : { backgroundColor: '#2E2E2E' },
                                  ]}
                                >
                                  <Text style={[styles.levelText, { color: job.experienceLevel === lv.value ? '#0D0D0D' : '#6F6B6B' }]}>
                                    {lv.label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ))}

          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#F5A623' }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#0D0D0D" />
            ) : (
              <Text style={styles.saveText}>Save {selectedCount > 0 ? `(${selectedCount})` : ''}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  heading: { fontSize: 18, fontFamily: fonts.bodyMedium, color: '#000000' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  subTitle: { fontSize: 13, fontFamily: fonts.body, color: '#6F6B6B', marginBottom: 16, lineHeight: 19 },
  catCard: { borderRadius: 16, padding: 14, marginBottom: 12 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  catName: { fontSize: 15, fontFamily: fonts.bodyMedium },
  emptyJobs: { fontSize: 12, fontFamily: fonts.body, paddingVertical: 8 },
  jobRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E5E5E5', marginTop: 4 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#6F6B6B', alignItems: 'center', justifyContent: 'center', marginTop: 1, marginRight: 10 },
  jobBody: { flex: 1 },
  jobName: { fontSize: 14, fontFamily: fonts.bodyMedium },
  rateWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 },
  rateLabel: { fontSize: 11, fontFamily: fonts.body },
  rateInput: { flex: 1, fontSize: 13, fontFamily: fonts.bodyMedium, textAlign: 'right' },
  levelWrap: { marginTop: 8 },
  levelRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  levelBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  levelText: { fontSize: 11, fontFamily: fonts.bodyMedium },
  saveBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  saveText: { fontSize: 15, fontFamily: fonts.bodyMedium, color: '#0D0D0D' },
})
