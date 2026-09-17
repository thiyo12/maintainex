import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Switch, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretLeft, Sparkle, Camera } from 'phosphor-react-native'
import { useTheme } from '../../lib/ThemeContext'
import { useCountry } from '../../lib/country'
import { realEstate } from '../../lib/api'
import { fonts } from '../../lib/fonts'
import { spacing, fontSizes } from '../../lib/tokens'

const PROPERTY_TYPES = ['house', 'apartment', 'commercial', 'land', 'rental']
const PURPOSES = ['sale', 'rent', 'commercial', 'land']

export default function UploadProperty() {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { selectedCountry } = useCountry()

  const [loading, setLoading] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [estimate, setEstimate] = useState<any>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    propertyType: 'house',
    purpose: 'sale',
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

  const currency = form.countryCode === 'CA' ? 'CAD' : 'Rs.'

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }))

  const handleEstimate = async () => {
    if (!form.propertyType || !form.purpose) {
      Alert.alert('Missing Info', 'Select property type and purpose first')
      return
    }
    setEstimating(true)
    try {
      const result = await realEstate.priceEstimate({
        countryCode: form.countryCode,
        district: form.district,
        city: form.city,
        propertyType: form.propertyType,
        purpose: form.purpose,
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : undefined,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : undefined,
        areaSqft: form.areaSqft ? parseInt(form.areaSqft) : undefined,
        landSize: form.landSize ? parseInt(form.landSize) : undefined,
        isFurnished: form.isFurnished,
        isNewProperty: form.isNewProperty,
      })
      setEstimate(result)
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to estimate price')
    } finally {
      setEstimating(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) return Alert.alert('Missing', 'Title is required')
    if (!form.priceLkr || parseFloat(form.priceLkr) <= 0) return Alert.alert('Missing', 'Valid price is required')

    setLoading(true)
    try {
      const data = {
        ...form,
        priceLkr: parseFloat(form.priceLkr),
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
        parking: form.parking ? parseInt(form.parking) : null,
        areaSqft: form.areaSqft ? parseInt(form.areaSqft) : null,
        landSize: form.landSize ? parseInt(form.landSize) : null,
        yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : null,
      }

      await realEstate.create(data)
      Alert.alert('Submitted!', 'Your listing has been submitted for review. You will be notified once approved.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit listing')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <CaretLeft size={22} color={colors.ink} weight="regular" />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.ink }]}>List Property</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Basic Info */}
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>Basic Info</Text>
        <TextInput style={[styles.input, { borderColor: colors.border, color: colors.ink }]} placeholder="Property title" placeholderTextColor={colors.muted} value={form.title} onChangeText={v => update('title', v)} />
        <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.ink }]} placeholder="Description" placeholderTextColor={colors.muted} value={form.description} onChangeText={v => update('description', v)} multiline numberOfLines={4} />

        {/* Property Type */}
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>Property Type</Text>
        <View style={styles.chipRow}>
          {PROPERTY_TYPES.map(t => (
            <TouchableOpacity key={t} style={[styles.chip, form.propertyType === t && { backgroundColor: colors.amber, borderColor: colors.amber }]} onPress={() => update('propertyType', t)}>
              <Text style={[styles.chipText, { color: form.propertyType === t ? '#111' : colors.muted }]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Purpose */}
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>Purpose</Text>
        <View style={styles.chipRow}>
          {PURPOSES.map(p => (
            <TouchableOpacity key={p} style={[styles.chip, form.purpose === p && { backgroundColor: colors.amber, borderColor: colors.amber }]} onPress={() => update('purpose', p)}>
              <Text style={[styles.chipText, { color: form.purpose === p ? '#111' : colors.muted }]}>{p === 'land' ? 'Land Sale' : p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Location */}
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>Location</Text>
        <View style={styles.chipRow}>
          {['LK', 'CA'].map(code => (
            <TouchableOpacity key={code} style={[styles.chip, form.countryCode === code && { backgroundColor: colors.amber, borderColor: colors.amber }]} onPress={() => update('countryCode', code)}>
              <Text style={[styles.chipText, { color: form.countryCode === code ? '#111' : colors.muted }]}>{code === 'LK' ? 'Sri Lanka' : 'Canada'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={[styles.input, { borderColor: colors.border, color: colors.ink }]} placeholder="District" placeholderTextColor={colors.muted} value={form.district} onChangeText={v => update('district', v)} />
        <TextInput style={[styles.input, { borderColor: colors.border, color: colors.ink }]} placeholder="City" placeholderTextColor={colors.muted} value={form.city} onChangeText={v => update('city', v)} />
        <TextInput style={[styles.input, { borderColor: colors.border, color: colors.ink }]} placeholder="Area" placeholderTextColor={colors.muted} value={form.area} onChangeText={v => update('area', v)} />
        <TextInput style={[styles.input, { borderColor: colors.border, color: colors.ink }]} placeholder="Full address" placeholderTextColor={colors.muted} value={form.address} onChangeText={v => update('address', v)} />

        {/* Specs */}
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>Property Details</Text>
        <View style={styles.specRow}>
          <TextInput style={[styles.input, styles.specInput, { borderColor: colors.border, color: colors.ink }]} placeholder="Bedrooms" placeholderTextColor={colors.muted} keyboardType="numeric" value={form.bedrooms} onChangeText={v => update('bedrooms', v)} />
          <TextInput style={[styles.input, styles.specInput, { borderColor: colors.border, color: colors.ink }]} placeholder="Bathrooms" placeholderTextColor={colors.muted} keyboardType="numeric" value={form.bathrooms} onChangeText={v => update('bathrooms', v)} />
          <TextInput style={[styles.input, styles.specInput, { borderColor: colors.border, color: colors.ink }]} placeholder="Parking" placeholderTextColor={colors.muted} keyboardType="numeric" value={form.parking} onChangeText={v => update('parking', v)} />
        </View>
        <View style={styles.specRow}>
          <TextInput style={[styles.input, styles.specInput, { borderColor: colors.border, color: colors.ink }]} placeholder="Size (sqft)" placeholderTextColor={colors.muted} keyboardType="numeric" value={form.areaSqft} onChangeText={v => update('areaSqft', v)} />
          <TextInput style={[styles.input, styles.specInput, { borderColor: colors.border, color: colors.ink }]} placeholder="Land size (sqft)" placeholderTextColor={colors.muted} keyboardType="numeric" value={form.landSize} onChangeText={v => update('landSize', v)} />
          <TextInput style={[styles.input, styles.specInput, { borderColor: colors.border, color: colors.ink }]} placeholder="Year built" placeholderTextColor={colors.muted} keyboardType="numeric" value={form.yearBuilt} onChangeText={v => update('yearBuilt', v)} />
        </View>

        <View style={styles.switchRow}>
          <Text style={{ color: colors.ink, fontFamily: fonts.body }}>Furnished</Text>
          <Switch value={form.isFurnished} onValueChange={v => update('isFurnished', v)} trackColor={{ true: colors.amber }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={{ color: colors.ink, fontFamily: fonts.body }}>New Property</Text>
          <Switch value={form.isNewProperty} onValueChange={v => update('isNewProperty', v)} trackColor={{ true: colors.amber }} />
        </View>

        {/* Price */}
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>Price ({currency})</Text>
        <TextInput style={[styles.input, { borderColor: colors.border, color: colors.ink }]} placeholder={`${currency} price`} placeholderTextColor={colors.muted} keyboardType="numeric" value={form.priceLkr} onChangeText={v => update('priceLkr', v)} />

        {/* AI Estimate */}
        <TouchableOpacity style={[styles.estimateBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleEstimate} disabled={estimating}>
          {estimating ? <ActivityIndicator size="small" color={colors.amber} /> : <Sparkle size={16} color={colors.amber} weight="fill" />}
          <Text style={[styles.estimateBtnText, { color: colors.amber }]}>Check Market Price</Text>
        </TouchableOpacity>

        {estimate && (
          <View style={[styles.estimateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.estimateTitle, { color: colors.ink }]}>AI Price Estimate</Text>
            <Text style={[styles.estimatePrice, { color: colors.amber }]}>
              {estimate.symbol} {estimate.estimatedMin?.toLocaleString()} - {estimate.estimatedMax?.toLocaleString()}
            </Text>
            <Text style={[styles.estimateSub, { color: colors.muted }]}>Market average: {estimate.symbol} {estimate.marketAverage?.toLocaleString()}</Text>
            <View style={[styles.confidenceBadge, { backgroundColor: estimate.confidence === 'high' ? '#10B981' : estimate.confidence === 'medium' ? '#F5A623' : '#EF4444' }]}>
              <Text style={styles.confidenceText}>{estimate.confidence} confidence</Text>
            </View>
          </View>
        )}

        {/* Photos */}
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>Photos (Up to 10)</Text>
        <TouchableOpacity style={[styles.photoUpload, { backgroundColor: colors.surface, borderColor: colors.border, borderStyle: 'dashed' }]}>
          <Camera size={32} color={colors.muted} weight="regular" />
          <Text style={[styles.photoUploadText, { color: colors.muted }]}>Add property photos</Text>
          <Text style={[styles.photoUploadSub, { color: colors.muted }]}>Upload from gallery</Text>
        </TouchableOpacity>

        {/* Contact */}
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>Contact Info</Text>
        <TextInput style={[styles.input, { borderColor: colors.border, color: colors.ink }]} placeholder="Contact name" placeholderTextColor={colors.muted} value={form.contactName} onChangeText={v => update('contactName', v)} />
        <TextInput style={[styles.input, { borderColor: colors.border, color: colors.ink }]} placeholder="Phone number" placeholderTextColor={colors.muted} keyboardType="phone-pad" value={form.contactPhone} onChangeText={v => update('contactPhone', v)} />

        {/* Submit */}
        <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.amber }]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#111" /> : <Text style={styles.submitText}>Post Property Listing</Text>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  backBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  title: { fontSize: fontSizes.h2, fontFamily: fonts.heading },
  scroll: { flex: 1, paddingHorizontal: spacing.xl },
  sectionTitle: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: fontSizes.body, fontFamily: fonts.body, marginBottom: spacing.sm },
  textArea: { height: 100, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipText: { fontSize: fontSizes.captionSmall, fontFamily: fonts.bodyMedium },
  specRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  specInput: { flex: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  estimateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginBottom: spacing.md },
  estimateBtnText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium },
  estimateCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: spacing.md },
  estimateTitle: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, marginBottom: 4 },
  estimatePrice: { fontSize: fontSizes.h2, fontFamily: fonts.heading, marginBottom: 4 },
  estimateSub: { fontSize: fontSizes.caption, fontFamily: fonts.body, marginBottom: 8 },
  confidenceBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  confidenceText: { color: '#fff', fontSize: 11, fontFamily: fonts.bodyMedium },
  photoUpload: { borderWidth: 2, borderRadius: 16, paddingVertical: 40, alignItems: 'center', gap: 6, marginBottom: spacing.md },
  photoUploadText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium },
  photoUploadSub: { fontSize: fontSizes.captionSmall, fontFamily: fonts.body },
  submitBtn: { paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: spacing.lg },
  submitText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: '#111' },
})
