import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  primary: '#F59E0B',
  purple: '#7C3AED',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
  red: '#EF4444',
}

export default function JobCompleteScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const [confirmed, setConfirmed] = useState(false)

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>✅</Text>
          <Text style={styles.heading}>Job in review</Text>
          <Text style={styles.subtitle}>
            The tasker has marked this job as complete. Please confirm that everything is done to your satisfaction.
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sumTitle}>Fix leaking pipe</Text>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Tasker</Text>
            <Text style={styles.sumValue}>Kamal Perera • Plumber</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Location</Text>
            <Text style={styles.sumValue}>📍 Colombo 03</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Date</Text>
            <Text style={styles.sumValue}>📅 Today at 2:00 PM</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Duration</Text>
            <Text style={styles.sumValue}>⏱️ 1 hour 15 min</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Quoted</Text>
            <Text style={styles.sumPrice}>LKR 8,500</Text>
          </View>
        </View>

        <View style={styles.photosSection}>
          <Text style={styles.photoSectionTitle}>Completion photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {['📸', '📸', '📸'].map((emoji, i) => (
              <View key={i} style={styles.photoThumb}>
                <Text style={styles.photoEmoji}>{emoji}</Text>
                <Text style={styles.photoLabel}>Photo {i + 1}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {confirmed ? (
          <View style={styles.confirmedBox}>
            <Text style={styles.confirmedIcon}>🎉</Text>
            <Text style={styles.confirmedText}>Job marked as complete!</Text>
            <Text style={styles.confirmedSub}>
              Payment of LKR 8,925 will be released to the tasker.
            </Text>
          </View>
        ) : null}

        <View style={styles.actionSection}>
          <Text style={styles.actionTitle}>Is everything done correctly?</Text>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => setConfirmed(true)}
          >
            <Text style={styles.confirmBtnText}>Yes, complete the job</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.issueBtn}
            onPress={() => router.push('/(customer)/jobs/dispute/' + id)}
          >
            <Text style={styles.issueBtnText}>Report an issue</Text>
          </TouchableOpacity>
          <Text style={styles.escrowNote}>
            🔒 Funds are held in escrow. Payment is only released when you confirm completion.
          </Text>
        </View>
      </ScrollView>

      {confirmed ? (
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => router.push('/(customer)/jobs/receipt/' + id)}
        >
          <Text style={styles.nextBtnText}>Continue to receipt</Text>
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  backBtn: { paddingHorizontal: 24, paddingTop: 8 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  header: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 16, paddingBottom: 20 },
  headerEmoji: { fontSize: 48, marginBottom: 12 },
  heading: { fontSize: 24, fontWeight: '800', color: colors.dark, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 20 },
  summaryCard: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sumTitle: { fontSize: 17, fontWeight: '700', color: colors.dark, marginBottom: 12 },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  sumLabel: { fontSize: 14, color: colors.gray },
  sumValue: { fontSize: 14, fontWeight: '600', color: colors.dark },
  sumPrice: { fontSize: 14, fontWeight: '700', color: colors.primary },
  photosSection: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  photoSectionTitle: { fontSize: 14, fontWeight: '700', color: colors.dark, marginBottom: 10 },
  photoRow: { gap: 10 },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  photoEmoji: { fontSize: 32, marginBottom: 4 },
  photoLabel: { fontSize: 11, color: colors.gray, fontWeight: '500' },
  confirmedBox: {
    backgroundColor: '#D1FAE5',
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmedIcon: { fontSize: 32, marginBottom: 8 },
  confirmedText: { fontSize: 16, fontWeight: '700', color: colors.green, marginBottom: 4 },
  confirmedSub: { fontSize: 13, color: colors.gray, textAlign: 'center' },
  actionSection: {
    marginHorizontal: 24,
    paddingBottom: 100,
    alignItems: 'center',
  },
  actionTitle: { fontSize: 15, fontWeight: '600', color: colors.dark, marginBottom: 16 },
  confirmBtn: {
    width: '100%',
    backgroundColor: colors.green,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  issueBtn: {
    width: '100%',
    backgroundColor: colors.white,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.red,
    marginBottom: 16,
  },
  issueBtnText: { fontSize: 16, fontWeight: '600', color: colors.red },
  escrowNote: { fontSize: 12, color: colors.gray, textAlign: 'center', lineHeight: 18 },
  nextBtn: {
    backgroundColor: colors.purple,
    marginHorizontal: 24,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  nextBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
})
