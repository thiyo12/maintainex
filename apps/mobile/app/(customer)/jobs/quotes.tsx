import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { jobs } from '../../../lib/api'
import { useColors } from '../../../lib/ThemeContext'
import type { JobPosting } from '../../../lib/types'

export default function QuotesScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { jobId } = useLocalSearchParams()
  const [job, setJob] = useState<JobPosting | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (jobId) {
      jobs.get(jobId as string)
        .then(setJob)
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [jobId])

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Quotes received</Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <>
          <View style={styles.jobSummary}>
            <Text style={styles.jobTitle}>{job?.title || 'Your job'}</Text>
            <Text style={styles.jobMeta}>{job?.category || ''} • {job?.location || ''}</Text>
          </View>

          <Text style={styles.count}>{job?.bids?.length || 0} quotes received</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {(job?.bids || []).map((q, i) => (
              <View key={q.id || i} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{q.tasker?.user?.name?.[0] || 'T'}</Text></View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{q.tasker?.user?.name || 'Tasker'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="star" size={13} color="#F59E0B" />
                      <Text style={styles.cardSkill}> {q.tasker?.rating?.toFixed(1) || '5.0'}</Text>
                    </View>
                  </View>
                  <Text style={styles.price}>LKR {q.amount?.toLocaleString()}</Text>
                </View>
                <Text style={styles.message}>{q.message}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.viewBtn}><Text style={styles.viewBtnText}>View profile</Text></TouchableOpacity>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => router.push(`/(customer)/booking/confirm?jobId=${jobId || ''}&bidId=${q.id}&taskerName=${q.tasker?.user?.name || ''}&price=${q.amount}` as any)}
                  >
                    <Text style={styles.acceptBtnText}>Accept quote</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heading: { fontSize: 22, fontWeight: '800', color: colors.dark, paddingHorizontal: 24, marginTop: 16, marginBottom: 16 },
  jobSummary: { backgroundColor: colors.white, marginHorizontal: 24, padding: 16, borderRadius: 14, marginBottom: 8 },
  jobTitle: { fontSize: 16, fontWeight: '700', color: colors.dark },
  jobMeta: { fontSize: 13, color: colors.gray, marginTop: 4 },
  count: { fontSize: 14, fontWeight: '600', color: colors.gray, paddingHorizontal: 24, marginBottom: 12, marginTop: 8 },
  card: { backgroundColor: colors.white, marginHorizontal: 24, marginBottom: 12, padding: 16, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.dark },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.dark },
  cardSkill: { fontSize: 13, color: colors.gray, marginTop: 2 },
  price: { fontSize: 15, fontWeight: '800', color: colors.primary },
  message: { fontSize: 14, color: colors.gray, lineHeight: 20, marginBottom: 12 },
  cardActions: { flexDirection: 'row', gap: 10 },
  viewBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.lightGray, alignItems: 'center' },
  viewBtnText: { fontSize: 14, fontWeight: '600', color: colors.dark },
  acceptBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
  acceptBtnText: { fontSize: 14, fontWeight: '700', color: colors.dark },
})