import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useColors } from '../../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { translateJobStatus } from '../../../../lib/i18n'
import { v2Jobs, V2Job } from '../../../../lib/api-v2'
import {
  ClipboardText,
  UserCircle,
  ChevronRight,
} from 'phosphor-react-native'
import { fonts } from '../../../../lib/fonts'

const FILTERS = ['All', 'Active', 'Quoted', 'Completed'] as const
type FilterKey = (typeof FILTERS)[number]

const STATUS_FILTER_MAP: Record<FilterKey, string | null> = {
  All: null,
  Active: 'OPEN',
  Quoted: 'IN_PROGRESS',
  Completed: 'COMPLETED',
}

export default function V2MyJobsScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()

  const [jobs, setJobs] = useState<V2Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All')

  const loadJobs = useCallback(async () => {
    try {
      const res = await v2Jobs.list()
      setJobs(res.jobs)
    } catch (e) {
      console.error('Load jobs error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const onRefresh = () => {
    setRefreshing(true)
    loadJobs()
  }

  const filteredJobs =
    activeFilter === 'All'
      ? jobs
      : jobs.filter((j) => j.status === STATUS_FILTER_MAP[activeFilter])

  const statusPillStyle = (status: string) => {
    switch (status) {
      case 'OPEN':
        return { bg: '#FDE8B3', text: '#9A6000' }
      case 'IN_PROGRESS':
        return { bg: '#EAF0FF', text: '#276EF1' }
      case 'COMPLETED':
        return { bg: '#F1F1F1', text: '#6F6B6B' }
      case 'CANCELLED':
        return { bg: '#FDEAEA', text: '#E11900' }
      default:
        return { bg: '#F1F1F1', text: '#6F6B6B' }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* App bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarSpacer} />
        <Text style={styles.appBarTitle}>My jobs</Text>
        <TouchableOpacity style={styles.profileBtn}>
          <UserCircle size={28} color="#6F6B6B" weight="fill" />
        </TouchableOpacity>
      </View>

      {/* Title + Subtitle */}
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{"Everything you've booked."}</Text>
        <Text style={styles.subtitle}>
          Active, quoted, scheduled and completed jobs in one place.
        </Text>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = activeFilter === f
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterPillText,
                  active && styles.filterPillTextActive,
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.amber}
          style={{ marginTop: 60 }}
        />
      ) : filteredJobs.length === 0 ? (
        <View style={styles.empty}>
          <ClipboardText size={48} color="#6F6B6B" weight="light" />
          <Text style={styles.emptyTitle}>No jobs yet</Text>
          <Text style={styles.emptySub}>
            Post your first job to get started
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/(customer)/jobs/v2/create')}
            activeOpacity={0.7}
          >
            <Text style={styles.emptyBtnText}>Post a job</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.amber}
            />
          }
        >
          {filteredJobs.map((job, idx) => {
            const pill = statusPillStyle(job.status)
            return (
              <TouchableOpacity
                key={job.id}
                style={styles.jobCard}
                onPress={() => router.push(`/(customer)/jobs/v2/${job.id}`)}
                activeOpacity={0.7}
              >
                {/* Number circle */}
                <View style={styles.numberCircle}>
                  <Text style={styles.numberText}>{idx + 1}</Text>
                </View>

                {/* Content */}
                <View style={styles.jobContent}>
                  <Text style={styles.jobTitle} numberOfLines={1}>
                    {job.title}
                  </Text>
                  <Text style={styles.jobMeta}>
                    {new Date(job.createdAt).toLocaleDateString()}
                    {job.locationName ? ` · ${job.locationName}` : ''}
                  </Text>
                </View>

                {/* Status pill */}
                <View
                  style={[styles.statusPill, { backgroundColor: pill.bg }]}
                >
                  <Text style={[styles.statusPillText, { color: pill.text }]}>
                    {t(translateJobStatus(job.status))}
                  </Text>
                </View>

                {/* Chevron */}
                <ChevronRight size={16} color="#6F6B6B" />
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0D0D0D',
    },

    /* ── App bar ── */
    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    appBarSpacer: { width: 28 },
    appBarTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 17,
      color: '#FFFFFF',
      textAlign: 'center',
    },
    profileBtn: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* ── Title block ── */
    titleBlock: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    title: {
      fontFamily: fonts.heading,
      fontSize: 25,
      color: '#FFFFFF',
      lineHeight: 32,
    },
    subtitle: {
      fontFamily: fonts.bodyLight,
      fontSize: 10,
      color: '#6F6B6B',
      marginTop: 4,
      lineHeight: 16,
    },

    /* ── Filter pills ── */
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: 8,
      marginBottom: 16,
    },
    filterPill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: '#F1F1F1',
    },
    filterPillActive: {
      backgroundColor: '#000000',
    },
    filterPillText: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: '#6F6B6B',
    },
    filterPillTextActive: {
      color: '#FFFFFF',
    },

    /* ── Job list ── */
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    jobCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 15,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: '#2E2E2E',
    },

    /* Number circle */
    numberCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#F1F1F1',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    numberText: {
      fontFamily: fonts.heading,
      fontSize: 10,
      color: '#000000',
    },

    /* Job content */
    jobContent: {
      flex: 1,
      marginRight: 10,
    },
    jobTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 11,
      color: '#000000',
      marginBottom: 3,
    },
    jobMeta: {
      fontFamily: fonts.bodyLight,
      fontSize: 9,
      color: '#6F6B6B',
    },

    /* Status pill */
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      marginRight: 8,
    },
    statusPillText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 9,
    },

    /* ── Empty state ── */
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 20,
      color: '#FFFFFF',
      marginTop: 16,
      marginBottom: 8,
    },
    emptySub: {
      fontFamily: fonts.bodyLight,
      fontSize: 13,
      color: '#6F6B6B',
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    emptyBtn: {
      backgroundColor: colors.amber,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 14,
    },
    emptyBtnText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: '#000000',
    },
  })
