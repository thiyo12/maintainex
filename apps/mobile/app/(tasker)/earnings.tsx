import { View, Text, StyleSheet, ScrollView } from 'react-native'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  background: '#F9FAFB',
  white: '#FFFFFF',
}

export default function EarningsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Earnings</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>This Week</Text>
        <Text style={styles.summaryAmount}>LKR 0</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.boxLabel}>Completed Jobs</Text>
          <Text style={styles.boxValue}>0</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.boxLabel}>Rating</Text>
          <Text style={styles.boxValue}>⭐ 0.0</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No transactions yet</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark, marginBottom: 24 },
  summaryCard: {
    backgroundColor: colors.primary, borderRadius: 16, padding: 24, marginBottom: 16,
  },
  summaryLabel: { fontSize: 14, color: colors.dark, opacity: 0.7 },
  summaryAmount: { fontSize: 36, fontWeight: '800', color: colors.dark, marginTop: 8 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  summaryBox: {
    flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 16,
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  boxLabel: { fontSize: 13, color: colors.gray, marginBottom: 8 },
  boxValue: { fontSize: 22, fontWeight: '800', color: colors.dark },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.dark, marginBottom: 12 },
  empty: { alignItems: 'center', paddingTop: 20 },
  emptyText: { fontSize: 14, color: colors.gray },
})
