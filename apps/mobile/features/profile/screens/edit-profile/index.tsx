import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { fontSizes } from '@/lib/tokens'
import { useAuth } from '@/lib/auth'

export default function EditProfileOverview() {
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { user } = useAuth()

  const roleRoutes: Record<string, string> = {
    CUSTOMER: '/(customer)/settings/edit-profile',
    TASKER: '/(tasker)/settings/edit-profile',
    COMPANY: '/(company)/settings/edit-profile',
  }

  const route = roleRoutes[user?.role || ''] || '/(customer)/settings/edit-profile'

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="person-circle-outline" size={48} color={colors.amber} />
          <Text style={styles.infoText}>Manage your profile information</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push(route as any)}>
            <Text style={styles.buttonText}>Edit Your Profile</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{user?.name || '\u2014'}</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || '\u2014'}</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{user?.phone || '\u2014'}</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{user?.role || '\u2014'}</Text>
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
  infoCard: { alignItems: 'center', padding: 24, backgroundColor: colors.white, borderRadius: 16, marginBottom: 24, gap: 12 },
  infoText: { fontSize: fontSizes.body, fontFamily: fonts.body, color: colors.muted },
  button: { backgroundColor: colors.amber, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: '#111827' },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontSize: fontSizes.body, fontFamily: fonts.body, color: colors.muted },
  value: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: colors.ink },
})
