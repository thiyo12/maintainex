import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { fontSizes } from '../../../lib/tokens'

export default function AddressesSettingsScreen() {
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Saved Addresses</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Your Addresses</Text>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="home-outline" size={20} color={colors.ink} />
            <Text style={styles.cardLabel}>Home</Text>
          </View>
          <Text style={styles.cardAddress}>123 Galle Road{"\n"}Colombo 03, Sri Lanka</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="briefcase-outline" size={20} color={colors.ink} />
            <Text style={styles.cardLabel}>Work</Text>
          </View>
          <Text style={styles.cardAddress}>456 Union Place{"\n"}Colombo 02, Sri Lanka</Text>
        </View>
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add-circle-outline" size={20} color={colors.amber} />
          <Text style={styles.addButtonText}>Add New Address</Text>
        </TouchableOpacity>
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardLabel: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: colors.ink },
  cardAddress: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body, color: colors.muted, lineHeight: 20, paddingLeft: 28 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  addButtonText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: colors.amber },
})
