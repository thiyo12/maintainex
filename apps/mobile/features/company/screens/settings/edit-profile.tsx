import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Camera, CaretLeft } from 'phosphor-react-native'
import * as ImagePicker from 'expo-image-picker'
import { auth } from '@/api/auth'
import { company as companyApi } from '@/api/companies'
import { upload } from '@/api/upload'
import { getAuthToken } from '@/api/token'
import { useAuth } from '@/features/auth/context/auth'
import { v3 } from '@/theme/v3/tokens'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

export default function CompanyEditProfile() {
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const [companyName, setCompanyName] = useState('')
  const [registrationNo, setRegistrationNo] = useState('')
  const [description, setDescription] = useState('')
  // Canonical active template-job IDs, never free-form service names.
  // Legacy profile labels are displayed but preserved on metadata-only edits.
  const [existingServices, setExistingServices] = useState<string[]>([])
  const [catalogue, setCatalogue] = useState<Array<{
    id: string; name: string; jobs: Array<{ id: string; name: string }>
  }>>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [servicesEdited, setServicesEdited] = useState(false)
  const [catalogueUnavailable, setCatalogueUnavailable] = useState(false)
  const [serviceAreas, setServiceAreas] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [logo, setLogo] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setOwnerName(user?.name || '')
    setPhone(user?.phone || '')
    ;(async () => {
      try {
        const p = await companyApi.profile.get()
        setCompanyName(p?.companyName || '')
        setRegistrationNo(p?.registrationNo || '')
        setDescription(p?.description || '')
        const savedServices = Array.isArray(p?.services)
          ? p.services.filter((id: unknown): id is string => typeof id === 'string')
          : []
        setExistingServices(savedServices)
        setServiceAreas(Array.isArray(p?.serviceAreas) ? p.serviceAreas.join(', ') : '')
        setLogo(p?.logo || (user as any)?.profileImage || '')

        const market = p?.countryCode === 'CA' || user?.countryCode?.toUpperCase() === 'CA' ? 'CA' : 'LK'
        try {
          const token = await getAuthToken()
          const response = await fetch(`${API_URL}/api/mobile/job-categories?country=${market}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
          if (!response.ok) throw new Error('Service catalogue unavailable')
          const data = await response.json()
          if (!Array.isArray(data)) throw new Error('Invalid service catalogue')
          const categories = data
            .filter((c: any) => c && typeof c.id === 'string' && Array.isArray(c.jobs))
            .map((c: any) => ({
              id: c.id,
              name: typeof c.name === 'string' ? c.name : 'Services',
              jobs: c.jobs
                .filter((job: any) => job && typeof job.id === 'string' && typeof job.name === 'string')
                .map((job: any) => ({ id: job.id, name: job.name })),
            }))
            .filter((c: { jobs: unknown[] }) => c.jobs.length > 0)
          setCatalogue(categories)
          const allowedIds = new Set<string>(categories.flatMap((c: { jobs: Array<{ id: string }> }) =>
            c.jobs.map((j: { id: string }) => j.id),
          ))
          setSelectedServiceIds(savedServices.filter((id: string) => allowedIds.has(id)))
          setCatalogueUnavailable(categories.length === 0)
        } catch {
          // Leave legacy declarations untouched if the catalogue is unavailable.
          setCatalogueUnavailable(true)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

  const pickLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to upload your company logo.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
    if (result.canceled || !result.assets[0]) return
    setUploading(true)
    try {
      const uploaded = await upload.file(result.assets[0].uri, 'avatar')
      setLogo(uploaded.url)
    } catch {
      Alert.alert('Upload failed', 'Could not upload the company logo.')
    } finally {
      setUploading(false)
    }
  }

  const toList = (value: string) => [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]

  const toggleServiceId = (id: string) => {
    setServicesEdited(true)
    setSelectedServiceIds(current =>
      current.includes(id) ? current.filter(value => value !== id) : [...current, id],
    )
  }

  const save = async () => {
    if (servicesEdited && selectedServiceIds.length === 0) {
      Alert.alert('Select services', 'Choose at least one active service before saving.')
      return
    }
    if (companyName.trim().length < 2 || ownerName.trim().length < 2) {
      Alert.alert('Complete required fields', 'Add the company name and owner name.')
      return
    }
    setSaving(true)
    try {
      await Promise.all([
        auth.updateProfile({ name: ownerName.trim(), phone: phone.trim() }),
        companyApi.profile.update({
          companyName: companyName.trim(),
          registrationNo: registrationNo.trim() || null,
          description: description.trim() || null,
          ...(servicesEdited ? { services: selectedServiceIds } : {}),
          serviceAreas: user?.countryCode?.toUpperCase() === 'CA' ? ['Vancouver'] : toList(serviceAreas),
          logo: logo || null,
        }),
      ])
      await refreshUser()
      Alert.alert('Saved', 'Company profile updated.', [{ text: 'Done', onPress: () => router.back() }])
    } catch (error: any) {
      Alert.alert('Could not save', error?.message || 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View></SafeAreaView>
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}><CaretLeft size={18} color={v3.colors.ink} weight="bold" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Edit company</Text>
        <View style={styles.back} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.logoWrap} onPress={pickLogo} disabled={uploading}>
          <View style={styles.logo}>
            {logo ? <Image source={{ uri: logo }} style={styles.logoImage} /> : <Text style={styles.logoText}>{(companyName || 'C')[0]}</Text>}
            <View style={styles.camera}><Camera size={14} color={v3.colors.paper} weight="fill" /></View>
          </View>
          <Text style={styles.logoHint}>{uploading ? 'Uploading…' : 'Change company logo'}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Business identity</Text>
        <Field label="Company name *" value={companyName} onChangeText={setCompanyName} placeholder="MaintainEX Services" />
        <Field label="Registration number" value={registrationNo} onChangeText={setRegistrationNo} placeholder="PV / BR / company number" />
        <Field label="About your company" value={description} onChangeText={setDescription} placeholder="What your team does and why customers should trust you" multiline />

        <Text style={styles.sectionTitle}>Marketplace setup</Text>
        <Text style={styles.helper}>Currently declared: {existingServices.join(', ') || 'None'}</Text>
        <Text style={styles.helper}>Select exact services from your market catalogue. Changing the selection replaces old free-text labels; saving other details preserves them.</Text>
        {catalogueUnavailable ? (
          <Text style={styles.helper}>Catalogue unavailable. Existing services will be preserved.</Text>
        ) : (
          catalogue.map(category => (
            <View key={category.id} style={styles.field}>
              <Text style={styles.label}>{category.name}</Text>
              {category.jobs.map(job => {
                const checked = selectedServiceIds.includes(job.id)
                return (
                  <TouchableOpacity
                    key={job.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    onPress={() => toggleServiceId(job.id)}
                    style={[styles.serviceChoice, checked && styles.serviceChoiceSelected]}
                  >
                    <Text style={styles.serviceChoiceLabel}>{checked ? '✓  ' : '○  '}{job.name}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          ))
        )}
        {user?.countryCode?.toUpperCase() === 'CA' ? (
          <Text style={styles.helper}>Service territory: City of Vancouver only (municipal boundary). Other Canadian cities are not available.</Text>
        ) : (
          <Field label="Service areas" value={serviceAreas} onChangeText={setServiceAreas} placeholder="Colombo, Jaffna, Negombo" helper="Separate Sri Lankan cities or regions with commas." />
        )}

        <Text style={styles.sectionTitle}>Owner contact</Text>
        <Field label="Owner full name *" value={ownerName} onChangeText={setOwnerName} placeholder="Full name" />
        <Field label="Mobile number" value={phone} onChangeText={setPhone} placeholder="+94…" keyboardType="phone-pad" />

        <TouchableOpacity style={[styles.save, saving && { opacity: 0.55 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={v3.colors.paper} /> : <Text style={styles.saveText}>Save company profile</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function Field(props: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  helper?: string
  multiline?: boolean
  keyboardType?: 'default' | 'phone-pad'
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.textArea]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={v3.colors.textPlaceholder}
        multiline={props.multiline}
        keyboardType={props.keyboardType || 'default'}
        textAlignVertical={props.multiline ? 'top' : 'center'}
      />
      {props.helper ? <Text style={styles.helper}>{props.helper}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...v3.typography.title, color: v3.colors.ink },
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  logoWrap: { alignItems: 'center', paddingVertical: 12 },
  logo: { width: 82, height: 82, borderRadius: 24, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 82, height: 82, borderRadius: 24 },
  logoText: { ...v3.typography.h3, color: v3.colors.amber },
  camera: { position: 'absolute', right: -3, bottom: -3, width: 29, height: 29, borderRadius: 15, backgroundColor: v3.colors.ink, borderWidth: 3, borderColor: v3.colors.canvas, alignItems: 'center', justifyContent: 'center' },
  logoHint: { ...v3.typography.captionBold, color: v3.colors.amberDark, marginTop: 10 },
  sectionTitle: { ...v3.typography.bodyLarge, color: v3.colors.ink, marginTop: 20, marginBottom: 2 },
  field: { marginTop: 12 },
  label: { ...v3.typography.captionBold, color: v3.colors.textSecondary, marginBottom: 6 },
  input: { minHeight: 52, borderRadius: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, paddingHorizontal: 14, color: v3.colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 13 },
  textArea: { minHeight: 112, paddingTop: 14, paddingBottom: 14 },
  helper: { ...v3.typography.small, color: v3.colors.textMuted, marginTop: 5, lineHeight: 14 },
  serviceChoice: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: v3.colors.line, marginBottom: 6 },
  serviceChoiceSelected: { backgroundColor: v3.colors.paper, borderColor: v3.colors.ink },
  serviceChoiceLabel: { ...v3.typography.body, color: v3.colors.ink },
  save: { height: 54, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 26 },
  saveText: { ...v3.typography.bodyLarge, color: v3.colors.paper },
})
