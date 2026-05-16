import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../lib/auth'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  background: '#F9FAFB',
  white: '#FFFFFF',
}

export default function ProfileScreen() {
  const { user, logout } = useAuth()
  const router = useRouter()

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{user?.role}</Text>
        </View>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>My Bookings</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>My Jobs</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Payment Methods</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Settings</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark, marginBottom: 24 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.dark },
  name: { fontSize: 20, fontWeight: '700', color: colors.dark },
  email: { fontSize: 14, color: colors.gray, marginTop: 4, marginBottom: 12 },
  badge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  menu: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 18, borderBottomWidth: 1, borderBottomColor: colors.background,
  },
  menuText: { fontSize: 16, color: colors.dark, fontWeight: '500' },
  menuArrow: { fontSize: 20, color: colors.gray },
  logoutButton: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#EF4444' },
})
