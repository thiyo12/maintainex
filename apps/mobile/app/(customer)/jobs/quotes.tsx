import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { jobs } from '../../../lib/api'
import { colors } from '../../../lib/colors'
import type { JobPosting } from '../../../lib/types'

export default function QuotesScreen() {
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
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
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
                    <Text style={styles.cardSkill}>⭐ {q.tasker?.rating?.toFixed(1) || '5.0'}</Text>
                  </View>
                  <Text style={styles.price}>LKR {q.amount?.toLocaleString()}</Text>
                </View>
                <Text style={styles.message}>{q.message}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.viewBtn}><Text style={styles.viewBtnText}>View profile</Text></TouchableOpacity>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => router.push(`/(customer)/booking/confirm?jobId=${jobId || ''}&bidId=${q.id}&taskerName=${q.tasker?.user?.name || ''}&price=${q.amount}`)}
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