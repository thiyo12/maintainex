import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CaretDown, CaretUp, CheckCircle } from 'phosphor-react-native'
import { useRouter } from 'expo-router'

import { useAuth } from '../../../lib/auth'
import { jobCategories, skillsApi } from '../../../lib/api'
import { v3 } from '../../../theme/v3/tokens'
import V3Button from '../../../components/v3/V3Button'
import V3NavBar from '../../../components/v3/V3NavBar'

const MAX_SERVICES = 15

interface ServiceJob {
  id: string
  name: string
  selected?: boolean
  experienceYears?: number
  experienceLevel?: number
  hourlyRate?: number
  fixedRate?: number
}

interface ServiceCategory {
  id: string
  name: string
  jobs: ServiceJob[]
}

export default function TaskerServicesOnboarding() {
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')

  const needsPhone = !user?.phone
  const selectedJobs = useMemo(
    () => categories.flatMap(category => category.jobs).filter(job => selected.has(job.id)),
    [categories, selected]
  )

  const loadServices = async () => {
    setLoading(true)
    setLoadError('')

    const normalize = (rows: any[]): ServiceCategory[] =>
      rows
        .filter((category: any) => category?.id && category?.name)
        .map((category: any) => ({
          id: category.id,
          name: category.name,
          jobs: Array.isArray(category.jobs)
            ? category.jobs
                .filter((job: any) => job?.id && job?.name && job?.isCompanyOnly !== true)
                .map((job: any) => ({
                  ...job,
                  selected: Boolean(job.selected),
                }))
            : [],
        }))
        .filter((category: ServiceCategory) => category.jobs.length > 0)

    try {
      let normalized: ServiceCategory[] = []

      try {
        const response: any = await skillsApi.list()
        const rows = Array.isArray(response)
          ? response
          : Array.isArray(response?.categories)
            ? response.categories
            : Array.isArray(response?.data)
              ? response.data
              : []
        normalized = normalize(rows)
      } catch (primaryError) {
        console.warn('Tasker service selection endpoint unavailable; loading public service catalog instead.', primaryError)
      }

      // Fresh/legacy tasker accounts can briefly have no TaskerProfile on the
      // production API. The public job catalog is the canonical fallback, so
      // onboarding never gets trapped on “Services could not load”.
      if (normalized.length === 0) {
        const publicRows: any = await jobCategories.list(((user as any)?.countryCode || 'LK').toUpperCase())
        const rows = Array.isArray(publicRows)
          ? publicRows
          : Array.isArray(publicRows?.data)
            ? publicRows.data
            : []
        normalized = normalize(rows)
      }

      if (normalized.length === 0) {
        setCategories([])
        setLoadError('No active services are available right now. Please try again.')
        return
      }

      setCategories(normalized)
      setExpanded(current => current && normalized.some(category => category.id === current) ? current : normalized[0]?.id || null)
      setSelected(new Set(
        normalized.flatMap((category: ServiceCategory) => category.jobs)
          .filter((job: ServiceJob) => job.selected)
          .map((job: ServiceJob) => job.id)
      ))
    } catch (err: any) {
      let message = err?.message || 'Unable to load services'
      try { message = JSON.parse(message).error || message } catch {}
      setLoadError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    if (user.role === 'CUSTOMER') {
      router.replace('/(customer)' as any)
      return
    }
    if (user.role === 'COMPANY') {
      router.replace('/(company)' as any)
      return
    }
    loadServices()
  }, [user?.id, user?.role])

  const toggle = (jobId: string) => {
    setSelected(current => {
      const next = new Set(current)
      if (next.has(jobId)) {
        next.delete(jobId)
        return next
      }
      if (next.size >= MAX_SERVICES) {
        Alert.alert('Service limit', `Choose up to ${MAX_SERVICES} services. You can update them later from Your Services.`)
        return current
      }
      next.add(jobId)
      return next
    })
  }

  const handleSave = async () => {
    if (selected.size === 0) {
      Alert.alert('Choose your services', 'Select at least one exact service you can provide.')
      return
    }
    if (needsPhone) {
      Alert.alert('Mobile verification required', 'This account does not have a verified mobile number. Sign out and complete the new mobile registration flow before continuing.')
      return
    }

    setSaving(true)
    try {
      const payload = selectedJobs.map(job => ({
        jobId: job.id,
        experienceYears: job.experienceYears || 0,
        experienceLevel: job.experienceLevel || 1,
        hourlyRate: job.hourlyRate || 0,
        fixedRate: job.fixedRate || 0,
      }))
      await skillsApi.save(payload)

      await refreshUser()

      // Service selection is profile readiness, not an authentication gate.
      // Save successfully and return to the Tasker workspace; identity and
      // other readiness items remain available from Tasker Profile.
      router.replace('/(tasker)' as any)
    } catch (err: any) {
      let message = err?.message || 'Unable to save services'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Unable to continue', message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.screen}>
      <V3NavBar title="Your services" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Choose exact services</Text>
        <Text style={styles.subtitle}>Do not select an entire trade unless you can perform each service. MaintainEX uses these selections to decide which jobs reach you.</Text>

        {needsPhone ? (
          <View style={styles.phoneCard}>
            <Text style={styles.warningTitle}>Mobile verification required</Text>
            <Text style={styles.warningText}>This legacy Tasker account has no verified mobile number. A verified number is required before service onboarding can continue.</Text>
          </View>
        ) : null}

        <View style={styles.summary}>
          <Text style={styles.summaryCount}>{selected.size}/{MAX_SERVICES} selected</Text>
          <Text style={styles.summaryText}>You can add, remove and price individual services later from Tasker Profile → Your Services.</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={v3.colors.ink} style={{ marginTop: 40 }} />
        ) : loadError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Services could not load</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadServices} activeOpacity={0.78}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : categories.map(category => {
          const open = expanded === category.id
          const categorySelected = category.jobs.filter(job => selected.has(job.id)).length
          return (
            <View key={category.id} style={styles.category}>
              <TouchableOpacity style={styles.categoryHeader} onPress={() => setExpanded(open ? null : category.id)} activeOpacity={0.75}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryMeta}>{categorySelected} selected · {category.jobs.length} services</Text>
                </View>
                {open ? <CaretUp size={18} color={v3.colors.ink} /> : <CaretDown size={18} color={v3.colors.ink} />}
              </TouchableOpacity>
              {open ? (
                <View style={styles.jobs}>
                  {category.jobs.map(job => {
                    const checked = selected.has(job.id)
                    return (
                      <TouchableOpacity key={job.id} style={styles.jobRow} onPress={() => toggle(job.id)} activeOpacity={0.72}>
                        <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                          {checked ? <CheckCircle size={19} color={v3.colors.ink} weight="fill" /> : null}
                        </View>
                        <Text style={styles.jobName}>{job.name}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ) : null}
            </View>
          )
        })}

        <View style={{ height: 24 }} />
        <V3Button label="Save & continue" onPress={handleSave} loading={saving} disabled={selected.size === 0 || loading || !!loadError} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  title: { marginTop: 10, fontSize: 27, lineHeight: 32, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  subtitle: { marginTop: 6, marginBottom: 20, fontSize: 10.5, lineHeight: 16, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  phoneCard: { marginBottom: 14, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.paper },
  warningTitle: { fontSize: 11, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.error },
  warningText: { marginTop: 5, fontSize: 9.5, lineHeight: 14, fontFamily: 'Outfit_500Medium', color: v3.colors.textSecondary },
  summary: { marginBottom: 14, padding: 14, borderRadius: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  summaryCount: { fontSize: 13, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  summaryText: { marginTop: 3, fontSize: 9.5, lineHeight: 14, fontFamily: 'Outfit_500Medium', color: v3.colors.textSecondary },
  category: { marginBottom: 10, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, overflow: 'hidden' },
  categoryHeader: { minHeight: 62, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  categoryName: { fontSize: 13, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  categoryMeta: { marginTop: 3, fontSize: 9.5, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted },
  jobs: { borderTopWidth: 1, borderTopColor: v3.colors.line },
  jobRow: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: v3.colors.line },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { borderColor: v3.colors.ink },
  jobName: { flex: 1, fontSize: 11, fontFamily: 'Outfit_700Bold', color: v3.colors.ink },
  errorCard: { marginTop: 12, padding: 18, borderRadius: 16, backgroundColor: v3.colors.errorSoft, borderWidth: 1, borderColor: '#FFD3CC' },
  errorTitle: { fontSize: 14, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.error },
  errorText: { marginTop: 5, fontSize: 11, lineHeight: 17, fontFamily: 'Outfit_500Medium', color: v3.colors.textSecondary },
  retryButton: { marginTop: 14, alignSelf: 'flex-start', height: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: v3.colors.paper },
})
