import { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { colors, typography, shadows, animations } from '../../lib/theme'

type Role = 'tasker' | 'company'

interface Props {
  role: Role
  active: string
  onPress: (tab: string) => void
  unreadMessages?: number
}

function TabButton({
  icon,
  label,
  isActive,
  isFab,
  unread,
  onPress,
}: {
  icon: string
  label: string
  isActive: boolean
  isFab?: boolean
  unread?: boolean
  onPress: () => void
}) {
  const scale = useSharedValue(1)

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.18 : 1, animations.spring)
  }, [isActive, scale])

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  if (isFab) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.fabWrap}>
        <View style={[styles.fab, { shadowColor: colors.accent }]}>
          <Ionicons name="add" size={26} color={colors.background} />
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      key={icon}
      style={styles.tab}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ position: 'relative' }}>
        <Animated.View style={animatedStyle}>
          <Ionicons name={icon as any} size={22} color={isActive ? colors.accent : colors.textSecondary} />
        </Animated.View>
        {unread && <View style={styles.pip} />}
      </View>
      <Text style={[styles.label, { color: isActive ? colors.accent : colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      {isActive ? <View style={styles.underline} /> : null}
    </TouchableOpacity>
  )
}

export default function BottomNav({ role, active, onPress, unreadMessages = 0 }: Props) {
  const { t } = useTranslation()

  const TASKER_TABS = [
    { id: 'home', label: t('customer.browse'), icon: 'home-outline' },
    { id: 'explore', label: t('tasker.findWork'), icon: 'search-outline' },
    { id: 'fab', label: '', icon: 'add' },
    { id: 'chat', label: t('home.chat'), icon: 'chatbubble-outline' },
    { id: 'profile', label: t('profile.title'), icon: 'person-circle-outline' },
  ]

  const COMPANY_TABS = [
    { id: 'home', label: t('company.dashboard'), icon: 'home-outline' },
    { id: 'jobs', label: t('company.contracts'), icon: 'document-text-outline' },
    { id: 'fab', label: '', icon: 'add' },
    { id: 'chat', label: t('home.chat'), icon: 'chatbubble-outline' },
    { id: 'company', label: t('company.profile'), icon: 'business-outline' },
  ]

  const tabs = role === 'tasker' ? TASKER_TABS : COMPANY_TABS

  return (
    <View style={[styles.bar, shadows.card]}>
      {tabs.map(tab => (
        <TabButton
          key={tab.id}
          icon={tab.icon}
          label={tab.label}
          isFab={tab.id === 'fab'}
          isActive={active === tab.id}
          unread={tab.id === 'chat' && unreadMessages > 0}
          onPress={() => onPress(tab.id)}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
  },
  fabWrap: { flex: 1, alignItems: 'center' },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  pip: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  underline: { width: 18, height: 3, borderRadius: 2, backgroundColor: colors.accent, position: 'absolute', bottom: -2 },
  label: { ...typography.caption, fontFamily: 'Outfit_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.4 },
})