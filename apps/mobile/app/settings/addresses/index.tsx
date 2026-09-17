import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, House, Briefcase, PlusCircle } from 'phosphor-react-native'
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
          <CaretLeft size={24} color={'#FFFFFF'} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.title}>Saved Addresses</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Your Addresses</Text>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <House size={20} color={'#FFFFFF'} weight="bold" />
            <Text style={styles.cardLabel}>Home</Text>
          </View>
          <Text style={styles.cardAddress}>123 Galle Road{"\n"}Colombo 03, Sri Lanka</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Briefcase size={20} color={'#FFFFFF'} weight="bold" />
            <Text style={styles.cardLabel}>Work</Text>
          </View>
          <Text style={styles.cardAddress}>456 Union Place{"\n"}Colombo 02, Sri Lanka</Text>
        </View>
        <TouchableOpacity style={styles.addButton}>
          <PlusCircle size={20} color={'#F5A623'} weight="bold" />
          <Text style={styles.addButtonText}>Add New Address</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  title: { fontSize: fontSizes.h3, fontFamily: fonts.heading, color: '#FFFFFF' },
  content: { padding: 24 },
  sectionTitle: { fontSize: fontSizes.h3, fontFamily: fonts.heading, color: '#FFFFFF', marginBottom: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardLabel: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
  cardAddress: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body, color: '#6F6B6B', lineHeight: 20, paddingLeft: 28 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  addButtonText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: '#F5A623' },
})
