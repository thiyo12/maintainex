import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../../lib/auth'

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

export default function CustomerSettings() {
  const router = useRouter()
  const { user, logout } = useAuth()

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || 'U')[0]}</Text>
          </View>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
          <Text style={styles.phone}>{user?.phone || ''}</Text>
          <TouchableOpacity style={styles.editProfileBtn} onPress={() => router.push('/(customer)/settings/edit-profile')}>
            <Text style={styles.editProfileText}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuIcon}>📋</Text>
            <Text style={styles.menuLabel}>My profile</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/(customer)/settings/edit-profile')}>
            <Text style={styles.menuIcon}>✏️</Text>
            <Text style={styles.menuLabel}>Edit profile</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/(customer)/settings/notifications')}>
            <Text style={styles.menuIcon}>🔔</Text>
            <Text style={styles.menuLabel}>Notifications</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuIcon}>💳</Text>
            <Text style={styles.menuLabel}>Payment methods</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuIcon}>📍</Text>
            <Text style={styles.menuLabel}>Saved addresses</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuIcon}>❓</Text>
            <Text style={styles.menuLabel}>Help & support</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuIcon}>📄</Text>
            <Text style={styles.menuLabel}>Terms & privacy</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuIcon}>ℹ️</Text>
            <Text style={styles.menuLabel}>About Maintainex</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>🚪 Log out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  profileHeader: { alignItems: 'center', paddingTop: 24, paddingBottom: 24 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.white },
  name: { fontSize: 22, fontWeight: '800', color: colors.dark, marginBottom: 4 },
  email: { fontSize: 14, color: colors.gray, marginBottom: 2 },
  phone: { fontSize: 14, color: colors.gray, marginBottom: 14 },
  editProfileBtn: {
    borderWidth: 1.5,
    borderColor: colors.purple,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editProfileText: { fontSize: 14, fontWeight: '600', color: colors.purple },
  section: { paddingHorizontal: 24, marginBottom: 16 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: colors.dark, flex: 1 },
  menuArrow: { fontSize: 22, color: colors.gray, fontWeight: '300' },
  logoutBtn: {
    marginHorizontal: 24,
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.red,
    marginBottom: 12,
  },
  logoutBtnText: { fontSize: 16, fontWeight: '700', color: colors.red },
  version: { textAlign: 'center', fontSize: 12, color: colors.gray, marginBottom: 32 },
})
