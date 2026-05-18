import { useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../../lib/auth'
import { colors } from '../../../lib/colors'

function MenuRow({ icon, label, onPress, color }: any) {
  const scale = useRef(new Animated.Value(1)).current
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, friction: 8, tension: 100, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }).start()}
      onPress={onPress}
    >
      <Animated.View style={[styles.menuRow, { transform: [{ scale }] }]}>
        <View style={[styles.menuIconWrap, { backgroundColor: (color || colors.customerAccent) + '20' }]}>
          <Ionicons name={icon} size={20} color={color || colors.customerAccent} />
        </View>
        <Text style={styles.menuLabel}>{label}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.gray} />
      </Animated.View>
    </TouchableOpacity>
  )
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
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => router.push('/(customer)/settings/edit-profile')}
          >
            <Ionicons name="create-outline" size={16} color={colors.customerAccent} />
            <Text style={styles.editProfileText}> Edit profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <MenuRow icon="person-outline" label="My profile" color={colors.customerAccent} />
          <MenuRow icon="create-outline" label="Edit profile" color={colors.customerAccent}
            onPress={() => router.push('/(customer)/settings/edit-profile')} />
          <MenuRow icon="notifications-outline" label="Notifications" color="#F59E0B"
            onPress={() => router.push('/(customer)/settings/notifications')} />
          <MenuRow icon="card-outline" label="Payment methods" color="#10B981" />
          <MenuRow icon="location-outline" label="Saved addresses" color="#3B82F6" />
        </View>

        <View style={styles.section}>
          <MenuRow icon="help-circle-outline" label="Help & support" color="#8B5CF6" />
          <MenuRow icon="document-text-outline" label="Terms & privacy" color="#6B7280" />
          <MenuRow icon="information-circle-outline" label="About Maintainex" color="#EC4899" />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.red} />
          <Text style={styles.logoutBtnText}> Log out</Text>
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
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.customerAccent,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.white },
  name: { fontSize: 22, fontWeight: '800', color: colors.dark, marginBottom: 4 },
  email: { fontSize: 14, color: colors.gray, marginBottom: 2 },
  phone: { fontSize: 14, color: colors.gray, marginBottom: 14 },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.customerAccent,
    paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20,
  },
  editProfileText: { fontSize: 14, fontWeight: '600', color: colors.customerAccent },
  section: { paddingHorizontal: 24, marginBottom: 16 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    padding: 16, borderRadius: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  menuLabel: { fontSize: 15, fontWeight: '600', color: colors.dark, flex: 1 },
  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 24, backgroundColor: colors.white, padding: 16,
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.red, marginBottom: 12,
  },
  logoutBtnText: { fontSize: 16, fontWeight: '700', color: colors.red },
  version: { textAlign: 'center', fontSize: 12, color: colors.gray, marginBottom: 32 },
})
