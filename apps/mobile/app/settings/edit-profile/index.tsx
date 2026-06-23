import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { useAuth } from '../../../lib/auth'
import { fonts } from '../../../lib/fonts'
import { fontSizes } from '../../../lib/tokens'
import { spacing, borderRadius } from '../../../lib/tokens'
import { useTranslation } from 'react-i18next'

export default function EditProfileScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useColors()
    const styles = makeStyles(colors)
  const { user } = useAuth()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.ink }]}>{t('profile.editProfileHeader')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>{t('profile.paymentComingSoon')}</Text>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  title: { fontSize: fontSizes.h3, fontFamily: fonts.headingBold },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  fieldLabel: { fontSize: fontSizes.body, fontFamily: fonts.body },
})
