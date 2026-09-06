import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { fontSizes } from '../../../lib/tokens'

export default function AboutScreen() {
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>About</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.appName}>MΛINTΛINEX</Text>
        <Text style={styles.version}>Version 1.0.0</Text>
        <Text style={styles.description}>
          MΛINTΛINEX connects you with trusted professionals for all your home service needs.
          From plumbing and electrical work to cleaning and repairs, find the right expert near you.
        </Text>
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Our Mission</Text>
        <Text style={styles.description}>
          To make professional home services accessible, reliable, and hassle-free for everyone.
        </Text>
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Contact</Text>
        <Text style={styles.description}>
          Email: support@maintainex.com{"\n"}
          Colombo, Sri Lanka
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  title: { fontSize: fontSizes.h3, fontFamily: fonts.heading, color: colors.ink },
  content: { padding: 24, alignItems: 'center' },
  appName: { fontSize: 32, fontFamily: fonts.heading, color: colors.ink, marginBottom: 4 },
  version: { fontSize: fontSizes.bodySmall, color: colors.muted, marginBottom: 24 },
  description: { fontSize: fontSizes.body, fontFamily: fonts.body, color: colors.muted, lineHeight: 22, textAlign: 'center' },
  divider: { width: '100%', height: 1, backgroundColor: colors.border, marginVertical: 24 },
  sectionTitle: { fontSize: fontSizes.h3, fontFamily: fonts.heading, color: colors.ink, marginBottom: 8, alignSelf: 'flex-start' },
})
