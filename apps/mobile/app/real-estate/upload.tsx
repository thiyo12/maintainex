import { useState } from 'react'
import {
  ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Camera, CaretRight, Check, Plus, Sparkle, X } from 'phosphor-react-native'
import { useRouter } from 'expo-router'

import { realEstate, upload } from '../../lib/api'
import { useCountry } from '../../lib/country'
import { v3 } from '../../theme/v3/tokens'
import V3PageHeader from '../../components/v3/V3PageHeader'

const PROPERTY_TYPES = ['house', 'apartment', 'commercial', 'land', 'rental']
const PURPOSES = ['rent', 'sale', 'commercial', 'land']

export default function UploadProperty() {
  const router = useRouter()
  const { selectedCountry } = useCountry()
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [loading, setLoading] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [estimate, setEstimate] = useState<any>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    propertyType: 'house',
    purpose: 'rent',
    priceLkr: '',
    countryCode: selectedCountry?.code || 'LK',
    district: '',
    city: '',
    area: '',
    address: '',
    bedrooms: '',
    bathrooms: '',
    parking: '',
    areaSqft: '',
    landSize: '',
    yearBuilt: '',
    isFurnished: false,
    isNewProperty: true,
    contactPhone: '',
    contactName: '',
  })

  const update = (key: string, value: any) => setForm((current) => ({ ...current, [key]: value }))
  const currency = form.countryCode === 'CA' ? 'CAD' : 'LKR'

  const pickPhotos = async () => {
    const remaining = 10 - photos.length
    if (remaining <= 0) return Alert.alert('Photo limit reached', 'You can add up to 10 photos.')
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (permission.status !== 'granted') return Alert.alert('Photo access needed', 'Allow photo access to add property images.')

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    })
    if (result.canceled) return

    setPhotoUploading(true)
    try {
      const urls: string[] = []
      for (const asset of result.assets) {
        const response = await upload.file(asset.uri, 'attachment')
        if (response.url) urls.push(response.url)
      }
      setPhotos((current) => [...current, ...urls].slice(0, 10))
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Could not upload the selected photos.')
    } finally {
      setPhotoUploading(false)
    }
  }

  const estimatePrice = async () => {
    setEstimating(true)
    try {
      const result = await realEstate.priceEstimate({
        countryCode: form.countryCode,
        district: form.district,
        city: form.city,
        propertyType: form.propertyType,
        purpose: form.purpose,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
        areaSqft: form.areaSqft ? Number(form.areaSqft) : undefined,
        landSize: form.landSize ? Number(form.landSize) : undefined,
        isFurnished: form.isFurnished,
        isNewProperty: form.isNewProperty,
      })
      setEstimate(result?.data || result)
    } catch (error: any) {
      Alert.alert('Estimate unavailable', error?.message || 'Try again after adding more property details.')
    } finally {
      setEstimating(false)
    }
  }

  const next = () => {
    if (step === 0) {
      if (!form.title.trim()) return Alert.alert('Add a title', 'Give the property a clear title.')
      if (!form.city.trim() && !form.district.trim()) return Alert.alert('Add a location', 'Enter the city or district.')
      setStep(1)
      return
    }
    if (step === 1) {
      if (!form.priceLkr || Number(form.priceLkr) <= 0) return Alert.alert('Add a price', 'Enter a valid listing price.')
      setStep(2)
    }
  }

  const submit = async () => {
    if (!form.contactName.trim() || !form.contactPhone.trim()) {
      return Alert.alert('Contact details needed', 'Add a contact name and phone number.')
    }
    setLoading(true)
    try {
      await realEstate.create({
        ...form,
        priceLkr: Number(form.priceLkr),
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        parking: form.parking ? Number(form.parking) : null,
        areaSqft: form.areaSqft ? Number(form.areaSqft) : null,
        landSize: form.landSize ? Number(form.landSize) : null,
        yearBuilt: form.yearBuilt ? Number(form.yearBuilt) : null,
        photos,
      })
      Alert.alert('Listing submitted', 'Your property is now waiting for review.', [
        { text: 'View my listings', onPress: () => router.replace('/real-estate/my-listings' as any) },
      ])
    } catch (error: any) {
      Alert.alert('Could not submit listing', error?.message || 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader
        title="List your property"
        subtitle={step === 0 ? 'Basics' : step === 1 ? 'Details & price' : 'Photos & contact'}
      />
      <View style={styles.progress}>
        {[0, 1, 2].map((index) => <View key={index} style={[styles.progressBar, index <= step && styles.progressBarActive]} />)}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <>
            <Text style={styles.eyebrow}>STEP 1 OF 3</Text>
            <Text style={styles.heroTitle}>Tell us the basics.</Text>
            <Field label="TITLE" value={form.title} onChangeText={(v: string) => update('title', v)} placeholder="Modern 3BR home near the beach" />
            <Field label="DESCRIPTION" value={form.description} onChangeText={(v: string) => update('description', v)} placeholder="What makes this place useful or special?" multiline />

            <Text style={styles.label}>PROPERTY TYPE</Text>
            <View style={styles.chips}>
              {PROPERTY_TYPES.map((type) => (
                <Chip key={type} label={type} selected={form.propertyType === type} onPress={() => update('propertyType', type)} />
              ))}
            </View>

            <Text style={styles.label}>LISTING PURPOSE</Text>
            <View style={styles.chips}>
              {PURPOSES.map((purpose) => (
                <Chip key={purpose} label={purpose} selected={form.purpose === purpose} onPress={() => update('purpose', purpose)} />
              ))}
            </View>

            <Text style={styles.label}>LOCATION</Text>
            <View style={styles.twoCol}>
              <Field compact label="DISTRICT" value={form.district} onChangeText={(v: string) => update('district', v)} placeholder="Jaffna" />
              <Field compact label="CITY" value={form.city} onChangeText={(v: string) => update('city', v)} placeholder="Jaffna" />
            </View>
            <Field label="AREA" value={form.area} onChangeText={(v: string) => update('area', v)} placeholder="Nallur" />
            <Field label="ADDRESS" value={form.address} onChangeText={(v: string) => update('address', v)} placeholder="Street / landmark" />
          </>
        ) : step === 1 ? (
          <>
            <Text style={styles.eyebrow}>STEP 2 OF 3</Text>
            <Text style={styles.heroTitle}>Price and key details.</Text>

            <Field label={`PRICE (${currency})`} value={form.priceLkr} onChangeText={(v: string) => update('priceLkr', v)} placeholder="8500000" keyboardType="numeric" />
            <View style={styles.threeCol}>
              <Field compact label="BEDS" value={form.bedrooms} onChangeText={(v: string) => update('bedrooms', v)} placeholder="3" keyboardType="numeric" />
              <Field compact label="BATHS" value={form.bathrooms} onChangeText={(v: string) => update('bathrooms', v)} placeholder="2" keyboardType="numeric" />
              <Field compact label="PARKING" value={form.parking} onChangeText={(v: string) => update('parking', v)} placeholder="1" keyboardType="numeric" />
            </View>
            <View style={styles.twoCol}>
              <Field compact label="AREA SQFT" value={form.areaSqft} onChangeText={(v: string) => update('areaSqft', v)} placeholder="1800" keyboardType="numeric" />
              <Field compact label="LAND SQFT" value={form.landSize} onChangeText={(v: string) => update('landSize', v)} placeholder="2400" keyboardType="numeric" />
            </View>
            <Field label="YEAR BUILT" value={form.yearBuilt} onChangeText={(v: string) => update('yearBuilt', v)} placeholder="2024" keyboardType="numeric" />

            <View style={styles.switchCard}>
              <View><Text style={styles.switchTitle}>Furnished</Text><Text style={styles.switchMeta}>Furniture is included with the property.</Text></View>
              <Switch value={form.isFurnished} onValueChange={(v) => update('isFurnished', v)} trackColor={{ false: '#D8D8D8', true: v3.colors.amber }} />
            </View>
            <View style={styles.switchCard}>
              <View><Text style={styles.switchTitle}>New property</Text><Text style={styles.switchMeta}>Recently built or first occupancy.</Text></View>
              <Switch value={form.isNewProperty} onValueChange={(v) => update('isNewProperty', v)} trackColor={{ false: '#D8D8D8', true: v3.colors.amber }} />
            </View>

            <TouchableOpacity activeOpacity={0.8} onPress={estimatePrice} disabled={estimating} style={styles.estimateButton}>
              {estimating ? <ActivityIndicator size="small" color={v3.colors.ink} /> : <Sparkle size={17} color={v3.colors.ink} weight="fill" />}
              <Text style={styles.estimateText}>{estimating ? 'Checking market…' : 'Check market estimate'}</Text>
            </TouchableOpacity>

            {estimate ? (
              <View style={styles.estimateCard}>
                <Text style={styles.estimateLabel}>MARKET ESTIMATE</Text>
                <Text style={styles.estimateValue}>
                  {estimate.symbol || currency} {Number(estimate.estimatedMin || 0).toLocaleString()} – {Number(estimate.estimatedMax || 0).toLocaleString()}
                </Text>
                {estimate.marketAverage ? <Text style={styles.estimateMeta}>Average {estimate.symbol || currency} {Number(estimate.marketAverage).toLocaleString()}</Text> : null}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.eyebrow}>STEP 3 OF 3</Text>
            <Text style={styles.heroTitle}>Make the listing trustworthy.</Text>

            <TouchableOpacity activeOpacity={0.8} onPress={pickPhotos} style={styles.photoUpload}>
              {photoUploading ? <ActivityIndicator color={v3.colors.ink} /> : <Camera size={28} color={v3.colors.ink} weight="fill" />}
              <Text style={styles.photoTitle}>{photoUploading ? 'Uploading…' : 'Add property photos'}</Text>
              <Text style={styles.photoMeta}>{photos.length}/10 uploaded</Text>
            </TouchableOpacity>

            {photos.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
                {photos.map((uri) => (
                  <View key={uri} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photo} />
                    <TouchableOpacity onPress={() => setPhotos((current) => current.filter((item) => item !== uri))} style={styles.removePhoto}>
                      <X size={12} color={v3.colors.paper} weight="bold" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <Field label="CONTACT NAME" value={form.contactName} onChangeText={(v: string) => update('contactName', v)} placeholder="Your name" />
            <Field label="PHONE" value={form.contactPhone} onChangeText={(v: string) => update('contactPhone', v)} placeholder="+94..." keyboardType="phone-pad" />

            <View style={styles.reviewCard}>
              <View style={styles.reviewIcon}><Check size={18} color={v3.colors.success} weight="bold" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewTitle}>Ready for review</Text>
                <Text style={styles.reviewMeta}>MaintainEX will review the listing before it becomes public.</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.footerButtons}>
          {step > 0 ? (
            <TouchableOpacity style={styles.secondary} onPress={() => setStep((step - 1) as 0 | 1 | 2)}>
              <Text style={styles.secondaryText}>Back</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            activeOpacity={0.82}
            disabled={loading || photoUploading}
            onPress={step === 2 ? submit : next}
            style={[styles.primary, (loading || photoUploading) && { opacity: 0.5 }]}
          >
            {loading ? <ActivityIndicator color={v3.colors.paper} /> : (
              <>
                <Text style={styles.primaryText}>{step === 2 ? 'Submit listing' : 'Continue'}</Text>
                {step < 2 ? <CaretRight size={18} color={v3.colors.paper} weight="bold" /> : null}
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Field(props: any) {
  return (
    <View style={[styles.field, props.compact && { flex: 1 }]}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={v3.colors.textPlaceholder}
        multiline={props.multiline}
        keyboardType={props.keyboardType}
        style={[styles.input, props.multiline && styles.textArea]}
      />
    </View>
  )
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label.charAt(0).toUpperCase() + label.slice(1)}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  progress: { paddingHorizontal: 18, flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: v3.colors.line },
  progressBarActive: { backgroundColor: v3.colors.ink },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 36 },
  eyebrow: { fontFamily: 'Outfit_800ExtraBold', fontSize: 10, color: v3.colors.textMuted, letterSpacing: 0.9 },
  heroTitle: { marginTop: 6, marginBottom: 20, fontFamily: 'Outfit_900Black', fontSize: 26, lineHeight: 32, color: v3.colors.ink },
  field: { marginBottom: 12 },
  label: { marginBottom: 6, fontFamily: 'Outfit_800ExtraBold', fontSize: 9.5, color: v3.colors.textMuted, letterSpacing: 0.7 },
  input: { minHeight: 52, borderRadius: 14, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, paddingHorizontal: 13, fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: v3.colors.ink },
  textArea: { minHeight: 100, paddingTop: 13, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { height: 38, paddingHorizontal: 13, borderRadius: 12, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, justifyContent: 'center' },
  chipSelected: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  chipText: { fontFamily: 'Outfit_700Bold', fontSize: 11.5, color: v3.colors.ink },
  chipTextSelected: { color: v3.colors.paper },
  twoCol: { flexDirection: 'row', gap: 10 },
  threeCol: { flexDirection: 'row', gap: 8 },
  switchCard: { minHeight: 66, marginBottom: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchTitle: { fontFamily: 'Outfit_700Bold', fontSize: 13, color: v3.colors.ink },
  switchMeta: { marginTop: 2, fontFamily: 'Outfit_400Regular', fontSize: 10.5, color: v3.colors.textSecondary },
  estimateButton: { marginTop: 4, height: 50, borderRadius: 14, backgroundColor: v3.colors.amberSoft, borderWidth: 1, borderColor: '#F2D08C', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  estimateText: { fontFamily: 'Outfit_700Bold', fontSize: 12.5, color: v3.colors.ink },
  estimateCard: { marginTop: 10, padding: 16, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  estimateLabel: { fontFamily: 'Outfit_800ExtraBold', fontSize: 9.5, color: v3.colors.amberDark, letterSpacing: 0.8 },
  estimateValue: { marginTop: 5, fontFamily: 'Outfit_900Black', fontSize: 19, color: v3.colors.ink },
  estimateMeta: { marginTop: 3, fontFamily: 'Outfit_400Regular', fontSize: 11, color: v3.colors.textSecondary },
  photoUpload: { minHeight: 160, borderRadius: 18, backgroundColor: v3.colors.amberSoft, borderWidth: 1.5, borderColor: '#F2D08C', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  photoTitle: { marginTop: 8, fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: v3.colors.ink },
  photoMeta: { marginTop: 3, fontFamily: 'Outfit_400Regular', fontSize: 11, color: v3.colors.textSecondary },
  photoStrip: { gap: 9, paddingVertical: 12 },
  photoWrap: { width: 84, height: 84, borderRadius: 14, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  reviewCard: { marginTop: 5, minHeight: 72, padding: 14, borderRadius: 16, backgroundColor: v3.colors.successSoft, flexDirection: 'row', alignItems: 'center' },
  reviewIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: v3.colors.paper, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  reviewTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 13, color: v3.colors.ink },
  reviewMeta: { marginTop: 2, fontFamily: 'Outfit_400Regular', fontSize: 10.5, lineHeight: 15, color: v3.colors.textSecondary },
  footerButtons: { marginTop: 20, flexDirection: 'row', gap: 10 },
  secondary: { flex: 0.35, height: 56, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: v3.colors.ink },
  primary: { flex: 1, height: 56, borderRadius: 16, backgroundColor: v3.colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: v3.colors.paper },
})
