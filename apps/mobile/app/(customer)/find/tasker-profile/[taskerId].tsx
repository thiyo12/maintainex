import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { colors } from '../../../../lib/colors'
import { findTasker } from '../../../../lib/api'
import StickyBottomBar from '../../../../components/find/StickyBottomBar'
import SkeletonLoader from '../../../../components/find/SkeletonLoader'

export default function TaskerProfileDetail() {
  const { taskerId, jobId } = useLocalSearchParams<{ taskerId: string; jobId: string }>()
  const [tasker, setTasker] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    (async () => {
      try {
        const data = await findTasker.getTaskerProfile(taskerId!)
        setTasker(data)
      } catch (e) {
        console.error('Failed to load tasker profile', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [taskerId])

  if (loading) return <View style={styles.container}><SkeletonLoader count={4} height={100} /></View>
  if (!tasker) return <View style={styles.container}><Text style={{ textAlign: 'center', marginTop: 40 }}>Tasker not found</Text></View>

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#fff" />
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{tasker.name}</Text>
              {tasker.isVerified && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={styles.statText}>{tasker.rating.toFixed(1)}</Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="briefcase" size={14} color="#6B7280" />
                <Text style={styles.statText}>{tasker.completedJobs} jobs</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.rateCard}>
          <Text style={styles.rateTitle}>Hourly Rate</Text>
          <Text style={styles.rateValue}>Rs {tasker.hourlyRate}</Text>
          <Text style={styles.rateLabel}>per hour</Text>
        </View>

        {tasker.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.sectionText}>{tasker.bio}</Text>
          </View>
        ) : null}

        {tasker.skills && tasker.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsWrap}>
              {tasker.skills.map((s: string, i: number) => (
                <View key={i} style={styles.skillBadge}>
                  <Text style={styles.skillText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {tasker.serviceAreas && tasker.serviceAreas.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Areas</Text>
            <View style={styles.areasWrap}>
              {tasker.serviceAreas.map((a: string, i: number) => (
                <View key={i} style={styles.areaBadge}>
                  <Ionicons name="location" size={12} color={colors.primary} />
                  <Text style={styles.areaText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {tasker.reviews && tasker.reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reviews ({tasker.reviews.length})</Text>
            {tasker.reviews.map((r: any, i: number) => (
              <View key={r.id || i} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>{r.reviewerName}</Text>
                  <View style={styles.reviewStars}>
                    {Array.from({ length: r.rating }).map((_, si) => (
                      <Ionicons key={si} name="star" size={12} color="#F59E0B" />
                    ))}
                  </View>
                </View>
                {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <StickyBottomBar
        price={`Rs ${tasker.hourlyRate}/hr`}
        label="Starting from"
        buttonText="Book Now"
        icon="calendar"
        onPress={() => router.push(`/(customer)/find/booking/${jobId}?taskerId=${taskerId}&rate=${tasker.hourlyRate}`)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  profileInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  statsRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, color: '#6B7280' },
  rateCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  rateTitle: { fontSize: 12, color: '#9CA3AF' },
  rateValue: { fontSize: 26, fontWeight: '700', color: '#059669', marginTop: 4 },
  rateLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  sectionText: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillBadge: { backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  skillText: { fontSize: 12, fontWeight: '500', color: colors.primary },
  areasWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  areaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 4 },
  areaText: { fontSize: 12, color: '#374151' },
  reviewItem: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, marginTop: 10 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewerName: { fontSize: 13, fontWeight: '600', color: '#374151' },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 18 },
})
