import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  primary: '#F59E0B',
  purple: '#7C3AED',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
}

const quotes = [
  { name: 'Kamal Perera', skill: 'Plumber', rating: 4.8, price: 8500, msg: 'I can do this job today, I have all the tools needed.' },
  { name: 'Saman Fernando', skill: 'Electrician', rating: 4.6, price: 7200, msg: 'Available this afternoon. Professional service guaranteed.' },
  { name: 'Nimal Silva', skill: 'Handyman', rating: 4.9, price: 9500, msg: '10+ years experience. Will bring my team for quick work.' },
]

export default function QuotesScreen() {
  const router = useRouter()
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.heading}>Quotes received</Text>

      <View style={styles.jobSummary}>
        <Text style={styles.jobTitle}>Fix leaking pipe</Text>
        <Text style={styles.jobMeta}>Plumbing • Colombo 03</Text>
      </View>

      <Text style={styles.count}>3 quotes received</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {quotes.map((q, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{q.name[0]}</Text></View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{q.name}</Text>
                <Text style={styles.cardSkill}>{q.skill} • ⭐ {q.rating}</Text>
              </View>
              <Text style={styles.price}>LKR {q.price.toLocaleString()}</Text>
            </View>
            <Text style={styles.message}>{q.msg}</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.viewBtn}><Text style={styles.viewBtnText}>View profile</Text></TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => router.push('/(customer)/booking/confirm')}
              >
                <Text style={styles.acceptBtnText}>Accept quote</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  backBtn: { paddingHorizontal: 24, paddingTop: 8 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark, paddingHorizontal: 24, marginBottom: 16 },
  jobSummary: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  jobTitle: { fontSize: 16, fontWeight: '700', color: colors.dark },
  jobMeta: { fontSize: 13, color: colors.gray, marginTop: 4 },
  count: { fontSize: 14, fontWeight: '600', color: colors.gray, paddingHorizontal: 24, marginBottom: 12 },
  card: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.dark },
  cardSkill: { fontSize: 13, color: colors.gray, marginTop: 2 },
  price: { fontSize: 17, fontWeight: '800', color: colors.primary },
  message: { fontSize: 13, color: colors.gray, lineHeight: 20, marginBottom: 14 },
  cardActions: { flexDirection: 'row', gap: 10 },
  viewBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    alignItems: 'center',
  },
  viewBtnText: { fontSize: 14, fontWeight: '600', color: colors.dark },
  acceptBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  acceptBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
})
