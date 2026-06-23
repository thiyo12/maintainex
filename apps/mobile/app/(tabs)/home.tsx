import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../lib/ThemeContext'
import { useAuth } from '../../lib/auth'
import { fonts } from '../../lib/fonts'
import { fontSizes } from '../../lib/tokens'
import { spacing, borderRadius } from '../../lib/tokens'
import { useTranslation } from 'react-i18next'

export default function HomeScreen() {
  const { t } = useTranslation()
  const colors = useColors()
    const styles = makeStyles(colors)
  const { user } = useAuth()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.ink }]}>
          {t('home.greeting.morning')}, {user?.name?.split(' ')[0] || t('home.user')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {t('home.whatDoYouNeed')}
        </Text>
      </View>
      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name="sparkles" size={24} color={colors.amber} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.ink }]}>{t('welcomeOnboarding.heading')}</Text>
          <Text style={[styles.cardSub, { color: colors.muted }]}>
            {t('postJob.publishedMsg')}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  greeting: { fontSize: fontSizes.h2, fontFamily: fonts.heading, letterSpacing: -0.3 },
  subtitle: { fontSize: fontSizes.body, fontFamily: fonts.body, marginTop: spacing.xs },
  content: { paddingHorizontal: spacing.xl },
  card: {
    borderRadius: borderRadius.card,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: borderRadius.iconBox,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: { fontSize: fontSizes.h3, fontFamily: fonts.headingBold },
  cardSub: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body, textAlign: 'center', lineHeight: 20 },
})
