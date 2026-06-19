import { useEffect, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../../../lib/auth'
import { useColors } from '../../../../lib/ThemeContext'

export default function MyProfileScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { user } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  if (!user) return null

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A'

  const fields = [
    { label: 'Full Name', value: user.name, icon: 'person-outline' as const },
    { label: 'Email', value: user.email, icon: 'mail-outline' as const },
    { label: 'Phone', value: user.phone || 'Not set', icon: 'call-outline' as const },
    { label: 'Role', value: user.role.charAt(0) + user.role.slice(1).toLowerCase(), icon: 'briefcase-outline' as const },
    { label: 'Member Since', value: memberSince, icon: 'calendar-outline' as const },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>My Profile</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userRole}>{user.role.charAt(0) + user.role.slice(1).toLowerCase()}</Text>
          </View>

          <View style={styles.card}>
            {fields.map((f, i) => (
              <View key={f.label} style={[styles.row, i === fields.length - 1 && { borderBottomWidth: 0 }]}>
                <Ionicons name={f.icon} size={20} color={colors.customerAccent} />
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <Text style={styles.fieldValue}>{f.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark, paddingHorizontal: 24, marginBottom: 16 },
  scroll: { paddingHorizontal: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.customerAccent,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.white },
  userName: { fontSize: 20, fontWeight: '800', color: colors.dark },
  userRole: { fontSize: 13, color: colors.gray, marginTop: 2, textTransform: 'capitalize' },
  card: {
    backgroundColor: colors.white, borderRadius: 14, padding: 4, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.lightGray,
  },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.gray, textTransform: 'uppercase' },
  fieldValue: { fontSize: 15, fontWeight: '600', color: colors.dark, marginTop: 2 },
})
