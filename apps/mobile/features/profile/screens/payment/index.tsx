import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { fontSizes } from '@/lib/tokens'

export default function PaymentSettingsScreen() {
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Payment Methods</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Saved Payment Methods</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="card-outline" size={20} color={colors.ink} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>Visa ending in 4242</Text>
              <Text style={styles.cardExpiry}>Expires 12/28</Text>
            </View>
          </View>
        </View>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="card-outline" size={20} color={colors.ink} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>Mastercard ending in 8888</Text>
              <Text style={styles.cardExpiry}>Expires 06/27</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add-circle-outline" size={20} color={colors.amber} />
          <Text style={styles.addButtonText}>Add Payment Method</Text>
        </TouchableOpacity>
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Bank Account</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="business-outline" size={20} color={colors.ink} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>Bank of Ceylon</Text>
              <Text style={styles.cardExpiry}>Account ending in 1234</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  title: { fontSize: fontSizes.h3, fontFamily: fonts.heading, color: colors.ink },
  content: { padding: 24 },
  sectionTitle: { fontSize: fontSizes.h3, fontFamily: fonts.heading, color: colors.ink, marginBottom: 16 },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 16, marginBottom: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: colors.ink },
  cardExpiry: { fontSize: fontSizes.bodySmall, color: colors.muted, marginTop: 2 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  addButtonText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: colors.amber },
})
