import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { v2Identity } from '@/api/v2-identity'
import { upload } from '@/api/upload'
import { resolveImageUri } from '@/api/client'

type PhotoStatus = Awaited<ReturnType<typeof v2Identity.getPhotoChangeStatus>>

export default function VerifiedWorkerPhotoScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [status, setStatus] = useState<PhotoStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await v2Identity.getPhotoChangeStatus()
      setStatus(data)
    } catch (error: any) {
      Alert.alert('Unable to load verified photo', error?.message || 'Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      load()
    }, [load])
  )

  const submitNewPhoto = async () => {
    if (status?.pendingRequest) {
      Alert.alert(
        'Review already pending',
        'MaintainEX is already reviewing your new worker photo. Your current approved photo stays active until that review is complete.',
      )
      return
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (permission.status !== 'granted') {
      Alert.alert('Camera permission required', 'Use the camera to submit a current verified worker photo.')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })
    if (result.canceled || !result.assets[0]) return

    setSubmitting(true)
    try {
      const { url } = await upload.file(result.assets[0].uri, 'avatar')
      await v2Identity.requestPhotoChange(
        url,
        'Provider requested an updated verified public worker photo',
      )
      await load()
      Alert.alert(
        'Submitted for verification',
        'MaintainEX will compare the new photo with your protected identity record. Your current approved photo remains public until approval.',
      )
    } catch (error: any) {
      Alert.alert('Could not submit photo', error?.message || 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 64 }} />
      </SafeAreaView>
    )
  }

  const currentPhoto = status?.verifiedPhotoUrl
    ? resolveImageUri(status.verifiedPhotoUrl) || status.verifiedPhotoUrl
    : null
  const pendingPhoto = status?.pendingRequest?.requestedPhotoUrl
    ? resolveImageUri(status.pendingRequest.requestedPhotoUrl) || status.pendingRequest.requestedPhotoUrl
    : null

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.title}>Verified worker photo</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.amberDark} />
          <Text style={styles.infoText}>
            This photo is shown to customers before work starts. After identity verification it cannot be replaced directly; every change is reviewed by MaintainEX.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Current approved photo</Text>
        <View style={styles.photoCard}>
          {currentPhoto ? (
            <Image source={{ uri: currentPhoto }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.placeholder]}>
              <Ionicons name="person-outline" size={48} color={colors.muted} />
              <Text style={styles.placeholderText}>No approved public worker photo yet</Text>
            </View>
          )}
          <View style={styles.badgeRow}>
            <Ionicons
              name={currentPhoto ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={currentPhoto ? colors.success : colors.amberDark}
            />
            <Text style={[styles.badgeText, { color: currentPhoto ? colors.success : colors.amberDark }]}>
              {currentPhoto ? 'Identity-controlled photo' : 'Photo approval required'}
            </Text>
          </View>
        </View>

        {pendingPhoto && (
          <>
            <Text style={styles.sectionTitle}>Pending review</Text>
            <View style={styles.photoCard}>
              <Image source={{ uri: pendingPhoto }} style={styles.photo} />
              <View style={styles.pendingBox}>
                <Ionicons name="hourglass-outline" size={16} color={colors.amberDark} />
                <Text style={styles.pendingText}>
                  MaintainEX is reviewing this photo. Customers still see your current approved photo.
                </Text>
              </View>
            </View>
          </>
        )}

        {!status?.identityVerified && (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={18} color={colors.error} />
            <Text style={styles.warningText}>
              Complete identity verification before submitting a verified worker photo.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            (!status?.identityVerified || submitting || Boolean(status?.pendingRequest)) && styles.buttonDisabled,
          ]}
          onPress={submitNewPhoto}
          disabled={!status?.identityVerified || submitting || Boolean(status?.pendingRequest)}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={20} color={colors.ink} />
              <Text style={styles.buttonText}>
                {status?.pendingRequest ? 'Review pending' : currentPhoto ? 'Request photo change' : 'Submit verified photo'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.ink },
  infoCard: {
    flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14,
    backgroundColor: colors.amberBg, borderWidth: 1, borderColor: colors.amberLight, marginBottom: 24,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.ink, fontFamily: fonts.body },
  sectionTitle: { fontSize: 14, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 8, marginTop: 8 },
  photoCard: {
    backgroundColor: colors.white, padding: 14, borderRadius: 16, borderWidth: 1,
    borderColor: colors.border, marginBottom: 18,
  },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 14, backgroundColor: colors.surface },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderText: { fontSize: 12, color: colors.muted, fontFamily: fonts.bodyMedium },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  badgeText: { fontSize: 12, fontFamily: fonts.bodyMedium },
  pendingBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12,
    backgroundColor: colors.amberBg, borderRadius: 10, padding: 10,
  },
  pendingText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.amberDark, fontFamily: fonts.body },
  warningBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error, marginBottom: 16,
  },
  warningText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.error, fontFamily: fonts.bodyMedium },
  button: {
    minHeight: 50, borderRadius: 14, backgroundColor: colors.amber,
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.ink },
})
