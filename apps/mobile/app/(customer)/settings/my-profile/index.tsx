import { useEffect, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { User, Envelope, Phone, Briefcase, CalendarBlank } from 'phosphor-react-native'
import { useAuth } from '../../../../lib/auth'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../lib/ThemeContext'

export default function MyProfileScreen() {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = makeStyles(colors)
  const { user } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [fadeAnim])

  if (!user) return null

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A'

  const roleLabel =
    user.role === 'CUSTOMER' ? t('profile.customer') :
    user.role === 'TASKER' ? t('profile.tasker') :
    t('profile.company')

  const fields = [
    { label: t('profile.fullName'), value: user.name, Icon: User },
    { label: t('profile.email'), value: user.email, Icon: Envelope },
    { label: t('profile.phone'), value: user.phone || t('profile.notSet'), Icon: Phone },
    { label: t('profile.role'), value: roleLabel, Icon: Briefcase },
    { label: t('profile.memberSince'), value: memberSince, Icon: CalendarBlank },
  ]

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>{t('profile.myProfile')}</Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userRole}>{roleLabel}</Text>
          </View>

          <View style={styles.card}>
            {fields.map((f, i) => (
              <View key={f.label} style={[styles.row, i === fields.length - 1 && styles.lastRow]}>
                <View style={styles.iconWrap}>
                  <f.Icon size={20} color={colors.amberDark} weight="fill" />
                </View>
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <Text style={styles.fieldValue}>{f.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heading: { fontSize: 28, fontFamily: 'Outfit_900Black', color: colors.ink, paddingHorizontal: 24, marginBottom: 16 },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.amber,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontFamily: 'Outfit_700Bold', color: colors.ink },
  userName: { fontSize: 20, fontFamily: 'Outfit_900Black', color: colors.ink },
  userRole: { fontSize: 13, color: colors.muted, marginTop: 2, fontFamily: 'Outfit_500Medium' },
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: 4, marginBottom: 24,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.amberBg, alignItems: 'center', justifyContent: 'center' },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: colors.muted, textTransform: 'uppercase' },
  fieldValue: { fontSize: 15, fontFamily: 'Outfit_600SemiBold', color: colors.ink, marginTop: 2 },
})
