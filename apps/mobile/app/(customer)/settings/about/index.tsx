import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../../lib/ThemeContext'

export default function AboutScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>About Maintainex</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <View style={styles.brandCard}>
            <View style={styles.iconWrap}>
              <Ionicons name="hammer" size={36} color={colors.white} />
            </View>
            <Text style={styles.appName}>Maintainex</Text>
            <Text style={styles.version}>Version 1.0.0</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.description}>
              Maintainex is Sri Lanka's trusted platform connecting customers with skilled
              taskers for home maintenance, repairs, and professional services. We make it
              easy to find, book, and pay for quality service providers in your area.
            </Text>
          </View>

          <View style={styles.card}>
            <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://maintainex.com')}>
              <Ionicons name="globe-outline" size={20} color={colors.customerAccent} />
              <Text style={styles.linkText}>  www.maintainex.com</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkRow, { borderBottomWidth: 0 }]} onPress={() => Linking.openURL('mailto:hello@maintainex.com')}>
              <Ionicons name="mail-outline" size={20} color={colors.customerAccent} />
              <Text style={styles.linkText}>  hello@maintainex.com</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.policyBtn} onPress={() => router.push('/settings/terms')}>
            <Ionicons name="shield-outline" size={18} color={colors.customerAccent} />
            <Text style={styles.policyBtnText}>  Privacy Policy</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark, paddingHorizontal: 24, marginBottom: 16 },
  scroll: { paddingHorizontal: 24 },
  brandCard: {
    backgroundColor: colors.white, borderRadius: 14, padding: 28,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: colors.customerAccent,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  appName: { fontSize: 22, fontWeight: '800', color: colors.dark },
  version: { fontSize: 13, color: colors.gray, marginTop: 4 },
  card: {
    backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  description: { fontSize: 14, color: colors.darkMid, lineHeight: 22 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.lightGray,
  },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.customerAccent },
  policyBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 14, marginBottom: 24,
  },
  policyBtnText: { fontSize: 14, fontWeight: '600', color: colors.customerAccent },
})
