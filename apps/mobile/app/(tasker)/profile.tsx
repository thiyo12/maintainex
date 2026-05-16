import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useAuth } from '../../lib/auth'
import { taskers as taskersApi, categories as categoriesApi } from '../../lib/api'
import { Category } from '../../lib/types'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
}

const DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle',
  'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle',
  'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala',
  'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura',
  'Trincomalee', 'Vavuniya',
]

export default function TaskerProfileScreen() {
  const { user, logout } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [bio, setBio] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => {})
  }, [])

  const toggleSkill = (slug: string) => {
    setSelectedSkills(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    )
  }

  const toggleArea = (area: string) => {
    setSelectedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await taskersApi.updateProfile({
        bio, hourlyRate: parseInt(hourlyRate) || 0,
        skills: selectedSkills, serviceAreas: selectedAreas,
      })
      Alert.alert('Saved', 'Profile updated successfully')
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <Text style={styles.sectionTitle}>About You</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={bio}
        onChangeText={setBio}
        placeholder="Tell customers about yourself and your experience..."
        multiline numberOfLines={4}
      />

      <Text style={styles.sectionTitle}>Hourly Rate (LKR)</Text>
      <TextInput
        style={styles.input}
        value={hourlyRate}
        onChangeText={setHourlyRate}
        placeholder="e.g. 1500"
        keyboardType="number-pad"
      />

      <Text style={styles.sectionTitle}>Skills / Services</Text>
      <View style={styles.chipRow}>
        {categories.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, selectedSkills.includes(c.slug) && styles.chipActive]}
            onPress={() => toggleSkill(c.slug)}
          >
            <Text style={[styles.chipText, selectedSkills.includes(c.slug) && styles.chipTextActive]}>
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Service Areas</Text>
      <View style={styles.chipRow}>
        {DISTRICTS.map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.chip, selectedAreas.includes(d) && styles.chipActive]}
            onPress={() => toggleArea(d)}
          >
            <Text style={[styles.chipText, selectedAreas.includes(d) && styles.chipTextActive]}>
              {d}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.dark} />
        ) : (
          <Text style={styles.saveButtonText}>Save Profile</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 32 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: colors.dark },
  name: { fontSize: 22, fontWeight: '700', color: colors.dark },
  email: { fontSize: 14, color: colors.gray, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 12, marginTop: 24 },
  input: {
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
    borderRadius: 12, padding: 14, fontSize: 15, color: colors.dark,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: '#FFFBEB' },
  chipText: { fontSize: 13, color: colors.dark, fontWeight: '500' },
  chipTextActive: { color: colors.primary },
  saveButton: {
    backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 32,
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: colors.dark },
  logoutButton: {
    backgroundColor: colors.white, borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 16, borderWidth: 1.5, borderColor: '#FEE2E2',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#EF4444' },
})
